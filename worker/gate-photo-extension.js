/* Private visitor / pickup photo storage for Gate QR.
   Same D1 database; photos are kept out of neo_portal_records JSON so normal lists stay small.
   Router integration:
   const gatePhotoResponse = await gatePhotoPortal(request, env, url);
   if (gatePhotoResponse) return gatePhotoResponse;
*/
async function gatePhotoPortal(request,env,url){
 if(!url.pathname.startsWith('/api/gate-photo/'))return null;
 const out=(body,status=200)=>json(body,status,request);
 try{
  await ensurePortalSchema(env);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS neo_gate_photos(school_id TEXT NOT NULL,kind TEXT NOT NULL,record_id TEXT NOT NULL,created_at TEXT NOT NULL,photo BLOB NOT NULL,PRIMARY KEY(school_id,kind,record_id))").run();
  const parts=url.pathname.split('/').filter(Boolean),scope=parts[2]||'';
  const readBody=async()=>{const raw=await request.text();if(raw.length>210000)throw new TypeError('Photo must be under 150 KB.');let b;try{b=JSON.parse(raw||'{}')}catch{throw new TypeError('Valid JSON is required.')}if(!b||typeof b!=='object'||Array.isArray(b))throw new TypeError('Invalid request.');return b};
  const photoBytes=value=>{const photo=typeof value==='string'?value:'';if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)||photo.length>205000)throw new TypeError('Capture a JPEG photo under 150 KB.');const bytes=Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0));if(bytes.length<4||bytes.length>150000||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new TypeError('Upload a valid JPEG photo under 150 KB.');return bytes};
  const kindFor=type=>type==='visitor'?'gate_visitors':type==='pickup'?'gate_pickups':'';
  const image=async(school,kind,id)=>{const row=await env.DB.prepare('SELECT photo FROM neo_gate_photos WHERE school_id=? AND kind=? AND record_id=?').bind(school,kind,id).first();if(!row)return out({error:'Photo not found.'},404);return new Response(new Uint8Array(row.photo),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...cors(request)}})};
  const save=async(school,kind,id,photo,actor)=>{const bytes=photoBytes(photo),record=await portalRecord(env,school,kind,id);if(!record)return out({error:'Gate record not found.'},404);const next={...record,has_photo:true};delete next.id;delete next.created_at;const now=new Date().toISOString();await env.DB.batch([env.DB.prepare("INSERT INTO neo_gate_photos(school_id,kind,record_id,created_at,photo) VALUES (?,?,?,?,?) ON CONFLICT(school_id,kind,record_id) DO UPDATE SET created_at=excluded.created_at,photo=excluded.photo").bind(school,kind,id,now,bytes),env.DB.prepare('UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind=? AND id=?').bind(JSON.stringify(next),school,kind,id),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,actor,'POST:gate-photo',id),env.DB.prepare("DELETE FROM neo_gate_photos WHERE datetime(created_at)<datetime('now','-30 days')")]);return out({success:true,has_photo:true},201)};

  if(scope==='public'){
   const school=decodeURIComponent(parts[3]||''),type=parts[4]||'',id=decodeURIComponent(parts[5]||''),kind=kindFor(type);if(!school||!kind||!id)return out({error:'Invalid gate photo request.'},404);const b=await readBody(),token=typeof b.public_token==='string'?b.public_token.trim():'';const record=await portalRecord(env,school,kind,id);if(!record||!token||record.public_token!==token)return out({error:'Photo not found.'},404);if(request.method!=='POST')return out({error:'Method not allowed.'},405);if(b.photo){const closed=type==='visitor'?['Exited','Rejected'].includes(record.status):['Released','Rejected','Parent rejected'].includes(record.status);if(closed)return out({error:'This gate request is already closed.'},409);return save(school,kind,id,b.photo,'public-gate')}return image(school,kind,id);
  }

  if(scope==='parent'){
   if(request.method!=='GET')return out({error:'Method not allowed.'},405);const parent=await parentSession(request,env);if(!parent)return out({error:'Parent sign in required.'},401);const id=decodeURIComponent(parts[3]||''),record=id&&await portalRecord(env,parent.school_id,'gate_pickups',id);if(!record||record.student_id!==parent.student_id)return out({error:'Photo not found.'},404);return image(parent.school_id,'gate_pickups',id);
  }

  if(scope==='school'){
   const school=decodeURIComponent(parts[3]||''),type=parts[4]||'',id=decodeURIComponent(parts[5]||''),kind=kindFor(type);if(!school||!kind||!id)return out({error:'Invalid gate photo request.'},404);const admin=await requireAdmin(request,env),session=admin?null:await schoolSession(request,env);if(!admin&&!session)return out({error:'School sign in required.'},401);if(!admin&&session.school_id!==school)return out({error:'Access denied.'},403);const record=await portalRecord(env,school,kind,id);if(!record)return out({error:'Photo not found.'},404);if(request.method==='GET')return image(school,kind,id);if(request.method==='POST'){const b=await readBody();if(!b.photo)throw new TypeError('Choose a photo.');return save(school,kind,id,b.photo,admin?'head-office':'school:'+school)}return out({error:'Method not allowed.'},405);
  }
  return out({error:'Not found.'},404);
 }catch(e){if(e instanceof TypeError)return out({error:e.message},400);console.error('Gate photo error',e);return out({error:'Gate photo service is temporarily unavailable.'},503)}
}

/* Neo School India admission workflow extension.
   Parent enquiry -> secure admission link -> parent form/documents -> school verification -> Student Master.
*/
const ADMISSION_SCHEMA=[
 `CREATE TABLE IF NOT EXISTS neo_admission_applications (
   id TEXT PRIMARY KEY,
   school_id TEXT NOT NULL,
   enquiry_id TEXT NOT NULL,
   token_hash TEXT,
   token_expires TEXT,
   status TEXT NOT NULL DEFAULT 'Admission Invited',
   data TEXT NOT NULL,
   correction_note TEXT,
   student_id TEXT,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   UNIQUE(school_id,enquiry_id)
 )`,
 `CREATE INDEX IF NOT EXISTS neo_admission_school_status ON neo_admission_applications(school_id,status,updated_at DESC)`,
 `CREATE TABLE IF NOT EXISTS neo_admission_documents (
   id TEXT PRIMARY KEY,
   application_id TEXT NOT NULL,
   school_id TEXT NOT NULL,
   doc_type TEXT NOT NULL,
   file_name TEXT NOT NULL,
   mime_type TEXT NOT NULL,
   body BLOB NOT NULL,
   size_bytes INTEGER NOT NULL,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   UNIQUE(application_id,doc_type)
 )`
];
const admissionSchemaReady=new WeakMap();
async function ensureAdmissionSchema(env){
 if(!admissionSchemaReady.has(env.DB)){
  const p=env.DB.batch(ADMISSION_SCHEMA.map(x=>env.DB.prepare(x))).catch(e=>{admissionSchemaReady.delete(env.DB);throw e});
  admissionSchemaReady.set(env.DB,p);
 }
 await admissionSchemaReady.get(env.DB);
}
async function admissionHash(value){
 const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value||'')));
 return base64urlEncode(new Uint8Array(raw));
}
function admissionToken(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')}
function admissionPublicUrl(token){return 'https://neoschoolindia.com/admission-form.html?token='+encodeURIComponent(token)}
function admissionEnquiryUrl(school){return 'https://neoschoolindia.com/admission-enquiry.html?school='+encodeURIComponent(school)}
function admissionClean(v,max=200){return typeof v==='string'?v.trim().slice(0,max):''}
function admissionValidDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v}
function admissionValidMobile(v){const x=String(v||'').trim();return /^\+?[0-9 ()-]{8,20}$/.test(x)&&x.replace(/\D/g,'').length>=10&&x.replace(/\D/g,'').length<=15}
function admissionYear(v){const m=String(v||'').match(/20\d{2}/);return m?m[0]:''}
async function admissionAppRow(env,school,enquiry){
 const r=await env.DB.prepare('SELECT * FROM neo_admission_applications WHERE school_id=? AND enquiry_id=? LIMIT 1').bind(school,enquiry).first();
 return r?{...r,data:JSON.parse(r.data||'{}')}:null;
}
async function admissionAppById(env,school,id){
 const r=await env.DB.prepare('SELECT * FROM neo_admission_applications WHERE school_id=? AND id=? LIMIT 1').bind(school,id).first();
 return r?{...r,data:JSON.parse(r.data||'{}')}:null;
}
async function admissionDocs(env,appId){
 const r=await env.DB.prepare('SELECT id,doc_type,file_name,mime_type,size_bytes,created_at FROM neo_admission_documents WHERE application_id=? ORDER BY created_at').bind(appId).all();
 return r.results||[];
}
async function admissionPublicApp(env,token){
 const hash=await admissionHash(token),row=await env.DB.prepare("SELECT * FROM neo_admission_applications WHERE token_hash=? LIMIT 1").bind(hash).first();
 if(!row)return null;
 if(row.token_expires&&Date.parse(row.token_expires)<Date.now())return {expired:true};
 return {...row,data:JSON.parse(row.data||'{}')};
}
async function admissionIssueToken(env,appId){
 const token=admissionToken(),hash=await admissionHash(token),expires=new Date(Date.now()+14*86400000).toISOString();
 await env.DB.prepare('UPDATE neo_admission_applications SET token_hash=?,token_expires=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(hash,expires,appId).run();
 return {token,parent_url:admissionPublicUrl(token),expires};
}
async function admissionUpdateEnquiry(env,school,enquiryId,patch){
 const old=await portalRecord(env,school,'enquiries',enquiryId);if(!old)return;
 const next={...old,...patch};delete next.id;delete next.created_at;
 await env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='enquiries' AND id=?").bind(JSON.stringify(next),school,enquiryId).run();
}
function admissionPublicAppShape(app,school,docs){
 return {application_id:app.id,status:app.status,correction_note:app.correction_note||'',school:{name:school?.name||'',city:school?.city||''},data:app.data,documents:docs||[]};
}
function admissionSchoolAppShape(app,docs){return {application_id:app.id,enquiry_id:app.enquiry_id,status:app.status,correction_note:app.correction_note||'',student_id:app.student_id||'',data:app.data,documents:docs||[]}}
function admissionStageData(body,program){
 const out={playgroup_status:'Not applicable',nursery_status:'Not applicable',nursery_school:'',nursery_city:'',nursery_year:'',lkg_status:'Not applicable',lkg_school:'',lkg_city:'',lkg_year:'',previous_school:'',previous_city:''};
 if(program==='Nursery'){
  const p=admissionClean(body.playgroup_status,50);if(!['Completed','Not attended / First school'].includes(p))throw new TypeError('Choose whether Playgroup was completed or this is the child’s first school stage.');out.playgroup_status=p;
 }
 if(program==='LKG'){
  if(admissionClean(body.nursery_status,40)!=='Completed')throw new TypeError('Nursery must be completed before LKG.');
  out.nursery_status='Completed';out.nursery_school=admissionClean(body.nursery_school,200);out.nursery_city=admissionClean(body.nursery_city,120);out.nursery_year=admissionYear(body.nursery_year);
  if(!out.nursery_school||!out.nursery_city||!out.nursery_year)throw new TypeError('Enter Nursery school, city and completion year.');out.previous_school=out.nursery_school;out.previous_city=out.nursery_city;
 }
 if(program==='UKG'){
  if(admissionClean(body.nursery_status,40)!=='Completed'||admissionClean(body.lkg_status,40)!=='Completed')throw new TypeError('Nursery and LKG must be completed before UKG.');
  out.nursery_status='Completed';out.lkg_status='Completed';out.nursery_school=admissionClean(body.nursery_school,200);out.nursery_city=admissionClean(body.nursery_city,120);out.nursery_year=admissionYear(body.nursery_year);out.lkg_school=admissionClean(body.lkg_school,200);out.lkg_city=admissionClean(body.lkg_city,120);out.lkg_year=admissionYear(body.lkg_year);
  if(!out.nursery_school||!out.nursery_city||!out.nursery_year)throw new TypeError('Enter Nursery school, city and completion year.');
  if(!out.lkg_school||!out.lkg_city||!out.lkg_year)throw new TypeError('Enter LKG school, city and completion year.');
  if(Number(out.nursery_year)>Number(out.lkg_year))throw new TypeError('Nursery completion year must not be after LKG completion year.');out.previous_school=out.lkg_school;out.previous_city=out.lkg_city;
 }
 return out;
}
async function admissionWorkflowPortal(request,env,url){
 if(!url.pathname.startsWith('/api/admission-workflow/'))return null;
 const out=(b,s=200)=>json(b,s,request);
 try{
  await ensurePortalSchema(env);await ensureAdmissionSchema(env);
  const publicSchool=url.pathname.match(/^\/api\/admission-workflow\/public\/school\/([^/]+)$/);
  if(publicSchool&&request.method==='GET'){
   const schoolId=decodeURIComponent(publicSchool[1]),s=await env.DB.prepare('SELECT school_id,name,city,active FROM neo_schools WHERE school_id=? AND active=1').bind(schoolId).first();
   if(!s)return out({error:'School is not available for enquiries.'},404);return out({school:s,enquiry_url:admissionEnquiryUrl(schoolId)});
  }
  const publicEnquiry=url.pathname.match(/^\/api\/admission-workflow\/public\/enquiry\/([^/]+)$/);
  if(publicEnquiry&&request.method==='POST'){
   const schoolId=decodeURIComponent(publicEnquiry[1]),s=await env.DB.prepare('SELECT school_id,name,city,active FROM neo_schools WHERE school_id=? AND active=1').bind(schoolId).first();if(!s)return out({error:'School is not available for enquiries.'},404);
   const b=await request.json(),name=admissionClean(b.parent_name||b.name,120),mobile=admissionClean(b.mobile,20),child=admissionClean(b.child_name,120),dob=admissionClean(b.dob,10),program=admissionClean(b.program,40),notes=admissionClean(b.notes,1000);
   if(!name||!admissionValidMobile(mobile)||!child||!admissionValidDate(dob)||dob>neoToday()||!['Playgroup','Nursery','LKG','UKG','Daycare'].includes(program))return out({error:'Check parent name, mobile, child name, date of birth and class of interest.'},400);
   if(b.confirmed!==true)return out({error:'Please confirm the enquiry details before submitting.'},400);
   const id='ENQ_'+crypto.randomUUID().replaceAll('-','').slice(0,24),data={name,mobile,child_name:child,dob,program,follow_up:neoToday(),notes,status:'New',source:'Parent self-enquiry',admission_status:'Enquiry received'};
   await env.DB.batch([env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'enquiries',?,?)").bind(schoolId,id,JSON.stringify(data)),portalAudit(env,schoolId,false,'PUBLIC:parent_enquiry',id)]);
   return out({success:true,enquiry_id:id,message:'Your enquiry has been received. The school will contact you if it proceeds to admission.'},201);
  }
  if(url.pathname==='/api/admission-workflow/public/application'&&request.method==='GET'){
   const token=url.searchParams.get('token')||'',app=await admissionPublicApp(env,token);if(!app)return out({error:'This admission link is invalid.'},404);if(app.expired)return out({error:'This admission link has expired. Please ask the school for a new link.'},410);
   const school=await env.DB.prepare('SELECT name,city FROM neo_schools WHERE school_id=?').bind(app.school_id).first();return out(admissionPublicAppShape(app,school,await admissionDocs(env,app.id)));
  }
  const publicDoc=url.pathname.match(/^\/api\/admission-workflow\/public\/document\/([a-z_]+)$/);
  if(publicDoc&&request.method==='POST'){
   const token=url.searchParams.get('token')||'',app=await admissionPublicApp(env,token);if(!app)return out({error:'This admission link is invalid.'},404);if(app.expired)return out({error:'This admission link has expired.'},410);if(!['Admission Invited','Correction Required'].includes(app.status))return out({error:'Documents are locked while the application is under verification.'},409);
   const docType=publicDoc[1];if(!['birth_certificate','aadhaar','previous_certificate'].includes(docType))return out({error:'Unsupported document type.'},400);
   const b=await request.json(),fileName=admissionClean(b.file_name,160),mime=admissionClean(b.mime_type,80),encoded=typeof b.data_base64==='string'?b.data_base64:'';
   if(!fileName||!['image/jpeg','image/png','application/pdf'].includes(mime)||!encoded)return out({error:'Upload a JPG, PNG or PDF document.'},400);
   let bytes;try{const bin=atob(encoded);if(bin.length>1572864)return out({error:'Each document must be 1.5 MB or smaller.'},413);bytes=Uint8Array.from(bin,c=>c.charCodeAt(0))}catch{return out({error:'Document could not be read.'},400)}
   const id='DOC_'+app.id+'_'+docType;
   await env.DB.prepare(`INSERT INTO neo_admission_documents(id,application_id,school_id,doc_type,file_name,mime_type,body,size_bytes) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(application_id,doc_type) DO UPDATE SET id=excluded.id,file_name=excluded.file_name,mime_type=excluded.mime_type,body=excluded.body,size_bytes=excluded.size_bytes,created_at=CURRENT_TIMESTAMP`).bind(id,app.id,app.school_id,docType,fileName,mime,bytes,bytes.byteLength).run();
   return out({success:true,document:{id,doc_type:docType,file_name:fileName,mime_type:mime,size_bytes:bytes.byteLength}});
  }
  if(url.pathname==='/api/admission-workflow/public/submit'&&request.method==='POST'){
   const token=url.searchParams.get('token')||'',app=await admissionPublicApp(env,token);if(!app)return out({error:'This admission link is invalid.'},404);if(app.expired)return out({error:'This admission link has expired.'},410);if(!['Admission Invited','Correction Required'].includes(app.status))return out({error:'This application is already submitted for verification.'},409);
   const b=await request.json();if(b.confirmed!==true)return out({error:'Review the details and confirm they are correct before submitting.'},400);
   const child=admissionClean(b.child_name,120),dob=admissionClean(b.dob,10),gender=admissionClean(b.gender,40),primary=admissionClean(b.primary_parent_name,120),father=admissionClean(b.father_name,120),mother=admissionClean(b.mother_name,120),guardian=admissionClean(b.guardian_name,120),mobile=admissionClean(b.mobile,20),alternate=admissionClean(b.alternate_mobile,20),email=admissionClean(b.email,160),address=admissionClean(b.address,500),city=admissionClean(b.city,120),pincode=admissionClean(b.pincode,10),program=admissionClean(app.data.program,40);
   if(!child||!admissionValidDate(dob)||dob>neoToday()||!['Male','Female','Prefer not to say'].includes(gender)||!primary||!admissionValidMobile(mobile)||!address||!city||!/^\d{6}$/.test(pincode))return out({error:'Complete the child, parent, contact and address details in the required format.'},400);
   if(alternate&&!admissionValidMobile(alternate))return out({error:'Check the alternate mobile number.'},400);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return out({error:'Check the email address.'},400);if(!father&&!mother&&!guardian)return out({error:'Enter at least one parent or guardian name.'},400);
   const stage=admissionStageData(b,program),docs=await admissionDocs(env,app.id),types=new Set(docs.map(x=>x.doc_type));if(!types.has('birth_certificate'))return out({error:'Birth certificate is required before submission.'},400);if(['LKG','UKG'].includes(program)&&!types.has('previous_certificate'))return out({error:'Previous-class certificate is required for '+program+' admission.'},400);
   const data={...app.data,child_name:child,dob,gender,primary_parent_name:primary,father_name:father,mother_name:mother,guardian_name:guardian,mobile,alternate_mobile:alternate,email,address,city,pincode,program,...stage,parent_confirmed_at:new Date().toISOString(),parent_confirmation:true};
   await env.DB.batch([env.DB.prepare("UPDATE neo_admission_applications SET status='Verification Pending',data=?,correction_note=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(data),app.id),portalAudit(env,app.school_id,false,'ADMISSION:parent_submitted',app.id)]);await admissionUpdateEnquiry(env,app.school_id,app.enquiry_id,{admission_application_id:app.id,admission_status:'Verification Pending'});
   return out({success:true,status:'Verification Pending',message:'Admission form submitted. The school will verify the details and documents.'});
  }

  const schoolInvite=url.pathname.match(/^\/api\/admission-workflow\/school\/([^/]+)\/enquiries\/([^/]+)\/invite$/);
  const schoolApp=url.pathname.match(/^\/api\/admission-workflow\/school\/([^/]+)\/applications\/([^/]+)$/);
  const schoolDoc=url.pathname.match(/^\/api\/admission-workflow\/school\/([^/]+)\/applications\/([^/]+)\/documents\/([^/]+)$/);
  if(schoolInvite||schoolApp||schoolDoc){
   const schoolId=decodeURIComponent((schoolInvite||schoolApp||schoolDoc)[1]),admin=await requireAdmin(request,env),session=admin?null:await schoolSession(request,env);if(!admin&&(!session||session.school_id!==schoolId))return out({error:'School sign in required.'},401);
   if(schoolDoc&&request.method==='GET'){
    const appId=decodeURIComponent(schoolDoc[2]),docId=decodeURIComponent(schoolDoc[3]),row=await env.DB.prepare('SELECT file_name,mime_type,body FROM neo_admission_documents WHERE school_id=? AND application_id=? AND id=?').bind(schoolId,appId,docId).first();if(!row)return out({error:'Document not found.'},404);return new Response(row.body,{status:200,headers:{'Content-Type':row.mime_type,'Content-Disposition':'inline; filename="'+String(row.file_name||'document').replace(/["\r\n]/g,'')+'"','Cache-Control':'no-store',...cors(request)}});
   }
   if(schoolInvite&&request.method==='POST'){
    const enquiryId=decodeURIComponent(schoolInvite[2]),enquiry=await portalRecord(env,schoolId,'enquiries',enquiryId);if(!enquiry)return out({error:'Enquiry not found.'},404);
    let app=await admissionAppRow(env,schoolId,enquiryId);if(!app){const id='ADM_'+crypto.randomUUID().replaceAll('-','').slice(0,24),data={parent_name:enquiry.name||'',mobile:enquiry.mobile||'',child_name:enquiry.child_name||'',dob:enquiry.dob||'',program:enquiry.program||'',enquiry_notes:enquiry.notes||'',source:enquiry.source||'School enquiry'};await env.DB.prepare("INSERT INTO neo_admission_applications(id,school_id,enquiry_id,status,data) VALUES (?,?,?,'Admission Invited',?)").bind(id,schoolId,enquiryId,JSON.stringify(data)).run();app=await admissionAppById(env,schoolId,id)}
    if(app.status==='Student Created')return out({...admissionSchoolAppShape(app,await admissionDocs(env,app.id)),message:'Admission already approved and Student Master created.'});
    const issued=await admissionIssueToken(env,app.id);if(app.status!=='Verification Pending')await env.DB.prepare("UPDATE neo_admission_applications SET status=CASE WHEN status='Correction Required' THEN status ELSE 'Admission Invited' END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(app.id).run();app=await admissionAppById(env,schoolId,app.id);await admissionUpdateEnquiry(env,schoolId,enquiryId,{admission_application_id:app.id,admission_status:app.status});
    return out({...admissionSchoolAppShape(app,await admissionDocs(env,app.id)),parent_url:issued.parent_url,link_expires:issued.expires});
   }
   if(schoolApp&&request.method==='PATCH'){
    const appId=decodeURIComponent(schoolApp[2]),app=await admissionAppById(env,schoolId,appId);if(!app)return out({error:'Admission application not found.'},404);const b=await request.json(),action=admissionClean(b.action,40);
    if(action==='correction'){
     if(!['Verification Pending','Admission Invited','Correction Required'].includes(app.status))return out({error:'This application cannot be returned for correction.'},409);const note=admissionClean(b.correction_note,1000);if(!note)return out({error:'Enter the correction required for the parent.'},400);await env.DB.prepare("UPDATE neo_admission_applications SET status='Correction Required',correction_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(note,app.id).run();const issued=await admissionIssueToken(env,app.id);await admissionUpdateEnquiry(env,schoolId,app.enquiry_id,{admission_status:'Correction Required'});const next=await admissionAppById(env,schoolId,app.id);return out({...admissionSchoolAppShape(next,await admissionDocs(env,next.id)),parent_url:issued.parent_url,link_expires:issued.expires});
    }
    if(action==='approve'){
     if(app.status!=='Verification Pending')return out({error:'Parent submission must be under Verification Pending before approval.'},409);if(app.student_id)return out({error:'Student Master was already created for this application.'},409);
     const classroomId=admissionClean(b.classroom_id,80),classroom=await portalRecord(env,schoolId,'classrooms',classroomId);if(!classroom)return out({error:'Choose an existing classroom.'},400);if(classroom.program!==app.data.program)return out({error:'Classroom programme must match the class of interest.'},400);
     const d=app.data,duplicate=(await portalRows(env,schoolId,'students')).find(x=>String(x.name||'').trim().toLowerCase()===String(d.child_name||'').trim().toLowerCase()&&String(x.dob||'')===String(d.dob||'')&&String(x.mobile||'').replace(/\D/g,'')===String(d.mobile||'').replace(/\D/g,''));if(duplicate)return out({error:'A matching Student Master already exists. Review the existing student instead of creating a duplicate.'},409);
     const docs=await admissionDocs(env,app.id),types=new Set(docs.map(x=>x.doc_type));if(!types.has('birth_certificate'))return out({error:'Birth certificate is missing.'},400);if(['LKG','UKG'].includes(d.program)&&!types.has('previous_certificate'))return out({error:'Previous-class certificate is missing.'},400);
     const studentId=crypto.randomUUID(),admissionDate=neoToday(),admissionNo=await createStudentAdmissionNo(env,schoolId,admissionDate),student={name:d.child_name,dob:d.dob,gender:d.gender||'',email:d.email||'',program:d.program,parent:d.primary_parent_name||d.parent_name||'',mobile:d.mobile,academic_year:classroom.academic_year,classroom_id:classroom.id,admission_date:admissionDate,admission_no:admissionNo,playgroup_status:d.playgroup_status||'Not applicable',nursery_status:d.nursery_status||'Not applicable',nursery_school:d.nursery_school||'',nursery_city:d.nursery_city||'',nursery_year:d.nursery_year||'',lkg_status:d.lkg_status||'Not applicable',lkg_school:d.lkg_school||'',lkg_city:d.lkg_city||'',lkg_year:d.lkg_year||'',previous_school:d.previous_school||'',previous_city:d.previous_city||'',address:d.address||'',city:d.city||'',pincode:d.pincode||'',father_name:d.father_name||'',mother_name:d.mother_name||'',guardian_name:d.guardian_name||'',alternate_mobile:d.alternate_mobile||'',admission_application_id:app.id,status:'Active'};
     const writes=[env.DB.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'students',?,?)").bind(schoolId,studentId,JSON.stringify(student)),env.DB.prepare("UPDATE neo_admission_applications SET status='Student Created',student_id=?,token_hash=NULL,token_expires=NULL,data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(studentId,JSON.stringify({...d,approved_at:new Date().toISOString(),admission_no:admissionNo,classroom_id:classroom.id}),app.id),portalAudit(env,schoolId,admin,'ADMISSION:approved',app.id)];
     const enquiry=await portalRecord(env,schoolId,'enquiries',app.enquiry_id);if(enquiry){const q={...enquiry,status:'Converted',admission_status:'Student Created',student_id:studentId,admission_no:admissionNo};delete q.id;delete q.created_at;writes.push(env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='enquiries' AND id=?").bind(JSON.stringify(q),schoolId,app.enquiry_id))}
     const fees=(await portalRows(env,schoolId,'fee_structures')).filter(f=>String(f.classroom_id)===String(classroom.id));for(const fee of fees)writes.push(env.DB.prepare("INSERT OR IGNORE INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'invoices',?,?)").bind(schoolId,'FS_'+fee.id+'_'+studentId,JSON.stringify({student_id:studentId,title:fee.title,due_date:fee.due_date,amount_paise:fee.amount_paise,fee_structure_id:fee.id,classroom_id:classroom.id,program:classroom.program,academic_year:classroom.academic_year})));
     await env.DB.batch(writes);return out({success:true,status:'Student Created',student_id:studentId,admission_no:admissionNo,message:'Admission approved and Student Master created.'});
    }
    return out({error:'Choose correction or approve.'},400);
   }
  }
  return out({error:'Not found.'},404);
 }catch(e){console.error('Admission workflow error',e);if(e instanceof TypeError)return out({error:e.message},400);return out({error:'Admission workflow is temporarily unavailable. Please retry.'},503)}
}

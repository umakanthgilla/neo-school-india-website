from pathlib import Path

ext = Path('worker/gate-qr-parent-extension.js')
s = ext.read_text()

marker = "  const alertParent=(school,student)=>queueTransportParentPush(ctx,env,school,[student]);"
helper = r'''  const alertParent=(school,student)=>queueTransportParentPush(ctx,env,school,[student]);
  const purgeVisitors=async(school,actor,{id='',olderThanDays=0}={})=>{
   const rows=await portalRows(env,school,'gate_visitors'),closed=new Set(['Exited','Rejected']);
   let targets=rows.filter(x=>closed.has(x.status));
   if(id){const row=rows.find(x=>String(x.id)===String(id));if(!row)return {error:'not_found',count:0};if(!closed.has(row.status))return {error:'active',count:0};targets=[row];}
   else if(olderThanDays>0){const cutoff=Date.now()-olderThanDays*86400000;targets=targets.filter(x=>{const t=Date.parse(x.checkout_at||x.created_at||x.checkin_at||'');return Number.isFinite(t)&&t<=cutoff});}
   if(!targets.length)return {count:0};
   await env.DB.prepare("CREATE TABLE IF NOT EXISTS neo_gate_photos(school_id TEXT NOT NULL,kind TEXT NOT NULL,record_id TEXT NOT NULL,created_at TEXT NOT NULL,photo BLOB NOT NULL,PRIMARY KEY(school_id,kind,record_id))").run();
   for(let i=0;i<targets.length;i+=40){const statements=[];for(const row of targets.slice(i,i+40)){statements.push(env.DB.prepare('DELETE FROM neo_gate_photos WHERE school_id=? AND kind=? AND record_id=?').bind(school,'gate_visitors',row.id));statements.push(env.DB.prepare('DELETE FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?').bind(school,'gate_visitors',row.id));}if(statements.length)await env.DB.batch(statements);}
   await audit(school,actor,id?'DELETE:gate_visitors':'DELETE:gate_visitors:bulk',id||('count:'+targets.length)).run();
   return {count:targets.length};
  };'''
if 'const purgeVisitors=' not in s:
    if marker not in s:
        raise SystemExit('alertParent marker not found')
    s = s.replace(marker, helper, 1)

old = "  if(!['visitor','pickup'].includes(kind))return null;if(!id&&request.method!=='POST')return null;"
new = "  if(!['visitor','pickup'].includes(kind))return null;if(!id&&request.method!=='POST'&&!(kind==='visitor'&&request.method==='DELETE'))return null;"
if old in s:
    s = s.replace(old,new,1)
elif new not in s:
    raise SystemExit('school gate method guard marker not found')

insert_before = "  if(kind==='visitor'&&request.method==='POST'&&!id){"
delete_block = r'''  if(kind==='visitor'&&request.method==='DELETE'){
   const rawDays=url.searchParams.get('retention'),days=rawDays==null?0:Number(rawDays);if(rawDays!=null&&(!Number.isInteger(days)||days<1||days>365))return out({error:'Retention must be 1–365 days.'},400);
   const result=await purgeVisitors(school,actor,{id,olderThanDays:id?0:days});if(result.error==='not_found')return out({error:'Visitor record not found.'},404);if(result.error==='active')return out({error:'Close the visitor first (Reject or Check out) before deleting the record.'},409);return out({success:true,deleted:result.count,retention_days:days||null});
  }
'''
intercept = s.find("/* Intercept school actions")
if "request.method==='DELETE'" not in s[intercept:]:
    if insert_before not in s:
        raise SystemExit('visitor POST insertion marker not found')
    s = s.replace(insert_before, delete_block+insert_before, 1)
ext.write_text(s)

worker = Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
w = worker.read_text()
start_src = s.find('async function gateQrParentPortal')
if start_src < 0:
    raise SystemExit('gateQrParentPortal source function not found')
src_func = s[start_src:].strip()
start_w = w.find('async function gateQrParentPortal')
end_w = w.find('async function visitorFacilitiesPortal', start_w)
if start_w < 0 or end_w < 0:
    raise SystemExit('combined Worker gate QR function boundaries not found')
w = w[:start_w] + src_func + '\n\n' + w[end_w:]
worker.write_text(w)

ui = Path('visitor-gate.js')
v = ui.read_text()
v = v.replace("let currentSchool=null,rendering=false,timer=0,liveTimer=0;","let currentSchool=null,rendering=false,timer=0,liveTimer=0,retentionChecked=false;",1)
v = v.replace("window.openNeoWorkspace=function(s){currentSchool=s||null;return prevOpen.apply(this,arguments)};","window.openNeoWorkspace=function(s){currentSchool=s||null;retentionChecked=false;return prevOpen.apply(this,arguments)};",1)
v = v.replace("window.closeNeoWorkspace=function(){currentSchool=null;return prevClose.apply(this,arguments)};","window.closeNeoWorkspace=function(){currentSchool=null;retentionChecked=false;return prevClose.apply(this,arguments)};",1)
old_fetch = "  const d=await api('');if(activeTab()!=='visitor_gate')return;"
new_fetch = "  if(!retentionChecked){retentionChecked=true;try{await api('visitor?retention=7','DELETE')}catch{}}\n  const d=await api('');if(activeTab()!=='visitor_gate')return;"
if old_fetch in v:
    v = v.replace(old_fetch,new_fetch,1)
elif new_fetch not in v:
    raise SystemExit('visitor render fetch marker not found')

old_register = "  <h3>Visitor register</h3><div class=\"portal-grid\">${visitors.map(v=>`<article class=\"portal-card\"><h4>${esc(v.name)}</h4>"
new_register = "  <h3>Visitor register</h3><p>Closed visitor records auto-clean after 7 days. Child pickup history is preserved.</p><div class=\"actions\"><button type=\"button\" class=\"secondary\" data-clear-visitors>Clear completed visitors</button></div><div class=\"portal-grid\">${visitors.map(v=>`<article class=\"portal-card\"><h4>${esc(v.name)}</h4>"
if old_register in v:
    v = v.replace(old_register,new_register,1)
elif new_register not in v:
    raise SystemExit('visitor register heading marker not found')

old_actions = "${v.status==='Inside'?`<button data-visitor-action=\"checkout\" data-id=\"${esc(v.id)}\">Check out</button>`:''}</div></article>"
new_actions = "${v.status==='Inside'?`<button data-visitor-action=\"checkout\" data-id=\"${esc(v.id)}\">Check out</button>`:''}${['Exited','Rejected'].includes(v.status)?`<button type=\"button\" class=\"secondary\" data-visitor-delete=\"${esc(v.id)}\">Delete</button>`:''}</div></article>"
if old_actions in v:
    v = v.replace(old_actions,new_actions,1)
elif new_actions not in v:
    raise SystemExit('visitor card actions marker not found')

listener_marker = "  area.querySelectorAll('[data-visitor-action]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('visitor/'+encodeURIComponent(b.dataset.id),'PATCH',{action:b.dataset.visitorAction});status('✓ Visitor status updated.');rendering=false;await render()}catch(err){status(err.message);b.disabled=false}});"
listeners = listener_marker + "\n  area.querySelector('[data-clear-visitors]')?.addEventListener('click',async e=>{if(!confirm('Delete all completed / rejected visitor records and their photos? Active visitors will be kept. Child pickup history will not be deleted.'))return;const btn=e.currentTarget;btn.disabled=true;try{const r=await api('visitor','DELETE');status('✓ '+r.deleted+' completed visitor record'+(r.deleted===1?'':'s')+' deleted.');rendering=false;await render()}catch(err){status(err.message);btn.disabled=false}});\n  area.querySelectorAll('[data-visitor-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this closed visitor record and photo?'))return;b.disabled=true;try{await api('visitor/'+encodeURIComponent(b.dataset.visitorDelete),'DELETE');status('✓ Visitor record deleted.');rendering=false;await render()}catch(err){status(err.message);b.disabled=false}});"
if "querySelector('[data-clear-visitors]')" not in v:
    if listener_marker not in v:
        raise SystemExit('visitor action listener marker not found')
    v = v.replace(listener_marker,listeners,1)
ui.write_text(v)

loader = Path('password-access.js')
p = loader.read_text()
old_ver = '/visitor-gate.js?v=20260930-gate3'
new_ver = '/visitor-gate.js?v=20261001-gate4'
if old_ver in p:
    p = p.replace(old_ver,new_ver,1)
elif new_ver not in p:
    raise SystemExit('visitor gate loader version marker not found')
loader.write_text(p)

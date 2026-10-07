(()=>{
'use strict';
if(window.__neoIdCardCenter)return;window.__neoIdCardCenter=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const root=()=>document.getElementById('neoWorkspace');
const photo=x=>x?.photo_url||x?.photo||x?.profile_photo_url||x?.profile_photo||x?.image_url||x?.avatar_url||'';
const initials=n=>String(n||'NEO').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const pick=(o,...keys)=>{for(const k of keys)if(o&&o[k]!=null&&String(o[k]).trim())return o[k];return ''};
const qr=s=>'https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=5&data='+encodeURIComponent(s);
function barcodeSvg(value){
 const s=String(value||'NEO'),bits=[1,0,1,0,1,1,0];
 for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);for(let b=0;b<7;b++)bits.push((n>>b)&1,0)}
 bits.push(1,0,1,1,0,1);
 let x=0,rects='';for(const bit of bits){const w=bit?2:1;if(bit)rects+='<rect x="'+x+'" y="0" width="'+w+'" height="28"/>';x+=w+1}
 return '<svg viewBox="0 0 '+x+' 28" preserveAspectRatio="none" aria-label="Barcode">'+rects+'</svg>';
}
function img(person,label){
 const src=photo(person);
 if(src)return '<img class="neo-id-photo" src="'+esc(src)+'" alt="'+esc(label)+'">';
 return '<div class="neo-id-photo neo-id-placeholder" aria-label="'+esc(label)+'"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="38" r="20" fill="#a9b9ca"/><path d="M18 91c4-23 17-34 32-34s28 11 32 34" fill="#a9b9ca"/></svg></div>';
}
function logo(){return '<img class="neo-id-logo" src="/neo-top-logo.jpeg" alt="Neo School India">'}
function wave(){return '<svg class="neo-id-wave" viewBox="0 0 300 62" preserveAspectRatio="none" aria-hidden="true"><path d="M0 42 C32 21 59 19 91 37 C117 51 139 54 166 39 C194 23 218 22 245 36 C267 48 282 51 300 42 L300 62 L0 62 Z" fill="#0f6fb4"/><path d="M0 50 C37 35 66 33 96 45 C122 55 145 57 171 45 C198 32 222 31 249 43 C270 52 286 55 300 49 L300 62 L0 62 Z" fill="#10a7b3"/><path d="M42 62 C73 41 103 40 131 53 C154 63 181 62 205 51 C226 41 248 41 271 51 L300 62 Z" fill="#4bb84a"/><path d="M126 62 C151 47 176 45 201 55 C219 62 239 63 258 56 C273 50 288 51 300 56 L300 62 Z" fill="#f3c400"/><path d="M217 62 C240 48 261 47 279 55 C288 59 295 61 300 61 L300 62 Z" fill="#ff7816"/><path d="M272 62 C282 56 291 55 300 58 L300 62 Z" fill="#ef3f7a"/></svg>'}
function pill(text,tone){return '<span class="neo-id-pill '+tone+'">'+esc(text)+'</span>'}
function line(label,value){return '<div class="neo-id-line"><b>'+esc(label)+'</b><span>'+esc(value||'—')+'</span></div>'}
function personQr(kind,id,school){return qr(location.origin+'/verify-card.html?type='+encodeURIComponent(kind)+'&id='+encodeURIComponent(id||'')+'&school='+encodeURIComponent(school?.school_id||''))}
function studentCard(s,school){
 const cardId=pick(s,'admission_no','student_id','id'),cls=pick(s,'class_section','classroom_name','program','class_name'),roll=pick(s,'roll_no','roll_number'),contact=pick(s,'emergency_mobile','mobile','parent_mobile'),year=pick(s,'academic_year');
 return '<article class="neo-id-card neo-id-student" data-print-card><div class="neo-id-side neo-left"></div><div class="neo-id-side neo-right"></div>'+logo()+'<h4>STUDENT ID CARD</h4>'+img(s,s.name)+'<h2>'+esc(s.name||'Student')+'</h2><div class="neo-id-accent">'+esc(cls||'Student')+'</div>'+line('Grade/Sec:',cls)+(roll?line('Roll No:',roll):'')+line('Admission No:',cardId)+(year?line('Academic Year:',year):'')+line('Emergency Contact:',contact)+pill('STUDENT','student')+'<div class="neo-id-footer"><img src="'+esc(personQr('student',cardId,school))+'" alt="Student QR">'+barcodeSvg(cardId)+'</div>'+wave()+'</article>';
}
function staffCard(s,school){
 const id=pick(s,'staff_id','employee_id','id'),role=pick(s,'role','designation','department'),blood=pick(s,'blood_group'),phone=pick(s,'mobile','phone'),dept=pick(s,'staff_type','staff_category','department');
 return '<article class="neo-id-card neo-id-staff" data-print-card><div class="neo-id-side neo-left"></div><div class="neo-id-side neo-right"></div>'+logo()+'<h4>STAFF ID CARD</h4>'+img(s,s.name)+'<h2>'+esc(s.name||'Staff')+'</h2><div class="neo-id-accent">'+esc(role||'Staff')+'</div>'+line('Staff ID:',id)+(dept&&dept!==role?line('Department:',dept):'')+(blood?line('Blood Group:',blood):'')+line('Phone:',phone)+pill('STAFF','staff')+'<div class="neo-id-footer"><img src="'+esc(personQr('staff',id,school))+'" alt="Staff QR"><span class="neo-id-sign">Authorised Signature</span></div>'+wave()+'</article>';
}
function visitorCard(v,school){
 const id=pick(v,'visitor_id','gate_pass','id'),date=pick(v,'date','created_at'),purpose=pick(v,'purpose'),name=pick(v,'name','visitor_name')||'VISITOR',valid=pick(v,'valid_for')||'Single Day Access';
 return '<article class="neo-id-card neo-id-visitor" data-print-card><div class="neo-id-side neo-left"></div><div class="neo-id-side neo-right"></div>'+logo()+'<h4>VISITOR ID CARD</h4><div class="neo-id-visitor-icon">♙</div><h2>'+esc(name)+'</h2><div class="neo-id-big-id">ID: '+esc(id||'Visitor')+'</div>'+line('Date:',date?new Date(date).toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata'}):new Date().toLocaleDateString('en-GB'))+line('Valid For:',valid)+line('Purpose:',purpose||'Official / Meeting')+pill('VISITOR','visitor')+'<div class="neo-id-footer"><img src="'+esc(personQr('visitor',id,school))+'" alt="Visitor QR"><small>Please return<br>at the reception</small></div>'+wave()+'</article>';
}
function escortCard(p,student,school){
 const id=pick(p,'escort_id','gate_pass','id'),name=pick(p,'pickup_name','escort_name','name')||'Escort',rel=pick(p,'relationship')||'Authorised Escort',phone=pick(p,'pickup_mobile','mobile','contact'),child=student||{},childName=pick(p,'student_name')||child.name||pick(p,'student_id')||'Student',cls=pick(child,'class_section','classroom_name','program','class_name');
 return '<article class="neo-id-card neo-id-escort" data-print-card><div class="neo-id-side neo-left"></div><div class="neo-id-side neo-right"></div>'+logo()+'<h4>CHILD PICKUP ESCORT</h4><div class="neo-id-dual-photo">'+img(p,name)+img(child,childName)+'</div><h2>'+esc(name)+'</h2><div class="neo-id-accent">Relationship: '+esc(rel)+'</div>'+line('Authorized to Pick Up:',childName+(cls?' ('+cls+')':''))+line('Escort ID:',id)+line('Contact No:',phone)+pill('ESCORT','escort')+'<div class="neo-id-footer"><img src="'+esc(personQr('escort',id,school))+'" alt="Escort QR">'+barcodeSvg(id)+'</div>'+wave()+'</article>';
}
function injectStyles(){
 if(document.getElementById('neoIdCardStyles'))return;
 const s=document.createElement('style');s.id='neoIdCardStyles';s.textContent=`
.neo-id-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0 18px}
.neo-id-toolbar label{min-width:240px;flex:1}
.neo-id-grid{display:grid;grid-template-columns:1fr;justify-items:center;gap:24px;align-items:start;padding:4px 0 18px}
.neo-id-preview{display:grid;justify-items:center;gap:12px;width:100%}
.neo-id-preview>.actions{justify-content:center}
.neo-id-card{
  --tone:#118be8;
  width:300px;
  height:478px;
  background:#fff;
  border:1px solid #d7dee7;
  border-radius:18px;
  position:relative;
  overflow:hidden;
  padding:24px 22px 18px;
  color:#0b2457;
  box-shadow:0 14px 34px rgba(7,27,82,.13);
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
  font-family:Arial,Helvetica,sans-serif
}
.neo-id-card>*{position:relative;z-index:2}
.neo-id-card:before{content:"";position:absolute;inset:0;background:#fff;z-index:0}
.neo-id-logo{width:126px;height:auto;object-fit:contain;margin:0 auto 8px}
.neo-id-card h4{
  font-size:15px;
  line-height:1.1;
  margin:1px 0 12px;
  letter-spacing:.01em;
  font-weight:900;
  color:#10285d
}
.neo-id-card h2{
  font-size:20px;
  line-height:1.08;
  margin:9px 0 3px;
  letter-spacing:-.025em;
  font-weight:900;
  color:#10285d
}
.neo-id-photo{
  width:96px;
  height:96px;
  border-radius:50%;
  object-fit:cover;
  border:4px solid #fff;
  outline:3px solid var(--tone);
  background:#f1f5f9;
  box-shadow:0 0 0 1px rgba(7,27,82,.05)
}
.neo-id-placeholder{display:grid;place-items:center;overflow:hidden}
.neo-id-placeholder svg{width:74px;height:74px}
.neo-id-accent{
  font-size:13px;
  line-height:1.15;
  font-weight:800;
  color:var(--tone);
  margin:0 0 8px
}
.neo-id-line{
  width:100%;
  font-size:11.4px;
  line-height:1.24;
  display:flex;
  gap:4px;
  justify-content:center;
  align-items:baseline;
  margin:1px 0;
  color:#172742;
  white-space:normal
}
.neo-id-line b{font-weight:800;color:#0f2047}
.neo-id-big-id{font-size:16px;font-weight:900;margin:2px 0 8px;color:#10285d}
.neo-id-pill{
  margin-top:auto;
  min-width:74px;
  border-radius:999px;
  color:#fff;
  font-weight:900;
  font-size:10px;
  line-height:1;
  padding:6px 15px 5px;
  letter-spacing:.08em
}
.neo-id-pill.student{background:linear-gradient(90deg,#2578a7,#46a94a)}
.neo-id-pill.staff{background:#123b73}
.neo-id-pill.visitor{background:#182f67}
.neo-id-pill.escort{background:linear-gradient(90deg,#1787aa,#73a93d)}
.neo-id-footer{
  width:100%;
  height:48px;
  margin-top:6px;
  padding:0 4px 1px;
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:12px
}
.neo-id-footer>img{width:43px;height:43px;object-fit:contain;background:#fff}
.neo-id-footer svg{width:78px;height:29px;fill:#111}
.neo-id-footer small{font-size:8.5px;line-height:1.12;text-align:right;color:#4c5569}
.neo-id-sign{
  width:92px;
  font-family:"Brush Script MT",cursive;
  font-size:11px;
  color:#1b2a47;
  border-top:1px solid #1b2a47;
  padding-top:3px;
  margin-bottom:4px
}
.neo-id-wave{
  position:absolute!important;
  z-index:1!important;
  left:0;
  right:0;
  bottom:0;
  width:100%;
  height:54px
}
.neo-id-side{position:absolute!important;z-index:1!important}
.neo-id-side.neo-left{
  left:0;
  top:62px;
  width:8px;
  height:114px;
  border-radius:0 8px 8px 0;
  background:linear-gradient(180deg,#ef3f7a 0 18%,#ff7816 18% 38%,#f3c400 38% 56%,#4bb84a 56% 76%,#0f78b8 76% 100%)
}
.neo-id-side.neo-right{
  right:-7px;
  top:188px;
  width:22px;
  height:58px;
  border-radius:12px 0 0 12px;
  background:linear-gradient(180deg,#1268b3,#0ca7b4 48%,#49ae4f)
}
.neo-id-staff{--tone:#1378a9}
.neo-id-student{--tone:#4aa948}
.neo-id-visitor{--tone:#182f67}
.neo-id-escort{--tone:#dc791c}
.neo-id-visitor-icon{
  width:88px;
  height:88px;
  border-radius:50%;
  background:#172f68;
  color:#fff;
  display:grid;
  place-items:center;
  font-size:44px;
  font-weight:900;
  margin-top:2px
}
.neo-id-dual-photo{display:flex;align-items:end;justify-content:center;margin:0 0 1px}
.neo-id-dual-photo .neo-id-photo:first-child{width:88px;height:88px}
.neo-id-dual-photo .neo-id-photo:last-child{width:54px;height:54px;margin-left:-12px;outline:2px solid #fff;border:3px solid #fff}
.neo-id-empty{padding:28px;border:1px dashed #cbd8e8;border-radius:18px;background:#f9fcff;color:#52617b}
.neo-id-help{font-size:13px;color:#64748b;margin:0 0 6px}
.neo-id-type-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.neo-id-type-tabs button[aria-pressed="true"]{background:#071b52;color:#fff}
.neo-id-type-tabs button{min-height:40px}
.neo-id-sheet{display:grid;grid-template-columns:repeat(2,54mm);gap:8mm;justify-content:center}
@media(max-width:680px){
  .neo-id-card{width:min(300px,100%);height:auto;aspect-ratio:54/86}
  .neo-id-toolbar{display:grid}
  .neo-id-toolbar label{min-width:0}
}
@media print{
  body>*{display:none!important}
  #neoIdPrintHost{display:block!important;position:fixed;inset:0;background:#fff}
  .neo-id-card{width:54mm;height:86mm;border-radius:3mm;box-shadow:none;page-break-inside:avoid;transform:none}
  .neo-id-grid{display:grid;grid-template-columns:repeat(2,54mm);gap:7mm}
}
`
}
function openPrint(cardHtml,title){
 const w=open('','_blank');if(!w)return;
 const styles=document.getElementById('neoIdCardStyles')?.textContent||'';
 w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:54mm 86mm;margin:0}html,body{margin:0;padding:0;background:#fff}'+styles+'.neo-id-card{width:54mm;height:86mm;border-radius:3mm;box-shadow:none;border:0;margin:0;padding:4.5mm 4mm 3.5mm}.neo-id-logo{width:24mm;margin-bottom:1.4mm}.neo-id-card h4{font-size:3mm;margin-bottom:2mm}.neo-id-card h2{font-size:3.9mm;margin-top:1.7mm}.neo-id-photo{width:18mm;height:18mm;border-width:.8mm;outline-width:.6mm}.neo-id-accent{font-size:2.45mm;margin-bottom:1.2mm}.neo-id-line{font-size:2.18mm;line-height:1.2;margin:.15mm 0}.neo-id-big-id{font-size:3mm}.neo-id-pill{font-size:2mm;padding:1.1mm 2.8mm 1mm}.neo-id-footer{height:9mm;margin-top:1mm}.neo-id-footer>img{width:8mm;height:8mm}.neo-id-footer svg{width:15mm;height:5.5mm}.neo-id-wave{height:10mm}.neo-id-side.neo-left{top:11mm;width:1.5mm;height:21mm}.neo-id-side.neo-right{top:34mm;width:4mm;height:11mm}.neo-id-visitor-icon{width:17mm;height:17mm;font-size:8mm}.neo-id-dual-photo .neo-id-photo:first-child{width:17mm;height:17mm}.neo-id-dual-photo .neo-id-photo:last-child{width:10.5mm;height:10.5mm}</style></head><body>'+cardHtml+'<script>setTimeout(()=>print(),700)<\/script></body></html>');w.document.close();
}
async function visitorData(school){
 try{
  const b=typeof BASE==='string'?BASE:'',t=typeof token==='string'?token:'';
  if(!b||!t||!school?.school_id)return {visitors:[],pickups:[],students:[]};
  const r=await fetch(b+'/api/visitor-gate/school/'+encodeURIComponent(school.school_id),{headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'}});
  if(!r.ok)return {visitors:[],pickups:[],students:[]};return await r.json();
 }catch{return {visitors:[],pickups:[],students:[]}}
}
window.renderNeoIdCards=async function(area,ctx){
 injectStyles();
 const school=ctx.school||{},records=ctx.records||{},students=(records.students||[]).filter(x=>x.status!=='Withdrawn'),staff=(records.staff||[]).filter(x=>x.status!=='Inactive');
 area.innerHTML='<span class="eyebrow">IDENTITY · SAFETY · SCHOOL BRAND</span><h3>ID Cards</h3><p>Student, Staff, Child Pickup Escort and Visitor cards use the approved Neo School India design. Names, IDs, class, contact details and available profile photos are pulled from the existing school records — no duplicate entry.</p><div class="neo-id-type-tabs"><button type="button" data-id-type="student" aria-pressed="true">Student ID</button><button type="button" class="secondary" data-id-type="staff">Staff ID</button><button type="button" class="secondary" data-id-type="escort">Pickup Escort</button><button type="button" class="secondary" data-id-type="visitor">Visitor ID</button></div><div id="neoIdBody"><p class="portal-empty">Loading card data…</p></div>';
 const body=area.querySelector('#neoIdBody');let gate=null;
 async function draw(type){
  area.querySelectorAll('[data-id-type]').forEach(b=>{const on=b.dataset.idType===type;b.setAttribute('aria-pressed',String(on));b.classList.toggle('secondary',!on)});
  if((type==='escort'||type==='visitor')&&!gate)gate=await visitorData(school);
  let rows=[],label='',make=null;
  if(type==='student'){rows=students;label='student';make=x=>studentCard(x,school)}
  if(type==='staff'){rows=staff;label='staff member';make=x=>staffCard(x,school)}
  if(type==='visitor'){rows=(gate?.visitors||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));label='visitor';make=x=>visitorCard(x,school)}
  if(type==='escort'){rows=(gate?.pickups||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));label='pickup escort';make=x=>{const all=[...students,...(gate?.students||[])],st=all.find(s=>String(s.id)===String(x.student_id));return escortCard(x,st,school)}}
  if(!rows.length){body.innerHTML='<div class="neo-id-empty">No '+esc(label)+' records are available yet. Add/approve the record in its existing module; the card will appear here automatically.</div>';return}
  body.innerHTML='<div class="neo-id-toolbar"><label>Choose '+esc(label)+'<select id="neoIdSelect">'+rows.map((x,i)=>'<option value="'+i+'">'+esc(pick(x,'name','student_name','pickup_name','visitor_name','id')||('Record '+(i+1)))+'</option>').join('')+'</select></label><button type="button" id="neoIdPrint">Print selected card</button></div><p class="neo-id-help">Preview uses live portal data. Print output is portrait CR80 size (54 × 86 mm).</p><div class="neo-id-grid"><div class="neo-id-preview" id="neoIdPreview"></div></div>';
  const sel=body.querySelector('#neoIdSelect'),preview=body.querySelector('#neoIdPreview');
  const show=()=>{preview.innerHTML=make(rows[Number(sel.value)||0])};show();sel.onchange=show;
  body.querySelector('#neoIdPrint').onclick=()=>{const html=make(rows[Number(sel.value)||0]);openPrint(html,'Neo School India '+type+' card')};
 }
 area.querySelectorAll('[data-id-type]').forEach(b=>b.onclick=()=>draw(b.dataset.idType));
 await draw('student');
};
})();
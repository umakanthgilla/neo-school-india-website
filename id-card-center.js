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
 return src?'<img class="neo-id-photo" src="'+esc(src)+'" alt="'+esc(label)+'">':'<div class="neo-id-photo neo-id-initials" aria-label="'+esc(label)+'">'+esc(initials(label))+'</div>';
}
function logo(){return '<img class="neo-id-logo" src="/neo-top-logo.jpeg" alt="Neo School India">'}
function wave(){return '<div class="neo-id-wave"><i></i><i></i><i></i><i></i><i></i></div>'}
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
.neo-id-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:14px 0 18px}.neo-id-toolbar label{min-width:220px;flex:1}.neo-id-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:24px;align-items:start}.neo-id-preview{display:grid;justify-items:center;gap:12px}.neo-id-preview>.actions{justify-content:center}.neo-id-card{--tone:#118be8;width:270px;height:430px;background:#fff;border:1px solid #dfe6ef;border-radius:22px;position:relative;overflow:hidden;padding:22px 22px 20px;color:#071b52;box-shadow:0 18px 42px rgba(7,27,82,.14);display:flex;flex-direction:column;align-items:center;text-align:center}.neo-id-card>*{position:relative;z-index:2}.neo-id-card:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#fff 0 82%,#fffdf8 100%);z-index:0}.neo-id-logo{width:132px;height:auto;object-fit:contain;margin:1px auto 7px}.neo-id-card h4{font-size:16px;line-height:1.05;margin:3px 0 10px;letter-spacing:.015em}.neo-id-card h2{font-size:20px;line-height:1.05;margin:8px 0 4px;letter-spacing:-.02em}.neo-id-photo{width:98px;height:98px;border-radius:50%;object-fit:cover;border:4px solid #fff;outline:3px solid var(--tone);background:#eef5fb}.neo-id-initials{display:grid;place-items:center;font-size:28px;font-weight:900}.neo-id-accent{font-size:13px;font-weight:850;color:var(--tone);margin:0 0 7px}.neo-id-line{font-size:11.5px;line-height:1.25;display:flex;gap:5px;justify-content:center;flex-wrap:wrap;margin:1px 0;color:#17294a}.neo-id-line b{font-weight:800}.neo-id-big-id{font-size:17px;font-weight:900;margin:2px 0 8px}.neo-id-pill{margin-top:auto;border-radius:999px;color:#fff;font-weight:900;font-size:11px;padding:5px 16px;letter-spacing:.07em}.neo-id-pill.student{background:linear-gradient(90deg,#187fae,#40af67)}.neo-id-pill.staff{background:#0f5f9f}.neo-id-pill.visitor{background:#1c2f67}.neo-id-pill.escort{background:linear-gradient(90deg,#1386ad,#67aa43)}.neo-id-footer{width:100%;height:48px;margin-top:5px;display:flex;justify-content:space-between;align-items:end;gap:10px}.neo-id-footer>img{width:44px;height:44px;object-fit:contain}.neo-id-footer svg{width:76px;height:30px;fill:#111}.neo-id-footer small{font-size:9px;line-height:1.15;text-align:right;color:#4e5870}.neo-id-sign{font-family:cursive;font-size:10px;color:#213258;border-top:1px solid #213258;padding-top:2px;margin-bottom:4px}.neo-id-wave{position:absolute!important;z-index:1!important;left:0;right:0;bottom:0;height:34px;overflow:hidden}.neo-id-wave i{position:absolute;left:-14%;width:42%;height:44px;border-radius:60% 60% 0 0;transform:rotate(14deg);bottom:-22px}.neo-id-wave i:nth-child(1){background:#126bb7;left:-10%}.neo-id-wave i:nth-child(2){background:#08a8b8;left:8%}.neo-id-wave i:nth-child(3){background:#54b84a;left:28%}.neo-id-wave i:nth-child(4){background:#f4c400;left:52%}.neo-id-wave i:nth-child(5){background:#ff7a16;left:74%}.neo-id-side{position:absolute!important;z-index:1!important;width:22px;height:58px;border-radius:10px;top:118px}.neo-id-side.neo-left{left:-12px;background:linear-gradient(#ef3b78,#f5c400,#39b96b,#118be8)}.neo-id-side.neo-right{right:-12px;top:184px;background:linear-gradient(#118be8,#39b96b)}.neo-id-staff{--tone:#1379ae}.neo-id-student{--tone:#49aa4a}.neo-id-visitor{--tone:#182f67}.neo-id-escort{--tone:#ed7a1a}.neo-id-visitor-icon{width:92px;height:92px;border-radius:50%;background:#172f68;color:#fff;display:grid;place-items:center;font-size:48px;font-weight:900}.neo-id-dual-photo{display:flex;align-items:end;justify-content:center;margin-top:1px}.neo-id-dual-photo .neo-id-photo:first-child{width:88px;height:88px}.neo-id-dual-photo .neo-id-photo:last-child{width:56px;height:56px;margin-left:-12px;outline-color:#fff;border-width:3px}.neo-id-empty{padding:28px;border:1px dashed #cbd8e8;border-radius:18px;background:#f9fcff;color:#52617b}.neo-id-help{font-size:13px;color:#64748b;margin:0}.neo-id-type-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.neo-id-type-tabs button[aria-pressed="true"]{background:#071b52;color:#fff}.neo-id-type-tabs button{min-height:40px}.neo-id-sheet{display:grid;grid-template-columns:repeat(2,54mm);gap:8mm;justify-content:center}
@media(max-width:680px){.neo-id-card{width:min(270px,100%)}.neo-id-toolbar{display:grid}.neo-id-toolbar label{min-width:0}}
@media print{body>*{display:none!important}#neoIdPrintHost{display:block!important;position:fixed;inset:0;background:#fff}.neo-id-card{width:54mm;height:86mm;border-radius:3mm;box-shadow:none;page-break-inside:avoid;transform:none}.neo-id-grid{display:grid;grid-template-columns:repeat(2,54mm);gap:7mm}}
`;document.head.appendChild(s);
}
function openPrint(cardHtml,title){
 const w=open('','_blank');if(!w)return;
 const styles=document.getElementById('neoIdCardStyles')?.textContent||'';
 w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:54mm 86mm;margin:0}html,body{margin:0;padding:0;background:#fff}'+styles+'.neo-id-card{width:54mm;height:86mm;border-radius:3mm;box-shadow:none;border:0;margin:0}.neo-id-card h4{font-size:3.2mm}.neo-id-card h2{font-size:4.2mm}.neo-id-logo{width:27mm}.neo-id-photo{width:19mm;height:19mm}.neo-id-line{font-size:2.35mm}.neo-id-accent{font-size:2.6mm}.neo-id-big-id{font-size:3.4mm}.neo-id-footer{height:10mm}.neo-id-footer>img{width:9mm;height:9mm}.neo-id-footer svg{width:16mm;height:6mm}</style></head><body>'+cardHtml+'<script>setTimeout(()=>print(),700)<\/script></body></html>');w.document.close();
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
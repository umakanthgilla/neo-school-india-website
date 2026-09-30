/* Neo School India: school setup linking readiness summary. Additive UI only. */
(()=>{
'use strict';
if(window.__neoSchoolLinkReadiness)return;window.__neoSchoolLinkReadiness=true;
let currentSchool=null,loading=false;
const prevOpen=window.openNeoWorkspace;
if(typeof prevOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;return prevOpen.apply(this,arguments)};
const prevClose=window.closeNeoWorkspace;
if(typeof prevClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;return prevClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
const base=()=>typeof BASE==='string'?BASE:'';
const auth=()=>typeof token==='string'?token:'';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ay=v=>(String(v||'').match(/20\d{2}/)||[])[0]||'';
async function api(kind){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind,{headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'}});
 const data=await r.json().catch(()=>({error:'Unreadable server response.'}));if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
function notice(text){const n=root()?.querySelector('#portalStatus');if(n)n.textContent=text;}
function openTab(tab){window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab}}));}
async function enhance(){
 if(activeTab()!=='school_setup'||loading)return;
 const area=root()?.querySelector('#portalContent');if(!area||area.querySelector('#neoLinkReadiness'))return;
 loading=true;
 try{
  const [studentsRes,classroomsRes,staffRes,parentRes,teacherRes,feesRes,invoicesRes]=await Promise.all([api('students'),api('classrooms'),api('staff'),api('parent_access'),api('teacher_access'),api('fee_structures'),api('invoices')]);
  const students=studentsRes.records||[],classrooms=classroomsRes.records||[],staff=staffRes.records||[],parents=parentRes.accounts||[],teachers=teacherRes.accounts||[],fees=feesRes.records||[],invoices=invoicesRes.records||[];
  const classroomById=new Map(classrooms.map(c=>[String(c.id),c]));
  const studentById=new Map(students.map(s=>[String(s.id),s]));
  const activeParentIds=new Set(parents.filter(x=>x.active).map(x=>String(x.student_id)));
  const teacherStaffIds=new Set(teachers.filter(x=>x.active!==false&&x.staff_id).map(x=>String(x.staff_id)));
  const feeClassroomIds=new Set(fees.map(x=>String(x.classroom_id||'')).filter(Boolean));
  const invoiceIds=new Set(invoices.map(x=>String(x.id||'')));
  const invoiceLinks=new Set(invoices.map(x=>String(x.fee_structure_id||'')+'::'+String(x.student_id||'')));
  const teaching=staff.filter(s=>s.status!=='Inactive'&&(s.staff_type==='Teaching Staff'||s.staff_category==='Teaching Staff'||s.department==='Teaching'));
  const activeStudents=students.filter(s=>String(s.status||'Active')!=='Withdrawn');
  const noTeacher=classrooms.filter(c=>!(c.teacher_staff_id||c.teacher_account_id||c.teacher_id||c.teacher));
  const noClass=activeStudents.filter(s=>{const c=classroomById.get(String(s.classroom_id||''));if(!c)return true;if(s.program&&c.program&&String(s.program)!==String(c.program))return true;const sy=ay(s.academic_year),cy=ay(c.academic_year);return !!(sy&&cy&&sy!==cy)});
  const noParent=activeStudents.filter(s=>!activeParentIds.has(String(s.id)));
  const noLogin=teaching.filter(s=>!teacherStaffIds.has(String(s.id)));
  const noFee=classrooms.filter(c=>!feeClassroomIds.has(String(c.id)));
  const missingFeeAssignments=[];
  let expectedFeeAssignments=0;
  for(const fee of fees){
   const children=activeStudents.filter(s=>String(s.classroom_id||'')===String(fee.classroom_id||''));
   for(const child of children){
    expectedFeeAssignments++;
    const expectedId='FS_'+fee.id+'_'+child.id,key=String(fee.id)+'::'+String(child.id);
    if(!invoiceIds.has(expectedId)&&!invoiceLinks.has(key))missingFeeAssignments.push({fee,student:child});
   }
  }
  const totalLinks=(classrooms.length*2)+(activeStudents.length*2)+teaching.length;
  const readyLinks=(classrooms.length-noTeacher.length)+(classrooms.length-noFee.length)+(activeStudents.length-noClass.length)+(activeStudents.length-noParent.length)+(teaching.length-noLogin.length);
  const pct=totalLinks?Math.round(readyLinks/totalLinks*100):100;
  const section=document.createElement('section');section.id='neoLinkReadiness';section.className='portal-card';
  section.innerHTML=`<span class="eyebrow">MASTER LINKING READINESS</span><h3>People, classroom & fee links</h3><p><b>${pct}% linked</b> · This checks existing master relationships only. No duplicate records are created here.</p><div class="portal-grid"><article class="portal-card"><p>Students without valid classroom</p><strong class="metric">${noClass.length}</strong><small>${activeStudents.length-noClass.length} of ${activeStudents.length} correctly linked</small><button type="button" class="secondary" data-readiness-tab="students">Open students</button></article><article class="portal-card"><p>Classrooms without teacher</p><strong class="metric">${noTeacher.length}</strong><small>${classrooms.length-noTeacher.length} of ${classrooms.length} linked</small><button type="button" class="secondary" data-readiness-tab="teacher_assignment">Open teacher assignment</button></article><article class="portal-card"><p>Students without parent login</p><strong class="metric">${noParent.length}</strong><small>${activeStudents.length-noParent.length} of ${activeStudents.length} active</small><button type="button" class="secondary" data-readiness-tab="parent_access">Open parent access</button></article><article class="portal-card"><p>Teaching Staff without login</p><strong class="metric">${noLogin.length}</strong><small>${teaching.length-noLogin.length} of ${teaching.length} linked</small><button type="button" class="secondary" data-readiness-tab="teacher_access">Open teacher access</button></article><article class="portal-card"><p>Classrooms without fee structure</p><strong class="metric">${noFee.length}</strong><small>${classrooms.length-noFee.length} of ${classrooms.length} covered</small><button type="button" class="secondary" data-readiness-tab="fee_structures">Open fee structures</button></article><article class="portal-card"><p>Missing student fee assignments</p><strong class="metric">${missingFeeAssignments.length}</strong><small>${Math.max(0,expectedFeeAssignments-missingFeeAssignments.length)} of ${expectedFeeAssignments} expected assignments present</small><button type="button" class="secondary" data-readiness-tab="fee_structures">Open fee structures</button></article></div>${noClass.length||noTeacher.length||noParent.length||noLogin.length||noFee.length||missingFeeAssignments.length?`<details><summary>Show pending items</summary>${noClass.length?`<p><b>Student classroom pending:</b> ${noClass.slice(0,12).map(s=>esc((s.name||s.id)+' · '+s.id)).join(', ')}${noClass.length>12?' …':''}</p>`:''}${noTeacher.length?`<p><b>Teacher pending:</b> ${noTeacher.slice(0,12).map(c=>esc((c.name||c.id)+' · '+(c.program||'Class'))).join(', ')}${noTeacher.length>12?' …':''}</p>`:''}${noParent.length?`<p><b>Parent login pending:</b> ${noParent.slice(0,12).map(s=>esc((s.name||s.id)+' · '+s.id)).join(', ')}${noParent.length>12?' …':''}</p>`:''}${noLogin.length?`<p><b>Teacher login pending:</b> ${noLogin.slice(0,12).map(s=>esc((s.name||s.id)+' · '+s.id)).join(', ')}${noLogin.length>12?' …':''}</p>`:''}${noFee.length?`<p><b>Fee setup pending:</b> ${noFee.slice(0,12).map(c=>esc((c.name||c.id)+' · '+(c.program||'Class'))).join(', ')}${noFee.length>12?' …':''}</p>`:''}${missingFeeAssignments.length?`<p><b>Fee assignment pending:</b> ${missingFeeAssignments.slice(0,12).map(x=>esc((studentById.get(String(x.student.id))?.name||x.student.id)+' · '+(x.fee.title||x.fee.id))).join(', ')}${missingFeeAssignments.length>12?' …':''}</p>`:''}</details>`:'<p><b>✓ All current master links are ready.</b></p>'}`;
  const rule=area.querySelector('.setup-rule');if(rule)rule.before(section);else area.append(section);
  section.querySelectorAll('[data-readiness-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.readinessTab));
 }catch(error){notice(error.message)}finally{loading=false;}
}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="school_setup"]'))setTimeout(enhance,0)},true);
enhance();
})();

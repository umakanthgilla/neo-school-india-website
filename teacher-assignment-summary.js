/* Neo School India teacher assignment summary. Additive UI only. */
(()=>{
'use strict';
if(window.__neoTeacherAssignmentSummary)return;window.__neoTeacherAssignmentSummary=true;
let currentSchool=null,loading=false,lastSchool='';
const prevOpen=window.openNeoWorkspace;
if(typeof prevOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;lastSchool='';return prevOpen.apply(this,arguments)};
const prevClose=window.closeNeoWorkspace;
if(typeof prevClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;lastSchool='';return prevClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
const base=()=>typeof BASE==='string'?BASE:'';
const auth=()=>typeof token==='string'?token:'';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function fetchAssignment(){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/teacher_assignment',{headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'}});
 const data=await r.json().catch(()=>({error:'Unreadable server response.'}));if(!r.ok)throw Error(data.error||'Unable to load teacher assignments.');return data;
}
function teacherForClass(classroom,teachers){
 const byId=teachers.find(t=>String(t.account_id)===String(classroom.teacher_account_id||'')||String(t.staff_id)===String(classroom.teacher_staff_id||''));
 if(byId)return byId;
 return teachers.find(t=>Array.isArray(t.classroom_ids)&&t.classroom_ids.some(id=>String(id)===String(classroom.id)))||null;
}
function focusClassroom(id){
 const form=root()?.querySelector('#portalForm'),select=form?.elements?.classroom_id;if(!select)return;
 if([...select.options].some(o=>String(o.value)===String(id))){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));form.scrollIntoView({behavior:'smooth',block:'start'});select.focus();}
}
async function enhance(){
 if(activeTab()!=='teacher_assignment'||loading)return;
 const area=root()?.querySelector('#portalContent');if(!area||area.querySelector('#neoTeacherAssignmentSummary'))return;
 loading=true;
 try{
  const data=await fetchAssignment(),classrooms=data.classrooms||[],teachers=data.teacher_accounts||[];
  const assigned=classrooms.filter(c=>teacherForClass(c,teachers)).length,unassigned=Math.max(0,classrooms.length-assigned);
  const section=document.createElement('section');section.id='neoTeacherAssignmentSummary';section.className='panel';
  section.innerHTML=`<span class="eyebrow">TEACHER ASSIGNMENT STATUS</span><h3>Classroom → Teacher links</h3><p>Every classroom uses one active Teaching Staff record. Reassigning a classroom moves that classroom to the newly selected teacher without creating a duplicate teacher.</p><div class="portal-grid"><article class="portal-card"><p>Total classrooms</p><strong class="metric">${classrooms.length}</strong></article><article class="portal-card"><p>Assigned</p><strong class="metric">${assigned}</strong></article><article class="portal-card"><p>Not assigned</p><strong class="metric">${unassigned}</strong></article></div><div class="portal-grid">${classrooms.map(c=>{const t=teacherForClass(c,teachers);return `<article class="portal-card"><span class="portal-pill">${t?'Assigned':'Needs teacher'}</span><h3>${esc(c.name||'Classroom')}</h3><p>${esc((c.program||'')+' · '+(c.academic_year||''))}</p>${t?`<p><b>${esc(t.name||c.teacher||'Teacher')}</b></p><p>Staff ID: ${esc(t.staff_id||c.teacher_staff_id||'—')}</p><p>Login: ${esc(t.account_id||c.teacher_account_id||'—')}</p>`:'<p>No active Teaching Staff member is linked yet.</p>'}<button type="button" class="secondary" data-assign-class="${esc(c.id)}">${t?'Change teacher':'Assign teacher'}</button></article>`}).join('')||'<p class="portal-empty">No classrooms exist yet.</p>'}</div>`;
  const editor=area.querySelector('.portal-editor');if(editor)editor.after(section);else area.prepend(section);
  section.querySelectorAll('[data-assign-class]').forEach(b=>b.onclick=()=>focusClassroom(b.dataset.assignClass));
  lastSchool=currentSchool.school_id;
 }catch(error){const status=root()?.querySelector('#portalStatus');if(status)status.textContent=error.message;}
 finally{loading=false;}
}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="teacher_assignment"]'))setTimeout(enhance,0)},true);
enhance();
})();

/* Neo School India student -> classroom -> teacher linking guard. Additive UI only. */
(()=>{
'use strict';
if(window.__neoStudentClassLink)return;window.__neoStudentClassLink=true;
let currentSchool=null,cache=null,cacheSchool='';
const previousOpen=window.openNeoWorkspace;
if(typeof previousOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;cache=null;cacheSchool='';return previousOpen.apply(this,arguments)};
const previousClose=window.closeNeoWorkspace;
if(typeof previousClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;cache=null;cacheSchool='';return previousClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ay=v=>(String(v||'').match(/20\d{2}/)||[])[0]||'';
const base=()=>typeof BASE==='string'?BASE:'';
const auth=()=>typeof token==='string'?token:'';
async function api(kind,method='GET',body=null,id=''){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind+(id?'/'+encodeURIComponent(id):''),{method,headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({error:'Unreadable server response.'}));
 if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
async function data(){
 const sid=currentSchool?.school_id||'';if(cache&&cacheSchool===sid)return cache;
 const [students,classrooms,assignment]=await Promise.all([api('students'),api('classrooms'),api('teacher_assignment')]);
 cache={students:students.records||[],classrooms:classrooms.records||assignment.classrooms||[],teachers:assignment.teacher_accounts||[]};cacheSchool=sid;return cache;
}
function teacherFor(classroom,d){
 if(!classroom)return null;
 const account=classroom.teacher_account_id||classroom.teacher_id||'';
 const staff=classroom.teacher_staff_id||'';
 return d.teachers.find(t=>String(t.account_id)===String(account)||String(t.staff_id)===String(staff)||(Array.isArray(t.classroom_ids)&&t.classroom_ids.some(id=>String(id)===String(classroom.id))))||null;
}
function notice(text){const n=root()?.querySelector('#portalStatus');if(n)n.textContent=text;}
async function enhanceStudents(){
 if(activeTab()!=='students')return;
 const area=root()?.querySelector('#portalContent');if(!area)return;
 let d;try{d=await data()}catch(e){notice(e.message);return}
 for(const button of area.querySelectorAll('[data-assign]')){
  const id=button.dataset.assign,student=d.students.find(s=>String(s.id)===String(id));if(!student)continue;
  const classroom=d.classrooms.find(c=>String(c.id)===String(student.classroom_id||'')),teacher=teacherFor(classroom,d),card=button.closest('.portal-card');
  if(card&&!card.querySelector('[data-class-teacher]')){
   const p=document.createElement('p');p.dataset.classTeacher='true';p.innerHTML='<b>Class teacher:</b> '+esc(teacher?.name||classroom?.teacher||'Not assigned');
   const tools=card.querySelector('.portal-tools');tools?.before(p);
  }
  const tools=card?.querySelector('.portal-tools');
  if(tools&&!tools.querySelector('[data-open-teacher-assignment]')){
   const manage=document.createElement('button');manage.type='button';manage.className='secondary';manage.dataset.openTeacherAssignment=id;manage.textContent='Class teacher';
   manage.onclick=()=>{if(student.classroom_id)sessionStorage.setItem('neo_teacher_assignment_classroom_id',student.classroom_id);window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'teacher_assignment'}}))};tools.append(manage);
  }
  if(button.dataset.neoClassGuard==='true')continue;button.dataset.neoClassGuard='true';
  button.onclick=()=>{
   const box=card?.querySelector('[data-extra]');if(!box)return;
   const matches=d.classrooms.filter(c=>String(c.program)===String(student.program)&&ay(c.academic_year)===ay(student.academic_year));
   box.innerHTML=`<form data-safe-classroom-form><label>Class / section<select name="classroom_id" required><option value="">Choose matching classroom…</option>${matches.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(student.classroom_id)?'selected':''}>${esc(c.name+' · '+c.program+' · '+c.academic_year)}</option>`).join('')}</select><small>Only ${esc(student.program)} classrooms for academic year ${esc(ay(student.academic_year)||student.academic_year)} are shown.</small></label><button>Save classroom</button></form>${matches.length?'':'<p class="portal-empty">Create the matching classroom section first.</p>'}`;
   const form=box.querySelector('[data-safe-classroom-form]');if(!matches.length){form?.querySelector('button')?.setAttribute('disabled','');return}
   form.onsubmit=async e=>{e.preventDefault();const submit=e.submitter;submit.disabled=true;try{await api('students','PATCH',{classroom_id:new FormData(form).get('classroom_id')},id);notice('Classroom assigned. Student programme and academic year were preserved.');cache=null;setTimeout(()=>{if(!currentSchool)return;window.openNeoWorkspace(currentSchool);setTimeout(()=>root()?.querySelector('[data-tab="students"]')?.click(),250)},250)}catch(error){notice(error.message);submit.disabled=false}};
  };
 }
}
function presetTeacherAssignment(){
 if(activeTab()!=='teacher_assignment')return;
 const id=sessionStorage.getItem('neo_teacher_assignment_classroom_id');if(!id)return;
 const form=root()?.querySelector('#portalForm');const select=form?.elements?.classroom_id;if(!select)return;
 if([...select.options].some(o=>String(o.value)===String(id))){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}
 sessionStorage.removeItem('neo_teacher_assignment_classroom_id');
}
function enhance(){enhanceStudents();presetTeacherAssignment()}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="students"],#neoWorkspace [data-tab="teacher_assignment"]'))setTimeout(enhance,0)},true);
enhance();
})();

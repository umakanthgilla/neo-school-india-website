/* Additive Student 360 link summary. Reuses existing Student ID and connected master records. */
(()=>{
'use strict';
if(window.__neoStudent360Links)return;window.__neoStudent360Links=true;
let currentSchool=null,requestSeq=0;
const prevOpen=window.openNeoWorkspace;
if(typeof prevOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;return prevOpen.apply(this,arguments)};
const prevClose=window.closeNeoWorkspace;
if(typeof prevClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;return prevClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const base=()=>typeof BASE==='string'?BASE:'';
const auth=()=>typeof token==='string'?token:'';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function portal(kind){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind,{headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'}});
 const d=await r.json().catch(()=>({error:'Unreadable server response.'}));if(!r.ok)throw Error(d.error||kind+' unavailable.');return d;
}
async function transport(){
 const r=await fetch(base()+'/api/transport/school/routes/'+encodeURIComponent(currentSchool.school_id),{headers:{Authorization:'Bearer '+auth()}});
 const d=await r.json().catch(()=>({error:'Unreadable transport response.'}));if(!r.ok)throw Error(d.error||'Transport unavailable.');return d;
}
const row=(label,value)=>'<div class="student-360-row"><strong>'+esc(label)+'</strong><span>'+esc(value||'Not available')+'</span></div>';
const section=(title,body)=>'<section class="student-360-section neo-360-linked"><h4>'+esc(title)+'</h4>'+body+'</section>';
function openTab(tab){window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab}}));}
async function enhance(button){
 const card=button.closest('article'),box=card?.querySelector('[data-extra]'),profile=box?.querySelector('.student-360');
 if(!profile||profile.querySelector('.neo-360-linked')||!currentSchool)return;
 const studentId=button.dataset.profile;if(!studentId)return;
 const seq=++requestSeq;
 const grid=profile.querySelector('.student-360-grid');if(!grid)return;
 const loading=document.createElement('section');loading.className='student-360-section neo-360-loading';loading.innerHTML='<h4>Connected status</h4><p class="student-360-muted">Loading classroom, lifecycle and transport links…</p>';grid.append(loading);
 try{
  const results=await Promise.allSettled([portal('students'),portal('classrooms'),portal('staff'),portal('teacher_access'),portal('parent_access'),portal('student_movements'),portal('student_tc'),transport()]);
  if(seq!==requestSeq||!profile.isConnected)return;
  const value=i=>results[i].status==='fulfilled'?results[i].value:null;
  const students=value(0)?.records||[],classrooms=value(1)?.records||[],staff=value(2)?.records||[],teachers=value(3)?.accounts||value(3)?.records||[],parents=value(4)?.accounts||value(4)?.records||[],movements=value(5)?.records||[],certificates=value(6)?.records||[],tr=value(7)||{};
  const child=students.find(s=>String(s.id)===String(studentId));
  const classroom=classrooms.find(c=>String(c.id)===String(child?.classroom_id||''));
  const teacherRef=classroom?.teacher_staff_id||classroom?.teacher_id||classroom?.teacher_account_id||classroom?.teacher||'';
  const teacherAccount=teachers.find(t=>String(t.staff_id||'')===String(teacherRef)||String(t.account_id||'')===String(teacherRef)||((t.classroom_ids||[]).map(String).includes(String(classroom?.id||''))));
  const teacherStaff=staff.find(s=>String(s.id)===String(teacherAccount?.staff_id||teacherRef));
  const parent=parents.find(p=>String(p.student_id||'')===String(studentId));
  const history=movements.filter(m=>String(m.student_id||'')===String(studentId)).sort((a,b)=>String(b.effective_date||b.created_at||'').localeCompare(String(a.effective_date||a.created_at||'')));
  const tcs=certificates.filter(tc=>String(tc.student_id||'')===String(studentId));
  const assignment=(tr.assignments||[]).find(a=>String(a.student_id||'')===String(studentId)&&a.active!==false);
  const route=(tr.routes||[]).find(r=>String(r.id)===String(assignment?.route_id||''));
  const vehicle=(tr.vehicles||[]).find(v=>String(v.id)===String(route?.vehicle_id||''));
  loading.remove();
  grid.insertAdjacentHTML('beforeend',
   section('Classroom & teacher',row('Class / section',classroom?((classroom.name||classroom.id)+' · '+(classroom.program||child?.program||'')):'Not linked')+row('Academic year',classroom?.academic_year||child?.academic_year||'Not recorded')+row('Class teacher',teacherStaff?.name||teacherAccount?.name||(teacherRef?'Legacy teacher link':'Not assigned'))+(teacherStaff?row('Teacher Staff ID',teacherStaff.id):''))+
   section('Parent login',row('Access status',parent?(parent.active===false?'Disabled':'Enabled'):'Not linked')+row('Parent Account ID',parent?.account_id||'Not created'))+
   section('Promotion / TC history',row('Movement records',String(history.length))+row('Transfer certificates',String(tcs.length))+(history.length?'<p class="student-360-muted">'+history.slice(0,4).map(m=>esc((m.type||'Movement')+' · '+(m.from_academic_year||'')+(m.to_academic_year?' → '+m.to_academic_year:'')+' · '+(m.effective_date||''))).join('<br>')+'</p>':'<p class="student-360-muted">No promotion, section change or withdrawal history yet.</p>')+(tcs.length?'<p class="student-360-muted">TC: '+tcs.slice(0,3).map(tc=>esc(tc.certificate_no||tc.id)).join(' · ')+'</p>':''))+
   section('Transport',assignment?row('Route',route?.name||assignment.route_id)+row('Stop',assignment.stop||'Not recorded')+row('Run','Run '+(assignment.run_no||1))+row('Vehicle',vehicle?((vehicle.registration_no||'')+' · '+(vehicle.label||'')).trim():'Vehicle not assigned'):row('Transport status',results[7].status==='rejected'?'Transport data unavailable':'No active transport assignment'))
  );
  const actions=profile.querySelector('.actions');if(actions&&!actions.querySelector('[data-360-linked-action]'))actions.insertAdjacentHTML('beforeend','<button type="button" class="secondary" data-360-linked-action="parent_access">Parent access</button><button type="button" class="secondary" data-360-linked-action="student_lifecycle">Promotion / TC</button><button type="button" class="secondary" data-360-linked-action="transport">Transport</button>');
  profile.querySelectorAll('[data-360-linked-action]').forEach(b=>b.onclick=()=>openTab(b.dataset['360LinkedAction']));
 }catch(error){loading.innerHTML='<h4>Connected status</h4><p class="student-360-muted">'+esc(error.message||'Connected records could not load.')+'</p>';}
}
document.addEventListener('click',e=>{const button=e.target.closest('#neoWorkspace [data-profile]');if(!button)return;setTimeout(()=>enhance(button),0)},true);
})();

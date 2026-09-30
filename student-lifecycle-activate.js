/* Activate the existing Student Lifecycle renderer from the school portal without duplicating lifecycle business logic. */
(()=>{
'use strict';
if(window.__neoStudentLifecycleActivate)return;window.__neoStudentLifecycleActivate=true;
let currentSchool=null,rendering=false,rerenderTimer=0;
const previousOpen=window.openNeoWorkspace;
if(typeof previousOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;return previousOpen.apply(this,arguments)};
const previousClose=window.closeNeoWorkspace;
if(typeof previousClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;return previousClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
const base=()=>typeof BASE==='string'?BASE:'';
const auth=()=>typeof token==='string'?token:'';
async function call(kind,method='GET',body=null,id=''){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind+(id?'/'+encodeURIComponent(id):''),{method,headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({error:'Unreadable server response.'}));if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
function status(text){const box=root()?.querySelector('#portalStatus');if(box)box.textContent=text||'';}
async function fetchRecords(){
 const [students,classrooms,fees]=await Promise.all([call('students'),call('classrooms'),call('fee_structures')]);
 return {students:students.records||[],classrooms:classrooms.records||[],fee_structures:fees.records||[]};
}
async function render(){
 if(rendering||activeTab()!=='student_lifecycle'||!currentSchool)return;
 const area=root()?.querySelector('#portalContent');if(!area||typeof window.renderNeoStudentLifecycle!=='function')return;
 rendering=true;
 try{
  const records=await fetchRecords();
  if(activeTab()!=='student_lifecycle')return;
  const refresh=async()=>{clearTimeout(rerenderTimer);rerenderTimer=setTimeout(()=>render(),80)};
  await window.renderNeoStudentLifecycle(area,{records,call,refresh,status});
 }catch(error){area.innerHTML='<div class="portal-error"><h3>Student lifecycle unavailable</h3><p>'+String(error.message||error)+'</p></div>';}finally{rendering=false;}
}
function schedule(){clearTimeout(rerenderTimer);rerenderTimer=setTimeout(render,0)}
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="student_lifecycle"]'))schedule()},true);
window.addEventListener('neo:open-tab',e=>{if(e.detail?.tab==='student_lifecycle')schedule()});
new MutationObserver(()=>{if(activeTab()==='student_lifecycle'&&!root()?.querySelector('#neoMovementForm'))schedule()}).observe(document.body,{childList:true,subtree:true});
})();

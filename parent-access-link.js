/* Neo School India: student -> parent access clarity and direct linking. Additive UI only. */
(()=>{
'use strict';
if(window.__neoParentAccessLink)return;window.__neoParentAccessLink=true;
let currentSchool=null,cache=null,cacheSchool='';
const prevOpen=window.openNeoWorkspace;
if(typeof prevOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;cache=null;cacheSchool='';return prevOpen.apply(this,arguments)};
const prevClose=window.closeNeoWorkspace;
if(typeof prevClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;cache=null;cacheSchool='';return prevClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
const base=()=>typeof BASE==='string'?BASE:'';
const auth=()=>typeof token==='string'?token:'';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(kind){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind,{headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'}});
 const data=await r.json().catch(()=>({error:'Unreadable server response.'}));if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
async function load(){
 const sid=currentSchool?.school_id||'';if(cache&&cacheSchool===sid)return cache;
 const [students,access]=await Promise.all([api('students'),api('parent_access')]);
 cache={students:students.records||[],accounts:access.accounts||[]};cacheSchool=sid;return cache;
}
function notice(text){const n=root()?.querySelector('#portalStatus');if(n)n.textContent=text;}
function accountFor(id,d){return d.accounts.find(a=>String(a.student_id)===String(id))||null;}
async function enhanceStudents(){
 if(activeTab()!=='students')return;
 const area=root()?.querySelector('#portalContent');if(!area)return;
 let d;try{d=await load()}catch(e){notice(e.message);return}
 for(const button of area.querySelectorAll('[data-assign]')){
  const id=button.dataset.assign,student=d.students.find(s=>String(s.id)===String(id));if(!student)continue;
  const account=accountFor(id,d),card=button.closest('.portal-card'),tools=card?.querySelector('.portal-tools');
  if(card&&!card.querySelector('[data-parent-access-status]')){
   const p=document.createElement('p');p.dataset.parentAccessStatus='true';
   p.innerHTML='<b>Parent login:</b> '+(account?(account.active?'Active · '+esc(account.account_id):'Disabled · '+esc(account.account_id)):'Not created');
   tools?.before(p);
  }
  if(tools&&!tools.querySelector('[data-parent-access-open]')){
   const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.parentAccessOpen=id;b.textContent=account?'Parent login / reset':'Create parent login';
   b.onclick=()=>{sessionStorage.setItem('neo_parent_access_student_id',id);window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'parent_access'}}))};tools.append(b);
  }
 }
}
async function enhanceParentAccess(){
 if(activeTab()!=='parent_access')return;
 const area=root()?.querySelector('#portalContent');if(!area)return;
 let d;try{d=await load()}catch(e){notice(e.message);return}
 const active=d.accounts.filter(a=>a.active).length,pending=Math.max(0,d.students.length-active),editor=area.querySelector('.portal-editor');
 if(!area.querySelector('#neoParentAccessSummary')){
  const panel=document.createElement('section');panel.id='neoParentAccessSummary';panel.className='portal-card';
  panel.innerHTML='<h3>Parent access status</h3><p><b>'+active+'</b> active parent login'+(active===1?'':'s')+' · <b>'+pending+'</b> student'+(pending===1?'':'s')+' without active login.</p><p>Creating or resetting access always reuses the existing Student ID. It does not create another student record.</p>';
  editor?.before(panel);
 }
 const form=area.querySelector('#accessForm'),select=form?.elements?.student_id;if(!select)return;
 for(const option of [...select.options]){
  if(!option.value)continue;const a=accountFor(option.value,d);if(a&&!option.dataset.parentState){option.textContent+=' · '+(a.active?'Login active':'Login disabled');option.dataset.parentState='true';}
 }
 const wanted=sessionStorage.getItem('neo_parent_access_student_id');
 if(wanted&&[...select.options].some(o=>String(o.value)===String(wanted))){select.value=wanted;select.dispatchEvent(new Event('change',{bubbles:true}));sessionStorage.removeItem('neo_parent_access_student_id');editor.open=true;editor.scrollIntoView({behavior:'smooth',block:'start'});}
}
function enhance(){enhanceStudents();enhanceParentAccess()}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="students"],#neoWorkspace [data-tab="parent_access"]'))setTimeout(enhance,0)},true);
enhance();
})();

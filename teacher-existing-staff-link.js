/* Neo School India: link an existing Teaching Staff ID to employee/teacher login without duplicating the staff master. */
(()=>{
'use strict';
if(window.__neoExistingTeacherLink)return;window.__neoExistingTeacherLink=true;
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
async function api(kind,method='GET',body=null,id=''){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const r=await fetch(base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind+(id?'/'+encodeURIComponent(id):''),{method,headers:{Authorization:'Bearer '+auth(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({error:'Unreadable server response.'}));if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
function strong(v){return typeof v==='string'&&v.length>=8&&v.length<=128&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-z0-9\s]/.test(v);}
function notice(text){const n=root()?.querySelector('#portalStatus');if(n)n.textContent=text;}
async function enhance(){
 if(activeTab()!=='teacher_access'||loading)return;
 const area=root()?.querySelector('#portalContent');if(!area||area.querySelector('#neoExistingTeacherLink'))return;
 loading=true;
 try{
  const [staffRes,accessRes]=await Promise.all([api('staff'),api('teacher_access')]);
  const staff=staffRes.records||[],accounts=accessRes.accounts||[],linked=new Set(accounts.map(a=>String(a.staff_id||'')).filter(Boolean));
  const available=staff.filter(s=>s.status!=='Inactive'&&(s.staff_type==='Teaching Staff'||s.staff_category==='Teaching Staff'||s.department==='Teaching')&&!linked.has(String(s.id)));
  const panel=document.createElement('details');panel.id='neoExistingTeacherLink';panel.className='portal-editor';panel.open=available.length>0;
  panel.innerHTML=`<summary>🔗 Link existing Teaching Staff ID to login</summary><p>Use this for teachers added through Bulk Upload or HR Staff Master. It creates login access for the existing Staff ID only — it does not create another employee record.</p>${available.length?`<form data-existing-teacher-form><div class="fields"><label>Existing Teaching Staff<select name="staff_id" required><option value="">Choose Staff ID…</option>${available.map(s=>`<option value="${esc(s.id)}">${esc((s.name||'Teacher')+' · '+s.id+' · '+(s.role||'Teaching'))}</option>`).join('')}</select></label><label>Initial password<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"><small>Use uppercase, lowercase, number and symbol.</small></label></div><button>Link Staff ID & activate login</button></form>`:'<p class="portal-empty">All active Teaching Staff records already have login access, or no unlinked Teaching Staff exists.</p>'}<div data-existing-teacher-result role="status"></div>`;
  const firstEditor=area.querySelector('.portal-editor');if(firstEditor)firstEditor.before(panel);else area.prepend(panel);
  const form=panel.querySelector('[data-existing-teacher-form]');if(form)form.onsubmit=async e=>{e.preventDefault();const button=e.submitter,fd=new FormData(form),staff_id=String(fd.get('staff_id')||''),password=String(fd.get('password')||'');if(!strong(password)){notice('Password must include uppercase, lowercase, number and symbol.');return}button.disabled=true;try{const out=await api('teacher_access','POST',{staff_id,password,classroom_ids:[]});panel.querySelector('[data-existing-teacher-result]').textContent='✓ Login linked to Staff ID '+staff_id+(out.account_id?' · Login ID: '+out.account_id:'')+'. Classroom assignment remains separate.';notice('Existing Teaching Staff login activated without creating a duplicate employee.');setTimeout(()=>{if(!currentSchool)return;window.openNeoWorkspace(currentSchool);setTimeout(()=>root()?.querySelector('[data-tab="teacher_access"]')?.click(),250)},500)}catch(error){notice(error.message);button.disabled=false}};
 }catch(error){notice(error.message)}finally{loading=false;}
}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="teacher_access"]'))setTimeout(enhance,0)},true);
enhance();
})();

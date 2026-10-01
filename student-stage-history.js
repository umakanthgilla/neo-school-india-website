/* Neo School India student stage history rules for manual Student Add form. */
(()=>{
'use strict';
if(window.__neoStudentStageHistory)return;window.__neoStudentStageHistory=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const yearNow=new Date().getFullYear();
const yearOptions=()=>Array.from({length:10},(_,i)=>yearNow-i).map(y=>`<option value="${y}">${y}</option>`).join('');
function selectHtml(name,label,options,required=true){return `<label>${esc(label)}<select name="${name}" ${required?'required':''}><option value="">Choose…</option>${options.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`}
function textHtml(name,label,required=true){return `<label>${esc(label)}<input name="${name}" type="text" maxlength="200" ${required?'required':''}></label>`}
function yearHtml(name,label){return `<label>${esc(label)}<select name="${name}" required><option value="">Choose year…</option>${yearOptions()}</select></label>`}
function removeLegacy(form){for(const name of ['nursery_status','lkg_status','previous_school','previous_city']){const el=form.elements?.[name];if(el)el.closest('label')?.remove()}}
function render(form){
 const host=form.querySelector('[data-neo-stage-history]');if(!host)return;
 const program=String(form.elements?.program?.value||'').trim();
 if(host.dataset.program===program)return;host.dataset.program=program;
 if(program==='Nursery'){
  host.innerHTML='<div class="neo-bulk-note"><b>Previous stage:</b> Playgroup is optional for Nursery admission.</div>'+selectHtml('playgroup_status','Playgroup history',['Completed','Not attended / First school']);
 }else if(program==='LKG'){
  host.innerHTML='<div class="neo-bulk-note"><b>Previous stage:</b> Nursery completion details are required for LKG.</div>'+selectHtml('nursery_status','Nursery status',['Completed'])+textHtml('nursery_school','Nursery completed school')+textHtml('nursery_city','Nursery school city')+yearHtml('nursery_year','Nursery completion year');
 }else if(program==='UKG'){
  host.innerHTML='<div class="neo-bulk-note"><b>Previous stages:</b> Nursery and LKG completion details are required for UKG.</div>'+selectHtml('nursery_status','Nursery status',['Completed'])+textHtml('nursery_school','Nursery completed school')+textHtml('nursery_city','Nursery school city')+yearHtml('nursery_year','Nursery completion year')+selectHtml('lkg_status','LKG status',['Completed'])+textHtml('lkg_school','LKG completed school')+textHtml('lkg_city','LKG school city')+yearHtml('lkg_year','LKG completion year');
 }else if(program==='Playgroup'){
  host.innerHTML='<div class="neo-bulk-note"><b>Starting stage:</b> No previous class history is required for Playgroup.</div>';
 }else if(program==='Daycare'){
  host.innerHTML='<div class="neo-bulk-note"><b>Daycare:</b> Previous academic-class history is not required.</div>';
 }else host.innerHTML='<div class="neo-bulk-note">Select a classroom to load the correct previous-stage fields.</div>';
}
function enhance(){
 document.querySelectorAll('form').forEach(form=>{
  const nursery=form.elements?.nursery_status,lkg=form.elements?.lkg_status,program=form.elements?.program;
  if(!program||(!nursery&&!lkg)||form.dataset.neoStageHistory)return;
  form.dataset.neoStageHistory='true';removeLegacy(form);
  const host=document.createElement('div');host.dataset.neoStageHistory='true';
  const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.before(host);else form.append(host);
  form.addEventListener('change',()=>requestAnimationFrame(()=>render(form)),true);
  form.addEventListener('input',()=>requestAnimationFrame(()=>render(form)),true);
  render(form);
 });
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
document.addEventListener('change',schedule,true);enhance();
})();

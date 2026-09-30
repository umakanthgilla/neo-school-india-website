/* Neo School India portal compatibility guards. Keep display labels rich while preserving backend data contracts. */
(()=>{
'use strict';
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';

function normalizeAcademicYearControls(){
  if(activeTab()!=='classrooms')return;
  const select=root()?.querySelector('#portalForm select[name="academic_year"]');
  if(!select)return;
  for(const option of select.options){
    const match=String(option.value||'').match(/^(20\d{2})-\d{2}$/);
    if(match)option.value=match[1];
  }
}

document.addEventListener('submit',event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||!form.closest('#neoWorkspace'))return;
  const field=form.elements?.academic_year;
  if(!field)return;
  const match=String(field.value||'').match(/^(20\d{2})-\d{2}$/);
  if(match)field.value=match[1];
},true);

new MutationObserver(()=>queueMicrotask(normalizeAcademicYearControls)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',event=>{if(event.target.closest('#neoWorkspace [data-tab="classrooms"]'))setTimeout(normalizeAcademicYearControls,0)},true);
normalizeAcademicYearControls();
})();

/* Keep dashboard operational-status copy aligned with modules that are already live. */
(()=>{
'use strict';
if(window.__neoPortalLiveStatus)return;window.__neoPortalLiveStatus=true;
function sync(){
 const root=document.getElementById('neoWorkspace');if(!root||root.hidden)return;
 const active=root.querySelector('.neo-department-nav [data-tab="dashboard"][aria-pressed="true"]');if(!active)return;
 for(const p of root.querySelectorAll('#portalContent .portal-card p')){
  const text=p.textContent||'';
  if(text.includes('Visitor & Gate and Transport remain planned integrations.'))p.textContent='Transport & Safety is connected to the live school transport workflow. Visitor & Gate remains a planned integration.';
 }
}
new MutationObserver(()=>queueMicrotask(sync)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="dashboard"]'))setTimeout(sync,0)},true);
sync();
})();

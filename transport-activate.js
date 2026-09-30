/* Activate the existing NeoTransport school workspace from the school portal. */
(()=>{
'use strict';
if(window.__neoTransportActivate)return;window.__neoTransportActivate=true;
let currentSchool=null,currentMode='setup',rendering=false,timer=0;
const previousOpen=window.openNeoWorkspace;
if(typeof previousOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;currentMode='setup';return previousOpen.apply(this,arguments)};
const previousClose=window.closeNeoWorkspace;
if(typeof previousClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;return previousClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
const modes=[['setup','Setup'],['monitor','Today Monitor'],['reports','Reports'],['documents','Documents']];
function shell(area){
 if(area.querySelector('#neoTransportLive'))return area.querySelector('#neoTransportLiveBody');
 area.innerHTML=`<section id="neoTransportLive"><div class="panel"><span class="eyebrow">TRANSPORT & SAFETY</span><h2>School Transport Workspace</h2><p>Vehicle setup, child assignments, live trip monitoring, reports and compliance documents use the existing Transport backend.</p><div class="actions" data-transport-live-nav>${modes.map(([value,label])=>`<button type="button" class="${value===currentMode?'':'secondary'}" data-transport-live-mode="${value}">${label}</button>`).join('')}</div></div><div id="neoTransportLiveBody"></div></section>`;
 area.querySelectorAll('[data-transport-live-mode]').forEach(button=>button.onclick=()=>{currentMode=button.dataset.transportLiveMode;render()});
 return area.querySelector('#neoTransportLiveBody');
}
async function render(){
 if(rendering||activeTab()!=='transport'||!currentSchool)return;
 const area=root()?.querySelector('#portalContent');
 if(!area||!window.NeoTransport?.school)return;
 rendering=true;
 try{
  let body=shell(area);
  area.querySelectorAll('[data-transport-live-mode]').forEach(button=>{button.classList.toggle('secondary',button.dataset.transportLiveMode!==currentMode)});
  body.innerHTML='<p class="portal-empty">Loading transport workspace…</p>';
  await window.NeoTransport.school(body,{school:currentSchool,token:typeof token==='string'?token:'',base:typeof BASE==='string'?BASE:'',mode:currentMode});
 }catch(error){
  const body=area.querySelector('#neoTransportLiveBody')||area;
  body.innerHTML='<div class="portal-error"><h3>Transport unavailable</h3><p>'+String(error.message||error)+'</p></div>';
 }finally{rendering=false;}
}
function schedule(){clearTimeout(timer);timer=setTimeout(render,0)}
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="transport"]'))schedule()},true);
window.addEventListener('neo:open-tab',e=>{if(e.detail?.tab==='transport')schedule()});
new MutationObserver(()=>{if(activeTab()==='transport'&&!root()?.querySelector('#neoTransportLive'))schedule()}).observe(document.body,{childList:true,subtree:true});
})();

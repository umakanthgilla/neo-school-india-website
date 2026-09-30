/* Optional Transport status inside School Setup readiness. Does not affect core readiness percentage. */
(()=>{
'use strict';
if(window.__neoTransportReadiness)return;window.__neoTransportReadiness=true;
let currentSchool=null,loading=false;
const previousOpen=window.openNeoWorkspace;
if(typeof previousOpen==='function')window.openNeoWorkspace=function(s){currentSchool=s||null;return previousOpen.apply(this,arguments)};
const previousClose=window.closeNeoWorkspace;
if(typeof previousClose==='function')window.closeNeoWorkspace=function(){currentSchool=null;return previousClose.apply(this,arguments)};
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
async function transportData(){
 if(!currentSchool?.school_id)throw Error('Open a school portal first.');
 const base=typeof BASE==='string'?BASE:'',auth=typeof token==='string'?token:'';
 const r=await fetch(base+'/api/transport/school/routes/'+encodeURIComponent(currentSchool.school_id),{headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'}});
 const data=await r.json().catch(()=>({error:'Unreadable transport response.'}));
 if(!r.ok)throw Error(data.error||'Transport unavailable.');return data;
}
async function enhance(){
 if(activeTab()!=='school_setup'||loading)return;
 const grid=root()?.querySelector('#neoLinkReadiness .portal-grid');if(!grid||grid.querySelector('[data-transport-readiness]'))return;
 loading=true;
 try{
  const d=await transportData(),vehicles=(d.vehicles||[]).filter(x=>x.active!==false),routes=(d.routes||[]).filter(x=>x.active!==false),assignments=(d.assignments||[]).filter(x=>x.active!==false);
  const card=document.createElement('article');card.className='portal-card';card.dataset.transportReadiness='true';
  card.innerHTML='<p>Transport setup <small>Optional</small></p><strong class="metric">'+routes.length+'</strong><small>'+vehicles.length+' active vehicle'+(vehicles.length===1?'':'s')+' · '+routes.length+' route'+(routes.length===1?'':'s')+' · '+assignments.length+' child assignment'+(assignments.length===1?'':'s')+'</small><button type="button" class="secondary">Open transport</button>';
  card.querySelector('button').onclick=()=>window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'transport'}}));grid.append(card);
 }catch(_error){
  const card=document.createElement('article');card.className='portal-card';card.dataset.transportReadiness='true';card.innerHTML='<p>Transport setup <small>Optional</small></p><strong class="metric">—</strong><small>Transport is optional. Open the module when this school uses school transport.</small><button type="button" class="secondary">Open transport</button>';card.querySelector('button').onclick=()=>window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'transport'}}));grid.append(card);
 }finally{loading=false;}
}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="school_setup"]'))setTimeout(enhance,0)},true);
enhance();
})();

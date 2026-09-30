/* Final school-portal handover UI cleanup: maintenance tabs + library rack map. */
(()=>{
'use strict';
if(window.__neoHandoverUiCleanup)return;window.__neoHandoverUiCleanup=true;
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
let timer=0;

const style=document.createElement('style');
style.textContent=`
.neo-module-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.neo-module-tabs button{border:1px solid #d7e2f2;border-radius:14px;background:#fff;color:#102052;padding:12px 10px;font-weight:800;box-shadow:0 4px 12px rgba(16,32,82,.06)}.neo-module-tabs button[aria-selected="true"]{background:linear-gradient(135deg,#0d2b6e,#1557a6);color:#fff;border-color:transparent;box-shadow:0 8px 20px rgba(13,43,110,.2)}.neo-maint-panel[hidden],.neo-library-panel[hidden]{display:none!important}.neo-maint-panel{margin-top:8px}.neo-rack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.neo-rack-card{border:1px solid #d7e2f2;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fbff);padding:16px;box-shadow:0 8px 20px rgba(16,32,82,.07)}.neo-rack-card h4{margin:0 0 8px;color:#102052}.neo-rack-card p{margin:5px 0}.neo-rack-code{display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:30px;border-radius:999px;background:#edf4ff;color:#0d2b6e;font-weight:800;margin-bottom:10px}.neo-library-note{border:1px solid #d7e2f2;border-radius:14px;padding:12px 14px;background:#f8fbff;margin:12px 0}.neo-library-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:760px){.neo-module-tabs,.neo-library-tabs{grid-template-columns:1fr 1fr}.neo-rack-grid{grid-template-columns:1fr}}
`;
document.head.append(style);

function directHeading(container,text){return [...container.children].find(x=>x.tagName==='H3'&&x.textContent.trim().startsWith(text))||null}
function sectionPair(container,text){const heading=directHeading(container,text),grid=heading?.nextElementSibling?.classList?.contains('portal-grid')?heading.nextElementSibling:null;return {heading,grid}}

function enhanceMaintenance(){
 if(activeTab()!=='maintenance')return;
 const area=root()?.querySelector('#portalContent'),fac=area?.querySelector('#neoFacilities');
 if(!fac||fac.dataset.handoverTabs==='true')return;
 const editors=[...fac.querySelectorAll('details.portal-editor')].slice(0,4);if(editors.length<4)return;
 fac.dataset.handoverTabs='true';
 const formGrid=editors[0].parentElement;if(!formGrid)return;
 const assignment=sectionPair(fac,'Housekeeping assignments'),verification=sectionPair(fac,'Cleaning verification'),requests=sectionPair(fac,'Shortage & maintenance requests');
 const defs=[
  ['areas','Areas & zones',editors[0],null],
  ['assignments','Assignments',editors[1],assignment],
  ['verification','Cleaning verification',editors[2],verification],
  ['requests','Shortage / repairs',editors[3],requests]
 ];
 const nav=document.createElement('div');nav.className='neo-module-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Maintenance sections');
 const panels=document.createElement('div');panels.className='neo-maint-panels';
 const activate=id=>{
  nav.querySelectorAll('[data-maint-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.maintTab===id)));
  panels.querySelectorAll('[data-maint-panel]').forEach(p=>p.hidden=p.dataset.maintPanel!==id);
 };
 defs.forEach(([id,label,editor,pair],index)=>{
  const b=document.createElement('button');b.type='button';b.dataset.maintTab=id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(index===0));b.textContent=label;b.onclick=()=>activate(id);nav.append(b);
  const panel=document.createElement('section');panel.className='neo-maint-panel';panel.dataset.maintPanel=id;panel.hidden=index!==0;panel.append(editor);if(pair?.heading)panel.append(pair.heading);if(pair?.grid)panel.append(pair.grid);panels.append(panel);
 });
 formGrid.before(nav);formGrid.replaceWith(panels);
}

function rackPanel(id,title,subtitle,cards){return `<section class="neo-library-panel" data-library-panel="${id}" ${id==='rack1'?'':'hidden'}><h3>${title}</h3><p>${subtitle}</p><div class="neo-rack-grid">${cards.map(([code,name,detail])=>`<article class="neo-rack-card"><span class="neo-rack-code">${code}</span><h4>${name}</h4><p>${detail}</p></article>`).join('')}</div></section>`}
function enhanceLibrary(){
 if(activeTab()!=='library')return;
 const area=root()?.querySelector('#portalContent');if(!area||area.querySelector('#neoLibraryRacks'))return;
 area.innerHTML=`<div id="neoLibraryRacks"><span class="eyebrow">LIBRARY · PHYSICAL STORAGE MAP</span><h2>Library racks</h2><p>Keep the physical library simple with three clearly labelled racks. Quantity/stock remains in Inventory & Stores, so no duplicate stock register is created here.</p><div class="neo-library-note"><strong>Rack labels:</strong> RACK 1 · RACK 2 · RACK 3. Put the same labels on the physical shelves so staff can locate books quickly.</div><div class="neo-module-tabs neo-library-tabs" role="tablist" aria-label="Library racks"><button type="button" data-library-tab="rack1" aria-selected="true">Rack 1 · Learning books</button><button type="button" data-library-tab="rack2" aria-selected="false">Rack 2 · Stories & activity</button><button type="button" data-library-tab="rack3" aria-selected="false">Rack 3 · Teacher & spare</button></div>${rackPanel('rack1','Rack 1 · Student learning books','Core classroom learning books arranged shelf-wise.',[['1A','Literacy','Literacy and phonics / early-reading books'],['1B','Numeracy & readiness','Numeracy, readiness and practice books'],['1C','Language & EVS','Language and Environmental Studies books']])}${rackPanel('rack2','Rack 2 · Stories & activity books','Shared reading, creative and home-activity materials.',[['2A','Story / fantasy','Story, fantasy and read-aloud books'],['2B','Drawing & art','Drawing books and art/activity resources'],['2C','Home activity','Home activity and parent-child reading material']])}${rackPanel('rack3','Rack 3 · Teacher, reference & spare','Controlled copies and replacements kept separately.',[['3A','Teacher resources','Teacher guides and classroom reference copies'],['3B','Reference copies','Master/reference editions and school-use copies'],['3C','Spare / replacement','Extra books kept for replacement or new admissions']])}<div class="actions" style="margin-top:16px"><button type="button" class="secondary" data-library-inventory>Open Inventory & Stores</button></div></div>`;
 const activate=id=>{area.querySelectorAll('[data-library-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.libraryTab===id)));area.querySelectorAll('[data-library-panel]').forEach(p=>p.hidden=p.dataset.libraryPanel!==id)};
 area.querySelectorAll('[data-library-tab]').forEach(b=>b.onclick=()=>activate(b.dataset.libraryTab));
 area.querySelector('[data-library-inventory]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'inventory'}})));
}
function enhance(){enhanceMaintenance();enhanceLibrary()}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,80)}
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="maintenance"],#neoWorkspace [data-tab="library"]'))schedule()},true);
window.addEventListener('neo:open-tab',e=>{if(['maintenance','library'].includes(e.detail?.tab))schedule()});
new MutationObserver(()=>{if(['maintenance','library'].includes(activeTab()))schedule()}).observe(document.body,{childList:true,subtree:true});
schedule();
})();

/* Final school-portal handover UI cleanup: vertical Maintenance submenu + clear Library rack map. */
(()=>{
'use strict';
if(window.__neoHandoverUiCleanup)return;window.__neoHandoverUiCleanup=true;
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
let timer=0,selectedMaintenance='areas';
const maintenanceSections=[
 ['areas','Area / Zone Setup'],
 ['assignments','Assign Attendant & Verifier'],
 ['verification','Cleaning Verification'],
 ['requests','Shortage / Repair Request']
];

const style=document.createElement('style');
style.textContent=`
.neo-maint-submenu .actions{display:grid!important;gap:6px}.neo-maint-submenu .actions button{width:100%;text-align:left;justify-content:flex-start!important;min-height:40px;padding:9px 12px!important;border-radius:10px!important}.neo-maint-submenu .actions button.is-active{background:#dceaff!important;color:#071b52!important;font-weight:850;box-shadow:inset 3px 0 #1557a6}.neo-maint-panel[hidden]{display:none!important}.neo-maint-panel{margin-top:10px}.neo-maint-panel details.portal-editor{margin-top:0}.neo-library-shell{display:grid;gap:16px}.neo-library-intro{border:1px solid #d7e2f2;border-radius:16px;padding:14px 16px;background:#f8fbff}.neo-library-racks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.neo-library-rack{overflow:hidden;border:1px solid #d7e2f2;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(16,32,82,.07)}.neo-library-rack-head{padding:15px 16px;background:linear-gradient(135deg,#0d2b6e,#1557a6);color:#fff}.neo-library-rack-head small{display:block;color:#dce9ff;margin-top:4px}.neo-library-shelves{padding:8px 14px 14px}.neo-library-shelf{display:grid;grid-template-columns:58px minmax(0,1fr);gap:10px;padding:12px 0;border-bottom:1px solid #e6edf7}.neo-library-shelf:last-child{border-bottom:0}.neo-library-shelf b{display:inline-flex;align-items:center;justify-content:center;height:30px;border-radius:999px;background:#edf4ff;color:#0d2b6e;font-size:.82rem}.neo-library-shelf strong{display:block;color:#102052}.neo-library-shelf span{display:block;margin-top:3px;color:#61708b;font-size:.9rem;line-height:1.4}.neo-library-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 15px;border:1px solid #d7e2f2;border-radius:14px;background:#fbfdff}.neo-library-footer p{margin:0}
@media(max-width:820px){.neo-library-racks{grid-template-columns:1fr}.neo-library-footer{display:grid}}
`;
document.head.append(style);

function updateMaintenanceMenu(){
 const menu=root()?.querySelector('[data-maintenance-menu]');if(!menu)return;
 menu.querySelectorAll('[data-maint-section]').forEach(b=>b.classList.toggle('is-active',b.dataset.maintSection===selectedMaintenance));
}
function ensureMaintenanceNav(){
 const nav=root()?.querySelector('.neo-department-nav .school-nav-scroll');if(!nav||nav.querySelector('[data-maintenance-menu]')){updateMaintenanceMenu();return;}
 const single=nav.querySelector('.neo-single-department[data-tab="maintenance"]');if(!single)return;
 const details=document.createElement('details');details.className='panel neo-department neo-maint-submenu';details.dataset.department='maintenance';details.dataset.maintenanceMenu='true';
 const original=single.innerHTML;
 details.innerHTML=`<summary data-tab="maintenance" aria-pressed="${single.getAttribute('aria-pressed')||'false'}">${original}<span class="neo-department-chevron" aria-hidden="true"></span></summary><div class="actions">${maintenanceSections.map(([id,label])=>`<button type="button" class="secondary" data-maint-section="${id}">${label}</button>`).join('')}</div>`;
 single.replaceWith(details);
 const summary=details.querySelector('summary');
 summary.addEventListener('click',()=>setTimeout(()=>{if(details.open)window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'maintenance',maintenanceSection:selectedMaintenance}}))},0));
 details.querySelectorAll('[data-maint-section]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();selectedMaintenance=b.dataset.maintSection;details.open=true;updateMaintenanceMenu();window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'maintenance',maintenanceSection:selectedMaintenance}}))});
 details.addEventListener('toggle',()=>{if(details.open)root()?.querySelectorAll('.neo-department-nav details.neo-department').forEach(other=>{if(other!==details)other.open=false})});
 updateMaintenanceMenu();
}

function directHeading(container,text){return [...container.children].find(x=>x.tagName==='H3'&&x.textContent.trim().startsWith(text))||null}
function sectionPair(container,text){const heading=directHeading(container,text),grid=heading?.nextElementSibling?.classList?.contains('portal-grid')?heading.nextElementSibling:null;return {heading,grid}}
function enhanceMaintenance(){
 if(activeTab()!=='maintenance')return;
 const area=root()?.querySelector('#portalContent'),fac=area?.querySelector('#neoFacilities');if(!fac||fac.dataset.handoverVertical==='true')return;
 const editors=[...fac.querySelectorAll('details.portal-editor')].slice(0,4);if(editors.length<4)return;
 const formGrid=editors[0].parentElement;if(!formGrid)return;fac.dataset.handoverVertical='true';
 const assignment=sectionPair(fac,'Housekeeping assignments'),verification=sectionPair(fac,'Cleaning verification'),requests=sectionPair(fac,'Shortage & maintenance requests');
 const defs=[['areas',editors[0],null],['assignments',editors[1],assignment],['verification',editors[2],verification],['requests',editors[3],requests]];
 const panels=document.createElement('div');panels.className='neo-maint-panels';
 defs.forEach(([id,editor,pair])=>{editor.open=true;const panel=document.createElement('section');panel.className='neo-maint-panel';panel.dataset.maintPanel=id;panel.hidden=id!==selectedMaintenance;panel.append(editor);if(pair?.heading)panel.append(pair.heading);if(pair?.grid)panel.append(pair.grid);panels.append(panel)});
 formGrid.replaceWith(panels);updateMaintenanceMenu();
}

const rack=(title,subtitle,shelves)=>`<article class="neo-library-rack"><div class="neo-library-rack-head"><strong>${title}</strong><small>${subtitle}</small></div><div class="neo-library-shelves">${shelves.map(([code,name,detail])=>`<div class="neo-library-shelf"><b>${code}</b><div><strong>${name}</strong><span>${detail}</span></div></div>`).join('')}</div></article>`;
function enhanceLibrary(){
 if(activeTab()!=='library')return;
 const area=root()?.querySelector('#portalContent');if(!area||area.querySelector('#neoLibraryRacks'))return;
 area.innerHTML=`<div id="neoLibraryRacks" class="neo-library-shell"><div><span class="eyebrow">LIBRARY · STORAGE MAP</span><h2>Library Rack Plan</h2><p>Three physical racks, clearly labelled. Staff can see where each type of book belongs without opening another menu.</p></div><div class="neo-library-intro"><strong>Physical labels:</strong> Use <b>RACK 1</b>, <b>RACK 2</b>, <b>RACK 3</b> on the actual racks, and use the shelf codes below inside each rack.</div><div class="neo-library-racks">${rack('RACK 1 · Learning Books','Daily student curriculum / learning books',[['1A','Literacy & Phonics','Literacy, phonics and early-reading books'],['1B','Numeracy & Readiness','Numeracy, readiness and practice books'],['1C','Language & EVS','Language and Environmental Studies books']])}${rack('RACK 2 · Stories & Activities','Shared reading and creative material',[['2A','Story / Fantasy','Story, fantasy and read-aloud books'],['2B','Drawing & Art','Drawing, art and craft activity books'],['2C','Home Activity','Home activity and parent-child reading material']])}${rack('RACK 3 · Teacher & Spare','Controlled school copies and replacements',[['3A','Teacher Resources','Teacher guides and classroom reference material'],['3B','Master / Reference','Master editions and school-use reference copies'],['3C','Spare / Replacement','Extra copies for replacement or new admissions']])}</div><div class="neo-library-footer"><p><strong>Quantity / stock:</strong> remains in Inventory & Stores. Library only defines the physical rack location.</p><button type="button" class="secondary" data-library-inventory>Open Inventory & Stores</button></div></div>`;
 area.querySelector('[data-library-inventory]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'inventory'}})));
}
function enhance(){ensureMaintenanceNav();enhanceMaintenance();enhanceLibrary()}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,70)}
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="maintenance"],#neoWorkspace [data-tab="library"]'))schedule()},true);
window.addEventListener('neo:open-tab',e=>{if(e.detail?.tab==='maintenance'&&maintenanceSections.some(([id])=>id===e.detail?.maintenanceSection))selectedMaintenance=e.detail.maintenanceSection;if(['maintenance','library'].includes(e.detail?.tab))schedule()});
new MutationObserver(()=>{if(root()&&!root().hidden)schedule()}).observe(document.body,{childList:true,subtree:true});
schedule();
})();

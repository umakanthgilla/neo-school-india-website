/* Final school-portal handover UI cleanup: maintenance dropdown + clear library rack map. */
(()=>{
'use strict';
if(window.__neoHandoverUiCleanup)return;window.__neoHandoverUiCleanup=true;
const root=()=>document.getElementById('neoWorkspace');
const activeTab=()=>root()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';
let timer=0;

const style=document.createElement('style');
style.textContent=`
.neo-maint-chooser{margin:18px 0 14px;padding:16px;border:1px solid #d7e2f2;border-radius:16px;background:linear-gradient(180deg,#fff,#f7faff);box-shadow:0 7px 18px rgba(16,32,82,.06)}.neo-maint-chooser label{display:grid;gap:8px;margin:0;font-weight:800;color:#102052}.neo-maint-chooser select{width:100%;min-height:48px;padding:11px 14px;border:1px solid #bdcde5;border-radius:12px;background:#fff;color:#102052;font:inherit;font-weight:700}.neo-maint-help{margin:8px 0 0;font-size:.92rem;color:#61708b}.neo-maint-panel[hidden]{display:none!important}.neo-maint-panel{margin-top:10px}.neo-maint-empty{padding:22px;border:1px dashed #c8d6e9;border-radius:16px;background:#fbfdff;color:#61708b;text-align:center}.neo-maint-panel details.portal-editor{margin-top:0}.neo-library-shell{display:grid;gap:16px}.neo-library-intro{border:1px solid #d7e2f2;border-radius:16px;padding:14px 16px;background:#f8fbff}.neo-library-racks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.neo-library-rack{overflow:hidden;border:1px solid #d7e2f2;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(16,32,82,.07)}.neo-library-rack-head{padding:15px 16px;background:linear-gradient(135deg,#0d2b6e,#1557a6);color:#fff}.neo-library-rack-head small{display:block;color:#dce9ff;margin-top:4px}.neo-library-shelves{padding:8px 14px 14px}.neo-library-shelf{display:grid;grid-template-columns:58px minmax(0,1fr);gap:10px;padding:12px 0;border-bottom:1px solid #e6edf7}.neo-library-shelf:last-child{border-bottom:0}.neo-library-shelf b{display:inline-flex;align-items:center;justify-content:center;height:30px;border-radius:999px;background:#edf4ff;color:#0d2b6e;font-size:.82rem}.neo-library-shelf strong{display:block;color:#102052}.neo-library-shelf span{display:block;margin-top:3px;color:#61708b;font-size:.9rem;line-height:1.4}.neo-library-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 15px;border:1px solid #d7e2f2;border-radius:14px;background:#fbfdff}.neo-library-footer p{margin:0}
@media(max-width:820px){.neo-library-racks{grid-template-columns:1fr}.neo-library-footer{display:grid}}
`;
document.head.append(style);

function directHeading(container,text){return [...container.children].find(x=>x.tagName==='H3'&&x.textContent.trim().startsWith(text))||null}
function sectionPair(container,text){const heading=directHeading(container,text),grid=heading?.nextElementSibling?.classList?.contains('portal-grid')?heading.nextElementSibling:null;return {heading,grid}}

function enhanceMaintenance(){
 if(activeTab()!=='maintenance')return;
 const area=root()?.querySelector('#portalContent'),fac=area?.querySelector('#neoFacilities');
 if(!fac||fac.dataset.handoverDropdown==='true')return;
 const editors=[...fac.querySelectorAll('details.portal-editor')].slice(0,4);if(editors.length<4)return;
 const formGrid=editors[0].parentElement;if(!formGrid)return;
 fac.dataset.handoverDropdown='true';
 const assignment=sectionPair(fac,'Housekeeping assignments'),verification=sectionPair(fac,'Cleaning verification'),requests=sectionPair(fac,'Shortage & maintenance requests');
 const defs=[
  ['areas','Area / Zone Setup',editors[0],null],
  ['assignments','Assign Attendant & Verifier',editors[1],assignment],
  ['verification','Cleaning Completion / Verification',editors[2],verification],
  ['requests','Shortage / Repair Request',editors[3],requests]
 ];
 const chooser=document.createElement('div');chooser.className='neo-maint-chooser';chooser.innerHTML='<label>Choose Maintenance Activity<select data-maint-select><option value="">Select an activity…</option>'+defs.map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label><p class="neo-maint-help">Select one activity. Only that form and its related records will open below.</p>';
 const panels=document.createElement('div');panels.className='neo-maint-panels';
 const empty=document.createElement('div');empty.className='neo-maint-empty';empty.dataset.maintEmpty='true';empty.textContent='Choose a maintenance activity from the dropdown above.';panels.append(empty);
 defs.forEach(([id,,editor,pair])=>{
  editor.open=true;
  const panel=document.createElement('section');panel.className='neo-maint-panel';panel.dataset.maintPanel=id;panel.hidden=true;panel.append(editor);if(pair?.heading)panel.append(pair.heading);if(pair?.grid)panel.append(pair.grid);panels.append(panel);
 });
 const select=chooser.querySelector('[data-maint-select]');
 select.onchange=()=>{const id=select.value;empty.hidden=!!id;panels.querySelectorAll('[data-maint-panel]').forEach(p=>p.hidden=p.dataset.maintPanel!==id)};
 formGrid.before(chooser);formGrid.replaceWith(panels);
}

const rack=(title,subtitle,shelves)=>`<article class="neo-library-rack"><div class="neo-library-rack-head"><strong>${title}</strong><small>${subtitle}</small></div><div class="neo-library-shelves">${shelves.map(([code,name,detail])=>`<div class="neo-library-shelf"><b>${code}</b><div><strong>${name}</strong><span>${detail}</span></div></div>`).join('')}</div></article>`;
function enhanceLibrary(){
 if(activeTab()!=='library')return;
 const area=root()?.querySelector('#portalContent');if(!area||area.querySelector('#neoLibraryRacks'))return;
 area.innerHTML=`<div id="neoLibraryRacks" class="neo-library-shell"><div><span class="eyebrow">LIBRARY · STORAGE MAP</span><h2>Library Rack Plan</h2><p>Simple physical rack map for daily use. No dropdowns and no duplicate stock register.</p></div><div class="neo-library-intro"><strong>How to use:</strong> Put physical labels <b>RACK 1</b>, <b>RACK 2</b>, <b>RACK 3</b> on the shelves. Inside each rack, use the shelf codes shown below. Staff can identify the location immediately.</div><div class="neo-library-racks">${rack('RACK 1 · Learning Books','Daily student learning / curriculum books',[['1A','Literacy & Phonics','Literacy, phonics and early-reading books'],['1B','Numeracy & Readiness','Numeracy, readiness and practice books'],['1C','Language & EVS','Language and Environmental Studies books']])}${rack('RACK 2 · Stories & Activities','Shared reading and creative material',[['2A','Story / Fantasy','Story, fantasy and read-aloud books'],['2B','Drawing & Art','Drawing, art and craft activity books'],['2C','Home Activity','Home activity and parent-child reading material']])}${rack('RACK 3 · Teacher & Spare','Controlled school copies and replacements',[['3A','Teacher Resources','Teacher guides and classroom reference material'],['3B','Master / Reference','Master editions and school-use reference copies'],['3C','Spare / Replacement','Extra copies for replacement or new admissions']])}</div><div class="neo-library-footer"><p><strong>Stock quantities:</strong> continue in Inventory & Stores. Library only shows the physical location.</p><button type="button" class="secondary" data-library-inventory>Open Inventory & Stores</button></div></div>`;
 area.querySelector('[data-library-inventory]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('neo:open-tab',{detail:{tab:'inventory'}})));
}
function enhance(){enhanceMaintenance();enhanceLibrary()}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,80)}
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="maintenance"],#neoWorkspace [data-tab="library"]'))schedule()},true);
window.addEventListener('neo:open-tab',e=>{if(['maintenance','library'].includes(e.detail?.tab))schedule()});
new MutationObserver(()=>{if(['maintenance','library'].includes(activeTab()))schedule()}).observe(document.body,{childList:true,subtree:true});
schedule();
})();

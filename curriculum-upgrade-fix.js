/* Show a pending curriculum draft even when an older curriculum is already active. */
(()=>{
'use strict';
if(window.neoCurriculumUpgradeFix)return;
window.neoCurriculumUpgradeFix=true;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const API='https://neo-lead-crm-api.umakanthgilla.workers.dev/api/learning/';

async function enhance(area,ctx){
  try{
    if(!area||!ctx?.school?.school_id||!ctx?.token)return;
    const heading=[...area.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Attached plans');
    if(!heading)return;
    const grid=heading.nextElementSibling;
    if(!grid)return;

    const url=API+'plans?school_id='+encodeURIComponent(ctx.school.school_id);
    const r=await fetch(url,{headers:{Authorization:'Bearer '+ctx.token}});
    if(!r.ok)return;
    const body=await r.json();
    const plans=Array.isArray(body.plans)?body.plans:[];
    const same=(a,b)=>a.classroom_id===b.classroom_id&&String(a.academic_year||'')===String(b.academic_year||'');
    const dayCount=p=>new Set((p.lessons||[]).map(l=>Number(l.day)).filter(Boolean)).size;
    const timeOf=p=>{const n=Date.parse(p.updated_at||'');return Number.isFinite(n)?n:0};

    /*
      Legacy Day-1 test drafts created before the production master was activated
      must not remain as a clickable "pending update". Keep the record in storage,
      but hide it when a newer complete Approved plan is already active.
    */
    const pending=plans.filter(p=>{
      if(p.status!=='Draft')return false;
      const approved=plans.find(x=>same(x,p)&&x.status==='Approved');
      if(!approved)return false;
      const legacyNoMaster=!p.master_curriculum_id&&!p.master_version;
      const approvedIsComplete=dayCount(approved)>=200;
      const approvedIsNewer=timeOf(approved)>=timeOf(p);
      if(legacyNoMaster&&approvedIsComplete&&approvedIsNewer)return false;
      return true;
    });

    grid.querySelectorAll('.neo-curriculum-upgrade-card').forEach(x=>x.remove());
    if(!pending.length)return;

    for(const p of pending){
      const classroom=ctx.classrooms?.find(c=>c.id===p.classroom_id)?.name||p.classroom_id||'Section';
      const days=dayCount(p);
      const card=document.createElement('article');
      card.className='portal-card neo-curriculum-upgrade-card';
      card.style.border='2px solid #1ca9e8';
      card.style.boxShadow='0 12px 30px rgba(16,32,82,.08)';
      card.innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="portal-pill" style="background:#e8f7ff;color:#075c8f">Pending curriculum update</span><strong>${esc(p.master_level||'Curriculum')} · ${esc(p.master_version||'New version')}</strong></div><h3>${esc(p.title||classroom)}</h3><p>${esc(classroom)}</p><p><b>${days} curriculum days</b> ready to replace the current active version.</p><p>Academic dates: ${esc(p.working_dates?.[0]||'—')} → ${esc(p.working_dates?.[199]||'—')}</p><p><b>Master:</b> ${esc((p.master_level||'Curriculum')+' · '+(p.master_version||'—'))}</p><p style="max-width:760px">The current active curriculum stays live for teachers until you activate this update. On activation, the old version is archived for history and this draft becomes the active version.</p><button type="button" data-neo-upgrade="${esc(p.id)}">Sync & Activate New Version</button>`;
      grid.prepend(card);
      const button=card.querySelector('[data-neo-upgrade]');
      button.onclick=async()=>{
        if(!confirm('Activate '+(p.master_level||'curriculum')+' '+(p.master_version||'new version')+' for '+classroom+'? The current active version will be archived and retained for history.'))return;
        button.disabled=true;
        const oldText=button.textContent;
        button.textContent='Activating…';
        try{
          const ar=await fetch(API+'activate?school_id='+encodeURIComponent(ctx.school.school_id),{method:'POST',headers:{Authorization:'Bearer '+ctx.token,'Content-Type':'application/json'},body:JSON.stringify({plan_id:p.id})});
          const result=await ar.json();
          if(!ar.ok)throw Error(result.error||'Unable to activate curriculum update.');
          button.textContent='Activated ✓';
          await window.renderNeoLearning(area,ctx);
        }catch(err){
          alert(err.message);
          button.disabled=false;
          button.textContent=oldText;
        }
      };
    }
  }catch(err){console.warn('Neo curriculum upgrade display:',err)}
}

function install(){
  const original=window.renderNeoLearning;
  if(typeof original!=='function'||original.__neoCurriculumUpgradeFix)return false;
  const wrapped=async function(area,ctx){
    const result=await original(area,ctx);
    await enhance(area,ctx);
    return result;
  };
  wrapped.__neoCurriculumUpgradeFix=true;
  window.renderNeoLearning=wrapped;
  return true;
}

if(!install()){
  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);
}
})();

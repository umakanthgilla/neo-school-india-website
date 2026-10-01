(()=>{
 const original=window.renderNeoLearningFamily;
 if(typeof original!=='function'||window.__neoTeacherGuideV2)return;
 window.__neoTeacherGuideV2=true;

 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 const installStyle=()=>{
  if(document.getElementById('neoTeacherGuideV2Style'))return;
  const style=document.createElement('style');
  style.id='neoTeacherGuideV2Style';
  style.textContent=`
   .neo-teacher-guide{margin-top:12px;border:1px solid #d9e6f5;border-radius:16px;background:#fff;overflow:hidden}
   .neo-teacher-guide>summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900;color:#09265d;background:linear-gradient(90deg,#eef8ff,#f3fbf3,#fff9e6);display:flex;gap:10px;align-items:center}
   .neo-teacher-guide>summary::-webkit-details-marker{display:none}
   .neo-guide-body{padding:15px;display:grid;gap:12px}
   .neo-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
   .neo-guide-card{border:1px solid #e1e9f4;border-radius:13px;padding:12px;background:#fbfdff;min-width:0}
   .neo-guide-card h4{margin:0 0 6px;color:#09265d;font-size:13px}
   .neo-guide-card p,.neo-guide-card li{margin:0;color:#51617a;font-size:12px;line-height:1.55;white-space:pre-wrap}
   .neo-guide-card ol{margin:0;padding-left:20px}
   .neo-guide-resource{display:inline-flex;margin-top:7px;padding:8px 11px;border-radius:10px;background:#09265d;color:#fff!important;text-decoration:none;font-weight:800;font-size:11px}
   .neo-guide-note{font-size:11px;color:#6c7890;line-height:1.45}
   @media(max-width:720px){.neo-guide-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
 };

 window.renderNeoLearningFamily=function(area,ctx){
  const result=original(area,ctx);
  if(ctx?.role!=='teacher'||ctx?.tab!=='timetable')return result;
  installStyle();

  const plans=ctx?.data?.learning?.plans?.plans||[];

  const enhance=()=>{
   const date=area.querySelector('#teachingDate')?.value;
   if(!date)return;
   const active=plans.filter(p=>p.status==='Approved'&&Array.isArray(p.working_dates)&&p.working_dates.includes(date));
   if(!active.length)return;

   area.querySelectorAll('.period-card').forEach(card=>{
    if(card.dataset.neoTeacherGuide==='1')return;
    const timeBox=card.querySelector('.period-time');
    const start=(timeBox?.childNodes?.[0]?.textContent||'').trim();
    const title=(card.querySelector('h3')?.textContent||'').trim();
    if(!start)return;

    let found=null;
    for(const plan of active){
     const lesson=(plan.lessons||[]).find(l=>plan.working_dates?.[Number(l.day)-1]===date&&String(l.start||'')===start);
     if(lesson){found={plan,lesson};break;}
    }
    if(!found)return;

    const {lesson}=found;
    const objective=String(lesson.objective||'').trim();
    const activity=String(lesson.activity||'').trim();
    const materials=String(lesson.materials||'').trim();
    const homework=String(lesson.homework||'').trim();
    const questions=Array.isArray(lesson.questions)?lesson.questions.filter(Boolean):[];
    const resourceUrl=String(lesson.resource_url||lesson.worksheet_url||'').trim();
    const resourceTitle=String(lesson.resource_title||'Open worksheet / resource').trim();
    const concept=String(lesson.concept||title||'Curriculum lesson').trim();

    const guide=document.createElement('details');
    guide.className='neo-teacher-guide';
    guide.innerHTML=`
     <summary>📘 Teacher Guide · Day ${esc(lesson.day)} · ${esc(concept)}</summary>
     <div class="neo-guide-body">
      <div class="neo-guide-grid">
       <section class="neo-guide-card"><h4>🎯 Learning focus</h4><p>${esc(objective||'Use the approved curriculum objective for this lesson.')}</p></section>
       <section class="neo-guide-card"><h4>🧺 Preparation & materials</h4><p>${esc(materials||'No special materials listed for this lesson.')}</p></section>
      </div>
      <section class="neo-guide-card"><h4>🧭 What to do — teaching sequence</h4><p>${esc(activity||'Follow the approved curriculum activity for this lesson.')}</p></section>
      <div class="neo-guide-grid">
       <section class="neo-guide-card"><h4>💬 Teacher prompts / approved questions</h4>${questions.length?`<ol>${questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>`:'<p>No additional prompt is listed yet.</p>'}</section>
       <section class="neo-guide-card"><h4>🏠 Home connection</h4><p>${esc(homework||'No home connection is scheduled for this lesson.')}</p></section>
      </div>
      <section class="neo-guide-card"><h4>📎 Worksheet / resource</h4>${resourceUrl?`<p>A linked curriculum resource is available.</p><a class="neo-guide-resource" href="${esc(resourceUrl)}" target="_blank" rel="noopener">${esc(resourceTitle)}</a>`:'<p>No worksheet/resource is attached yet. Worksheets are optional and should be used only when they strengthen the play-based learning goal.</p>'}</section>
      <p class="neo-guide-note">This guide brings the approved curriculum into the teacher’s daily workflow. It does not replace professional observation or require a worksheet for every lesson.</p>
     </div>`;

    const workflow=card.querySelector('.portal-editor');
    if(workflow)card.querySelector('div[style*="min-width"]')?.insertBefore(guide,workflow);
    else card.querySelector('div[style*="min-width"]')?.appendChild(guide);
    card.dataset.neoTeacherGuide='1';
   });
  };

  let scheduled=false;
  const run=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});};
  run();
  const observer=new MutationObserver(run);
  observer.observe(area,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),120000);
  return result;
 };
})();

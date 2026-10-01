(()=>{
 const original=window.renderNeoLearningFamily;
 if(typeof original!=='function'||window.__neoTeacherGuideV2)return;
 window.__neoTeacherGuideV2=true;

 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
 const text=(v)=>String(v??'').trim();

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
   .neo-guide-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.neo-guide-tag{display:inline-flex;padding:5px 8px;border-radius:999px;background:#eef5ff;color:#09265d;font-size:10px;font-weight:850}
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
    const objective=text(lesson.objective);
    const activity=text(lesson.activity);
    const materials=text(lesson.materials);
    const homework=text(lesson.homework);
    const questions=Array.isArray(lesson.questions)?lesson.questions.filter(Boolean):[];
    const resourceUrl=text(lesson.resource_url||lesson.worksheet_url);
    const resourceTitle=text(lesson.resource_title)||'Open worksheet / resource';
    const resourceType=text(lesson.resource_type);
    const resourceId=text(lesson.resource_id);
    const concept=text(lesson.concept)||title||'Curriculum lesson';
    const why=text(lesson.why_this_matters);
    const teacherLanguage=text(lesson.teacher_language);
    const observeFor=text(lesson.observe_for||lesson.teacher_note);
    const support=text(lesson.support_scaffold);
    const challenge=text(lesson.challenge_extension);
    const inclusion=text(lesson.inclusion_note);
    const safety=text(lesson.safety_supervision);
    const evidence=text(lesson.portfolio_evidence);
    const playMode=text(lesson.play_mode);
    const ncfGoal=text(lesson.ncf_curricular_goal);
    const ncfCompetency=text(lesson.ncf_competency);
    const extraCards=[
      why?`<section class="neo-guide-card"><h4>💡 Why this matters</h4><p>${esc(why)}</p></section>`:'',
      teacherLanguage?`<section class="neo-guide-card"><h4>🗣️ Teacher language</h4><p>${esc(teacherLanguage)}</p></section>`:'',
      observeFor?`<section class="neo-guide-card"><h4>👀 Observe for</h4><p>${esc(observeFor)}</p></section>`:'',
      evidence?`<section class="neo-guide-card"><h4>📸 Evidence / portfolio cue</h4><p>${esc(evidence)}</p></section>`:'',
      support?`<section class="neo-guide-card"><h4>🤝 Support / scaffold</h4><p>${esc(support)}</p></section>`:'',
      challenge?`<section class="neo-guide-card"><h4>🚀 Extend / challenge</h4><p>${esc(challenge)}</p></section>`:'',
      inclusion?`<section class="neo-guide-card"><h4>🌈 Inclusion note</h4><p>${esc(inclusion)}</p></section>`:'',
      safety?`<section class="neo-guide-card"><h4>🛡️ Safety / supervision</h4><p>${esc(safety)}</p></section>`:''
    ].filter(Boolean).join('');

    const guide=document.createElement('details');
    guide.className='neo-teacher-guide';
    guide.innerHTML=`
     <summary>📘 Teacher Guide · Day ${esc(lesson.day)} · ${esc(concept)}</summary>
     <div class="neo-guide-body">
      <div class="neo-guide-grid">
       <section class="neo-guide-card"><h4>🎯 Learning focus</h4><p>${esc(objective||'Use the approved curriculum objective for this lesson.')}</p>${playMode?`<div class="neo-guide-tags"><span class="neo-guide-tag">${esc(playMode)}</span></div>`:''}</section>
       <section class="neo-guide-card"><h4>🧺 Preparation & materials</h4><p>${esc(materials||'No special materials listed for this lesson.')}</p></section>
      </div>
      <section class="neo-guide-card"><h4>🧭 What to do — teaching sequence</h4><p>${esc(activity||'Follow the approved curriculum activity for this lesson.')}</p></section>
      ${extraCards?`<div class="neo-guide-grid">${extraCards}</div>`:''}
      <div class="neo-guide-grid">
       <section class="neo-guide-card"><h4>💬 Approved prompts / questions</h4>${questions.length?`<ol>${questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>`:'<p>No additional prompt is listed yet.</p>'}</section>
       <section class="neo-guide-card"><h4>🏠 Home connection</h4><p>${esc(homework||'No home connection is scheduled for this lesson.')}</p></section>
      </div>
      ${(ncfGoal||ncfCompetency)?`<section class="neo-guide-card"><h4>🧩 Curriculum alignment</h4><p>${ncfGoal?`<strong>Goal:</strong> ${esc(ncfGoal)}`:''}${ncfGoal&&ncfCompetency?'\n':''}${ncfCompetency?`<strong>Competency:</strong> ${esc(ncfCompetency)}`:''}</p></section>`:''}
      <section class="neo-guide-card"><h4>📎 Worksheet / resource</h4>${resourceUrl?`<p>${resourceType?esc(resourceType)+' · ':''}${resourceId?esc(resourceId)+' · ':''}A linked curriculum resource is ready.</p><a class="neo-guide-resource" href="${esc(resourceUrl)}" target="_blank" rel="noopener">${esc(resourceTitle)}</a>`:'<p>No worksheet/resource is attached yet. Worksheets are optional and should be used only when they strengthen the play-based learning goal.</p>'}</section>
      <p class="neo-guide-note">Teacher Manual content is delivered here in context, beside the exact period. The monthly printable manual can be generated from the same approved curriculum; teachers do not need to maintain a second version manually.</p>
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

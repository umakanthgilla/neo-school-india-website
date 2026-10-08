(()=>{
 const GRAD='linear-gradient(90deg,#118be8,#4dbb42,#f4c400,#ff7a16,#ef3b78)';
 const DATA={
  school:{title:'School Portal',te:'స్కూల్ పోర్టల్',aud:'School admin / branch manager',modules:[
   ['School overview','Daily snapshot of attendance, fees, income, staff attendance, payroll and items that need attention.','రోజువారీ attendance, fees, income, staff attendance, payroll, pending items అన్నీ ఒకే snapshotలో చూడండి.'],
   ['School setup','Complete school profile, academic setup and readiness items before regular operations.','School profile, academic setup, readiness items complete చేసి daily operations ప్రారంభించండి.'],
   ['School calendar','Maintain working days, holidays, events and academic dates.','Working days, holidays, events, academic dates maintain చేయండి.'],
   ['Curriculum & calendar','View/publish curriculum plans and the academic learning calendar.','Curriculum plans, academic learning calendar చూడండి లేదా publish చేయండి.'],
   ['Subject Master','Create and maintain subjects used by classrooms, teachers and assessments.','Classrooms, teachers, assessmentsలో వాడే subjects maintain చేయండి.'],
   ['Classrooms','Create Preschool / Primary / High School classes, choose section, academic year and Teaching Model.','Class create చేసి Section, Academic Year, Mother Teacher లేదా Subject-wise Teachers model select చేయండి.'],
   ['Teacher timetable','Build and review teacher period schedules.','Teacher period schedules create చేసి review చేయండి.'],
   ['Teaching progress','Monitor lesson completion and classroom teaching progress.','Lessons completion, classroom teaching progress monitor చేయండి.'],
   ['Students & parents','Register/bulk upload students, manage parent access and student records.','Students single/bulk upload చేసి parent access మరియు student records manage చేయండి.'],
   ['Teachers','Create teacher access, assign classroom/subject and manage ownership.','Teacher access create చేసి class/subject assignments manage చేయండి.'],
   ['Front office','Manage enquiries, admissions follow-up and parent-facing front-office work.','Enquiries, admissions follow-up, front-office work manage చేయండి.'],
   ['HR & payroll','Maintain staff, attendance, salary rules, leave, advances and payroll.','Staff, attendance, salary rules, leave, advances, payroll manage చేయండి.'],
   ['Finance','Use fee collection, receipts, vouchers and reports; ledger remains report-only.','Fee collection, receipts, vouchers, reports వాడండి; ledger report-onlyగా ఉంటుంది.'],
   ['Inventory & supply','Track stock, school orders, materials and procurement-related activity.','Stock, school orders, materials, procurement activity track చేయండి.'],
   ['Transport','Set up routes/vehicles/staff and monitor daily transport operations.','Routes, vehicles, staff setup చేసి daily transport operations monitor చేయండి.'],
   ['Notices & support','Publish parent notices and handle support/concern items.','Parent notices publish చేసి support/concern items handle చేయండి.'],
   ['Documents & reports','Preview/download official student, staff, finance and operational documents.','Student, staff, finance, operational documents preview/download చేయండి.'],
   ['Test analytics','School oversight only: monitor published tests and results; teachers own creation/review.','School oversight కోసం tests/results చూడండి; creation/review teacher ownershipలోనే ఉంటుంది.']
  ]},
  teacher:{title:'Teacher Portal',te:'టీచర్ పోర్టల్',aud:'Assigned teachers',modules:[
   ['Today','See today’s teaching plan, pending lessons, announcements and tasks.','ఈరోజు teaching plan, pending lessons, announcements, tasks చూడండి.'],
   ['School calendar','Check school working days, holidays and events.','School working days, holidays, events చూడండి.'],
   ['My timetable','View only your assigned periods/classes.','మీకు assign చేసిన periods/classes మాత్రమే చూడండి.'],
   ['My curriculum','Open assigned curriculum, complete lesson execution and record outcomes.','Assigned curriculum open చేసి lesson execution complete చేసి outcomes record చేయండి.'],
   ['Post homework','Create homework for your assigned class/subject and publish it to parents.','Assigned class/subjectకి homework create చేసి parentsకి publish చేయండి.'],
   ['My Question Bank','Generate questions only from your own completed lessons; review, select and approve them.','మీరు complete చేసిన lessons నుంచే questions generate చేసి review/select/approve చేయండి.'],
   ['Online Tests','Create tests from your approved questions and publish to your assigned class/subject.','Approved questionsతో test create చేసి assigned class/subjectకి publish చేయండి.'],
   ['Short-answer review','Review only attempts belonging to your assigned subject and give marks.','మీ assigned subject attemptsలో short answers మాత్రమే review చేసి marks ఇవ్వండి.'],
   ['Child performance & activity','Add classroom performance/activity updates, including photos when required.','Child performance/activity updates మరియు అవసరమైతే photos add చేయండి.'],
   ['Parent follow-up & PTM','Record parent calls, follow-up actions and PTM notes/reports.','Parent calls, follow-up actions, PTM notes/reports record చేయండి.'],
   ['Student comments','Add learning/behaviour comments for assigned students.','Assigned studentsకి learning/behaviour comments add చేయండి.'],
   ['Mark attendance','Mark attendance for the class you are responsible for.','మీ బాధ్యత ఉన్న classకి attendance mark చేయండి.'],
   ['My tasks & reports','See pending work and teacher reports.','Pending work మరియు teacher reports చూడండి.'],
   ['Announcements','Read school announcements relevant to teachers.','Teachersకి సంబంధించిన school announcements చదవండి.'],
   ['Parent concerns','View and respond to concerns routed to you.','మీకు route చేసిన parent concerns చూడండి/respond చేయండి.'],
   ['Employee Hub / My HR','Use leave, salary advance and employee self-service features.','Leave, salary advance, employee self-service features వాడండి.'],
   ['Documents & reports','Preview/download your permitted reports and documents.','మీకు permission ఉన్న reports/documents preview/download చేయండి.'],
   ['Password','Change your password securely when required.','అవసరమైనప్పుడు password securely change చేయండి.']
  ]},
  parent:{title:'Parent Portal',te:'పేరెంట్ పోర్టల్',aud:'Parents / guardians',modules:[
   ['Today','See the child’s latest classroom update and important status at a glance.','పిల్లవాడి latest classroom update మరియు important status ఒకచోట చూడండి.'],
   ['School calendar','Check holidays, events and working days.','Holidays, events, working days చూడండి.'],
   ['Child timetable','See the child’s class timetable.','పిల్లవాడి class timetable చూడండి.'],
   ['Learning journal','See teacher-posted learning/activity updates for your child.','Teacher post చేసిన learning/activity updates చూడండి.'],
   ['Attendance','Check attendance history and current status.','Attendance history మరియు current status చూడండి.'],
   ['Homework','View homework and teacher instructions.','Homework మరియు teacher instructions చూడండి.'],
   ['PTM reports','Read parent-teacher meeting reports and follow-up notes.','PTM reports మరియు follow-up notes చూడండి.'],
   ['Fees & receipts','See fee dues, payments and official receipts.','Fee dues, payments, official receipts చూడండి.'],
   ['School notices','Read school announcements and notices.','School announcements/notices చదవండి.'],
   ['Concerns & support','Raise a concern/support request and follow its status.','Concern/support request raise చేసి status follow చేయండి.'],
   ['Books & uniforms','View issued material/orders related to the child.','Childకి సంబంధించిన books/uniforms/material details చూడండి.'],
   ['Transport','See assigned route/trip updates and transport alerts.','Assigned route/trip updates, transport alerts చూడండి.'],
   ['Online Tests','Attempt published tests for your child and view results when enabled.','Published online tests attempt చేసి enabled ఉంటే results చూడండి.'],
   ['Pickup approval','Use pickup/escort approval controls when the school enables them.','School enable చేసినప్పుడు pickup/escort approval controls వాడండి.'],
   ['Documents & reports','Preview/download permitted child documents and reports.','Permitted child documents/reports preview/download చేయండి.'],
   ['Password','Change portal password securely.','Portal password securely change చేయండి.']
  ]},
  transport:{title:'Driver / Transport Portal',te:'డ్రైవర్ / ట్రాన్స్‌పోర్ట్ పోర్టల్',aud:'Drivers and vehicle attendants',modules:[
   ['Today / assigned route','Confirm your assigned route, vehicle and trip for the day.','ఈరోజు assigned route, vehicle, trip verify చేయండి.'],
   ['Pre-trip checks','Complete required vehicle/safety checks before starting.','Trip start ముందు vehicle/safety checks complete చేయండి.'],
   ['Start trip','Start only the correct assigned pickup/drop trip.','Correct assigned pickup/drop trip మాత్రమే start చేయండి.'],
   ['Student list','Use the route list; do not add/select the same child twice.','Route list మాత్రమే వాడండి; ఒకే childని రెండు సార్లు select చేయకండి.'],
   ['Pickup / drop status','Update each child’s pickup/drop status at the correct time.','ప్రతి child pickup/drop status సరైన సమయంలో update చేయండి.'],
   ['Emergency / alerts','Use emergency actions only when needed; school receives the alert.','అవసరమైనప్పుడు మాత్రమే emergency action వాడండి; schoolకి alert వెళ్తుంది.'],
   ['Trip history','Review saved trips and status history.','Saved trips మరియు status history చూడండి.'],
   ['Vehicle documents','Open available vehicle/transport documents when required.','అవసరమైనప్పుడు vehicle/transport documents open చేయండి.'],
   ['Sign out','Sign out after completing duty, especially on shared devices.','Duty complete అయిన తర్వాత, shared device అయితే తప్పనిసరిగా sign out చేయండి.']
  ]},
  headoffice:{title:'Head Office / Admin Portal',te:'హెడ్ ఆఫీస్ / అడ్మిన్ పోర్టల్',aud:'Head office operations team',modules:[
   ['Network overview','Monitor schools, students, attendance, fees, open orders and support items.','Schools, students, attendance, fees, open orders, support items monitor చేయండి.'],
   ['School management','Open an individual school workspace for controlled administration/support.','Individual school workspace open చేసి administration/support చేయండి.'],
   ['User / access control','Create/reset authorised users and share credentials privately.','Authorised users create/reset చేసి credentials privateగా ఇవ్వండి.'],
   ['Operational follow-up','Track schools requiring attention and pending operational actions.','Attention అవసరమైన schools మరియు pending actions track చేయండి.'],
   ['Finance oversight','Review school balances, deposits and network-level finance follow-up.','School balances, deposits, network finance follow-up review చేయండి.'],
   ['Supply oversight','Review procurement/orders and move into Supply Chain when required.','Procurement/orders review చేసి అవసరమైతే Supply Chainకి వెళ్లండి.'],
   ['Reports','Download network and operations reports for review.','Network/operations reports download చేసి review చేయండి.'],
   ['Support / sign-off','Use final checklist before go-live, backup and client sign-off.','Go-live ముందు final checklist, backup, client sign-off follow చేయండి.']
  ]},
  supply:{title:'Supply Chain Portal',te:'సప్లై చైన్ పోర్టల్',aud:'HO procurement and inventory team',modules:[
   ['Material hub','Maintain the common item master, standard prices and categories.','Common item master, standard prices, categories maintain చేయండి.'],
   ['Kit master','Generate class-wise student kits from the material hub and edit items/prices.','Material hub నుంచి class-wise student kits generate చేసి items/prices edit చేయండి.'],
   ['Vendors','Maintain approved vendors for uniforms, books and other materials.','Uniforms, books, other materials vendors maintain చేయండి.'],
   ['Center orders','Review school/center kit or material orders.','School/center kit/material orders review చేయండి.'],
   ['Approval','Approve valid center orders at Head Office only.','Valid center ordersని Head Officeలోనే approve చేయండి.'],
   ['Vendor orders','Split approved demand into vendor purchase orders.','Approved demandని vendor purchase ordersగా split చేయండి.'],
   ['Goods received / stock-in','Record vendor delivery received at Head Office and update stock.','Vendor delivery HOలో receive చేసి stock-in update చేయండి.'],
   ['Dispatch','Dispatch approved quantities to the correct center.','Approved quantities correct centerకి dispatch చేయండి.'],
   ['Center receipt','Track confirmation when the center receives dispatched material.','Center material receive చేసిన confirmation track చేయండి.'],
   ['Credit dues','Watch credit due dates and payment follow-up.','Credit due dates మరియు payment follow-up monitor చేయండి.'],
   ['Stock / reports','Review HO/center stock movement and procurement reports.','HO/center stock movement, procurement reports చూడండి.']
  ]}
 };
 function role(){const p=location.pathname.toLowerCase(); if(p.includes('teacher'))return 'teacher'; if(p.includes('parent'))return 'parent'; if(p.includes('transport')||p.includes('driver'))return 'transport'; if(p.includes('supply'))return 'supply'; if(p.includes('admin'))return 'headoffice'; return 'school';}
 const key=role(),d=DATA[key]||DATA.school;
 function openModal(){let m=document.getElementById('neoHowToModal'); if(!m){m=document.createElement('div');m.id='neoHowToModal';document.body.appendChild(m)}
  const en=d.modules.map((m,i)=>'<article class="neo-guide-module"><b>'+(i+1)+'. '+m[0]+'</b><p>'+m[1]+'</p></article>').join(''),te=d.modules.map((m,i)=>'<article class="neo-guide-module"><b>'+(i+1)+'. '+m[0]+'</b><p>'+m[2]+'</p></article>').join('');
  m.innerHTML=`<div class="neo-howto-backdrop"></div><section class="neo-howto-card" role="dialog" aria-modal="true"><button class="neo-howto-close" aria-label="Close">×</button><div class="neo-howto-top"><img src="/neo-top-logo.jpeg" alt="Neo School India"><div><span>HOW TO USE</span><h2>${d.title}</h2><p>${d.aud}</p></div></div><div class="neo-howto-tabs"><button data-howtab="en" class="active">Guidance in English</button><button data-howtab="te">Guidance in Telugu</button><button data-howtab="pdf">PDF Guide</button><button data-howtab="play">▶ PPT / Play Guide</button></div><div class="neo-howto-body" data-pane="en"><h3>${d.title} - complete tab guide</h3><div class="neo-guide-modules">${en}</div><p class="neo-note">Use this guide for daily operation. Passwords and private credentials must be shared separately.</p></div><div class="neo-howto-body" data-pane="te" hidden><h3>${d.te} - ప్రతి ట్యాబ్ ఎలా వాడాలి</h3><div class="neo-guide-modules">${te}</div><p class="neo-note">Daily operation కోసం ఈ guide వాడండి. Passwords/private credentials వేరుగా ఇవ్వాలి.</p></div><div class="neo-howto-body" data-pane="pdf" hidden><h3>PDF Guide</h3><p>Select the language, then use Print / Save PDF. This prints only the guide you are viewing.</p><div class="neo-howto-actions"><button data-pdf-lang="en">English PDF</button><button data-pdf-lang="te">Telugu PDF</button></div><div id="neoHowPdfPreview" class="neo-how-pdf-preview"></div><div class="neo-howto-actions"><button data-print-guide>Print / Save PDF</button></div></div><div class="neo-howto-body" data-pane="play" hidden><div class="neo-play-head"><h3>PPT-style Play Guide</h3><div class="neo-howto-actions"><button data-play-lang="en">English</button><button data-play-lang="te">Telugu</button></div></div><div id="neoHowSlide" class="neo-how-slide"></div><div class="neo-howto-actions"><button data-prev>Previous</button><button data-autoplay>▶ Play</button><button data-next>Next</button></div></div></section>`;
  const style=document.getElementById('neoHowToStyle')||document.createElement('style');style.id='neoHowToStyle';style.textContent=`#neoHowToModal{position:fixed;inset:0;z-index:99999}.neo-howto-backdrop{position:absolute;inset:0;background:rgba(3,17,52,.62)}.neo-howto-card{position:relative;margin:4vh auto;width:min(920px,94vw);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.35);border-top:5px solid transparent;border-image:${GRAD} 1;color:#12213c}.neo-howto-close{position:absolute;right:16px;top:14px;width:36px;height:36px;border-radius:50%;border:1px solid #d9e4f2;background:#fff;color:#071b52;font-size:24px}.neo-howto-top{display:flex;gap:22px;align-items:center;padding:28px 32px 16px}.neo-howto-top img{width:140px;background:#fff;object-fit:contain}.neo-howto-top span{font-size:12px;letter-spacing:.14em;color:#118be8;font-weight:900}.neo-howto-top h2{margin:4px 0;color:#071b52;font-size:34px}.neo-howto-top p{margin:0;color:#65748c}.neo-howto-tabs{display:flex;gap:10px;padding:0 32px 18px;flex-wrap:wrap}.neo-howto-tabs button,.neo-howto-actions button{border:0;border-radius:12px;padding:11px 14px;background:#edf5ff;color:#071b52;font-weight:900}.neo-howto-tabs button.active{background:#071b52;color:#fff}.neo-howto-body{margin:0 32px 32px;padding:22px;border:1px solid #dce6f2;border-radius:18px;background:#fbfdff}.neo-howto-body h3{margin-top:0;color:#071b52}.neo-howto-body li{margin:12px 0;font-size:16px;line-height:1.55}.neo-guide-modules{display:grid;gap:10px}.neo-guide-module{padding:13px 14px;border:1px solid #dce6f2;border-radius:13px;background:#fff}.neo-guide-module b{display:block;color:#071b52;font-size:15px}.neo-guide-module p{margin:5px 0 0;color:#52617b;line-height:1.5}.neo-note{padding:12px 14px;border-left:4px solid #4dbb42;background:#f4fff6;color:#244f2c}.neo-how-slide{min-height:210px;padding:26px;border-radius:18px;background:#fff;border:1px solid #dce6f2;display:grid;align-content:center}.neo-how-slide h4{font-size:26px;color:#071b52;margin:0 0 10px}.neo-how-slide p{font-size:18px;color:#445773}.neo-howto-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.neo-how-pdf-preview{margin-top:14px;padding:22px;border:1px solid #dce6f2;border-radius:18px;background:#fff}.neo-how-pdf-preview h4{margin:0 0 12px;color:#071b52;font-size:24px}.neo-how-pdf-preview li{margin:10px 0;line-height:1.55}.neo-play-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.neo-play-head h3{margin:0}.neo-play-head .neo-howto-actions{margin-top:0}.neo-slide-count{font-size:12px;font-weight:900;color:#118be8;letter-spacing:.08em;margin-bottom:8px}@media print{body>*:not(#neoHowToModal){display:none!important}#neoHowToModal{position:static!important}.neo-howto-backdrop,.neo-howto-close,.neo-howto-tabs,.neo-howto-actions{display:none!important}.neo-howto-card{margin:0!important;width:100%!important;max-height:none!important;box-shadow:none!important;border-radius:0!important}.neo-howto-body{display:none!important}.neo-howto-body[data-pane="pdf"]{display:block!important;border:0!important;margin:0!important}.neo-how-pdf-preview{border:0!important;padding:0!important}}@media(max-width:640px){.neo-howto-top{display:block}.neo-howto-top img{width:110px}.neo-howto-top h2{font-size:26px}}`;document.head.appendChild(style);
  m.querySelector('.neo-howto-close').onclick=()=>m.remove();m.querySelector('.neo-howto-backdrop').onclick=()=>m.remove();
  let slide=0,playLang='en',pdfLang='en',timer=null;
  const slideRows=()=>d.modules.map((m,i)=>({h:m[0],p:playLang==='te'?m[2]:m[1]}));
  const render=()=>{const slides=slideRows(),s=slides[slide%slides.length];m.querySelector('#neoHowSlide').innerHTML='<div class="neo-slide-count">'+(slide+1)+' / '+slides.length+'</div><h4>'+s.h+'</h4><p>'+s.p+'</p>'};
  const renderPdf=()=>{const title=pdfLang==='te'?d.te:d.title;m.querySelector('#neoHowPdfPreview').innerHTML='<h4>'+title+' - '+(pdfLang==='te'?'ప్రతి ట్యాబ్ ఎలా వాడాలి':'How to Use Each Tab')+'</h4><div class="neo-guide-modules">'+d.modules.map((m,i)=>'<article class="neo-guide-module"><b>'+(i+1)+'. '+m[0]+'</b><p>'+(pdfLang==='te'?m[2]:m[1])+'</p></article>').join('')+'</div>'};
  const stop=()=>{if(timer){clearInterval(timer);timer=null}const b=m.querySelector('[data-autoplay]');if(b)b.textContent='▶ Play'};
  const start=()=>{stop();const b=m.querySelector('[data-autoplay]');if(b)b.textContent='❚❚ Pause';timer=setInterval(()=>{const slides=slideRows();slide=(slide+1)%slides.length;render()},3500)};
  render();renderPdf();
  m.querySelectorAll('[data-howtab]').forEach(b=>b.onclick=()=>{stop();m.querySelectorAll('[data-howtab]').forEach(x=>x.classList.toggle('active',x===b));m.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.howtab);if(b.dataset.howtab==='play'){slide=0;render()}if(b.dataset.howtab==='pdf')renderPdf()});
  m.querySelectorAll('[data-play-lang]').forEach(b=>b.onclick=()=>{playLang=b.dataset.playLang;slide=0;render()});
  m.querySelectorAll('[data-pdf-lang]').forEach(b=>b.onclick=()=>{pdfLang=b.dataset.pdfLang;renderPdf()});
  m.querySelector('[data-next]').onclick=()=>{stop();const slides=slideRows();slide=(slide+1)%slides.length;render()};
  m.querySelector('[data-prev]').onclick=()=>{stop();const slides=slideRows();slide=(slide+slides.length-1)%slides.length;render()};
  m.querySelector('[data-autoplay]').onclick=()=>timer?stop():start();
  m.querySelector('[data-print-guide]').onclick=()=>window.print();
 }
 function inject(){
  const old=document.querySelector('[data-neo-howto]');
  let host=null,signout=null,classes='';
  if(document.querySelector('.family-tabs')){
    host=document.querySelector('.family-nav-scroll');classes='secondary neo-howto-family';
  }else if(document.querySelector('.neo-department-nav')){
    host=document.querySelector('.neo-department-nav');signout=host.querySelector('#navSignOut');classes='neo-single-department neo-howto-school';
  }else if(document.querySelector('.transport-sidebar')){
    host=document.querySelector('.transport-sidebar-scroll');classes='neo-howto-transport';
  }else if(document.querySelector('#appView .workspace-nav')){
    host=document.querySelector('#appView .workspace-nav');signout=host.querySelector('.logout');classes='neo-howto-admin';
  }else if(document.querySelector('#app .side')){
    host=document.querySelector('#app .side .supply-nav-scroll')||document.querySelector('#app .side');classes='neo-howto-supply';
  }
  if(!host){if(old)old.remove();return}
  if(old&&old.parentElement===host)return;
  if(old)old.remove();
  const btn=document.createElement('button');btn.type='button';btn.dataset.neoHowto='1';btn.className=classes;btn.innerHTML='<span class="neo-howto-mini">?</span><span>How to Use</span>';btn.onclick=openModal;
  const style=document.getElementById('neoHowBtnStyle')||document.createElement('style');style.id='neoHowBtnStyle';style.textContent=`
  [data-neo-howto]{position:relative;box-sizing:border-box;cursor:pointer}
  .neo-howto-mini{display:grid;place-items:center;width:29px;height:29px;flex:0 0 29px;border-radius:9px;background:#eaf7fb;color:#0b5f82;font-weight:900}
  .family-nav-scroll>[data-neo-howto]{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;width:100%!important;min-height:40px!important;margin:4px 0!important;padding:7px 10px!important;background:#17356c!important;color:#fff!important;border:1px solid #2b4a80!important;border-radius:10px!important;font-size:12px!important;font-weight:750!important;line-height:1.3!important;text-align:left!important}
  .family-nav-scroll>[data-neo-howto]:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#118be8,#4dbb42,#f4c400,#ff7a16,#ef3b78)}
  .neo-department-nav>[data-neo-howto]{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;min-height:44px!important;margin:0 0 7px!important;padding:11px 13px!important;background:#102a60!important;color:#fff!important;border:1px solid #294579!important;border-radius:12px!important;font-size:14px!important;font-weight:750!important;text-align:left!important}
  .transport-sidebar-scroll>[data-neo-howto],#appView .workspace-nav>[data-neo-howto],#app .supply-nav-scroll>[data-neo-howto]{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;width:100%!important;min-height:46px!important;margin:7px 0!important;padding:9px 13px!important;background:#17356c!important;color:#fff!important;border:1px solid #2b4a80!important;border-radius:12px!important;font-size:13px!important;font-weight:800!important;text-align:left!important}
  @media(max-width:760px){.family-nav-scroll>[data-neo-howto],.transport-sidebar-scroll>[data-neo-howto],#appView .workspace-nav>[data-neo-howto],#app .supply-nav-scroll>[data-neo-howto]{min-height:44px!important;font-size:14px!important}}
  `;document.head.appendChild(style);
  if(signout&&signout.parentElement===host)host.insertBefore(btn,signout);else host.appendChild(btn);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();setTimeout(inject,1500)});else{inject();setTimeout(inject,1500)}
 let neoHowScheduled=false;new MutationObserver(()=>{if(neoHowScheduled)return;neoHowScheduled=true;requestAnimationFrame(()=>{neoHowScheduled=false;inject()})}).observe(document.body||document.documentElement,{childList:true,subtree:true});
})();
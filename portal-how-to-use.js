(()=>{
 const GRAD='linear-gradient(90deg,#118be8,#4dbb42,#f4c400,#ff7a16,#ef3b78)';
 const M=(name,enPurpose,enHow,tePurpose,teHow)=>[name,enPurpose,enHow,tePurpose,teHow];
 const DATA={
  school:{title:'School Portal',te:'స్కూల్ పోర్టల్',aud:'School admin / branch manager',groups:[
   ['School overview',[M('School overview','A daily control room for the school. It shows attendance, fees, income, staff attendance, payroll and urgent items in one place.','Open this first every day. Review pending counts and open the relevant department only when action is needed.','స్కూల్ రోజువారీ పరిస్థితిని ఒకే చోట చూపించే control room. Attendance, fees, income, staff attendance, payroll, pending items కనిపిస్తాయి.','ప్రతి రోజు మొదట ఇది open చేయండి. Pending count చూసి action అవసరమైన department మాత్రమే open చేయండి.')]],
   ['School setup',[
    M('School setup & readiness','Initial school configuration and readiness checklist.','Complete school profile, academic settings and readiness items before routine operations.','School basic configuration మరియు readiness checklist.','School profile, academic settings, readiness items complete చేసి regular operations ప్రారంభించండి.'),
    M('Manage teachers','Teacher login/access creation and account control.','Create teacher access only for approved staff and keep login ownership linked to the correct staff record.','Teacher login/access create చేసే tab.','Approved staffకే teacher access create చేసి correct staff recordకి link చేయండి.'),
    M('Teacher assignment','Controls which teacher owns which classroom or subject.','For Mother Teacher classes assign the classroom teacher; for Subject-wise classes assign the exact subject teacher.','ఏ teacherకి ఏ class/subject బాధ్యత ఉందో నిర్ణయించే tab.','Mother Teacher classకి classroom teacher assign చేయండి; Subject-wise classకి exact subject teacher assign చేయండి.')
   ]],
   ['Academics',[
    M('School calendar','School working days, holidays, events and academic dates.','Maintain and publish the official school calendar used by staff and parents.','Working days, holidays, events, academic dates కోసం.','Official school calendar maintain చేసి publish చేయండి.'),
    M('Curriculum & calendar','Curriculum plans and academic learning calendar.','Review/publish curriculum versions without overwriting published production history.','Curriculum plans మరియు academic learning calendar కోసం.','Published history overwrite చేయకుండా current/new curriculum versions manage చేయండి.'),
    M('Teacher timetable','Teacher period scheduling.','Create/review period schedules after classroom and teacher assignment are ready.','Teacher period schedules కోసం.','Classroom/teacher assignment తర్వాత timetable create/review చేయండి.'),
    M('Learning report','School-level learning progress report.','Use it to review class/learning progress; operational lesson completion remains teacher-owned.','School-level learning progress report.','Class learning progress review చేయండి; lesson completion teacher ownershipలోనే ఉంటుంది.'),
    M('Classrooms','Class, section, academic year and Teaching Model setup.','Choose Preschool / Primary / High School, active section, academic year, capacity and Mother Teacher or Subject-wise Teachers.','Class, section, academic year, Teaching Model setup కోసం.','Preschool/Primary/High School, active section, academic year, capacity, Mother Teacher లేదా Subject-wise Teachers select చేయండి.'),
    M('Homework','School oversight of homework records.','Review homework activity; teacher posting remains in Teacher Portal.','Homework oversight కోసం.','Homework activity review చేయండి; posting Teacher Portalలో జరుగుతుంది.'),
    M('Exams & hall tickets','Exam setup and hall-ticket related records.','Create/manage exam records where applicable and produce permitted outputs.','Exam setup మరియు hall tickets కోసం.','Applicable exam records manage చేసి permitted outputs generate చేయండి.'),
    M('Assessments & report cards','Assessment and report-card records.','Use for formal assessment/report-card workflows separate from teacher daily activity.','Assessments మరియు report cards కోసం.','Formal assessment/report-card workflow కోసం వాడండి.')
   ]],
   ['Students & parents',[
    M('Students','Student master and admissions data.','Register students or bulk upload existing data, then link them to the correct classroom.','Student master/admission data కోసం.','Students single entry లేదా bulk upload చేసి correct classroomకి link చేయండి.'),
    M('Attendance','Student attendance records.','Monitor attendance and correct only authorised school-level exceptions.','Student attendance records కోసం.','Attendance monitor చేసి authorised school-level corrections మాత్రమే చేయండి.'),
    M('Adoption calls & PTM','Parent call, follow-up and PTM monitoring.','Monitor teacher follow-up and PTM completion across assigned students.','Parent calls, follow-up, PTM monitoring కోసం.','Teacher follow-up/PTM completion monitor చేయండి.'),
    M('Promotion, TC & exit','Student lifecycle changes.','Use for promotion, transfer certificate and exit processes without deleting student history.','Promotion, TC, exit process కోసం.','Student history delete చేయకుండా lifecycle changes process చేయండి.'),
    M('Health & child safety','Health/safety oversight records.','Use only for authorised school safety and child-care records.','Health/safety oversight కోసం.','Authorised health/safety records మాత్రమే maintain చేయండి.'),
    M('Parent access','Parent portal login/access management.','Create/reset parent access and link it to the correct child/guardian.','Parent Portal access కోసం.','Parent login create/reset చేసి correct child/guardianకి link చేయండి.'),
    M('Parent concerns','Parent complaints/support items.','Track status, assign responsibility and close only after resolution.','Parent concerns/support items కోసం.','Status track చేసి responsibility assign చేసి resolution తర్వాత close చేయండి.')
   ]],
   ['Teachers',[M('Teacher tasks & reports','Teacher work tracking and reporting.','Use for school-level monitoring of teacher tasks and reports, not for editing teacher-owned assessment content.','Teacher tasks/reports monitoring కోసం.','Teacher work monitor చేయండి; teacher-owned assessment content edit చేయకండి.')]],
   ['Front office',[
    M('Enquiries','Admission/front-office enquiry pipeline.','Record enquiries and follow-up until admission, closure or next action.','Admission enquiries కోసం.','Enquiry record చేసి admission/closure/next action వరకు follow-up చేయండి.'),
    M('Parent notices','School notices sent to parents.','Create and publish parent-safe notices with clear dates and instructions.','Parentsకి school notices కోసం.','Clear date/instructionsతో parent-safe notice publish చేయండి.'),
    M('Visitor & gate','Visitor/gate control records.','Use for authorised visitor/gate workflows and child pickup controls where enabled.','Visitor/gate control కోసం.','Authorised visitor/gate/pickup workflowsకి వాడండి.')
   ]],
   ['HR & payroll',[
    M('Staff','Staff master.','Create and maintain staff records before assigning portal access or payroll.','Staff master కోసం.','Portal access/payroll ముందు staff records maintain చేయండి.'),
    M('Staff attendance','Employee attendance.','Mark/review staff attendance used by HR/payroll workflows.','Staff attendance కోసం.','HR/payroll workflowsకి staff attendance maintain చేయండి.'),
    M('HR salary & rules','Salary setup, HR rules, leave and advance workflow controls.','Configure approved salary/rule settings and review employee requests.','Salary setup, HR rules, leave/advance controls కోసం.','Approved salary/rules configure చేసి employee requests review చేయండి.'),
    M('Payroll','Payroll processing.','Process payroll only after attendance and salary setup are verified.','Payroll processing కోసం.','Attendance/salary setup verify చేసిన తర్వాత payroll process చేయండి.')
   ]],
   ['Finance',[
    M('Ledger & reports','Read-only finance ledger and summaries.','Use for reporting only; do not create manual duplicate ledger entries.','Read-only finance ledger/report కోసం.','Reportingకే వాడండి; manual duplicate ledger entries create చేయకండి.'),
    M('Payment vouchers','Money Out source document.','Create direct operating expense vouchers where allowed; system payments generate vouchers automatically.','Money Out source document.','Allowed direct expensesకి voucher create చేయండి; system payments auto-voucher అవుతాయి.'),
    M('Fee structures','Class/student fee setup.','Create approved fee structures before assigning fees.','Fee setup కోసం.','Approved fee structures create చేసి తర్వాత fees assign చేయండి.'),
    M('Assigned fees','Student fee requests/assignments.','Review assigned fee dues generated from fee structures.','Student fee dues/assignments కోసం.','Fee structure నుంచి వచ్చిన assigned fees review చేయండి.'),
    M('Collect payment','Fee receipt / Money In entry point.','Collect payment and generate receipt; ledger Money In posts automatically.','Fee collection మరియు receipt కోసం.','Payment collect చేసి receipt generate చేయండి; Money In ledgerకి auto-post అవుతుంది.'),
    M('Head-office payments','Head-office financial follow-up.','Use for authorised head-office related school payment records.','Head Office payment follow-up కోసం.','Authorised HO-related school payment recordsకి వాడండి.')
   ]],
   ['Inventory & stores',[
    M('Inventory & stores','School stock view and movement.','Track issued/received school stock and avoid manual duplication.','School stock tracking కోసం.','Issued/received stock track చేసి duplicate entries avoid చేయండి.'),
    M('Orders','School material/order requests.','Raise valid school orders and follow their status.','School material orders కోసం.','Valid order raise చేసి status follow చేయండి.'),
    M('Purchase, vendors & assets','School-side procurement/vendor/asset records.','Use only for school-authorised procurement and asset records; HO procurement remains in Supply Chain.','School-side procurement/vendor/assets కోసం.','School-authorised recordsకి వాడండి; HO procurement Supply Chainలో ఉంటుంది.')
   ]],
   ['Transport & safety',[M('Transport & safety','Routes, vehicles, drivers/attendants and daily transport monitoring.','Set up transport, assign children and monitor trips; GPS/CCTV are outside current Phase 1 scope.','Routes, vehicles, staff, child assignments, daily trip monitoring కోసం.','Transport setup/monitor చేయండి; GPS/CCTV current Phase 1లో లేవు.')]],
   ['Maintenance',[M('Maintenance & housekeeping','School maintenance and housekeeping records.','Use to record and track approved maintenance work.','Maintenance/housekeeping tracking కోసం.','Approved maintenance work record చేసి track చేయండి.')]],
   ['Library',[M('Library','Library operations where enabled.','Use only if the school activates the library workflow.','Library operations కోసం.','School library workflow enable చేసినప్పుడు వాడండి.')]],
   ['Approvals & control',[
    M('Approvals','Central approval queue.','Review only items routed for school-level approval.','Approval queue కోసం.','School approvalకి routed items మాత్రమే review చేయండి.'),
    M('Notification centre','School notifications and action alerts.','Open unread/actionable items and mark complete only after action.','Notifications/action alerts కోసం.','Action complete చేసిన తర్వాత మాత్రమే close/read status update చేయండి.'),
    M('Audit trail','Audit visibility.','Use to review recorded actions where available; do not use it as an editable transaction screen.','Audit review కోసం.','Recorded actions review చేయండి; editable transaction screenగా వాడకండి.')
   ]],
   ['Documents & reports',[
    M('Documents & downloads','Official document preview/download.','Generate only authorised school/student/staff documents.','Official documents కోసం.','Authorised school/student/staff documents మాత్రమే generate చేయండి.'),
    M('Reports & Excel','Operational report/export area.','Use filters first, then export the required report only.','Reports/Excel exports కోసం.','ముందు filters apply చేసి అవసరమైన report మాత్రమే export చేయండి.')
   ]],
   ['Operations & support',[M('Support','Operational support requests.','Raise a clear issue with enough detail, then follow status instead of creating duplicates.','Operational support కోసం.','Clear issue raise చేసి duplicate tickets create చేయకుండా status follow చేయండి.')]]
  ]},
  teacher:{title:'Teacher Portal',te:'టీచర్ పోర్టల్',aud:'Assigned teachers',groups:[
   ['Today',[M('Today','Your daily teaching dashboard.','Check today’s plan, pending lessons, announcements and tasks before class starts.','రోజువారీ teacher dashboard.','Class ప్రారంభానికి ముందు plan, pending lessons, announcements, tasks చూడండి.')]],
   ['Academics & teaching',[
    M('School calendar','School working days, holidays and events.','Check dates before planning lessons/homework.','School calendar కోసం.','Lessons/homework plan ముందు dates check చేయండి.'),
    M('My timetable','Your assigned periods only.','Use it to know which class/period you are responsible for.','మీ assigned periods కోసం.','ఏ class/period మీ బాధ్యతో తెలుసుకోడానికి వాడండి.'),
    M('My curriculum','Your assigned curriculum and lesson execution.','Open the planned lesson, teach it, then record completion/outcome.','మీ assigned curriculum/lesson execution కోసం.','Planned lesson open చేసి teach చేసి completion/outcome record చేయండి.'),
    M('Post homework','Homework publishing for assigned class/subject.','Select the correct class/subject, enter homework and publish to parents.','Assigned class/subject homework కోసం.','Correct class/subject select చేసి homework enter చేసి parentsకి publish చేయండి.'),
    M('My Question Bank','Teacher-owned question creation from completed lessons.','Generate only from your completed topics, review, select and approve your own questions.','మీ completed lessons నుంచి Question Bank కోసం.','మీ completed topics నుంచే questions generate చేసి review/select/approve చేయండి.'),
    M('Online Tests','Teacher-owned test creation/publishing.','Use approved questions, choose assigned class/subject, chapters and publish.','Online test creation/publishing కోసం.','Approved questionsతో assigned class/subject/chapter select చేసి publish చేయండి.'),
    M('Child performance & activity','Student performance/activity updates.','Add short observation/activity updates and photos only when needed.','Child performance/activity updates కోసం.','Short observation/activity update add చేసి అవసరమైతే photo add చేయండి.'),
    M('Parent follow-up & PTM','Parent communication and PTM workflow.','Record calls, follow-up actions and PTM notes for assigned students.','Parent calls/follow-up/PTM కోసం.','Assigned studentsకి calls, follow-up, PTM notes record చేయండి.'),
    M('Student comments','Teacher comments for students.','Add relevant learning/behaviour comments only for assigned students.','Student comments కోసం.','Assigned studentsకి relevant learning/behaviour comments మాత్రమే add చేయండి.'),
    M('Mark attendance','Class attendance.','Mark attendance only for the class you are responsible for.','Class attendance కోసం.','మీ బాధ్యత ఉన్న classకి మాత్రమే attendance mark చేయండి.'),
    M('My tasks & reports','Teacher task list and reporting.','Review pending work and complete required teacher reports.','Teacher tasks/reports కోసం.','Pending work చూసి required reports complete చేయండి.')
   ]],
   ['School communication',[
    M('Announcements','School messages for teachers.','Read current announcements and follow instructions.','Teacher announcements కోసం.','Current announcements చదివి instructions follow చేయండి.'),
    M('Parent concerns','Concerns routed to the teacher.','Respond only to assigned concerns and record the action taken.','Teacherకి routed parent concerns కోసం.','Assigned concernకి response/action record చేయండి.')
   ]],
   ['My HR',[M('Employee Hub','Teacher employee self-service.','Use leave, salary advance and other permitted HR self-service functions.','Teacher HR self-service కోసం.','Leave, salary advance మరియు permitted HR options వాడండి.')]],
   ['Documents & account',[
    M('Documents & reports','Teacher-permitted documents/reports.','Preview/download only your permitted records.','Teacher permitted documents/reports కోసం.','మీకు permission ఉన్న records మాత్రమే preview/download చేయండి.'),
    M('Password','Portal password management.','Change your password securely and do not share it.','Portal password కోసం.','Password securely change చేసి share చేయకండి.')
   ]]
  ]},
  parent:{title:'Parent Portal',te:'పేరెంట్ పోర్టల్',aud:'Parents / guardians',groups:[
   ['Today',[M('Today','Your child’s current-day learning snapshot.','Check latest classroom update, attendance status and important messages.','పిల్లవాడి ఈరోజు learning snapshot.','Latest classroom update, attendance status, important messages చూడండి.')]],
   ['Learning & classroom',[
    M('School calendar','School holidays, events and working days.','Check before planning attendance or activities.','School calendar కోసం.','Attendance/activity planning ముందు dates చూడండి.'),
    M('Child timetable','Your child’s class timetable.','Use it to know the day’s periods/activities.','పిల్లవాడి timetable కోసం.','రోజు periods/activities తెలుసుకోండి.'),
    M('Learning journal','Teacher-posted learning/activity updates.','Read what the child did/learned and any teacher note.','Teacher learning/activity updates కోసం.','Child ఏమి చేశాడు/నేర్చుకున్నాడు, teacher note చూడండి.'),
    M('Attendance','Attendance history/status.','Check marked attendance and contact school if something is genuinely incorrect.','Attendance కోసం.','Marked attendance చూడండి; తప్పు ఉంటే schoolని contact చేయండి.'),
    M('Homework','Teacher-posted homework.','Open current homework and follow the teacher instruction.','Homework కోసం.','Current homework open చేసి teacher instruction follow చేయండి.'),
    M('PTM reports','Parent-teacher meeting reports.','Read meeting summary, follow-up and agreed action.','PTM reports కోసం.','Meeting summary, follow-up, agreed action చూడండి.')
   ]],
   ['School & support',[
    M('Fees & receipts','Fee dues, payments and receipts.','Check outstanding dues and download official receipts after payment.','Fee dues/payments/receipts కోసం.','Outstanding dues చూడండి; payment తర్వాత official receipt download చేయండి.'),
    M('School notices','Official school announcements.','Read current notices and dates/instructions carefully.','School notices కోసం.','Current notice, date, instructions చదవండి.'),
    M('Concerns & support','Parent support/concern requests.','Raise one clear request and follow its status instead of sending duplicates.','Parent support/concern కోసం.','ఒక clear request raise చేసి duplicate కాకుండా status follow చేయండి.'),
    M('Books & uniforms','Child material/order information.','View issued materials or order status related to your child.','Books/uniforms/material details కోసం.','Childకి సంబంధించిన issued/order status చూడండి.'),
    M('Transport','Assigned route/trip updates and alerts.','Check transport information and alerts for your child.','Transport details కోసం.','Child assigned route/trip updates, alerts చూడండి.')
   ]],
   ['Documents & account',[
    M('Documents & reports','Permitted child documents/reports.','Preview/download only documents made available by the school.','Child documents/reports కోసం.','School అందుబాటులో పెట్టిన documents మాత్రమే preview/download చేయండి.'),
    M('Password','Parent portal password.','Change securely and keep credentials private.','Parent portal password కోసం.','Securely change చేసి credentials privateగా ఉంచండి.')
   ]]
  ]},
  transport:{title:'Driver / Transport Portal',te:'డ్రైవర్ / ట్రాన్స్‌పోర్ట్ పోర్టల్',aud:'Driver / attendant',groups:[
   ['Today’s Assigned Trips & Vehicle',[M('Today’s Assigned Trips & Vehicle','The main daily route/trip screen.','Verify assigned route, vehicle and children, complete checks and start only the correct trip.','రోజువారీ main route/trip screen.','Assigned route, vehicle, children verify చేసి checks complete చేసి correct trip మాత్రమే start చేయండి.')]],
   ['Documents',[
    M('Vehicle Documents','Assigned vehicle documents.','Open insurance, pollution, fitness, tax or RC records when needed.','Assigned vehicle documents కోసం.','Insurance, pollution, fitness, tax, RC అవసరమైనప్పుడు చూడండి.'),
    M('Driver Documents','Assigned driver documents.','Driver can view authorised driver documents for the assigned route.','Driver documents కోసం.','Assigned routeకి authorised driver documents చూడండి.'),
    M('Attendant Documents','Assigned attendant documents.','Use for authorised attendant ID/document reference.','Attendant documents కోసం.','Authorised attendant documents reference కోసం వాడండి.')
   ]],
   ['Vehicle Maintenance',[
    M('Fuel Refill','Fuel refill reporting.','Enter odometer, litres, details, amount and invoice photo when required; this report itself is not the finance entry.','Fuel refill report కోసం.','Odometer, litres, details, amount, అవసరమైతే invoice photo add చేయండి; ఇది finance entry కాదు.'),
    M('Tyre Air Check','Tyre air/safety check report.','Record the check after it is actually done.','Tyre air/safety check కోసం.','Actual check చేసిన తర్వాత మాత్రమే record చేయండి.'),
    M('Repairs & Service','Vehicle repair/service report.','Report service/repair details to school; school confirms finance separately.','Vehicle repair/service report కోసం.','Repair/service details schoolకి report చేయండి; finance school separately confirm చేస్తుంది.')
   ]]
  ]},
  supply:{title:'Supply Chain Portal',te:'సప్లై చైన్ పోర్టల్',aud:'Head Office procurement / inventory team',groups:[
   ['Overview',[M('Dashboard','Supply-chain control dashboard.','Review pending center orders, vendor POs, stock, packs and credit alerts.','Supply-chain control dashboard.','Pending center orders, vendor POs, stock, packs, credit alerts review చేయండి.')]],
   ['Center demand & finance',[
    M('Center Orders','Orders received from schools/centers.','Review and approve valid orders at Head Office.','Centers నుంచి వచ్చిన orders కోసం.','Valid ordersని Head Officeలో review/approve చేయండి.'),
    M('Demand Consolidation','Aggregated demand across centers.','Use to combine demand before vendor procurement.','Centers demand aggregation కోసం.','Vendor procurement ముందు demand consolidate చేయండి.'),
    M('Center Finance','Center credit/outstanding follow-up.','Track dues, due dates and payment follow-up.','Center credit dues కోసం.','Due dates, outstanding, payment follow-up track చేయండి.'),
    M('Schools Ledger','School-level supply/finance ledger view.','Use for review and reconciliation, not duplicate manual entries.','School supply/finance ledger review కోసం.','Review/reconciliationకి వాడండి; duplicate manual entries చేయకండి.')
   ]],
   ['Procurement',[
    M('Vendor Master','Approved vendor list.','Maintain vendor details for books, uniforms and other materials.','Approved vendors కోసం.','Books, uniforms, materials vendors maintain చేయండి.'),
    M('Products & Kits','Material/kit master.','Maintain items, standard prices and class-wise kits.','Products/kits master కోసం.','Items, standard prices, class-wise kits maintain చేయండి.'),
    M('Vendor Purchase Orders','POs issued to vendors.','Create/track vendor orders based on approved demand.','Vendor purchase orders కోసం.','Approved demand ఆధారంగా vendor POs create/track చేయండి.')
   ]],
   ['Warehouse & fulfillment',[
    M('Warehouse & GRN','Goods receipt and central stock.','Record received vendor goods and update stock.','Goods receipt/central stock కోసం.','Vendor goods receive చేసి stock update చేయండి.'),
    M('Packing','Center-wise packing.','Pack approved quantities and perform the required check.','Center-wise packing కోసం.','Approved quantities pack చేసి required check complete చేయండి.'),
    M('Dispatch & Tracking','Dispatch to centers and delivery tracking.','Dispatch the correct pack to the correct center and track receipt.','Center dispatch/tracking కోసం.','Correct pack correct centerకి dispatch చేసి receipt track చేయండి.')
   ]],
   ['Vendor finance',[M('Vendor Finance','Vendor payable/payment follow-up.','Review vendor dues and authorised payment status.','Vendor finance follow-up కోసం.','Vendor dues మరియు authorised payment status review చేయండి.')]]
  ]},
  headoffice:{title:'Head Office / Admin Portal',te:'హెడ్ ఆఫీస్ / అడ్మిన్ పోర్టల్',aud:'Head Office operations team',groups:[
   ['Head Office workspace',[
    M('Overview / dashboard','Network-level operational overview.','Review school activity, pipeline, alerts and items requiring Head Office action.','Network-level operational overview.','Schools activity, alerts, pending HO actions review చేయండి.'),
    M('Schools','School account/workspace management.','Open the correct school for support, controlled administration and status review.','School account/workspace management కోసం.','Correct school open చేసి support/admin/status review చేయండి.'),
    M('Leads / enquiries','Head Office lead and franchise enquiry pipeline.','Track enquiry stage, next action and ownership.','HO leads/franchise enquiries కోసం.','Stage, next action, ownership track చేయండి.'),
    M('Access / credentials','Authorised access administration.','Create/reset authorised access and share credentials privately.','Authorised access administration కోసం.','Access create/reset చేసి credentials privateగా ఇవ్వండి.'),
    M('Operations / alerts','Network issues requiring follow-up.','Open actionable items, resolve, then update status.','Network operational alerts కోసం.','Actionable items resolve చేసి తర్వాత status update చేయండి.'),
    M('Reports','Network-level reports.','Use filters and download only the required report.','Network reports కోసం.','Filters apply చేసి అవసరమైన report మాత్రమే download చేయండి.'),
    M('Supply Chain link','Entry to the dedicated Head Office procurement workspace.','Use Supply Chain for center orders, vendors, warehouse and dispatch.','Supply Chain workspaceకి entry.','Center orders, vendors, warehouse, dispatch కోసం Supply Chain వాడండి.')
   ]]
  ]}
 };
 function role(){const p=location.pathname.toLowerCase();if(p.includes('teacher'))return'teacher';if(p.includes('parent'))return'parent';if(p.includes('transport')||p.includes('driver'))return'transport';if(p.includes('supply'))return'supply';if(p.includes('admin'))return'headoffice';return'school'}
 const key=role(),d=DATA[key]||DATA.school;
 const flat=()=>d.groups.flatMap(([g,mods])=>mods.map(m=>({group:g,m})));
 function moduleCard(m,lang){const name=m[0],purpose=lang==='te'?m[3]:m[1],how=lang==='te'?m[4]:m[2];return '<article class="neo-guide-module"><h4>'+name+'</h4><p><b>'+(lang==='te'?'ఇది ఏమిటి / Purpose':'What it is / Purpose')+':</b> '+purpose+'</p><p><b>'+(lang==='te'?'ఎలా వాడాలి':'How to use')+':</b> '+how+'</p></article>'}
 function guideHtml(lang){return d.groups.map(([g,mods])=>'<section class="neo-guide-group"><h3>'+g+'</h3>'+mods.map(m=>moduleCard(m,lang)).join('')+'</section>').join('')}
 function openModal(){let modal=document.getElementById('neoHowToModal');if(!modal){modal=document.createElement('div');modal.id='neoHowToModal';document.body.appendChild(modal)}
  modal.innerHTML='<div class="neo-howto-backdrop"></div><section class="neo-howto-card" role="dialog" aria-modal="true"><button class="neo-howto-close" aria-label="Close">×</button><div class="neo-howto-top"><img src="/neo-top-logo.jpeg" alt="Neo School India"><div><span>HOW TO USE</span><h2>'+d.title+'</h2><p>'+d.aud+'</p></div></div><div class="neo-howto-tabs"><button data-howtab="en" class="active">Guidance in English</button><button data-howtab="te">Guidance in Telugu</button><button data-howtab="pdf">PDF Guide</button><button data-howtab="play">▶ PPT / Play Guide</button></div><div class="neo-howto-body" data-pane="en"><p class="neo-guide-intro">This guide follows the same departments, tab names and order as the portal.</p>'+guideHtml('en')+'</div><div class="neo-howto-body" data-pane="te" hidden><p class="neo-guide-intro">ఈ guide portalలో ఉన్న అదే departments, అదే tab names, అదే orderను follow అవుతుంది.</p>'+guideHtml('te')+'</div><div class="neo-howto-body" data-pane="pdf" hidden><h3>PDF Guide</h3><div class="neo-howto-actions"><button data-pdf-lang="en">English PDF</button><button data-pdf-lang="te">Telugu PDF</button></div><div id="neoHowPdfPreview"></div><div class="neo-howto-actions"><button data-print-guide>Print / Save PDF</button></div></div><div class="neo-howto-body" data-pane="play" hidden><div class="neo-play-head"><h3>PPT-style Play Guide</h3><div class="neo-howto-actions"><button data-play-lang="en">English</button><button data-play-lang="te">Telugu</button></div></div><div id="neoHowSlide" class="neo-how-slide"></div><div class="neo-howto-actions"><button data-prev>Previous</button><button data-autoplay>▶ Play</button><button data-next>Next</button></div></div></section>';
  let style=document.getElementById('neoHowToStyle');if(!style){style=document.createElement('style');style.id='neoHowToStyle';document.head.appendChild(style)}
  style.textContent='#neoHowToModal{position:fixed;inset:0;z-index:99999}.neo-howto-backdrop{position:absolute;inset:0;background:#031134a8}.neo-howto-card{position:relative;margin:3vh auto;width:min(980px,94vw);max-height:94vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 28px 80px #0006;border-top:5px solid transparent;border-image:'+GRAD+' 1;color:#12213c}.neo-howto-close{position:absolute;right:16px;top:14px;width:36px;height:36px;border-radius:50%;border:1px solid #d9e4f2;background:#fff;color:#071b52;font-size:24px}.neo-howto-top{display:flex;gap:20px;align-items:center;padding:28px 32px 16px}.neo-howto-top img{width:135px}.neo-howto-top span{font-size:12px;letter-spacing:.14em;color:#118be8;font-weight:900}.neo-howto-top h2{margin:4px 0;color:#071b52;font-size:32px}.neo-howto-top p{margin:0;color:#65748c}.neo-howto-tabs{display:flex;gap:9px;padding:0 32px 18px;flex-wrap:wrap}.neo-howto-tabs button,.neo-howto-actions button{border:0;border-radius:11px;padding:10px 13px;background:#edf5ff;color:#071b52;font-weight:900}.neo-howto-tabs button.active{background:#071b52;color:#fff}.neo-howto-body{margin:0 32px 32px;padding:22px;border:1px solid #dce6f2;border-radius:18px;background:#fbfdff}.neo-guide-intro{margin-top:0;color:#52617b}.neo-guide-group{margin:0 0 18px;padding:16px;border:1px solid #dbe6f2;border-radius:16px;background:#fff}.neo-guide-group>h3{margin:0 0 12px;color:#071b52;padding-bottom:9px;border-bottom:3px solid transparent;border-image:'+GRAD+' 1}.neo-guide-module{padding:12px 13px;margin:9px 0;border:1px solid #e2e9f3;border-radius:12px;background:#fbfdff}.neo-guide-module h4{margin:0 0 7px;color:#0d2c65}.neo-guide-module p{margin:5px 0;color:#52617b;line-height:1.5}.neo-how-slide{min-height:250px;padding:28px;border-radius:18px;background:#fff;border:1px solid #dce6f2;display:grid;align-content:center}.neo-how-slide .slide-dept{font-size:12px;font-weight:900;letter-spacing:.08em;color:#118be8}.neo-how-slide h4{font-size:27px;color:#071b52;margin:8px 0}.neo-how-slide p{font-size:17px;color:#445773;line-height:1.5}.neo-howto-actions{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap}.neo-play-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}@media print{body>*:not(#neoHowToModal){display:none!important}.neo-howto-backdrop,.neo-howto-close,.neo-howto-tabs,.neo-howto-actions{display:none!important}.neo-howto-card{margin:0!important;width:100%!important;max-height:none!important;box-shadow:none!important;border-radius:0!important}.neo-howto-body{display:none!important}.neo-howto-body[data-pane="pdf"]{display:block!important;border:0!important;margin:0!important}}@media(max-width:640px){.neo-howto-top{display:block}.neo-howto-top img{width:105px}.neo-howto-top h2{font-size:25px}.neo-howto-body{margin:0 12px 18px;padding:14px}}';
  const close=()=>{if(timer)clearInterval(timer);modal.remove()};modal.querySelector('.neo-howto-close').onclick=close;modal.querySelector('.neo-howto-backdrop').onclick=close;
  let slide=0,playLang='en',pdfLang='en',timer=null;const rows=()=>flat();
  const renderSlide=()=>{const a=rows(),x=a[slide%a.length],m=x.m,purpose=playLang==='te'?m[3]:m[1],how=playLang==='te'?m[4]:m[2];modal.querySelector('#neoHowSlide').innerHTML='<div class="slide-dept">'+x.group+' · '+(slide+1)+' / '+a.length+'</div><h4>'+m[0]+'</h4><p><b>'+(playLang==='te'?'Purpose':'Purpose')+':</b> '+purpose+'</p><p><b>'+(playLang==='te'?'ఎలా వాడాలి':'How to use')+':</b> '+how+'</p>'};
  const renderPdf=()=>{modal.querySelector('#neoHowPdfPreview').innerHTML='<div class="neo-guide-intro">'+(pdfLang==='te'?'Portalలో ఉన్న అదే departments/tabs orderలో guide.':'Guide in the same department/tab order as the portal.')+'</div>'+guideHtml(pdfLang)};
  const stop=()=>{if(timer){clearInterval(timer);timer=null}const b=modal.querySelector('[data-autoplay]');if(b)b.textContent='▶ Play'};const start=()=>{stop();modal.querySelector('[data-autoplay]').textContent='❚❚ Pause';timer=setInterval(()=>{slide=(slide+1)%rows().length;renderSlide()},3500)};
  renderSlide();renderPdf();modal.querySelectorAll('[data-howtab]').forEach(b=>b.onclick=()=>{stop();modal.querySelectorAll('[data-howtab]').forEach(x=>x.classList.toggle('active',x===b));modal.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.howtab);if(b.dataset.howtab==='play'){slide=0;renderSlide()}if(b.dataset.howtab==='pdf')renderPdf()});modal.querySelectorAll('[data-play-lang]').forEach(b=>b.onclick=()=>{playLang=b.dataset.playLang;slide=0;renderSlide()});modal.querySelectorAll('[data-pdf-lang]').forEach(b=>b.onclick=()=>{pdfLang=b.dataset.pdfLang;renderPdf()});modal.querySelector('[data-next]').onclick=()=>{stop();slide=(slide+1)%rows().length;renderSlide()};modal.querySelector('[data-prev]').onclick=()=>{stop();slide=(slide+rows().length-1)%rows().length;renderSlide()};modal.querySelector('[data-autoplay]').onclick=()=>timer?stop():start();modal.querySelector('[data-print-guide]').onclick=()=>window.print()
 }
 function inject(){
  const old=document.querySelector('[data-neo-howto]');let host=null,signout=null;
  if(document.querySelector('.family-tabs')){host=document.querySelector('.family-tabs');signout=host.querySelector('#familySignOut')}
  else if(document.querySelector('.neo-department-nav')){host=document.querySelector('.neo-department-nav');signout=host.querySelector('#navSignOut')}
  else if(document.querySelector('.transport-sidebar')){host=document.querySelector('.transport-sidebar');signout=host.querySelector('#transportSideSignout')}
  else if(document.querySelector('#appView .workspace-nav')){host=document.querySelector('#appView .workspace-nav');signout=host.querySelector('.logout')}
  else if(document.querySelector('#app .side')){host=document.querySelector('#app .side');signout=host.querySelector('.nav-signout')}
  if(!host){if(old)old.remove();return}if(old&&old.parentElement===host&&(!signout||old.nextElementSibling===signout))return;if(old)old.remove();
  const btn=document.createElement('button');btn.type='button';btn.dataset.neoHowto='1';btn.innerHTML='<span class="neo-howto-mini">?</span><span>How to Use</span>';btn.onclick=openModal;
  let style=document.getElementById('neoHowBtnStyle');if(!style){style=document.createElement('style');style.id='neoHowBtnStyle';document.head.appendChild(style)}
  style.textContent='[data-neo-howto]{position:relative;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;width:calc(100% - 24px)!important;min-height:46px!important;margin:8px 12px!important;padding:9px 13px!important;border-radius:12px!important;background:#17356c!important;color:#fff!important;border:1px solid #2b4a80!important;font-size:13px!important;font-weight:800!important;line-height:1.3!important;text-align:left!important;box-shadow:none!important;flex:none!important}.neo-howto-mini{display:grid;place-items:center;width:29px;height:29px;flex:0 0 29px;border-radius:9px;background:#eaf7fb;color:#0b5f82;font-weight:900}[data-neo-howto]:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:'+GRAD+'}.neo-department-nav>[data-neo-howto],#appView .workspace-nav>[data-neo-howto],#app .side>[data-neo-howto],.transport-sidebar>[data-neo-howto]{width:100%!important;margin:7px 0!important}@media(max-width:760px){[data-neo-howto]{min-height:44px!important;font-size:14px!important}}';
  if(signout&&signout.parentElement===host)host.insertBefore(btn,signout);else host.appendChild(btn)
 }
 const run=()=>{inject();setTimeout(inject,700)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;inject()})}).observe(document.body||document.documentElement,{childList:true,subtree:true});
})();
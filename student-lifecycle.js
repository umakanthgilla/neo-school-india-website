(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
window.renderNeoStudentLifecycle=async function(area,{records,call,refresh,status}){
 area.innerHTML='<p class="portal-empty">Loading student movement history…</p>';
 let movements,certificates,feeSummaries={};
 try{const [movementResponse,tcResponse]=await Promise.all([call('student_movements'),call('student_tc')]);movements=movementResponse.records||[];feeSummaries=movementResponse.fee_summaries||{};certificates=tcResponse.records||[]}
 catch(error){area.innerHTML='<div class="portal-error"><h3>Student movements unavailable</h3><p>'+esc(error.message)+'</p></div>';return}
 const students=(records.students||[]).filter(x=>x.status!=='Withdrawn'),classes=records.classrooms||[];
 const className=id=>classes.find(x=>x.id===id)?.name||id||'Unassigned';
 const money=p=>Number(p||0)/100;
 const feeSummary=student=>feeSummaries[student.id]||{old:0,current:0,total:0};

 area.innerHTML=`<span class="eyebrow">STUDENT LIFECYCLE</span><h2>Promote, change section or withdraw</h2><p>Keep one Student ID. The previous class remains in the history below. Fees already paid are preserved; new class fee requests are created only once.</p>
 <form id="neoMovementForm" class="panel"><div class="fields">
 <label>Student<select name="student_id" required><option value="">Choose child…</option>${students.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.program)} · ${esc(x.academic_year)}</option>`).join('')}</select></label>
 <label>Movement<select name="type" required><option value="">Choose…</option><option>Promotion</option><option>Section change</option><option>Withdrawal</option></select></label>
 <label id="movementTarget">New classroom<select name="to_classroom_id" required><option value="">Choose student and movement first…</option></select></label>
 <label>Effective date<input name="effective_date" type="date" max="${today()}" value="${today()}" required></label>
 <label class="full-width">Reason / authorisation note<textarea name="reason" required maxlength="500"></textarea></label></div>
 <div id="movementFeeSummary" class="portal-system-note"><strong>Fee balance</strong><span>Choose a student to review old dues and the current balance before changing the student's status.</span></div><p id="movementHint" class="form-note">Choose a student and movement to see eligible classrooms.</p><button type="submit">Save student movement</button></form>
 <h3>Movement history</h3><div class="portal-grid">${movements.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map(x=>{const child=(records.students||[]).find(s=>s.id===x.student_id);return `<article class="portal-card"><h4>${esc(child?.name||x.student_id)} · ${esc(x.type)}</h4><p>${esc(className(x.from_classroom_id))} → ${esc(x.to_classroom_id?className(x.to_classroom_id):'Withdrawn')}</p><p>${esc(x.from_academic_year)} → ${esc(x.to_academic_year||'Exit')} · Effective ${esc(x.effective_date)}</p><p>${esc(x.reason)}</p></article>`}).join('')||'<p>No student movements recorded.</p>'}</div>`;
 const pending=movements.filter(x=>x.type==='Withdrawal'&&!certificates.some(c=>c.movement_id===x.id));
 area.insertAdjacentHTML('beforeend',`<h3>Transfer Certificates</h3><p>Review outstanding fees and student details before issuing. The document number is assigned once.</p><div class="portal-grid">${pending.map(x=>{const child=(records.students||[]).find(s=>s.id===x.student_id);return `<article class="portal-card"><h4>${esc(child?.name||x.student_id)} · Withdrawal</h4><p>Previous-year dues: ₹${(Number(x.previous_due_paise||0)/100).toFixed(2)} · Current dues: ₹${(Number(x.current_due_paise||0)/100).toFixed(2)}</p><p><strong>Total outstanding at TC: ₹${(Number(x.total_due_paise||0)/100).toFixed(2)}</strong> · ${esc(x.due_status||'DUE')}</p><button type="button" data-issue-tc="${esc(x.id)}">Issue Transfer Certificate</button></article>`}).join('')}${certificates.map(tc=>`<article class="portal-card"><h4>${esc(tc.student_name)}</h4><p>${esc(tc.certificate_no)} · Issued ${esc(tc.issued_on)}</p><button type="button" class="secondary" data-print-tc="${esc(tc.id)}">Print TC</button></article>`).join('')||(!pending.length?'<p>No Transfer Certificates issued yet.</p>':'')}</div>`);
 area.querySelectorAll('[data-issue-tc]').forEach(button=>button.onclick=async()=>{if(!confirm('Issue one numbered Transfer Certificate for this saved withdrawal? Review the fee balance and student details first.'))return;button.disabled=true;try{await call('student_tc','POST',{movement_id:button.dataset.issueTc});await refresh();status('Transfer Certificate issued. Open this tab to print it.')}catch(error){status(error.message);button.disabled=false}});
 area.querySelectorAll('[data-print-tc]').forEach(button=>button.onclick=()=>{const tc=certificates.find(c=>c.id===button.dataset.printTc);if(!window.neoPrintTC?.(tc))status('Allow pop-ups to print the Transfer Certificate.')});
 const form=area.querySelector('#neoMovementForm'),studentSelect=form.elements.student_id,typeSelect=form.elements.type,targetSelect=form.elements.to_classroom_id,targetLabel=area.querySelector('#movementTarget'),hint=area.querySelector('#movementHint');
 const choices=()=>{const student=students.find(x=>x.id===studentSelect.value),type=typeSelect.value;const summary=student?feeSummary(student):null;
  const target=student&&type!=='Withdrawal'?classes.find(c=>c.id===targetSelect.value):null;
  const newFee=(target?(records.fee_structures||[]).filter(f=>String(f.classroom_id)===String(target.id)).reduce((n,f)=>n+Number(f.amount_paise||0),0):0);
  const feeBox=area.querySelector('#movementFeeSummary');
  if(feeBox)feeBox.innerHTML=student?'<strong>Fee balance before movement</strong><span>Old / previous-year due: ₹'+summary.old.toFixed(2)+' · Current due: ₹'+summary.current.toFixed(2)+' · Total outstanding: ₹'+summary.total.toFixed(2)+'</span>':'<strong>Fee balance</strong><span>Choose a student to review old dues and the current balance before changing the student status.</span>';

  targetLabel.hidden=type==='Withdrawal';targetSelect.required=type!=='Withdrawal';targetSelect.disabled=type==='Withdrawal';
  const eligible=student&&type==='Promotion'?classes.filter(c=>Number(c.academic_year)>Number(student.academic_year)):student&&type==='Section change'?classes.filter(c=>c.program===student.program&&c.academic_year===student.academic_year&&c.id!==student.classroom_id):[];
  targetSelect.innerHTML='<option value="">Choose classroom…</option>'+eligible.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.program)} · ${esc(c.academic_year)}</option>`).join('');
  hint.textContent=!student?'Choose a student first.':type==='Withdrawal'?'The student will leave the active class. Existing fees and history remain.':eligible.length?'Choose the destination classroom.':'No eligible classroom yet. Create the next class or section first.';
 };
 targetSelect.onchange=choices;studentSelect.onchange=choices;typeSelect.onchange=choices;
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,body=Object.fromEntries(new FormData(form));const selected=students.find(x=>x.id===body.student_id),summary=selected?feeSummary(selected):null;const target=body.to_classroom_id?classes.find(x=>x.id===body.to_classroom_id):null;const newFee=target?(records.fee_structures||[]).filter(f=>String(f.classroom_id)===String(target.id)).reduce((n,f)=>n+Number(f.amount_paise||0),0):0;
  if(summary&&body.type==='Withdrawal'&&summary.total>0&&!confirm('This student has an outstanding balance of ₹'+summary.total.toFixed(2)+', including previous-year dues of ₹'+summary.old.toFixed(2)+'. Continue withdrawal?'))return;
  if(summary&&body.type==='Promotion'&&!confirm('Promotion will keep the old outstanding balance of ₹'+summary.total.toFixed(2)+' and add the destination classroom fee of ₹'+newFee.toFixed(2)+'. Total visible balance after promotion will be ₹'+(summary.total+newFee).toFixed(2)+'. Continue?'))return;body.request_id=crypto.randomUUID();if(body.type==='Withdrawal')delete body.to_classroom_id;button.disabled=true;try{await call('student_movements','POST',body);await refresh();status('Student movement saved. The original Student ID and history remain available.')}catch(error){status(error.message);button.disabled=false}};
};
})();

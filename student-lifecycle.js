(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
window.renderNeoStudentLifecycle=async function(area,{records,call,refresh,status}){
 area.innerHTML='<p class="portal-empty">Loading student movement history…</p>';
 let movements;
 try{movements=(await call('student_movements')).records||[]}
 catch(error){area.innerHTML='<div class="portal-error"><h3>Student movements unavailable</h3><p>'+esc(error.message)+'</p></div>';return}
 const students=(records.students||[]).filter(x=>x.status!=='Withdrawn'),classes=records.classrooms||[];
 const className=id=>classes.find(x=>x.id===id)?.name||id||'Unassigned';
 area.innerHTML=`<span class="eyebrow">STUDENT LIFECYCLE</span><h2>Promote, change section or withdraw</h2><p>Keep one Student ID. The previous class remains in the history below. Fees already paid are preserved; new class fee requests are created only once.</p>
 <form id="neoMovementForm" class="panel"><div class="fields">
 <label>Student<select name="student_id" required><option value="">Choose child…</option>${students.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.program)} · ${esc(x.academic_year)}</option>`).join('')}</select></label>
 <label>Movement<select name="type" required><option value="">Choose…</option><option>Promotion</option><option>Section change</option><option>Withdrawal</option></select></label>
 <label id="movementTarget">New classroom<select name="to_classroom_id" required><option value="">Choose student and movement first…</option></select></label>
 <label>Effective date<input name="effective_date" type="date" max="${today()}" value="${today()}" required></label>
 <label class="full-width">Reason / authorisation note<textarea name="reason" required maxlength="500"></textarea></label></div>
 <p id="movementHint" class="form-note">Choose a student and movement to see eligible classrooms.</p><button type="submit">Save student movement</button></form>
 <h3>Movement history</h3><div class="portal-grid">${movements.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map(x=>{const child=(records.students||[]).find(s=>s.id===x.student_id);return `<article class="portal-card"><h4>${esc(child?.name||x.student_id)} · ${esc(x.type)}</h4><p>${esc(className(x.from_classroom_id))} → ${esc(x.to_classroom_id?className(x.to_classroom_id):'Withdrawn')}</p><p>${esc(x.from_academic_year)} → ${esc(x.to_academic_year||'Exit')} · Effective ${esc(x.effective_date)}</p><p>${esc(x.reason)}</p></article>`}).join('')||'<p>No student movements recorded.</p>'}</div>`;
 const form=area.querySelector('#neoMovementForm'),studentSelect=form.elements.student_id,typeSelect=form.elements.type,targetSelect=form.elements.to_classroom_id,targetLabel=area.querySelector('#movementTarget'),hint=area.querySelector('#movementHint');
 const choices=()=>{const student=students.find(x=>x.id===studentSelect.value),type=typeSelect.value;
  targetLabel.hidden=type==='Withdrawal';targetSelect.required=type!=='Withdrawal';targetSelect.disabled=type==='Withdrawal';
  const eligible=student&&type==='Promotion'?classes.filter(c=>Number(c.academic_year)>Number(student.academic_year)):student&&type==='Section change'?classes.filter(c=>c.program===student.program&&c.academic_year===student.academic_year&&c.id!==student.classroom_id):[];
  targetSelect.innerHTML='<option value="">Choose classroom…</option>'+eligible.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.program)} · ${esc(c.academic_year)}</option>`).join('');
  hint.textContent=!student?'Choose a student first.':type==='Withdrawal'?'The student will leave the active class. Existing fees and history remain.':eligible.length?'Choose the destination classroom.':'No eligible classroom yet. Create the next class or section first.';
 };
 studentSelect.onchange=choices;typeSelect.onchange=choices;
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,body=Object.fromEntries(new FormData(form));body.request_id=crypto.randomUUID();if(body.type==='Withdrawal')delete body.to_classroom_id;button.disabled=true;try{await call('student_movements','POST',body);await refresh();status('Student movement saved. The original Student ID and history remain available.')}catch(error){status(error.message);button.disabled=false}};
};
})();

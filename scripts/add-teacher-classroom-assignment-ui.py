from pathlib import Path

p = Path('schools.html')
s = p.read_text()

old = """<p>Assigned: ${esc((a.classroom_ids||[]).map(classroomName).join(', ')||'No classroom yet')}</p><button class=\"secondary\" data-disable=\"${esc(a.account_id)}\" ${!a.active?'disabled':''}>${a.active?'Disable access':'Access disabled'}</button>"""
new = """<p>Assigned: ${esc((a.classroom_ids||[]).map(classroomName).join(', ')||'No classroom yet')}</p><div class=\"actions\"><button type=\"button\" class=\"secondary\" data-assign-classroom=\"${esc(a.account_id)}\" ${!a.active?'disabled':''}>Assign / change classroom</button><button class=\"secondary\" data-disable=\"${esc(a.account_id)}\" ${!a.active?'disabled':''}>${a.active?'Disable access':'Access disabled'}</button></div><div data-assignment-editor></div>"""

if old in s:
    s = s.replace(old, new, 1)
elif 'data-assign-classroom=' not in s:
    raise SystemExit('teacher account card anchor not found')

anchor = """   if(openStaff)openStaff.onclick=()=>openPortalTab('staff','teacher_access');
 }else{"""
insert = """   if(openStaff)openStaff.onclick=()=>openPortalTab('staff','teacher_access');
   area.querySelectorAll('[data-assign-classroom]').forEach(button=>button.onclick=()=>{
    const account=accounts.find(a=>String(a.account_id)===String(button.dataset.assignClassroom));
    const card=button.closest('.portal-card'),host=card?.querySelector('[data-assignment-editor]');
    if(!account||!host)return;
    if(host.dataset.open==='1'){host.innerHTML='';host.dataset.open='0';button.textContent='Assign / change classroom';return}
    const rooms=(records.classrooms||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    if(!rooms.length){portalNotice('Create the classroom / section first.');return}
    host.dataset.open='1';button.textContent='Close assignment';
    host.innerHTML=`<div class=\"portal-editor\" style=\"margin-top:12px\"><label>Classroom / section<select data-teacher-room><option value=\"\">Choose classroom…</option>${rooms.map(c=>`<option value=\"${esc(c.id)}\" ${(account.classroom_ids||[]).includes(c.id)?'selected':''}>${esc(c.name+' · '+c.program+' · '+c.academic_year)}</option>`).join('')}</select></label><button type=\"button\" data-save-teacher-room>Save classroom assignment</button><p class=\"form-note\">This links the existing Teacher Account and Staff ID to the selected classroom. It does not create another teacher or reset the password.</p></div>`;
    host.querySelector('[data-save-teacher-room]').onclick=async e=>{
     const classroomId=host.querySelector('[data-teacher-room]').value;
     if(!classroomId){portalNotice('Choose a classroom / section.');return}
     e.target.disabled=true;
     try{
      await call('teacher_assignment','POST',{classroom_id:classroomId,teacher_account_id:account.account_id});
      await loadRecords();
      portalNotice('Teacher classroom assignment saved.');
      renderContent();
     }catch(error){portalNotice(error.message);e.target.disabled=false}
    };
   });
 }else{"""

if anchor in s:
    s = s.replace(anchor, insert, 1)
elif "area.querySelectorAll('[data-assign-classroom]')" not in s:
    raise SystemExit('teacher assignment handler anchor not found')

p.write_text(s)

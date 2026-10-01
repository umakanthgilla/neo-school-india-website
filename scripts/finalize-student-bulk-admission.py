from pathlib import Path
import re


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Marker not found: {label}')
    return text.replace(old, new, 1)

bulk_path=Path('bulk-upload.js')
plus_path=Path('bulk-upload-plus.js')
password_path=Path('password-access.js')
schools_path=Path('schools.html')

bulk=bulk_path.read_text()
plus=plus_path.read_text()
password=password_path.read_text()
schools=schools_path.read_text()

bulk=replace_once(
    bulk,
    "const STUDENT_HEADERS=['student_id','name','dob','gender','parent','mobile','email','program','academic_year','classroom','previous_school','previous_city','nursery_status','lkg_status'];",
    "const STUDENT_HEADERS=['name','dob','gender','parent','mobile','email','program','academic_year','classroom','previous_school','previous_city','nursery_status','lkg_status'];\nconst STUDENT_PROGRAM_ORDER=['Playgroup','Nursery','LKG','UKG','Daycare'];",
    'student template headers'
)

bulk=bulk.replace("    if(d.student_id&&!validRecordId(d.student_id))errors.push('Student ID must be 8-80 letters/numbers/_/- or leave blank');\n",'')
bulk=bulk.replace("    if(d.student_id&&existing.some(x=>String(x.id)===d.student_id))errors.push('Student ID already exists');\n",'')
bulk=replace_once(
    bulk,
    "    return {...row,type:'student',recordId:d.student_id||'',body,errors,status:errors.length?'Invalid':'Ready'};",
    "    return {...row,type:'student',recordId:'',body,errors,status:errors.length?'Invalid':'Ready'};",
    'student record id'
)

old="""function renderPreview(panel,items){
  const valid=items.filter(x=>!x.errors.length).length,invalid=items.length-valid;
  panel.querySelector('[data-bulk-summary]').innerHTML=`<article><small>Total rows</small><strong>${items.length}</strong></article><article><small>Ready</small><strong>${valid}</strong></article><article><small>Needs correction</small><strong>${invalid}</strong></article>`;
  const tbody=items.slice(0,150).map(x=>`<tr><td>${x.row}</td><td>${esc(x.data.name||'')}</td><td>${esc(x.recordId||'Auto-generate')}</td><td class="${x.errors.length?'neo-bulk-bad':'neo-bulk-ok'}">${x.errors.length?esc(x.errors.join(' · ')):esc(x.status)}</td></tr>`).join('');
  panel.querySelector('[data-bulk-preview]').innerHTML=`<div class="neo-bulk-table-wrap"><table class="neo-bulk-table"><thead><tr><th>Row</th><th>Name</th><th>Existing ID</th><th>Validation</th></tr></thead><tbody>${tbody}</tbody></table></div>${items.length>150?'<p>Preview shows first 150 rows. All rows are still validated and imported.</p>':''}`;
  const button=panel.querySelector('[data-bulk-import]');button.disabled=!valid;button.textContent='Import '+valid+' validated row'+(valid===1?'':'s');
}"""
new="""function renderPreview(panel,items){
  const valid=items.filter(x=>!x.errors.length).length,invalid=items.length-valid,student=items.some(x=>x.type==='student');
  panel.querySelector('[data-bulk-summary]').innerHTML=`<article><small>Total rows</small><strong>${items.length}</strong></article><article><small>Ready</small><strong>${valid}</strong></article><article><small>Needs correction</small><strong>${invalid}</strong></article>`;
  const tbody=items.slice(0,150).map(x=>`<tr><td>${x.row}</td><td>${esc(x.data.name||'')}</td><td>${student?'Auto after import':esc(x.recordId||'Auto-generate')}</td><td class="${x.errors.length?'neo-bulk-bad':'neo-bulk-ok'}">${x.errors.length?esc(x.errors.join(' · ')):esc(x.status)}</td></tr>`).join('');
  panel.querySelector('[data-bulk-preview]').innerHTML=`<div class="neo-bulk-table-wrap"><table class="neo-bulk-table"><thead><tr><th>Row</th><th>Name</th><th>${student?'Admission No.':'Existing ID'}</th><th>Validation</th></tr></thead><tbody>${tbody}</tbody></table></div>${items.length>150?'<p>Preview shows first 150 rows. All rows are still validated and imported.</p>':''}`;
  const button=panel.querySelector('[data-bulk-import]');button.disabled=!valid;button.textContent='Import '+valid+' validated row'+(valid===1?'':'s');
}"""
bulk=replace_once(bulk,old,new,'bulk preview')

old="""async function importItems(panel,items,kind){
  const ready=items.filter(x=>!x.errors.length);if(!ready.length)return;"""
new="""async function importItems(panel,items,kind){
  const ready=items.filter(x=>!x.errors.length);if(kind==='students')ready.sort((a,b)=>{const ai=STUDENT_PROGRAM_ORDER.indexOf(a.body.program),bi=STUDENT_PROGRAM_ORDER.indexOf(b.body.program),ap=ai<0?99:ai,bp=bi<0?99:bi;if(ap!==bp)return ap-bp;const ac=String(a.data.classroom||a.data.section||''),bc=String(b.data.classroom||b.data.section||'');return ac.localeCompare(bc,undefined,{numeric:true,sensitivity:'base'})||a.row-b.row});if(!ready.length)return;"""
bulk=replace_once(bulk,old,new,'class-wise import sort')
bulk=replace_once(
    bulk,
    "      if(kind==='students'&&!item.recordId)body.request_id=crypto.randomUUID();",
    "      if(kind==='students')body.request_id=crypto.randomUUID();",
    'student request id'
)

old="""  panel.innerHTML=`<summary>⇧ Bulk Upload ${student?'Students':'Teachers / Staff'}</summary><p>${student?'Migrate confirmed students from an existing school database. Classroom, programme and academic year are validated against this school before import.':'Migrate teachers or other employees into HR → Staff Master. Teachers should use Department = Teaching; login/classroom access is linked later from Manage Teachers.'}</p><div class="neo-bulk-note"><b>Excel workflow:</b> Download the template → fill it in Excel → Save As <b>CSV UTF-8 (.csv)</b> → upload here. Existing IDs are preserved when they meet Neo ID rules; leave the ID blank to generate a new one.</div>"""
new="""  panel.innerHTML=`<summary>⇧ Bulk Upload ${student?'Students':'Teachers / Staff'}</summary><p>${student?'Migrate confirmed students from an existing school database. Classroom, programme and academic year are validated against this school before import.':'Migrate teachers or other employees into HR → Staff Master. Teachers should use Department = Teaching; login/classroom access is linked later from Manage Teachers.'}</p><div class="neo-bulk-note"><b>Excel workflow:</b> ${student?'Download the template → fill student details → upload Excel / CSV. Do not enter a Student ID or Admission No. The system generates both automatically. Valid rows are imported class-wise in the order Playgroup → Nursery → LKG → UKG → Daycare, then receive the next permanent Admission No.':'Download the template → fill it in Excel → upload Excel / CSV. Existing Staff IDs are preserved when valid; leave Staff ID blank to generate a new one.'}</div>"""
bulk=replace_once(bulk,old,new,'bulk panel note')

old="""  const note=panel.querySelector('.neo-bulk-note'),noteHtml='<b>Migration workflow:</b> Download the template → fill it in Excel → upload the saved <b>.xlsx</b> directly, or use <b>CSV UTF-8 (.csv)</b>. Existing IDs are preserved when valid; leave the ID blank to generate a new one.';if(note&&note.innerHTML!==noteHtml)note.innerHTML=noteHtml;"""
new="""  const note=panel.querySelector('.neo-bulk-note'),student=/Students/i.test(panel.querySelector('summary')?.textContent||''),noteHtml=student?'<b>Migration workflow:</b> Download the template → fill student details → upload the saved <b>.xlsx</b> directly, or use <b>CSV UTF-8 (.csv)</b>. Student ID and Admission No. are generated automatically. Valid rows are imported class-wise: Playgroup → Nursery → LKG → UKG → Daycare.':'<b>Migration workflow:</b> Download the template → fill it in Excel → upload the saved <b>.xlsx</b> directly, or use <b>CSV UTF-8 (.csv)</b>. Existing Staff IDs are preserved when valid; leave Staff ID blank to generate a new one.';if(note&&note.innerHTML!==noteHtml)note.innerHTML=noteHtml;"""
plus=replace_once(plus,old,new,'xlsx migration note')

password=password.replace('/bulk-upload.js?v=20260930-bulk1','/bulk-upload.js?v=20261001-bulk2')
password=password.replace('/bulk-upload-plus.js?v=20261001-bulk3','/bulk-upload-plus.js?v=20261001-bulk4')

schools=re.sub(r'/password-access\.js\?v=[^"\']+', '/password-access.js?v=20261001-bulkclass1', schools, count=1)

bulk_path.write_text(bulk)
plus_path.write_text(plus)
password_path.write_text(password)
schools_path.write_text(schools)
print('Student bulk Admission No flow finalised.')

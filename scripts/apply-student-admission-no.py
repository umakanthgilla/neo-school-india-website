from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Marker not found: {label}')
    return text.replace(old, new, 1)

worker_path=Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
ext_path=Path('worker/gate-qr-parent-extension.js')
schools_path=Path('schools.html')
gate_path=Path('gate-checkin.html')
family_path=Path('family-portal.js')
parents_path=Path('parents.html')

worker=worker_path.read_text()
ext=ext_path.read_text()
schools=schools_path.read_text()
gate=gate_path.read_text()
family=family_path.read_text()
parents=parents_path.read_text()

helper=r'''/* Student shareable Admission No. — internal UUID remains the database key. */
function studentAdmissionYearCode(value){const m=String(value||'').match(/20\d{2}/);return (m?m[0]:neoToday().slice(0,4)).slice(-2)}
async function studentBranchCode(env,school){const s=await env.DB.prepare('SELECT city,name FROM neo_schools WHERE school_id=?').bind(school).first(),raw=String(s?.city||s?.name||'X').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),m=raw.match(/[A-Z0-9]/);return m?m[0]:'X'}
async function ensureStudentAdmissionSequence(env){await env.DB.prepare('CREATE TABLE IF NOT EXISTS neo_student_admission_seq(school_id TEXT NOT NULL,year_code TEXT NOT NULL,branch_code TEXT NOT NULL,last_no INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(school_id,year_code,branch_code))').run()}
async function syncStudentAdmissionSequence(env,school,rows=[]){await ensureStudentAdmissionSequence(env);const maxima=new Map();for(const row of rows){const m=String(row.admission_no||'').trim().toUpperCase().match(/^NEO(\d{2})([A-Z0-9])(\d{4,})$/);if(!m)continue;const key=m[1]+'|'+m[2],n=Number(m[3]);if(Number.isSafeInteger(n)&&n>Number(maxima.get(key)||0))maxima.set(key,n)}if(maxima.size)await env.DB.batch([...maxima].map(([key,n])=>{const [year,branch]=key.split('|');return env.DB.prepare('INSERT INTO neo_student_admission_seq(school_id,year_code,branch_code,last_no) VALUES (?,?,?,?) ON CONFLICT(school_id,year_code,branch_code) DO UPDATE SET last_no=CASE WHEN last_no<excluded.last_no THEN excluded.last_no ELSE last_no END').bind(school,year,branch,n)}))}
async function allocateStudentAdmissionNo(env,school,yearCode,branchCode){await ensureStudentAdmissionSequence(env);const year=String(yearCode||'').replace(/\D/g,'').slice(-2)||studentAdmissionYearCode(''),branch=(String(branchCode||'X').toUpperCase().match(/[A-Z0-9]/)||['X'])[0];await env.DB.prepare('INSERT OR IGNORE INTO neo_student_admission_seq(school_id,year_code,branch_code,last_no) VALUES (?,?,?,0)').bind(school,year,branch).run();const row=await env.DB.prepare('UPDATE neo_student_admission_seq SET last_no=last_no+1 WHERE school_id=? AND year_code=? AND branch_code=? RETURNING last_no').bind(school,year,branch).first(),n=Number(row?.last_no);if(!Number.isSafeInteger(n)||n<1)throw new Error('Admission number could not be generated.');return 'NEO'+year+branch+String(n).padStart(4,'0')}
async function ensureStudentAdmissionNumbers(env,school){await ensurePortalSchema(env);const raw=(await env.DB.prepare("SELECT id,data,created_at FROM neo_portal_records WHERE school_id=? AND kind='students' ORDER BY created_at,id").bind(school).all()).results||[],rows=raw.map(r=>({...JSON.parse(r.data),id:r.id,created_at:r.created_at}));if(!rows.length)return 0;await syncStudentAdmissionSequence(env,school,rows);const branch=await studentBranchCode(env,school);let changed=0;for(const row of rows){if(row.admission_no)continue;const year=studentAdmissionYearCode(row.admission_date||row.created_at||row.academic_year),admissionNo=await allocateStudentAdmissionNo(env,school,year,branch),next={...row,admission_no:admissionNo,admission_date:row.admission_date||String(row.created_at||neoToday()).slice(0,10)};delete next.id;delete next.created_at;await env.DB.batch([env.DB.prepare("UPDATE neo_portal_records SET data=? WHERE school_id=? AND kind='students' AND id=?").bind(JSON.stringify(next),school,row.id),env.DB.prepare('INSERT INTO neo_portal_audit(id,school_id,actor,action,record_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),school,'system','BACKFILL:student_admission_no',row.id)]);changed++}return changed}
async function createStudentAdmissionNo(env,school,yearSource){await ensureStudentAdmissionNumbers(env,school);return allocateStudentAdmissionNo(env,school,studentAdmissionYearCode(yearSource),await studentBranchCode(env,school))}
async function findStudentByAdmissionOrId(env,school,value){await ensureStudentAdmissionNumbers(env,school);const raw=String(value||'').trim();if(!raw)return null;let student=await portalRecord(env,school,'students',raw);if(student)return student;const upper=raw.toUpperCase();if(upper!==raw){student=await portalRecord(env,school,'students',upper);if(student)return student}return (await portalRows(env,school,'students')).find(x=>String(x.admission_no||'').trim().toUpperCase()===upper)||null}
'''
if '/* Student shareable Admission No.' not in worker:
    worker=replace_once(worker,'async function schoolPortal(request,env,url){',helper+'\nasync function schoolPortal(request,env,url){','student admission helpers')

worker=worker.replace('"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"','"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"')

old="""   if(kind==='stock_items'||kind==='stock_moves')await reconcileCenterSupplyReceipts(env,school);\n   const rows=await env.DB.prepare('SELECT id,data,created_at FROM neo_portal_records WHERE school_id=? AND kind=? ORDER BY created_at DESC,id').bind(school,kind).all();"""
new="""   if(kind==='stock_items'||kind==='stock_moves')await reconcileCenterSupplyReceipts(env,school);\n   if(kind==='students')await ensureStudentAdmissionNumbers(env,school);\n   const rows=await env.DB.prepare('SELECT id,data,created_at FROM neo_portal_records WHERE school_id=? AND kind=? ORDER BY created_at DESC,id').bind(school,kind).all();"""
worker=replace_once(worker,old,new,'student GET backfill')

old="if(!/^20[0-9]{2}$/.test(data.academic_year))fail('Enter the academic starting year.');"
new=old+"\n    data.admission_date=neoToday();data.admission_no=await createStudentAdmissionNo(env,school,data.admission_date);"
worker=replace_once(worker,old,new,'new student admission no')

old="if(url.pathname!=='/api/parent/me'||request.method!=='GET')return out({error:'Not found.'},404);\n const child=await portalRecord(env,a.school_id,'students',a.student_id);"
new="if(url.pathname!=='/api/parent/me'||request.method!=='GET')return out({error:'Not found.'},404);\n await ensureStudentAdmissionNumbers(env,a.school_id);\n const child=await portalRecord(env,a.school_id,'students',a.student_id);"
worker=replace_once(worker,old,new,'parent admission no backfill')


def patch_gate(text):
    old="let studentId=text(b,'student_id',80,true),student=await portalRecord(env,school,'students',studentId);if(!student&&studentId!==studentId.toUpperCase()){studentId=studentId.toUpperCase();student=await portalRecord(env,school,'students',studentId)}if(!student||student.status==='Withdrawn')return out({error:'Student ID was not found. Please check the ID or contact the gate desk.'},400);"
    new="const studentKey=text(b,'student_id',80,true),student=await findStudentByAdmissionOrId(env,school,studentKey);if(!student||student.status==='Withdrawn')return out({error:'Admission No. / Student ID was not found. Please check the number or contact the gate desk.'},400);"
    text=replace_once(text,old,new,'public pickup admission lookup')
    old="const b=await readBody(),rid=requestId(b);if(await portalRecord(env,school,'gate_pickups',rid))return out({error:'Submission already exists.'},409);const student=await portalRecord(env,school,'students',text(b,'student_id',80,true));if(!student||student.status==='Withdrawn')return out({error:'Choose an active student.'},400);"
    new="const b=await readBody(),rid=requestId(b);if(await portalRecord(env,school,'gate_pickups',rid))return out({error:'Submission already exists.'},409);const student=await findStudentByAdmissionOrId(env,school,text(b,'student_id',80,true));if(!student||student.status==='Withdrawn')return out({error:'Choose an active student / valid Admission No.'},400);"
    text=replace_once(text,old,new,'school pickup admission lookup')
    old="students:students.map(s=>({id:s.id,name:s.name,program:s.program,status:s.status}))"
    new="students:students.map(s=>({id:s.id,admission_no:s.admission_no||'',name:s.name,program:s.program,status:s.status}))"
    if old in text:text=text.replace(old,new,1)
    return text

worker=patch_gate(worker)
ext=patch_gate(ext)

# School portal: show the short Admission No. to people; retain UUID only as hidden internal key.
schools=schools.replace("Student ID: ${esc(s.id)}","Admission No.: ${esc(s.admission_no||s.id)}")
schools=schools.replace("Student ID: '+esc(child.id)+' · ","Admission No.: '+esc(child.admission_no||child.id)+' · ")
schools=schools.replace("if(tab==='students')lines=['Student ID: '+r.id,","if(tab==='students')lines=['Admission No.: '+(r.admission_no||r.id),")
schools=schools.replace("Create each child once. Fees, attendance, kit, parent access, transport and promotion must reuse this Student ID.","Create each child once. Fees, attendance, kit, parent access, transport and promotion reuse the internal student record. Share the short Admission No. with parents and gate staff.")
schools=schools.replace("Create or reset the parent login for an existing child. The child record is selected by Student ID; no second child record is created.","Create or reset the parent login for an existing child. Select the existing child; the Admission No. is the shareable reference and no second child record is created.")
schools=schools.replace("<p>Student ID: ${esc(a.student_id)} · Account ID: ${esc(a.account_id)}</p>","<p>Admission No.: ${esc(student(a.student_id)?.admission_no||a.student_id)} · Account ID: ${esc(a.account_id)}</p>")
schools=schools.replace("const chooseStudent=()=>select('student_id','Student',(records.students||[]).filter(s=>s.classroom_id).map(s=>[s.id,s.name+' · '+s.program+' · '+classroomName(s.classroom_id)]));","const chooseStudent=()=>select('student_id','Student',(records.students||[]).filter(s=>s.classroom_id).map(s=>[s.id,s.name+' · '+(s.admission_no||s.id)+' · '+s.program+' · '+classroomName(s.classroom_id)]));")

# Public gate form: make the expected shareable format obvious.
gate=gate.replace('<label>Student ID / Admission No.<input name="student_id" required maxlength="80" autocomplete="off"></label>','<label>Admission No. / Student ID<input name="student_id" required maxlength="80" autocomplete="off" autocapitalize="characters" placeholder="e.g. NEO26J0001"></label>')

# Parent portal: always backfilled by /api/parent/me, show the Admission No. in the hero and printed school docs.
family=family.replace("role==='parent'?esc(data.child.program+' · '+data.child.academic_year):data.classrooms.length+' assigned classrooms'","role==='parent'?esc((data.child.admission_no?data.child.admission_no+' · ':'')+data.child.program+' · '+data.child.academic_year):data.classrooms.length+' assigned classrooms'")
family=family.replace("<p><b>Student:</b> ${esc(data.child.name)} · ${esc(data.child.program)} · ${esc(data.child.academic_year)}</p>","<p><b>Student:</b> ${esc(data.child.name)} · <b>Admission No.:</b> ${esc(data.child.admission_no||data.child.id)} · ${esc(data.child.program)} · ${esc(data.child.academic_year)}</p>")
parents=parents.replace('/family-portal.js?v=20260928-v23','/family-portal.js?v=20261001-admission1')

worker_path.write_text(worker)
ext_path.write_text(ext)
schools_path.write_text(schools)
gate_path.write_text(gate)
family_path.write_text(family)
parents_path.write_text(parents)

print('Student Admission No. implementation applied.')

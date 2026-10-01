/* Neo School India bulk migration helper. Reuses the existing portal APIs and validation rules. */
(()=>{
'use strict';

let currentSchool=null;
const originalOpen=window.openNeoWorkspace;
if(typeof originalOpen==='function'){
  window.openNeoWorkspace=function(s){currentSchool=s||null;return originalOpen.apply(this,arguments)};
}
const originalClose=window.closeNeoWorkspace;
if(typeof originalClose==='function'){
  window.closeNeoWorkspace=function(){currentSchool=null;return originalClose.apply(this,arguments)};
}

const style=document.createElement('style');
style.textContent=`
.neo-bulk-panel{margin:16px 0;border:1px solid #dbe4f4;border-radius:16px;background:#fff;padding:16px}.neo-bulk-panel summary{cursor:pointer;font-weight:800;color:#102052}.neo-bulk-panel p{line-height:1.55}.neo-bulk-note{margin:10px 0;padding:10px 12px;border-radius:12px;background:#f6f9ff;color:#102052}.neo-bulk-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}.neo-bulk-file{display:inline-flex;align-items:center;gap:8px}.neo-bulk-file input{max-width:280px}.neo-bulk-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0}.neo-bulk-summary article{border:1px solid #dbe4f4;border-radius:12px;padding:10px;background:#fbfdff}.neo-bulk-summary strong{display:block;font-size:1.35rem;color:#102052}.neo-bulk-table-wrap{overflow:auto;max-height:430px;border:1px solid #dbe4f4;border-radius:12px}.neo-bulk-table{width:100%;border-collapse:collapse;font-size:.9rem}.neo-bulk-table th,.neo-bulk-table td{padding:8px 10px;border-bottom:1px solid #e8eef8;text-align:left;vertical-align:top;white-space:nowrap}.neo-bulk-table th{position:sticky;top:0;background:#f6f9ff;z-index:1}.neo-bulk-ok{color:#126b3a;font-weight:700}.neo-bulk-bad{color:#a11b1b;font-weight:700}.neo-bulk-running{color:#8a5b00;font-weight:700}.neo-bulk-result{margin-top:10px;font-weight:700}.neo-bulk-panel button[disabled]{opacity:.55;cursor:not-allowed}
`;
document.head.append(style);

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const base=()=>typeof BASE==='string'?BASE:'';
const authToken=()=>typeof token==='string'?token:'';
const portalRoot=()=>document.getElementById('neoWorkspace');
const activeTab=()=>portalRoot()?.querySelector('.neo-department-nav [data-tab][aria-pressed="true"]')?.dataset.tab||'';

async function api(kind,method='GET',body=null,id=''){
  if(!currentSchool?.school_id)throw Error('Open a school portal before using bulk upload.');
  const url=base()+'/api/portal/'+encodeURIComponent(currentSchool.school_id)+'/'+kind+(id?'/'+encodeURIComponent(id):'');
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+authToken(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({error:'Unreadable server response.'}));
  if(!response.ok)throw Error(data.error||('Request failed ('+response.status+').'));
  return data;
}

function csvCell(value){
  const text=String(value??'');
  return /[",\n\r]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
}
function downloadCsv(filename,headers){
  const content='\uFEFF'+headers.map(csvCell).join(',')+'\r\n';
  const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function parseCsv(text){
  text=String(text||'').replace(/^\uFEFF/,'');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    }else{
      if(ch==='"')quoted=true;
      else if(ch===','){row.push(cell);cell='';}
      else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
      else if(ch!=='\r')cell+=ch;
    }
  }
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  if(quoted)throw Error('CSV has an unclosed quoted field.');
  return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
const key=s=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
function objectsFromCsv(text){
  const rows=parseCsv(text);if(rows.length<1)throw Error('The CSV is empty.');
  const headers=rows[0].map(key);if(headers.some((h,i)=>!h||headers.indexOf(h)!==i))throw Error('CSV headers must be unique and non-empty.');
  return rows.slice(1).map((values,index)=>({row:index+2,data:Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'').trim()]))}));
}
function isoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function validMobile(v){return /^\+?[0-9 ()-]{8,20}$/.test(String(v||'').trim());}
function validRecordId(v){return /^[A-Za-z0-9_-]{8,80}$/.test(v);}
function academicStart(v){const m=String(v||'').match(/20\d{2}/);return m?m[0]:'';}
function normalizeProgram(v){const map={playgroup:'Playgroup',nursery:'Nursery',lkg:'LKG',ukg:'UKG',daycare:'Daycare'};return map[String(v||'').trim().toLowerCase()]||'';}

const STUDENT_HEADERS=['name','dob','gender','parent','mobile','email','program','academic_year','classroom','playgroup_status','nursery_status','nursery_school','nursery_city','nursery_year','lkg_status','lkg_school','lkg_city','lkg_year'];
const STUDENT_PROGRAM_ORDER=['Playgroup','Nursery','LKG','UKG','Daycare'];
const STAFF_HEADERS=['staff_id','name','department','role','gender','dob','mobile','email','joining_date','monthly_salary','emergency_mobile','status'];
const departments=['Teaching','Administration','Accounts','HR','Transport','Inventory / Stores','Maintenance / Housekeeping','Security','Other'];
const genders=['','Male','Female','Prefer not to say'];

function matchClassroom(row,classrooms){
  const d=row.data,id=d.classroom_id||'';
  if(id){const exact=classrooms.find(c=>String(c.id)===id);return exact?{classroom:exact}:{error:'Classroom ID not found in this school.'};}
  const name=(d.classroom||d.section||'').trim().toLowerCase(),program=normalizeProgram(d.program),year=academicStart(d.academic_year);
  if(!name)return {error:'Enter classroom (section name) or classroom_id.'};
  const matches=classrooms.filter(c=>String(c.name||'').trim().toLowerCase()===name&&(!program||c.program===program)&&(!year||academicStart(c.academic_year)===year));
  if(matches.length===1)return {classroom:matches[0]};
  if(!matches.length)return {error:'No matching classroom. Check section, programme and academic year.'};
  return {error:'Classroom is ambiguous. Add programme and academic year.'};
}

function validateStudentRows(rows,classrooms,existing){
  const seen=new Set();
  return rows.map(row=>{
    const d=row.data,errors=[];
    if(!d.name)errors.push('Child name required');
    if(!isoDate(d.dob))errors.push('DOB must be YYYY-MM-DD');
    if(d.dob&&d.dob>new Date().toISOString().slice(0,10))errors.push('DOB cannot be future');
    if(!d.parent)errors.push('Parent/guardian required');
    if(!validMobile(d.mobile))errors.push('Valid parent mobile required');
    const duplicateKey=[d.name.toLowerCase(),d.dob,d.mobile.replace(/\D/g,'')].join('|');
    if(seen.has(duplicateKey))errors.push('Duplicate row in file');else seen.add(duplicateKey);
    if(existing.some(x=>String(x.name||'').trim().toLowerCase()===d.name.toLowerCase()&&String(x.dob||'')===d.dob&&String(x.mobile||'').replace(/\D/g,'')===d.mobile.replace(/\D/g,'')))errors.push('Possible existing student duplicate');
    const m=matchClassroom(row,classrooms);if(m.error)errors.push(m.error);
    const classroom=m.classroom,program=classroom?.program||normalizeProgram(d.program),academic_year=academicStart(classroom?.academic_year||d.academic_year);
    let playgroup='Not applicable',nursery='Not applicable',lkg='Not applicable';
    let nurserySchool='',nurseryCity='',nurseryYear='',lkgSchool='',lkgCity='',lkgYear='';
    if(program==='Nursery'){
      playgroup=d.playgroup_status||'';
      if(!['Completed','Not attended / First school'].includes(playgroup))errors.push('For Nursery, choose Playgroup: Completed or Not attended / First school');
    }else if(program==='LKG'){
      nursery=d.nursery_status||'';nurserySchool=d.nursery_school||d.previous_school||'';nurseryCity=d.nursery_city||d.previous_city||'';nurseryYear=academicStart(d.nursery_year);
      if(nursery!=='Completed')errors.push('Nursery must be completed for LKG');
      if(!nurserySchool||!nurseryCity)errors.push('Nursery completed school and city required for LKG');
      if(!nurseryYear)errors.push('Nursery completion year required for LKG');
      if(nurseryYear&&academic_year&&Number(nurseryYear)>Number(academic_year))errors.push('Nursery completion year cannot be after current academic year');
    }else if(program==='UKG'){
      nursery=d.nursery_status||'';lkg=d.lkg_status||'';
      nurserySchool=d.nursery_school||'';nurseryCity=d.nursery_city||'';nurseryYear=academicStart(d.nursery_year);
      lkgSchool=d.lkg_school||d.previous_school||'';lkgCity=d.lkg_city||d.previous_city||'';lkgYear=academicStart(d.lkg_year);
      if(nursery!=='Completed')errors.push('Nursery must be completed for UKG');
      if(!nurserySchool||!nurseryCity||!nurseryYear)errors.push('Nursery school, city and completion year required for UKG');
      if(lkg!=='Completed')errors.push('LKG must be completed for UKG');
      if(!lkgSchool||!lkgCity||!lkgYear)errors.push('LKG school, city and completion year required for UKG');
      if(nurseryYear&&lkgYear&&Number(nurseryYear)>Number(lkgYear))errors.push('Nursery completion year must be before or equal to LKG completion year');
      if(lkgYear&&academic_year&&Number(lkgYear)>Number(academic_year))errors.push('LKG completion year cannot be after current academic year');
    }
    const previousSchool=program==='UKG'?lkgSchool:program==='LKG'?nurserySchool:'';
    const previousCity=program==='UKG'?lkgCity:program==='LKG'?nurseryCity:'';
    const body={name:d.name,dob:d.dob,gender:d.gender||'',email:d.email||'',program,parent:d.parent,mobile:d.mobile,academic_year,playgroup_status:playgroup,nursery_status:nursery,nursery_school:nurserySchool,nursery_city:nurseryCity,nursery_year:nurseryYear,lkg_status:lkg,lkg_school:lkgSchool,lkg_city:lkgCity,lkg_year:lkgYear,previous_school:previousSchool,previous_city:previousCity,classroom_id:classroom?.id||''};
    return {...row,type:'student',recordId:'',body,errors,status:errors.length?'Invalid':'Ready'};
  });
}

function validateStaffRows(rows,existing){
  const seenMobile=new Set();
  return rows.map(row=>{
    const d=row.data,errors=[],department=d.department||'Teaching',gender=d.gender||'',status=d.status||'Active';
    if(!d.name)errors.push('Employee name required');
    if(!departments.includes(department))errors.push('Invalid department');
    if(!d.role)errors.push('Role required');
    if(!genders.includes(gender))errors.push('Invalid gender');
    if(d.dob&&(!isoDate(d.dob)||d.dob>new Date().toISOString().slice(0,10)))errors.push('Invalid DOB');
    if(!validMobile(d.mobile))errors.push('Valid mobile required');
    if(!isoDate(d.joining_date))errors.push('Joining date must be YYYY-MM-DD');
    if(!['Active','Inactive'].includes(status))errors.push('Status must be Active or Inactive');
    if(d.emergency_mobile&&!validMobile(d.emergency_mobile))errors.push('Invalid emergency mobile');
    if(d.staff_id&&!validRecordId(d.staff_id))errors.push('Staff ID must be 8-80 letters/numbers/_/- or leave blank');
    if(d.staff_id&&existing.some(x=>String(x.id)===d.staff_id))errors.push('Staff ID already exists');
    const mobileKey=d.mobile.replace(/\s+/g,'');
    if(seenMobile.has(mobileKey))errors.push('Duplicate mobile in file');else seenMobile.add(mobileKey);
    if(existing.some(x=>String(x.mobile||'').replace(/\s+/g,'')===mobileKey))errors.push('Mobile already exists in Staff Master');
    let salary=0;if(d.monthly_salary){const amount=Number(String(d.monthly_salary).replace(/,/g,''));if(!Number.isFinite(amount)||amount<0||amount>1000000)errors.push('Monthly salary must be 0-1000000');else salary=Math.round(amount*100);}
    const body={name:d.name,department,role:d.role,gender,dob:d.dob||'',mobile:d.mobile,email:d.email||'',joining_date:d.joining_date,salary_paise:salary,emergency_mobile:d.emergency_mobile||'',status};
    return {...row,type:'staff',recordId:d.staff_id||'',body,errors,status:errors.length?'Invalid':'Ready'};
  });
}

function renderPreview(panel,items){
  const valid=items.filter(x=>!x.errors.length).length,invalid=items.length-valid,student=items.some(x=>x.type==='student');
  panel.querySelector('[data-bulk-summary]').innerHTML=`<article><small>Total rows</small><strong>${items.length}</strong></article><article><small>Ready</small><strong>${valid}</strong></article><article><small>Needs correction</small><strong>${invalid}</strong></article>`;
  const tbody=items.slice(0,150).map(x=>`<tr><td>${x.row}</td><td>${esc(x.data.name||'')}</td><td>${student?'Auto after import':esc(x.recordId||'Auto-generate')}</td><td class="${x.errors.length?'neo-bulk-bad':'neo-bulk-ok'}">${x.errors.length?esc(x.errors.join(' · ')):esc(x.status)}</td></tr>`).join('');
  panel.querySelector('[data-bulk-preview]').innerHTML=`<div class="neo-bulk-table-wrap"><table class="neo-bulk-table"><thead><tr><th>Row</th><th>Name</th><th>${student?'Admission No.':'Existing ID'}</th><th>Validation</th></tr></thead><tbody>${tbody}</tbody></table></div>${items.length>150?'<p>Preview shows first 150 rows. All rows are still validated and imported.</p>':''}`;
  const button=panel.querySelector('[data-bulk-import]');button.disabled=!valid;button.textContent='Import '+valid+' validated row'+(valid===1?'':'s');
}

async function importItems(panel,items,kind){
  const ready=items.filter(x=>!x.errors.length);if(kind==='students')ready.sort((a,b)=>{const ai=STUDENT_PROGRAM_ORDER.indexOf(a.body.program),bi=STUDENT_PROGRAM_ORDER.indexOf(b.body.program),ap=ai<0?99:ai,bp=bi<0?99:bi;if(ap!==bp)return ap-bp;const ac=String(a.data.classroom||a.data.section||''),bc=String(b.data.classroom||b.data.section||'');return ac.localeCompare(bc,undefined,{numeric:true,sensitivity:'base'})||a.row-b.row});if(!ready.length)return;
  if(!confirm('Import '+ready.length+' validated '+(kind==='students'?'student':'staff / teacher')+' record(s) into '+(currentSchool?.name||'this school')+'? Invalid rows will be skipped.'))return;
  const button=panel.querySelector('[data-bulk-import]'),result=panel.querySelector('[data-bulk-result]');button.disabled=true;result.textContent='Importing…';
  let success=0,failed=0;
  for(const item of ready){
    try{
      const body={...item.body};
      if(kind==='students')body.request_id=crypto.randomUUID();
      await api(kind==='students'?'students':'staff','POST',body,item.recordId);
      item.status='Imported';success++;
    }catch(error){item.status='Failed';item.errors=[error.message];failed++;}
  }
  renderPreview(panel,items);result.textContent='✓ '+success+' imported'+(failed?' · '+failed+' failed. Review the red rows.':' successfully.');
  if(success){
    setTimeout(()=>{
      if(!currentSchool)return;
      window.openNeoWorkspace(currentSchool);
      setTimeout(()=>portalRoot()?.querySelector('[data-tab="'+(kind==='students'?'students':'staff')+'"]')?.click(),250);
    },500);
  }
}

async function prepare(panel,kind,file){
  const result=panel.querySelector('[data-bulk-result]');result.textContent='Reading and validating file…';
  try{
    if(!/\.csv$/i.test(file.name))throw Error('Please save the Excel sheet as CSV UTF-8 and upload the .csv file.');
    const rows=objectsFromCsv(await file.text());if(!rows.length)throw Error('No data rows found below the header.');if(rows.length>1000)throw Error('Maximum 1000 rows per file. Split larger migrations into batches.');
    let items;
    if(kind==='students'){
      const [classroomData,studentData]=await Promise.all([api('classrooms'),api('students')]);
      items=validateStudentRows(rows,classroomData.records||[],studentData.records||[]);
    }else{
      const staffData=await api('staff');items=validateStaffRows(rows,staffData.records||[]);
    }
    panel._bulkItems=items;renderPreview(panel,items);result.textContent=items.some(x=>x.errors.length)?'Fix invalid rows in Excel/CSV, save again, and re-upload. Valid rows can also be imported now.':'All rows passed validation. Review the preview, then import.';
  }catch(error){panel._bulkItems=[];panel.querySelector('[data-bulk-summary]').innerHTML='';panel.querySelector('[data-bulk-preview]').innerHTML='';panel.querySelector('[data-bulk-import]').disabled=true;result.textContent=error.message;}
}

function buildPanel(kind){
  const student=kind==='students',panel=document.createElement('details');panel.id='neoBulkUploadPanel';panel.className='neo-bulk-panel';
  panel.innerHTML=`<summary>⇧ Bulk Upload ${student?'Students':'Teachers / Staff'}</summary><p>${student?'Migrate confirmed students from an existing school database. Classroom, programme and academic year are validated against this school before import.':'Migrate teachers or other employees into HR → Staff Master. Teachers should use Department = Teaching; login/classroom access is linked later from Manage Teachers.'}</p><div class="neo-bulk-note"><b>Excel workflow:</b> ${student?'Download the template → fill student details → upload Excel / CSV. Do not enter a Student ID or Admission No. The system generates both automatically. Valid rows are imported class-wise in the order Playgroup → Nursery → LKG → UKG → Daycare, then receive the next permanent Admission No.':'Download the template → fill it in Excel → upload Excel / CSV. Existing Staff IDs are preserved when valid; leave Staff ID blank to generate a new one.'}</div><div class="neo-bulk-actions"><button type="button" class="secondary" data-bulk-template>Download Excel-compatible CSV template</button><label class="neo-bulk-file">Choose CSV <input type="file" accept=".csv,text/csv" data-bulk-file></label><button type="button" data-bulk-import disabled>Import validated rows</button></div><div class="neo-bulk-summary" data-bulk-summary></div><div data-bulk-preview></div><div class="neo-bulk-result" data-bulk-result role="status" aria-live="polite"></div>`;
  panel.querySelector('[data-bulk-template]').onclick=()=>downloadCsv(student?'neo-student-bulk-template.csv':'neo-teacher-staff-bulk-template.csv',student?STUDENT_HEADERS:STAFF_HEADERS);
  panel.querySelector('[data-bulk-file]').onchange=e=>{const file=e.target.files?.[0];if(file)prepare(panel,kind,file)};
  panel.querySelector('[data-bulk-import]').onclick=()=>importItems(panel,panel._bulkItems||[],kind);
  return panel;
}

function enhance(){
  const root=portalRoot(),area=root?.querySelector('#portalContent');if(!root||root.hidden||!area)return;
  const tab=activeTab();if(!['students','staff'].includes(tab))return;
  if(area.querySelector('#neoBulkUploadPanel'))return;
  const panel=buildPanel(tab);
  const editor=area.querySelector('.portal-editor');if(editor)editor.before(panel);else area.prepend(panel);
}

new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#neoWorkspace [data-tab="students"],#neoWorkspace [data-tab="staff"]'))setTimeout(enhance,0)},true);
enhance();
})();

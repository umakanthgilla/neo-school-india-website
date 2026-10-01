from pathlib import Path

# 1) Teacher portal: full-day schedule from curriculum rhythm.
p=Path('learning-family.js')
s=p.read_text()
room=" const room=id=>data.classrooms.find(c=>c.id===id)?.name||id;"
rhythm=""" const room=id=>data.classrooms.find(c=>c.id===id)?.name||id;
 const legacyPlaygroupRhythm=[
  {id:'pg-rhythm-1',start:'09:30',end:'09:45',label:'Arrival & Settling',type:'Routine'},
  {id:'pg-rhythm-2',start:'09:45',end:'10:05',label:'Circle Time',type:'Routine'},
  {id:'pg-rhythm-3',start:'10:05',end:'10:30',label:'IMLS Core Experience',type:'Teaching'},
  {id:'pg-rhythm-4',start:'10:30',end:'10:45',label:'Snack & Practical Life',type:'Routine'},
  {id:'pg-rhythm-5',start:'10:45',end:'11:10',label:'Language / Story / Sound Play',type:'Routine'},
  {id:'pg-rhythm-6',start:'11:10',end:'11:35',label:'Motor / Sensory / Outdoor',type:'Routine'},
  {id:'pg-rhythm-7',start:'11:35',end:'12:00',label:'Creative / Concept Reinforcement',type:'Routine'},
  {id:'pg-rhythm-8',start:'12:00',end:'12:15',label:'Reflection & My Neo Moment',type:'Routine'},
  {id:'pg-rhythm-9',start:'12:15',end:'12:30',label:'Pack-up & Goodbye',type:'Routine'}
 ];
 const rhythmFor=p=>Array.isArray(p.daily_rhythm)&&p.daily_rhythm.length?p.daily_rhythm:(p.master_level==='Playgroup'&&p.master_version==='2026.2'?legacyPlaygroupRhythm:[]);"""
if 'legacyPlaygroupRhythm' not in s:
    if room not in s: raise SystemExit('room anchor not found')
    s=s.replace(room,rhythm,1)
old="const dated=plans.flatMap(p=>p.lessons.filter(l=>l.start&&p.working_dates[l.day-1]===date).map(l=>({...l,classroom_id:p.classroom_id,type:'Teaching'})));const overlaps=(a,b)=>a.classroom_id&&b.classroom_id&&a.classroom_id===b.classroom_id&&a.start<b.end&&b.start<a.end;const slots=[...dated,...timetable.slots.filter(s=>s.weekday===weekday&&!dated.some(d=>overlaps(d,s)))].sort((a,b)=>a.start.localeCompare(b.start));"
new="""const activePlans=plans.filter(p=>p.status==='Approved'&&Array.isArray(p.working_dates)&&p.working_dates.includes(date));
 const dated=activePlans.flatMap(p=>p.lessons.filter(l=>l.start&&p.working_dates[l.day-1]===date).map(l=>({...l,classroom_id:p.classroom_id,type:'Teaching',source:'Curriculum lesson'})));
 const overlaps=(a,b)=>a.classroom_id&&b.classroom_id&&a.classroom_id===b.classroom_id&&a.start&&a.end&&b.start&&b.end&&a.start<b.end&&b.start<a.end;
 const rhythm=activePlans.flatMap(p=>rhythmFor(p).map((r,i)=>({id:r.id||('rhythm-'+(i+1)),start:String(r.start||''),end:String(r.end||''),subject:String(r.label||r.learning_block||'Daily rhythm'),period:String(r.label||r.learning_block||'Daily rhythm'),classroom_id:p.classroom_id,type:r.type||'Routine',source:'Curriculum rhythm'}))).filter(r=>r.start&&r.end);
 const auto=[...dated,...rhythm.filter(r=>!dated.some(d=>overlaps(d,r)))];
 const slots=[...auto,...timetable.slots.filter(s=>s.weekday===weekday&&!auto.some(d=>overlaps(d,s)))].sort((a,b)=>a.start.localeCompare(b.start));"""
if old in s:
    s=s.replace(old,new,1)
elif 'const activePlans=plans.filter' not in s:
    raise SystemExit('daily schedule anchor not found')
p.write_text(s)

# 2) Head Office Curriculum Master: optional Daily Rhythm sheet is versioned with the master.
p=Path('curriculum-master.html')
s=p.read_text()
s=s.replace("let lessons=[],editing='';","let lessons=[],dailyRhythm=[],editing='';")
if 'const excelTime=' not in s:
    s=s.replace("const workbook=()=>import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');", "const workbook=()=>import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');\nconst excelTime=v=>{if(typeof v==='number'&&Number.isFinite(v)){const mins=Math.round((v%1)*24*60);return String(Math.floor(mins/60)%24).padStart(2,'0')+':'+String(mins%60).padStart(2,'0')}return String(v||'').trim()};")
s=s.replace("+' timed periods'+(missing.length?", "+' timed periods · '+dailyRhythm.length+' daily rhythm blocks'+(missing.length?")
if "XLSX.utils.book_append_sheet(book,rhythmSheet,'Daily Rhythm')" not in s:
    s=s.replace("XLSX.utils.book_append_sheet(book,sheet,'Day 1-200');XLSX.writeFile(book,'Neo-200-Day-Master-Template.xlsx');", "XLSX.utils.book_append_sheet(book,sheet,'Day 1-200');const rhythmRows=[{start:'',end:'',learning_block:'',type:'Routine'}],rhythmSheet=XLSX.utils.json_to_sheet(rhythmRows);XLSX.utils.book_append_sheet(book,rhythmSheet,'Daily Rhythm');XLSX.writeFile(book,'Neo-200-Day-Master-Template.xlsx');")
anchor="lessons=rows.map((r,i)=>({id:String(r.id||'lesson-'+(i+1)),day:Number(r.day),subject:String(r.subject||'').trim(),concept:String(r.concept||'').trim(),objective:String(r.objective||'').trim(),activity:String(r.activity||'').trim(),materials:String(r.materials||'').trim(),homework:String(r.homework||'').trim(),period:String(r.period||'').trim(),start:String(r.start||'').trim(),end:String(r.end||'').trim(),questions:[r.question_1,r.question_2,r.question_3].map(q=>String(q||'').trim()).filter(Boolean)}));inspectLessons();message('Excel loaded. Review the day preview, then Save Draft for server validation.','ok')"
replacement="""lessons=rows.map((r,i)=>({id:String(r.id||'lesson-'+(i+1)),day:Number(r.day),subject:String(r.subject||'').trim(),concept:String(r.concept||'').trim(),objective:String(r.objective||'').trim(),activity:String(r.activity||'').trim(),materials:String(r.materials||'').trim(),homework:String(r.homework||'').trim(),period:String(r.period||'').trim(),start:String(r.start||'').trim(),end:String(r.end||'').trim(),questions:[r.question_1,r.question_2,r.question_3].map(q=>String(q||'').trim()).filter(Boolean)}));const rhythmName=wb.SheetNames.find(n=>String(n).trim().toLowerCase()==='daily rhythm');dailyRhythm=[];if(rhythmName){const rhythmSheet=wb.Sheets[rhythmName];if(Object.values(rhythmSheet).some(c=>c&&c.f))throw Error('Replace Daily Rhythm formulas with values before uploading.');const rr=XLSX.utils.sheet_to_json(rhythmSheet,{defval:''}).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k).trim().toLowerCase(),v])));dailyRhythm=rr.filter(r=>r.start||r.end||r.learning_block||r.label).map((r,i)=>({id:String(r.id||'rhythm-'+(i+1)),start:excelTime(r.start),end:excelTime(r.end),label:String(r.learning_block||r.label||'').trim(),type:String(r.type||'Routine').trim()}))}inspectLessons();message('Excel loaded. '+dailyRhythm.length+' Daily Rhythm block(s) loaded. Review the day preview, then Save Draft for server validation.','ok')"""
if anchor in s:
    s=s.replace(anchor,replacement,1)
elif 'const rhythmName=wb.SheetNames.find' not in s:
    raise SystemExit('curriculum master Excel parser anchor not found')
s=s.replace("title,lessons});editing=d.id;", "title,lessons,daily_rhythm:dailyRhythm});editing=d.id;")
s=s.replace("editing=x.id;lessons=x.lessons||[];document.querySelector('#level').value=x.level;", "editing=x.id;lessons=x.lessons||[];dailyRhythm=Array.isArray(x.daily_rhythm)?x.daily_rhythm:[];document.querySelector('#level').value=x.level;")
s=s.replace("catch(err){lessons=[];inspectLessons();", "catch(err){lessons=[];dailyRhythm=[];inspectLessons();")
s=s.replace("editing='';lessons=[];document.querySelector('#file').value='';", "editing='';lessons=[];dailyRhythm=[];document.querySelector('#file').value='';")
s=s.replace("Keep IDs unique.</p>", "Keep IDs unique.</p>")
p.write_text(s)

# 3) School center sync: carry the Head Office Daily Rhythm into the center plan.
p=Path('learning-admin.js')
s=p.read_text()
s=s.replace("let lessons=[],editing='',masterCurricula=[];", "let lessons=[],dailyRhythm=[],editing='',masterCurricula=[];")
s=s.replace("lessons=Array.isArray(selectedMaster.lessons)?selectedMaster.lessons.map(l=>({...l})):[];", "lessons=Array.isArray(selectedMaster.lessons)?selectedMaster.lessons.map(l=>({...l})):[];dailyRhythm=Array.isArray(selectedMaster.daily_rhythm)?selectedMaster.daily_rhythm.map(r=>({...r})):[];")
s=s.replace("lessons=Array.isArray(master.lessons)?master.lessons.map(l=>({...l})):[];", "lessons=Array.isArray(master.lessons)?master.lessons.map(l=>({...l})):[];dailyRhythm=Array.isArray(master.daily_rhythm)?master.daily_rhythm.map(r=>({...r})):[];")
s=s.replace("master_status:selectedMaster?.status||source.master_status||''});", "master_status:selectedMaster?.status||source.master_status||'',daily_rhythm:selectedMaster?dailyRhythm:(source.daily_rhythm||dailyRhythm)});")
s=s.replace("editing=p.id;lessons=p.lessons;const selectedClassroom=", "editing=p.id;lessons=p.lessons;dailyRhythm=Array.isArray(p.daily_rhythm)?p.daily_rhythm.map(r=>({...r})):[];const selectedClassroom=")
s=s.replace("+' curriculum days';previewDays();message((selectedMaster.status", "+' curriculum days · '+dailyRhythm.length+' daily rhythm blocks';previewDays();message((selectedMaster.status")
s=s.replace("+' curriculum days';previewDays();message((master.status", "+' curriculum days · '+dailyRhythm.length+' daily rhythm blocks';previewDays();message((master.status")
p.write_text(s)

# 4) Worker: validate/store Daily Rhythm in existing JSON records. No new D1 table.
p=Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s=p.read_text()
plan_anchor="""  master_version:typeof b.master_version==='string'?b.master_version:'',
  master_status:typeof b.master_status==='string'?b.master_status:''
};
}
function validateMasterCurriculum(b){"""
plan_replacement="""  master_version:typeof b.master_version==='string'?b.master_version:'',
  master_status:typeof b.master_status==='string'?b.master_status:'',
  daily_rhythm:validateDailyRhythm(b.daily_rhythm,fail)
};
}
function validateDailyRhythm(value,fail){
 if(value===undefined||value===null||value==='')return [];
 if(!Array.isArray(value))fail('Daily Rhythm must be a list.');
 if(value.length>24)fail('Daily Rhythm supports up to 24 blocks.');
 const allowed=new Set(['Routine','Teaching','Break','Planning']);
 const rows=value.map((r,i)=>{
  if(!r||typeof r!=='object')fail('Check Daily Rhythm row '+(i+1)+'.');
  const start=typeof r.start==='string'?r.start.trim():'';
  const end=typeof r.end==='string'?r.end.trim():'';
  const label=typeof r.label==='string'?r.label.trim():(typeof r.learning_block==='string'?r.learning_block.trim():'');
  const type=typeof r.type==='string'&&r.type.trim()?r.type.trim():'Routine';
  if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(start)||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(end)||start>=end)fail('Check Daily Rhythm start/end times.');
  if(!label||label.length>120)fail('Each Daily Rhythm block needs a label.');
  if(!allowed.has(type))fail('Daily Rhythm type must be Routine, Teaching, Break or Planning.');
  return {id:typeof r.id==='string'&&r.id.trim()?r.id.trim().slice(0,80):'rhythm-'+(i+1),start,end,label,type};
 });
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(rows[i].start<rows[j].end&&rows[j].start<rows[i].end)fail('Daily Rhythm blocks overlap.');
 return rows;
}
function validateMasterCurriculum(b){"""
if 'function validateDailyRhythm(value,fail)' not in s:
    if plan_anchor not in s: raise SystemExit('worker learning-plan anchor not found')
    s=s.replace(plan_anchor,plan_replacement,1)
master_anchor=""" return {
  level:b.level.trim(),
  version:b.version.trim(),
  title:b.title.trim(),
  lessons
 };
}"""
master_replacement=""" return {
  level:b.level.trim(),
  version:b.version.trim(),
  title:b.title.trim(),
  lessons,
  daily_rhythm:validateDailyRhythm(b.daily_rhythm,fail)
 };
}"""
if master_anchor in s:
    s=s.replace(master_anchor,master_replacement,1)
elif 'daily_rhythm:validateDailyRhythm(b.daily_rhythm,fail)' not in s[s.find('function validateMasterCurriculum'):s.find('async function learningPortal')]:
    raise SystemExit('worker master return anchor not found')
p.write_text(s)

# 5) Timetable admin copy and cache versions.
p=Path('timetable-full-day.js')
s=p.read_text()
s=s.replace("The approved Day 1–200 curriculum is the primary source for date-specific teaching periods. When curriculum rows include <b>period, start and end</b>, those periods automatically appear on the teacher's mapped working date.","The approved Day 1–200 curriculum is the primary source for the teacher day. Date-specific curriculum periods appear on the mapped working date, and a versioned <b>Daily Rhythm</b> supplies the remaining recurring school-day blocks when available.")
s=s.replace("<strong>No Day-1 pilot timetable is inserted here.</strong> Use the weekly timetable below only for recurring Break / Planning / fallback blocks that are not supplied by the day-wise curriculum.","<strong>No Day-1 pilot timetable is inserted here.</strong> Curriculum lessons + Daily Rhythm build the normal school day. Use the weekly timetable below only for center-specific Break / Planning / fallback blocks that are not already supplied by the curriculum version.")
p.write_text(s)

p=Path('teachers.html')
s=p.read_text().replace('/learning-family.js?v=20261001-daywise1','/learning-family.js?v=20261001-daywise2')
p.write_text(s)

p=Path('schools.html')
s=p.read_text().replace('/timetable-full-day.js?v=20261001-daywise1','/timetable-full-day.js?v=20261001-daywise2')
s=s.replace('/learning-admin.js?v=20260928-master-preview','/learning-admin.js?v=20261001-rhythm1')
p.write_text(s)

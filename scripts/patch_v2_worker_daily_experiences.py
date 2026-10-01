from pathlib import Path
import re

p = Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s = p.read_text()

validator = r'''function validateDailyExperiences(value,fail){
 const rows=value===undefined||value===null||value===''?[]:value;
 if(!Array.isArray(rows))fail('Daily Experiences must be a list.');
 if(rows.length>1800)fail('Daily Experiences supports up to 1800 rows.');
 const ids=new Set();
 const out=rows.map((r,i)=>{
  if(!r||typeof r!=='object')fail('Check Daily Experience '+(i+1)+'.');
  const day=Number(r.day),experienceNo=Number(r.experience_no);
  if(!Number.isInteger(day)||day<1||day>200)fail('Daily Experience '+(i+1)+': day must be 1–200.');
  if(!Number.isInteger(experienceNo)||experienceNo<1||experienceNo>9)fail('Daily Experience '+(i+1)+': experience_no must be 1–9.');
  const id=typeof r.id==='string'&&r.id.trim()?r.id.trim():'experience-'+day+'-'+experienceNo;
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||ids.has(id))fail('Daily Experience IDs must be unique.');
  ids.add(id);
  const name=typeof r.experience_name==='string'?r.experience_name.trim():'';
  const start=typeof r.start==='string'?r.start.trim():'';
  const end=typeof r.end==='string'?r.end.trim():'';
  if(!name||name.length>120)fail('Daily Experience '+(i+1)+': check experience_name.');
  if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(start)||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(end)||start>=end)fail('Daily Experience '+(i+1)+': check start/end.');
  const item={id,day,experience_no:experienceNo,experience_name:name,start,end};
  for(const [key,max] of [['concept',180],['objective',700],['activity',2200]]){
   const v=typeof r[key]==='string'?r[key].trim():'';
   if(!v||v.length>max)fail('Daily Experience '+(i+1)+': check '+key);
   item[key]=v;
  }
  for(const [key,max] of [['subject',120],['materials',1600],['teacher_language',1200],['observe_for',1200],['why_this_matters',1000],['support_scaffold',1200],['challenge_extension',1200],['inclusion_note',1200],['safety_supervision',1200],['portfolio_evidence',1200],['play_mode',120],['resource_id',120],['resource_type',100],['resource_title',240],['resource_url',1200],['classwork_home_either',40],['homework',1500],['ncf_curricular_goal',240],['ncf_competency',700]]){
   if(r[key]!==undefined&&(typeof r[key]!=='string'||r[key].length>max))fail('Daily Experience '+(i+1)+': check '+key);
   item[key]=typeof r[key]==='string'?r[key].trim():'';
  }
  if(r.questions!==undefined){
   if(!Array.isArray(r.questions)||r.questions.length>5||r.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>300))fail('Daily Experience '+(i+1)+': check questions.');
   item.questions=r.questions.map(q=>q.trim());
  }else item.questions=[];
  return item;
 });
 for(let day=1;day<=200;day++){
  const dayRows=out.filter(x=>x.day===day).sort((a,b)=>a.start.localeCompare(b.start));
  for(let i=0;i<dayRows.length;i++)for(let j=i+1;j<dayRows.length;j++)if(dayRows[i].start<dayRows[j].end&&dayRows[j].start<dayRows[i].end)fail('Daily Experiences overlap on Day '+day+'.');
 }
 return out;
}
'''

if 'function validateDailyExperiences(value,fail)' not in s:
    marker = 'function validateLearningPlan(b){'
    if s.count(marker) != 1:
        raise SystemExit('validateLearningPlan marker not found uniquely')
    s = s.replace(marker, validator + marker, 1)

if 'daily_experiences:validateDailyExperiences(b.daily_experiences,fail)' not in s:
    pattern = r'(daily_rhythm:validateDailyRhythm\(b\.daily_rhythm,fail\))(\s*\n\s*};)'
    s, n = re.subn(pattern, r'\1,\n  daily_experiences:validateDailyExperiences(b.daily_experiences,fail)\2', s, count=2)
    if n != 2:
        raise SystemExit(f'Expected 2 daily_rhythm return targets, found {n}')

publish_marker = " const status=testMode?'TestPublished':'Published';"
if 'V2 production publish requires exactly 9 Learning Experiences' not in s:
    gate = """ if(!testMode&&Array.isArray(checked.daily_experiences)&&checked.daily_experiences.length){
  if(checked.daily_experiences.length!==1800)
   return out({error:'V2 production publish requires exactly 9 Learning Experiences for each of 200 days.'},400);
  for(let day=1;day<=200;day++){
   const rows=checked.daily_experiences.filter(x=>x.day===day),nums=new Set(rows.map(x=>x.experience_no));
   if(rows.length!==9||nums.size!==9||![1,2,3,4,5,6,7,8,9].every(n=>nums.has(n)))
    return out({error:'Day '+day+' must contain Learning Experiences 1–9 exactly once.'},400);
  }
 }

"""
    if s.count(publish_marker) != 1:
        raise SystemExit('Publish status marker not found uniquely')
    s = s.replace(publish_marker, gate + publish_marker, 1)

old_get = "const all=await plans();return out({today:neoToday(),plans:teacher?all.filter(p=>p.status==='Approved'&&teacher.classroom_ids.includes(p.classroom_id)).map(p=>({...p,lessons:p.lessons.filter(l=>p.working_dates[l.day-1]<=new Date(Date.parse(neoToday())+7*86400000).toISOString().slice(0,10))})):all});"
new_get = "const all=await plans(),horizon=new Date(Date.parse(neoToday())+7*86400000).toISOString().slice(0,10);return out({today:neoToday(),plans:teacher?all.filter(p=>p.status==='Approved'&&teacher.classroom_ids.includes(p.classroom_id)).map(p=>({...p,lessons:p.lessons.filter(l=>p.working_dates[l.day-1]<=horizon),daily_experiences:Array.isArray(p.daily_experiences)?p.daily_experiences.filter(x=>p.working_dates[x.day-1]<=horizon):[]})):all});"
if 'daily_experiences:Array.isArray(p.daily_experiences)' not in s:
    if s.count(old_get) != 1:
        raise SystemExit('Teacher plan response target not found uniquely')
    s = s.replace(old_get, new_get, 1)

p.write_text(s)
print('V2 Worker daily experiences patch applied.')

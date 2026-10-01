from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# ---------- Head Office Curriculum Master ----------
p = Path('curriculum-master.html')
s = p.read_text()

if "let lessons=[],dailyRhythm=[],dailyExperiences=[],editing='';" not in s:
    s = replace_once(s, "let lessons=[],dailyRhythm=[],editing='';", "let lessons=[],dailyRhythm=[],dailyExperiences=[],editing='';", 'master state')

if "dailyExperiences.length+' daily experiences'" not in s:
    old = "+' timed periods · '+dailyRhythm.length+' daily rhythm blocks'+"
    new = "+' timed periods · '+dailyRhythm.length+' daily rhythm blocks · '+dailyExperiences.length+' daily experiences'+"
    s = replace_once(s, old, new, 'master preview daily experiences')

parse_marker = "const expName=wb.SheetNames.find(n=>['daily experiences','v2 final 9 flow','final 9 flow','production daily experiences'].includes(String(n).trim().toLowerCase()))"
if parse_marker not in s:
    exp_parse = """const expName=wb.SheetNames.find(n=>['daily experiences','v2 final 9 flow','final 9 flow','production daily experiences'].includes(String(n).trim().toLowerCase()));dailyExperiences=[];if(expName){const expSheet=wb.Sheets[expName];if(Object.values(expSheet).some(c=>c&&c.f))throw Error('Replace Daily Experiences formulas with values before uploading.');const er=XLSX.utils.sheet_to_json(expSheet,{defval:''});if(er.length>1800)throw Error('Daily Experiences supports up to 1800 rows.');const norm=er.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k).trim().toLowerCase(),v])));dailyExperiences=norm.filter(r=>r.day||r.experience_no||r.experience_name).map((r,i)=>({id:String(r.id||r.block_id||r.lesson_id||('experience-'+r.day+'-'+r.experience_no)),day:Number(r.day),experience_no:Number(r.experience_no),experience_name:String(r.experience_name||r.learning_experience||'').trim(),start:excelTime(r.start),end:excelTime(r.end),subject:String(r.subject||r.experience_name||'').trim(),concept:String(r.concept||r.day_concept||r.experience_name||'').trim(),objective:String(r.objective||r.observable_outcome||'').trim(),activity:String(r.activity||r.activity_or_micro_experiences||'').trim(),materials:String(r.materials||'').trim(),teacher_language:String(r.teacher_language||'').trim(),observe_for:String(r.observe_for||r.priority_observation||'').trim(),why_this_matters:String(r.why_this_matters||'').trim(),support_scaffold:String(r.support_scaffold||'').trim(),challenge_extension:String(r.challenge_extension||'').trim(),inclusion_note:String(r.inclusion_note||'').trim(),safety_supervision:String(r.safety_supervision||r.safety_note||'').trim(),portfolio_evidence:String(r.portfolio_evidence||'').trim(),play_mode:String(r.play_mode||'').trim(),resource_id:String(r.resource_id||'').trim(),resource_type:String(r.resource_type||'').trim(),resource_title:String(r.resource_title||r.student_resource_decision||'').trim(),resource_url:String(r.resource_url||'').trim(),classwork_home_either:String(r.classwork_home_either||'').trim(),homework:String(r.homework||r.home_connection||'').trim(),ncf_curricular_goal:String(r.ncf_curricular_goal||r.ncf_alignment_domain||'').trim(),ncf_competency:String(r.ncf_competency||r.ncf_alignment_focus||'').trim(),questions:[r.question_1,r.question_2,r.question_3].map(q=>String(q||'').trim()).filter(Boolean)}))}"""
    anchor = "inspectLessons();message('Excel loaded. '+dailyRhythm.length+' Daily Rhythm block(s) loaded. Review the day preview, then Save Draft for server validation.','ok')"
    replacement = exp_parse + ";inspectLessons();message('Excel loaded. '+dailyRhythm.length+' Daily Rhythm block(s) + '+dailyExperiences.length+' Daily Experience(s) loaded. Review the day preview, then Save Draft for server validation.','ok')"
    s = replace_once(s, anchor, replacement, 'master daily experiences parse')

if "dailyExperiences=Array.isArray(x.daily_experiences)?x.daily_experiences:[];" not in s:
    s = replace_once(s,
        "dailyRhythm=Array.isArray(x.daily_rhythm)?x.daily_rhythm:[];",
        "dailyRhythm=Array.isArray(x.daily_rhythm)?x.daily_rhythm:[];dailyExperiences=Array.isArray(x.daily_experiences)?x.daily_experiences:[];",
        'master edit daily experiences')

if "daily_experiences:dailyExperiences" not in s:
    s = replace_once(s,
        "lessons,daily_rhythm:dailyRhythm});",
        "lessons,daily_rhythm:dailyRhythm,daily_experiences:dailyExperiences});",
        'master save payload')

if "editing='';lessons=[];dailyRhythm=[];dailyExperiences=[];" not in s:
    s = replace_once(s,
        "editing='';lessons=[];dailyRhythm=[];",
        "editing='';lessons=[];dailyRhythm=[];dailyExperiences=[];",
        'master clear state')

p.write_text(s)

# ---------- School Curriculum Admin ----------
p = Path('learning-admin.js')
s = p.read_text()

if "let lessons=[],dailyRhythm=[],dailyExperiences=[],editing='',masterCurricula=[];" not in s:
    s = replace_once(s,
        "let lessons=[],dailyRhythm=[],editing='',masterCurricula=[];",
        "let lessons=[],dailyRhythm=[],dailyExperiences=[],editing='',masterCurricula=[];",
        'school state')

if "selectedMaster.daily_experiences" not in s:
    s = replace_once(s,
        "dailyRhythm=Array.isArray(selectedMaster.daily_rhythm)?selectedMaster.daily_rhythm.map(r=>({...r})):[];",
        "dailyRhythm=Array.isArray(selectedMaster.daily_rhythm)?selectedMaster.daily_rhythm.map(r=>({...r})):[];dailyExperiences=Array.isArray(selectedMaster.daily_experiences)?selectedMaster.daily_experiences.map(r=>({...r})):[];",
        'school selected master daily experiences')

if "master.daily_experiences" not in s:
    s = replace_once(s,
        "dailyRhythm=Array.isArray(master.daily_rhythm)?master.daily_rhythm.map(r=>({...r})):[];",
        "dailyRhythm=Array.isArray(master.daily_rhythm)?master.daily_rhythm.map(r=>({...r})):[];dailyExperiences=Array.isArray(master.daily_experiences)?master.daily_experiences.map(r=>({...r})):[];",
        'school load master daily experiences')

if "daily_experiences:selectedMaster?dailyExperiences" not in s:
    s = replace_once(s,
        "daily_rhythm:selectedMaster?dailyRhythm:(source.daily_rhythm||dailyRhythm)});",
        "daily_rhythm:selectedMaster?dailyRhythm:(source.daily_rhythm||dailyRhythm),daily_experiences:selectedMaster?dailyExperiences:(source.daily_experiences||dailyExperiences)});",
        'school save payload')

if "dailyExperiences=Array.isArray(p.daily_experiences)?p.daily_experiences.map(r=>({...r})):[];" not in s:
    s = replace_once(s,
        "dailyRhythm=Array.isArray(p.daily_rhythm)?p.daily_rhythm.map(r=>({...r})):[];",
        "dailyRhythm=Array.isArray(p.daily_rhythm)?p.daily_rhythm.map(r=>({...r})):[];dailyExperiences=Array.isArray(p.daily_experiences)?p.daily_experiences.map(r=>({...r})):[];",
        'school edit plan daily experiences')

# Clear stale master experience state before a legacy/manual file import.
if "dailyExperiences=[];const file=e.target.files[0]" not in s:
    s = replace_once(s,
        "area.querySelector('#curriculumFile').onchange=async e=>{try{await checkCalendar();const file=e.target.files[0];",
        "area.querySelector('#curriculumFile').onchange=async e=>{try{await checkCalendar();dailyExperiences=[];const file=e.target.files[0];",
        'school manual import clears daily experiences')

p.write_text(s)

# ---------- Teacher timetable / guide source ----------
p = Path('learning-family.js')
s = p.read_text()

old_dated = " const dated=activePlans.flatMap(p=>p.lessons.filter(l=>l.start&&p.working_dates[l.day-1]===date).map(l=>({...l,classroom_id:p.classroom_id,type:'Teaching',source:'Curriculum lesson'})));"
new_dated = " const experiencePeriods=activePlans.flatMap(p=>(Array.isArray(p.daily_experiences)?p.daily_experiences:[]).filter(x=>x.start&&p.working_dates[x.day-1]===date).map(x=>({...x,subject:x.experience_name||x.subject||'Learning Experience',period:x.experience_name||x.period||'Learning Experience',classroom_id:p.classroom_id,type:'Teaching',source:'Curriculum experience'})));\n const dated=experiencePeriods.length?experiencePeriods:activePlans.flatMap(p=>p.lessons.filter(l=>l.start&&p.working_dates[l.day-1]===date).map(l=>({...l,classroom_id:p.classroom_id,type:'Teaching',source:'Curriculum lesson'})));"
if "const experiencePeriods=activePlans.flatMap" not in s:
    s = replace_once(s, old_dated, new_dated, 'teacher daily experiences schedule')

if "s.source==='Curriculum experience'" not in s:
    s = replace_once(s,
        "const directLesson=s.source==='Curriculum lesson'?s:null;",
        "const directLesson=(s.source==='Curriculum lesson'||s.source==='Curriculum experience')?s:null;",
        'teacher direct experience metadata')

p.write_text(s)

print('V2 frontend daily experiences patch applied.')

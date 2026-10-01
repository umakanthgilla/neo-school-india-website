from pathlib import Path
import re


def one(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Marker not found: {label}')
    return text.replace(old, new, 1)

bulk_path=Path('bulk-upload.js')
plus_path=Path('bulk-upload-plus.js')
pass_path=Path('password-access.js')
schools_path=Path('schools.html')
worker_path=Path('worker/neo-lead-crm-api-worker-transport-phase1.js')

bulk=bulk_path.read_text()
plus=plus_path.read_text()
paccess=pass_path.read_text()
schools=schools_path.read_text()
worker=worker_path.read_text()

bulk=one(bulk,
"const STUDENT_HEADERS=['name','dob','gender','parent','mobile','email','program','academic_year','classroom','previous_school','previous_city','nursery_status','lkg_status'];",
"const STUDENT_HEADERS=['name','dob','gender','parent','mobile','email','program','academic_year','classroom','playgroup_status','nursery_status','nursery_school','nursery_city','nursery_year','lkg_status','lkg_school','lkg_city','lkg_year'];",
'bulk student headers')

old="""    const nursery=d.nursery_status||'Not applicable',lkg=d.lkg_status||'Not applicable';
    if(!['Not applicable','Completed','In progress','Not attended'].includes(nursery))errors.push('Invalid Nursery status');
    if(!['Not applicable','Completed','In progress','Not attended'].includes(lkg))errors.push('Invalid LKG status');
    if(['LKG','UKG'].includes(program)&&nursery==='Not applicable')errors.push('Nursery history required for LKG/UKG');
    if(program==='UKG'&&lkg==='Not applicable')errors.push('LKG history required for UKG');
    if([nursery,lkg].some(x=>['Completed','In progress'].includes(x))&&(!d.previous_school||!d.previous_city))errors.push('Previous school and city required');
    const body={name:d.name,dob:d.dob,gender:d.gender||'',email:d.email||'',program,parent:d.parent,mobile:d.mobile,academic_year,previous_school:d.previous_school||'',previous_city:d.previous_city||'',nursery_status:nursery,lkg_status:lkg,classroom_id:classroom?.id||''};"""
new="""    let playgroup='Not applicable',nursery='Not applicable',lkg='Not applicable';
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
    const body={name:d.name,dob:d.dob,gender:d.gender||'',email:d.email||'',program,parent:d.parent,mobile:d.mobile,academic_year,playgroup_status:playgroup,nursery_status:nursery,nursery_school:nurserySchool,nursery_city:nurseryCity,nursery_year:nurseryYear,lkg_status:lkg,lkg_school:lkgSchool,lkg_city:lkgCity,lkg_year:lkgYear,previous_school:previousSchool,previous_city:previousCity,classroom_id:classroom?.id||''};"""
bulk=one(bulk,old,new,'bulk stage validation')

old_note="Student ID and Admission No. are generated automatically. Valid rows are imported class-wise: Playgroup → Nursery → LKG → UKG → Daycare."
new_note="Student ID and Admission No. are generated automatically. Previous-stage rules: Playgroup/Daycare = none; Nursery = Playgroup optional; LKG = Nursery completion details required; UKG = Nursery + LKG completion details required. Valid rows are imported class-wise: Playgroup → Nursery → LKG → UKG → Daycare."
plus=one(plus,old_note,new_note,'bulk note')

# Load the manual-form stage helper and refresh bulk assets.
paccess=paccess.replace("'/bulk-upload.js?v=20261001-bulk2'","'/bulk-upload.js?v=20261001-bulk5'")
paccess=paccess.replace("'/bulk-upload-plus.js?v=20261001-bulk4'","'/bulk-upload-plus.js?v=20261001-bulk5'")
needle="['/student-class-link.js?v=20261001-link2','neoStudentClassLink']"
insert="['/student-stage-history.js?v=20261001-stage1','neoStudentStageHistory'],"+needle
if 'neoStudentStageHistory' not in paccess:
    paccess=one(paccess,needle,insert,'stage helper loader')

# Ensure browsers load the updated loader.
schools=re.sub(r'/password-access\.js\?v=[^"\']+', '/password-access.js?v=20261001-stage1', schools)

old_data="""data={gender:b.gender?choice('gender',['Male','Female','Prefer not to say']):'',email:str('email',200,false),name:str('name'),dob:date('dob'),program:choice('program',['Playgroup','Nursery','LKG','UKG','Daycare']),parent:str('parent'),mobile:mobile(),academic_year:str('academic_year',9),previous_school:str('previous_school',200,false),previous_city:str('previous_city',120,false),nursery_status:choice('nursery_status',['Not applicable','Completed','In progress','Not attended']),lkg_status:choice('lkg_status',['Not applicable','Completed','In progress','Not attended'])};"""
new_data="""data={gender:b.gender?choice('gender',['Male','Female','Prefer not to say']):'',email:str('email',200,false),name:str('name'),dob:date('dob'),program:choice('program',['Playgroup','Nursery','LKG','UKG','Daycare']),parent:str('parent'),mobile:mobile(),academic_year:str('academic_year',9),playgroup_status:b.playgroup_status?choice('playgroup_status',['Not applicable','Completed','Not attended / First school']):'Not applicable',nursery_status:b.nursery_status?choice('nursery_status',['Not applicable','Completed']):'Not applicable',nursery_school:str('nursery_school',200,false),nursery_city:str('nursery_city',120,false),nursery_year:str('nursery_year',4,false),lkg_status:b.lkg_status?choice('lkg_status',['Not applicable','Completed']):'Not applicable',lkg_school:str('lkg_school',200,false),lkg_city:str('lkg_city',120,false),lkg_year:str('lkg_year',4,false),previous_school:str('previous_school',200,false),previous_city:str('previous_city',120,false)};"""
worker=one(worker,old_data,new_data,'worker student fields')

old_rules="""    if(['LKG','UKG'].includes(data.program)&&data.nursery_status==='Not applicable')fail('Specify previous Nursery status.');
    if(data.program==='UKG'&&data.lkg_status==='Not applicable')fail('Specify previous LKG status.');
    if([data.nursery_status,data.lkg_status].some(x=>['Completed','In progress'].includes(x))&&(!data.previous_school||!data.previous_city))fail('Enter previous school and city.');"""
new_rules="""    if(['Playgroup','Daycare'].includes(data.program)){data.playgroup_status='Not applicable';data.nursery_status='Not applicable';data.lkg_status='Not applicable';data.nursery_school='';data.nursery_city='';data.nursery_year='';data.lkg_school='';data.lkg_city='';data.lkg_year='';data.previous_school='';data.previous_city='';}
    if(data.program==='Nursery'){if(!['Completed','Not attended / First school'].includes(data.playgroup_status))fail('Choose whether Playgroup was completed or this is the child\'s first school stage.');data.nursery_status='Not applicable';data.lkg_status='Not applicable';data.nursery_school='';data.nursery_city='';data.nursery_year='';data.lkg_school='';data.lkg_city='';data.lkg_year='';data.previous_school='';data.previous_city='';}
    if(data.program==='LKG'){if(data.nursery_status!=='Completed')fail('Nursery must be completed before LKG.');if(!data.nursery_school||!data.nursery_city||!/^20\\d{2}$/.test(data.nursery_year))fail('Enter Nursery completed school, city and completion year.');if(Number(data.nursery_year)>Number(data.academic_year))fail('Nursery completion year cannot be after the current academic year.');data.playgroup_status='Not applicable';data.lkg_status='Not applicable';data.lkg_school='';data.lkg_city='';data.lkg_year='';data.previous_school=data.nursery_school;data.previous_city=data.nursery_city;}
    if(data.program==='UKG'){if(data.nursery_status!=='Completed'||data.lkg_status!=='Completed')fail('Nursery and LKG must be completed before UKG.');if(!data.nursery_school||!data.nursery_city||!/^20\\d{2}$/.test(data.nursery_year))fail('Enter Nursery school, city and completion year.');if(!data.lkg_school||!data.lkg_city||!/^20\\d{2}$/.test(data.lkg_year))fail('Enter LKG school, city and completion year.');if(Number(data.nursery_year)>Number(data.lkg_year))fail('Nursery completion year must be before or equal to LKG completion year.');if(Number(data.lkg_year)>Number(data.academic_year))fail('LKG completion year cannot be after the current academic year.');data.playgroup_status='Not applicable';data.previous_school=data.lkg_school;data.previous_city=data.lkg_city;}"""
worker=one(worker,old_rules,new_rules,'worker stage validation')

bulk_path.write_text(bulk)
plus_path.write_text(plus)
pass_path.write_text(paccess)
schools_path.write_text(schools)
worker_path.write_text(worker)
print('Student class-stage history rules applied.')

from pathlib import Path

p=Path('curriculum-master.html')
s=p.read_text()

marker="Neo-Playgroup-V2-200-Day-Master-Template.xlsx"
if marker in s:
    print('V2 master template already applied.')
    raise SystemExit(0)

start=s.index("document.querySelector('#downloadTemplate').onclick=async()=>{")
end=s.index(";\nasync function api(",start)

new=r'''document.querySelector('#downloadTemplate').onclick=async()=>{try{
 const XLSX=await workbook(),level=document.querySelector('#level').value;
 const coreRows=Array.from({length:200},(_,i)=>({day:i+1,id:'lesson-'+String(i+1).padStart(3,'0'),subject:'',concept:'',objective:'',activity:'',question_1:'',question_2:'',question_3:'',materials:'',homework:'',period:'Core IMLS Experience',start:'10:25',end:'10:50'}));
 const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(coreRows),'Day 1-200');
 if(level==='Playgroup'){
  const defs=[
   [1,'Welcome & Discovery','09:30','09:45'],
   [2,'Circle & Communication','09:45','10:05'],
   [3,'Language & Story','10:05','10:25'],
   [4,'Core IMLS Experience','10:25','10:50'],
   [5,'Movement & Sensory','10:50','11:10'],
   [6,'Snack & Life Skills','11:10','11:30'],
   [7,'Maths, Thinking & Readiness','11:30','11:50'],
   [8,'Create, Practice & Apply','11:50','12:10'],
   [9,'Reflect, Pack & Goodbye','12:10','12:30']
  ];
  const experienceRows=Array.from({length:200},(_,i)=>defs.map(([experience_no,experience_name,start,end])=>({day:i+1,experience_no,experience_name,start,end,subject:experience_name,concept:'',objective:'',activity:'',materials:'',teacher_language:'',observe_for:'',why_this_matters:'',support_scaffold:'',challenge_extension:'',inclusion_note:'',safety_supervision:'',portfolio_evidence:'',play_mode:'',resource_id:'',resource_type:'',resource_title:'',resource_url:'',classwork_home_either:'Class',homework:'',ncf_curricular_goal:'',ncf_competency:'',question_1:'',question_2:'',question_3:'',question_4:'',question_5:''}))).flat();
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(experienceRows),'Daily Experiences');
  const resourceHeaders=['resource_id','day','experience_no','experience_name','resource_type','title','objective','file_path_or_url','classwork_home_either','parent_share','teacher_instruction','status','revision_note'];
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([resourceHeaders]),'Resource Manifest');
  const instructions=[
   ['Neo School India · Playgroup V2 Master Import'],
   ['Rule','Day 1–200 remains independent of the academic calendar.'],
   ['Core Sheet','Day 1-200 keeps one approved core curriculum record per day.'],
   ['Daily Experiences','Exactly 9 Learning Experiences per day; names and times are locked for Playgroup V2.'],
   ['Resources','Use stable Neo Resource IDs. Resource files/URLs are linked from Daily Experiences and Resource Manifest.'],
   ['Teacher Guide','Materials, teacher language, observe-for, support/challenge, inclusion and safety flow to the Teacher Guide.'],
   ['Parent','Home connection/homework is shared only through the approved parent workflow.'],
   ['Publish','Production publish requires all 200 days and all 1800 Playgroup Learning Experiences.']
  ];
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(instructions),'Instructions');
 }
 const rhythmRows=[{start:'',end:'',learning_block:'',type:'Routine'}];
 XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rhythmRows),'Daily Rhythm');
 const fileName=level==='Playgroup'?'Neo-Playgroup-V2-200-Day-Master-Template.xlsx':'Neo-200-Day-Master-Template.xlsx';
 XLSX.writeFile(book,fileName);
 message(level==='Playgroup'?'Playgroup V2 template downloaded: 200 core days + 1800 Learning Experiences + Resource Manifest.':'200-day master template downloaded.','ok')
 }catch(e){message('Could not prepare Excel template: '+e.message,'error')}}'''

s=s[:start]+new+s[end:]

old='Upload your curriculum, daily lesson periods and homework in one master Excel per level. Day 1–200 maps to each centre’s saved working dates; holidays and events are skipped by the academic calendar.'
newtext='Upload one structured master Excel per level. For Playgroup V2, the workbook carries the 200-day core curriculum plus 9 Learning Experiences per day, resource links, teacher guidance, observation cues and home connection. Day 1–200 maps to each centre’s saved working dates.'
if old in s:
    s=s.replace(old,newtext,1)

p.write_text(s)
print('Playgroup V2 downloadable master template applied.')

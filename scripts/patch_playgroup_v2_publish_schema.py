from pathlib import Path

p = Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s = p.read_text()

old = """ if(!testMode&&Array.isArray(checked.daily_experiences)&&checked.daily_experiences.length){
  if(checked.daily_experiences.length!==1800)
   return out({error:'V2 production publish requires exactly 9 Learning Experiences for each of 200 days.'},400);
  for(let day=1;day<=200;day++){
   const rows=checked.daily_experiences.filter(x=>x.day===day),nums=new Set(rows.map(x=>x.experience_no));
   if(rows.length!==9||nums.size!==9||![1,2,3,4,5,6,7,8,9].every(n=>nums.has(n)))
    return out({error:'Day '+day+' must contain Learning Experiences 1–9 exactly once.'},400);
  }
 }"""

new = """ if(!testMode&&checked.level==='Playgroup'&&(checked.curriculum_schema==='playgroup-v2'||checked.daily_experiences.length>0)){
  const playgroupV2Schema=[
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
  if(checked.daily_experiences.length!==1800)
   return out({error:'Playgroup V2 production publish requires exactly 9 Learning Experiences for each of 200 days.'},400);
  for(let day=1;day<=200;day++){
   const rows=checked.daily_experiences.filter(x=>x.day===day).sort((a,b)=>a.experience_no-b.experience_no),nums=new Set(rows.map(x=>x.experience_no));
   if(rows.length!==9||nums.size!==9||playgroupV2Schema.some(([n])=>!nums.has(n)))
    return out({error:'Day '+day+' must contain Learning Experiences 1–9 exactly once.'},400);
   for(const [n,name,start,end] of playgroupV2Schema){
    const row=rows.find(x=>x.experience_no===n);
    if(!row||row.experience_name!==name||row.start!==start||row.end!==end)
     return out({error:'Day '+day+' Experience '+n+' must use the approved Playgroup V2 name and time: '+name+' · '+start+'–'+end+'.'},400);
   }
  }
 }"""

if new in s:
    print('Playgroup V2 publish schema already applied.')
elif old in s:
    s = s.replace(old, new, 1)
    # Playgroup V2 schema marker guard is maintained in the Worker source.\n# New Playgroup drafts are tagged curriculum_schema=playgroup-v2 by curriculum-master.html.\np.write_text(s)
    print('Playgroup V2 publish schema applied.')
else:
    raise SystemExit('Current V2 publish gate target was not found.')

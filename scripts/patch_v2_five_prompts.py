from pathlib import Path
p=Path('curriculum-master.html')
s=p.read_text()
old="ncf_competency:String(r.ncf_competency||r.ncf_alignment_focus||'').trim(),questions:[r.question_1,r.question_2,r.question_3].map(q=>String(q||'').trim()).filter(Boolean)"
new="ncf_competency:String(r.ncf_competency||r.ncf_alignment_focus||'').trim(),questions:[r.question_1,r.question_2,r.question_3,r.question_4,r.question_5].map(q=>String(q||'').trim()).filter(Boolean)"
if new in s:
 print('Five Daily Experience prompts already enabled.')
elif old in s:
 s=s.replace(old,new,1);p.write_text(s);print('Five Daily Experience prompts enabled.')
else:
 raise SystemExit('Daily Experience prompt parser target not found.')

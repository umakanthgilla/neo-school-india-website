from pathlib import Path
p=Path('learning-family.js')
s=p.read_text()
old="const concept=concepts.find(x=>x.p.classroom_id===s.classroom_id&&(x.l.start===s.start||x.l.subject===s.subject));const lesson=concept?.l;const material=lesson?.materials||'';const homework=lesson?.homework||'';const specialSnack=/snack/i.test(s.subject);"
new="const directLesson=s.source==='Curriculum lesson'?s:null;const concept=concepts.find(x=>x.p.classroom_id===s.classroom_id&&(x.l.start===s.start||x.l.subject===s.subject));const lesson=directLesson||concept?.l;const material=lesson?.materials||'';const homework=lesson?.homework||'';const resourceUrl=lesson?.resource_url||lesson?.worksheet_url||'';const isRoutine=s.source==='Curriculum rhythm'||(s.type!=='Teaching'&&!lesson);const specialSnack=/snack/i.test(s.subject);"
if old not in s:
    raise SystemExit('lesson mapping anchor not found')
s=s.replace(old,new,1)
old2="<p><strong>Materials:</strong> ${material?esc(material):'No materials linked yet.'}</p><p><strong>Worksheet / resource:</strong> ${lesson?'Link from curriculum when attached.':'No curriculum resource linked to this block yet.'}</p>"
new2="<p><strong>Materials:</strong> ${material?esc(material):isRoutine?'Routine block — curriculum materials are not required.':'No materials attached to this curriculum lesson.'}</p><p><strong>Worksheet / resource:</strong> ${resourceUrl?`<a href=\"${esc(resourceUrl)}\" target=\"_blank\" rel=\"noopener\">Open worksheet / resource</a>`:isRoutine?'Routine block — worksheet/resource not applicable.':'No worksheet/resource attached to this lesson yet.'}</p>"
if old2 not in s:
    raise SystemExit('prepare panel anchor not found')
s=s.replace(old2,new2,1)
p.write_text(s)

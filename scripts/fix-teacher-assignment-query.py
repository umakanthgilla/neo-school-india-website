from pathlib import Path

p=Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
s=p.read_text()
old="SELECT account_id,name,staff_id,staff_type,active,classroom_ids FROM neo_employee_accounts e JOIN neo_teacher_accounts a ON a.account_id=e.account_id AND a.school_id=e.school_id WHERE e.school_id=? AND e.account_id=?"
new="SELECT e.account_id,e.name,e.staff_id,e.staff_type,e.active,a.classroom_ids FROM neo_employee_accounts e JOIN neo_teacher_accounts a ON a.account_id=e.account_id AND a.school_id=e.school_id WHERE e.school_id=? AND e.account_id=?"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('teacher assignment query anchor not found')
p.write_text(s)

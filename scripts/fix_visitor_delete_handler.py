from pathlib import Path
import re

ext=Path('worker/gate-qr-parent-extension.js')
s=ext.read_text()
marker="  if(kind==='visitor'&&request.method==='POST'&&!id){"
block=r'''  if(kind==='visitor'&&request.method==='DELETE'){
   const rawDays=url.searchParams.get('retention'),days=rawDays==null?0:Number(rawDays);if(rawDays!=null&&(!Number.isInteger(days)||days<1||days>365))return out({error:'Retention must be 1–365 days.'},400);
   const result=await purgeVisitors(school,actor,{id,olderThanDays:id?0:days});if(result.error==='not_found')return out({error:'Visitor record not found.'},404);if(result.error==='active')return out({error:'Close the visitor first (Reject or Check out) before deleting the record.'},409);return out({success:true,deleted:result.count,retention_days:days||null});
  }
'''
intercept=s.find('/* Intercept school actions')
if intercept < 0:
    raise SystemExit('school intercept marker not found')
if "if(kind==='visitor'&&request.method==='DELETE')" not in s[intercept:]:
    if marker not in s:
        raise SystemExit('visitor POST marker not found')
    s=s.replace(marker,block+marker,1)
ext.write_text(s)

worker=Path('worker/neo-lead-crm-api-worker-transport-phase1.js')
w=worker.read_text()
start_src=s.find('async function gateQrParentPortal')
start_w=w.find('async function gateQrParentPortal')
if start_src<0 or start_w<0:
    raise SystemExit('gateQrParentPortal not found')
src_func=s[start_src:].strip()
next_match=re.search(r'\nasync function [A-Za-z0-9_]+\(',w[start_w+len('async function gateQrParentPortal'):])
if not next_match:
    raise SystemExit('next worker function boundary not found')
end_w=start_w+len('async function gateQrParentPortal')+next_match.start()+1
w=w[:start_w]+src_func+'\n\n'+w[end_w:]
worker.write_text(w)

from pathlib import Path
import re

p = Path('gate-checkin.html')
text = p.read_text()
pattern = r"async function loadPassPhoto\(\)\{.*?\}\nasync function poll\(\)\{"
replacement = """async function loadPassPhoto(){const img=document.getElementById('gatePassPhoto');if(!tracking?.hasPhoto||!img)return;if(passPhotoUrl){img.src=passPhotoUrl;return}try{const r=await fetch(API+'/api/gate-photo/public/'+encodeURIComponent(school)+'/'+tracking.type+'/'+encodeURIComponent(tracking.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({public_token:tracking.token})});if(!r.ok)return;passPhotoUrl=URL.createObjectURL(await r.blob());const target=document.getElementById('gatePassPhoto');if(target)target.src=passPhotoUrl}catch{}}
async function poll(){"""
new, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('Pass photo function marker not found.')
p.write_text(new)
scripts = re.findall(r'<script>(.*?)</script>', new, flags=re.S)
if not scripts:
    raise SystemExit('Inline script not found.')
Path('/tmp/gate-checkin-inline.js').write_text(scripts[-1])

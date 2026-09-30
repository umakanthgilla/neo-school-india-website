from pathlib import Path
import re

p = Path('gate-checkin.html')
text = p.read_text()

css = r'''
/* Premium Neo digital gate pass */
.pass{position:relative;border:0!important;background:linear-gradient(145deg,#ffffff 0%,#f7fbff 62%,#f0f7ff 100%)!important;border-radius:28px!important;padding:0!important;text-align:left!important;overflow:hidden;box-shadow:0 22px 55px rgba(0,26,73,.20);isolation:isolate}
.pass:before{content:"";position:absolute;left:0;right:0;top:0;height:7px;background:linear-gradient(90deg,#00b9e8 0 20%,#4dbb42 20% 40%,#f4c400 40% 60%,#ff7a16 60% 80%,#ef3b78 80% 100%);z-index:3}
.pass:after{content:"";position:absolute;width:300px;height:300px;right:-145px;bottom:-160px;border-radius:50%;border:28px solid rgba(0,185,232,.08);box-shadow:0 0 0 34px rgba(77,187,66,.055),0 0 0 68px rgba(244,196,0,.04);z-index:-1}
.pass.pending{background:linear-gradient(145deg,#fff 0%,#fffaf0 100%)!important}.pass.rejected{background:linear-gradient(145deg,#fff 0%,#fff5f5 100%)!important}
.neo-pass-inner{position:relative;z-index:1;padding:24px 22px 20px}.neo-pass-watermark{position:absolute;right:-8px;top:118px;font-size:108px;font-weight:950;letter-spacing:-.08em;color:#071b52;opacity:.025;line-height:1;pointer-events:none;user-select:none}
.neo-pass-brand{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:4px 0 18px}.neo-pass-school{display:flex;align-items:center;gap:12px;min-width:0}.neo-pass-school img{width:72px;height:60px;object-fit:contain;background:#fff;border-radius:14px;padding:5px;box-shadow:0 5px 16px rgba(0,24,70,.10)}.neo-pass-school-copy{min-width:0}.neo-pass-school-name{font-size:17px;font-weight:900;color:#071b52;line-height:1.15}.neo-pass-school-city{font-size:12px;color:#63718c;margin-top:4px}.neo-pass-type{text-align:right;font-size:11px;font-weight:900;letter-spacing:.14em;color:#0b397f;text-transform:uppercase}.neo-pass-status{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:7px 11px;border-radius:999px;background:#e7f8ee;color:#176b3a;font-size:12px;font-weight:900;letter-spacing:.02em}.pass.pending .neo-pass-status{background:#fff0c9;color:#775600}.pass.rejected .neo-pass-status{background:#ffe4e4;color:#a72b2b}.neo-pass-status:before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 15%,transparent)}
.neo-pass-main{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;padding:15px;border:1px solid #dbe6f4;border-radius:20px;background:rgba(255,255,255,.82);backdrop-filter:blur(4px)}.neo-pass-main.no-photo{grid-template-columns:1fr}.neo-pass-main .pass-photo{margin:0}.neo-pass-main .pass-photo img{width:112px;height:112px;border:5px solid #fff;box-shadow:0 6px 18px rgba(0,26,73,.18)}.neo-pass-name-label{font-size:11px;font-weight:900;letter-spacing:.12em;color:#6b7890;text-transform:uppercase}.neo-pass-name{font-size:clamp(24px,6vw,34px);font-weight:950;letter-spacing:-.025em;color:#071b52;line-height:1.05;margin:4px 0 10px}.neo-pass-subline{font-size:13px;color:#465674;line-height:1.45;margin:4px 0}.neo-pass-subline b{color:#0b397f}.neo-pass-details{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.neo-pass-detail{padding:11px 12px;border-radius:14px;background:#f4f8fd;border:1px solid #e2eaf5}.neo-pass-detail span{display:block;font-size:10px;font-weight:900;letter-spacing:.1em;color:#76839a;text-transform:uppercase;margin-bottom:4px}.neo-pass-detail b{display:block;font-size:13px;color:#071b52;line-height:1.35}.neo-pass-code-wrap{position:relative;overflow:hidden;margin:16px 0 12px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,#071b52,#0b397f);color:#fff;text-align:center;box-shadow:0 10px 25px rgba(7,27,82,.18)}.neo-pass-code-wrap:before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#00b9e8,#4dbb42,#f4c400,#ff7a16,#ef3b78)}.neo-pass-code-wrap .pass-code{margin:3px 0 0;color:#fff;font-size:clamp(25px,7vw,36px);letter-spacing:.045em}.neo-pass-code-label{font-size:10px;font-weight:900;letter-spacing:.14em;color:#c9d9f5;text-transform:uppercase}.neo-pass-valid{display:flex;justify-content:center;gap:6px;align-items:center;margin-top:7px;font-size:12px;color:#e8efff}.neo-pass-valid strong{color:#fff}.neo-pass-pending{padding:12px 14px;border-radius:14px;background:#fff8df;color:#6f5200;text-align:center;font-weight:700;line-height:1.45;margin:14px 0}.neo-pass-footer{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-top:14px;padding-top:12px;border-top:1px dashed #cbd8e9}.neo-pass-footer-copy{font-size:11px;color:#6d7990;line-height:1.5}.neo-pass-secure{font-size:10px;font-weight:900;letter-spacing:.09em;color:#0b397f;text-transform:uppercase;white-space:nowrap}.neo-pass-secure:before{content:"✓";display:inline-grid;place-items:center;width:20px;height:20px;margin-right:6px;border-radius:50%;background:#e6f6ed;color:#16804a;letter-spacing:0}.pass .steps{max-width:none;margin:14px 0 0;grid-template-columns:repeat(3,1fr);gap:7px}.pass .step{font-size:11px;padding:9px 8px;text-align:center;border:1px solid #e1e8f3}.pass .step.done{border-color:#cfe9d8}.neo-pass-warning{margin:12px 0;padding:10px 12px;border-radius:12px;background:#fff2e4;color:#8c3218;font-size:12px;line-height:1.45}.neo-pass-expired{margin:12px 0;padding:11px;border-radius:12px;background:#fff0f0;color:#9b2727;font-weight:800;text-align:center}.tracking-card-premium{background:transparent!important;box-shadow:none!important;padding:0!important;overflow:visible!important}.tracking-card-premium:before{display:none!important}
@media(max-width:560px){.neo-pass-inner{padding:20px 16px 17px}.neo-pass-brand{align-items:flex-start}.neo-pass-school img{width:62px;height:52px}.neo-pass-school-name{font-size:15px}.neo-pass-type{font-size:9px}.neo-pass-main{grid-template-columns:90px 1fr;gap:12px;padding:12px}.neo-pass-main.no-photo{grid-template-columns:1fr}.neo-pass-main .pass-photo img{width:88px;height:88px}.neo-pass-name{font-size:25px}.neo-pass-details{grid-template-columns:1fr}.pass .steps{grid-template-columns:1fr}.neo-pass-footer{align-items:flex-start;flex-direction:column}.neo-pass-watermark{font-size:82px;top:125px}}
'''
if '/* Premium Neo digital gate pass */' not in text:
    text = text.replace('</style>', css + '\n</style>', 1)

text = text.replace("let tracking=null,timer=0,passPhotoUrl='';const photos={visitor:'',pickup:''};", "let tracking=null,timer=0,passPhotoUrl='',schoolInfo={name:'Neo School India',city:''};const photos={visitor:'',pickup:''};")
text = text.replace("try{const d=await call('/api/gate-public/school/'+encodeURIComponent(school));$('schoolName').textContent=d.name||'Neo School India'}", "try{const d=await call('/api/gate-public/school/'+encodeURIComponent(school));schoolInfo={name:d.name||'Neo School India',city:d.city||''};$('schoolName').textContent=schoolInfo.name}")
text = text.replace('<section class="card hidden" id="trackingCard">', '<section class="card hidden tracking-card-premium" id="trackingCard">')

new_poll = r'''async function poll(){
 if(!tracking)return;
 try{
  const d=await call('/api/gate-public/status/'+encodeURIComponent(school)+'/'+tracking.type+'/'+encodeURIComponent(tracking.id),'POST',{public_token:tracking.token});
  const expired=d.pass_state==='Expired',approved=['Inside','Approved for release'].includes(d.status)&&!expired,closed=['Exited','Released','Rejected','Parent rejected'].includes(d.status)||expired;
  let steps='';
  if(tracking.type==='pickup')steps=`<div class="steps"><div class="step ${d.parent_status==='Approved'?'done':''}">Parent<br><b>${esc(d.parent_status||'Pending')}</b></div><div class="step ${d.management_status==='Approved'?'done':''}">School<br><b>${esc(d.management_status||'Pending')}</b></div><div class="step ${d.status==='Released'?'done':''}">Gate<br><b>${esc(d.status)}</b></div></div>`;
  const cls=approved?'pass':(closed&&!['Exited','Released'].includes(d.status)?'pass rejected':'pass pending');
  const primaryName=tracking.type==='visitor'?(d.name||'Visitor'):(d.pickup_name||'Pickup person');
  const typeLabel=tracking.type==='visitor'?'Visitor Pass':'Child Pickup Pass';
  const detailA=tracking.type==='visitor'?(d.purpose||'Visitor'):(d.student_name?'Child · '+d.student_name:'Child pickup');
  const detailB=tracking.type==='visitor'?(d.host_name?'Meeting · '+d.host_name:'School visit'):`Parent · ${d.parent_status||'Pending'}`;
  const photo=tracking.hasPhoto?'<div class="pass-photo"><img id="gatePassPhoto" alt="Gate verification photo"></div>':'';
  const code=d.gate_pass?`<div class="neo-pass-code-wrap"><div class="neo-pass-code-label">Digital gate pass</div><div class="pass-code">${esc(d.gate_pass)}</div>${d.valid_until?`<div class="neo-pass-valid">Valid until <strong>${esc(dt(d.valid_until))}</strong></div>`:''}</div>`:`<div class="neo-pass-pending">${tracking.type==='visitor'?'Waiting for school approval.':'Keep this page open while parent and school approvals are completed.'}</div>`;
  const warning=tracking.photoWarning?`<div class="neo-pass-warning">${esc(tracking.photoWarning)} Gate staff can verify manually.</div>`:'';
  const expiredNote=expired?'<div class="neo-pass-expired">This pass has expired. Please contact the gate desk.</div>':'';
  $('tracking').innerHTML=`<div class="${cls}"><div class="neo-pass-inner"><div class="neo-pass-watermark">neo</div><div class="neo-pass-brand"><div class="neo-pass-school"><img src="/neo-top-logo.jpeg" alt="Neo School India"><div class="neo-pass-school-copy"><div class="neo-pass-school-name">${esc(schoolInfo.name||'Neo School India')}</div>${schoolInfo.city?`<div class="neo-pass-school-city">${esc(schoolInfo.city)}</div>`:''}</div></div><div><div class="neo-pass-type">${typeLabel}</div><div class="neo-pass-status">${esc(d.status)}</div></div></div><div class="neo-pass-main ${tracking.hasPhoto?'':'no-photo'}">${photo}<div><div class="neo-pass-name-label">${tracking.type==='visitor'?'Visitor':'Pickup person'}</div><div class="neo-pass-name">${esc(primaryName)}</div><div class="neo-pass-subline"><b>${esc(detailA)}</b></div><div class="neo-pass-subline">${esc(detailB)}</div></div></div>${warning}${steps}${code}${expiredNote}<div class="neo-pass-footer"><div class="neo-pass-footer-copy">Request ID<br><span>${esc(tracking.id)}</span></div><div class="neo-pass-secure">Secure gate verification</div></div></div></div>`;
  loadPassPhoto();
  $('newRequest').classList.toggle('hidden',!closed);
 }catch(e){$('tracking').innerHTML='<p class="status">'+esc(e.message)+'</p>'}
}'''
pattern = r"async function poll\(\)\{.*?\n\$\('newRequest'\)\.onclick="
match = re.search(pattern, text, flags=re.S)
if not match:
    raise SystemExit('poll function marker not found')
text = text[:match.start()] + new_poll + "\n$('newRequest').onclick=" + text[match.end():]

p.write_text(text)

# Extract the inline JS to syntax-check in the workflow.
scripts = re.findall(r'<script>(.*?)</script>', text, flags=re.S)
if not scripts:
    raise SystemExit('inline gate script not found')
Path('/tmp/gate-checkin-inline.js').write_text(scripts[-1])

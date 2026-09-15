(()=>{
const host=document.getElementById('askNeoPanel');if(!host)return;
const start=document.createElement('button');start.type='button';start.textContent='Admission enquiry / అడ్మిషన్ వివరాలు';start.style.cssText='margin:8px;padding:12px;border-radius:12px;background:#071b52;color:white;border:0';host.insertBefore(start,host.querySelector('form'));
const dialog=document.createElement('dialog');dialog.style.cssText='width:min(580px,92vw);max-height:85vh;overflow:auto;border:1px solid #dce4f5;border-radius:18px;padding:24px;color:#071b52';
dialog.innerHTML=`<form id="neoIntake"><button type="button" id="intakeClose" style="float:right">Close / మూసివేయి</button><h2>Admission enquiry</h2><p>వివరాలు నమోదు చేయండి. Neo team సమీక్షించిన తర్వాత admission నిర్ధారిస్తుంది.</p><section id="intakeStep"></section><p id="intakeError" role="alert"></p><button type="button" id="intakeBack">Back / వెనుకకు</button> <button id="intakeNext">Next / తదుపరి</button></form>`;document.body.appendChild(dialog);
const form=dialog.querySelector('form'),area=dialog.querySelector('#intakeStep'),error=dialog.querySelector('#intakeError'),next=dialog.querySelector('#intakeNext'),back=dialog.querySelector('#intakeBack');let step=0,data={},pending=false;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function input(key,label,type='text',max=120){return `<label style="display:block;margin:12px 0">${label}<input name="${key}" type="${type}" maxlength="${max}" required value="${escape(data[key])}" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label>`;}
function classify(){const d=new Date(data.dob+'T00:00:00Z'),y=+data.academic_year;const months=day=>(y-d.getUTCFullYear())*12+6-d.getUTCMonth()-(day<d.getUTCDate()?1:0);const band=m=>m<32?'Review':m<44?'Nursery':m<56?'LKG':m<72?'UKG':'Review';return band(months(1))===band(months(31))?band(months(1)):'Review';}
function levels(){return data.program==='Nursery'?[]:data.program==='LKG'?['Nursery']:['Nursery','LKG'];}
function render(){error.textContent='';back.hidden=step===0;next.textContent=step===4?'Submit enquiry / పంపించండి':'Next / తదుపరి';
if(step===0){const y=new Date().getFullYear();area.innerHTML=input('child_name','Child name / పిల్లల పేరు')+input('dob','Date of birth / పుట్టిన తేదీ','date',10)+`<label>Academic year / అడ్మిషన్ సంవత్సరం<select name="academic_year" required style="display:block;padding:10px;width:100%">${Array.from({length:4},(_,i)=>`<option value="${y+i}" ${data.academic_year==y+i?'selected':''}>${y+i}–${y+i+1}</option>`).join('')}</select></label>`;area.querySelector('[name=dob]').max=new Date().toISOString().slice(0,10);}
if(step===1){area.innerHTML=`<p><b>${data.program==='Review'?'Head-office age review required':escape(data.program)}</b></p><p>July opening date is pending. Class guidance is provisional. / జూలై ప్రారంభ తేదీ ప్రకారం తుది నిర్ధారణ ఉంటుంది.</p>`+levels().map(l=>`<label style="display:block;margin:12px 0">${l} — previous study / గత చదువు<select required name="${l}" style="display:block;padding:10px;width:100%"><option value="">Select / ఎంచుకోండి</option>${['Completed','Currently studying','Not attended'].map((v,i)=>`<option ${data.previous?.[l]===v?'selected':''} value="${v}">${v} / ${['పూర్తయింది','ప్రస్తుతం చదువుతున్నారు','చదవలేదు'][i]}</option>`).join('')}</select></label>`).join('');if(!levels().length)area.innerHTML+='<p>Fresh Nursery admission / కొత్త Nursery అడ్మిషన్</p>';}
if(step===2){area.innerHTML=input('previous_school','Previous school name / గత స్కూల్ పేరు','text',160)+input('previous_city','Previous school city / గత స్కూల్ నగరం');}
if(step===3)area.innerHTML=input('name','Parent / guardian name / తల్లిదండ్రుల పేరు')+input('mobile','Mobile / మొబైల్','tel',20)+input('city','Your city / మీ నగరం');
if(step===4){const rows={...data};delete rows.previous;area.innerHTML='<h3>Review your enquiry / వివరాలు సరిచూడండి</h3><dl>'+Object.entries(rows).map(([k,v])=>`<dt>${escape(k.replaceAll('_',' '))}</dt><dd>${escape(v)}</dd>`).join('')+Object.entries(data.previous||{}).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+'</dl><label><input type="checkbox" name="consent" required> I agree that Neo School India may store these details and contact me about admission. / ఈ వివరాలను నమోదు చేసి అడ్మిషన్ గురించి సంప్రదించడానికి అంగీకరిస్తున్నాను.</label><p>This is an enquiry, not admission confirmation. / ఇది enquiry మాత్రమే.</p>';}
}
function hasSchool(){return levels().some(l=>data.previous?.[l]!=='Not attended');}
start.onclick=()=>{if(!dialog.open){dialog.showModal();render();}};
dialog.querySelector('#intakeClose').onclick=()=>{if(!pending)dialog.close();};dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
back.onclick=()=>{step--;if(step===2&&!hasSchool())step--;render();};
form.onsubmit=async e=>{e.preventDefault();if(pending||!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));
if(step===0){Object.assign(data,values);data.program=classify();data.previous={};}
if(step===1){data.previous=values;delete data.previous.consent;}
if(step===2||step===3)Object.assign(data,values);
if(step<4){step++;if(step===2&&!hasSchool()){delete data.previous_school;delete data.previous_city;step++;}render();return;}
pending=true;next.disabled=true;back.disabled=true;error.textContent='Saving / నమోదు జరుగుతోంది…';
try{const r=await fetch('https://neo-lead-crm-api.umakanthgilla.workers.dev/api/admission-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,consent:values.consent==='on'})});const result=await r.json();if(!r.ok||result.success!==true||!result.lead_id)throw Error(result.error||'Submission could not be confirmed.');area.textContent='Enquiry saved / నమోదు అయింది. Enquiry ID: '+result.lead_id;error.textContent='Neo team will review your details. / Neo team మీ వివరాలను సమీక్షిస్తుంది.';next.hidden=true;back.hidden=true;start.disabled=true;form.reset();data={};}
catch(err){error.textContent=err.message||'Could not confirm submission. Contact Neo before retrying.';}
finally{pending=false;next.disabled=false;back.disabled=false;}
};render();
})();

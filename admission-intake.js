(()=>{
const host=document.getElementById('askNeoPanel');if(!host)return;
const start=document.createElement('button');start.type='button';start.textContent='Admission enquiry';start.style.cssText='align-self:flex-start;flex-shrink:0;margin:8px 14px;padding:8px 12px;border-radius:999px;background:#eef5ff;color:#071b52;border:1px solid #d8e5f5;font:600 13px/1.3 system-ui;cursor:pointer';host.querySelector('.askneo-head').after(start);
const dialog=document.createElement('dialog');dialog.id='neoAdmissionDialog';dialog.setAttribute('aria-labelledby','neoIntakeTitle');dialog.style.cssText='width:min(580px,92vw);max-height:85vh;overflow:auto;border:1px solid #dce4f5;border-radius:18px;padding:24px;color:#071b52';
dialog.innerHTML=`<form id="neoIntake"><button type="button" id="intakeClose" class="intake-close">Close</button><h2 id="neoIntakeTitle">Admission enquiry</h2><p>Tell us a little about your child. Our admissions team will help with the next steps.</p><section id="intakeStep"></section><p id="intakeError" role="alert"></p><button type="button" id="intakeBack">Back</button> <button id="intakeNext">Next</button></form>`;document.body.appendChild(dialog);
const style=document.createElement('style');style.textContent=`
#neoAdmissionDialog{box-sizing:border-box!important;width:min(540px,calc(100vw - 28px))!important;max-height:88dvh!important;padding:24px!important;font:15px/1.5 Inter,system-ui,sans-serif!important;background:#fff;box-shadow:0 24px 90px #071b5233}
#neoAdmissionDialog::backdrop{background:rgba(7,27,82,.5)}
#neoAdmissionDialog *{box-sizing:border-box}
#neoAdmissionDialog h2{font-size:26px!important;line-height:1.2!important;margin:12px 0!important;clear:both}
#neoAdmissionDialog h3{font-size:19px!important;margin:16px 0!important}
#neoAdmissionDialog p{font-size:14px!important;line-height:1.55!important;margin:12px 0!important;color:#53627c}
#neoAdmissionDialog label{font-size:14px!important;font-weight:600}
#neoAdmissionDialog input:not([type=checkbox]),#neoAdmissionDialog select{font:16px/1.4 system-ui!important;border:1px solid #d9e2ee;border-radius:10px;background:white;color:#071b52;min-height:44px}
#neoAdmissionDialog button{font:600 14px/1.2 system-ui;min-height:44px;border:1px solid #d9e2ee;border-radius:10px;padding:11px 18px;background:#f1f5fb;color:#071b52;cursor:pointer}
#neoAdmissionDialog #intakeNext{background:#071b52;color:white;float:right}
#neoAdmissionDialog .intake-close{float:right;background:white;min-height:36px;padding:8px 12px}
#neoAdmissionDialog dl{margin:16px 0;padding:14px;background:#f6f8fc;border-radius:12px}
#neoAdmissionDialog dt{font-size:12px;color:#65728b;margin-top:10px}
#neoAdmissionDialog dd{font-size:15px;margin:2px 0 8px;overflow-wrap:anywhere}
#neoAdmissionDialog input[type=checkbox]{width:18px;height:18px;vertical-align:middle;margin-right:7px;accent-color:#071b52}
#neoAdmissionDialog button:disabled{opacity:.55;cursor:wait}
#neoAdmissionDialog [hidden]{display:none!important}
#neoAdmissionDialog :focus-visible{outline:3px solid #118be8;outline-offset:2px}
`;document.head.appendChild(style);
const form=dialog.querySelector('form'),area=dialog.querySelector('#intakeStep'),error=dialog.querySelector('#intakeError'),next=dialog.querySelector('#intakeNext'),back=dialog.querySelector('#intakeBack');let step=0,data={},pending=false;
const labels={child_name:'Child name',dob:'Date of birth',academic_year:'Academic year',program:'Suggested class',previous_school:'Previous school',previous_city:'Previous school city',name:'Parent or guardian',mobile:'Mobile number',city:'City'};
const translations={
'Admission enquiry':'అడ్మిషన్ విచారణ','Close':'మూసివేయి','Tell us a little about your child. Our admissions team will help with the next steps.':'మీ పిల్లల వివరాలు తెలియజేయండి. తదుపరి దశల్లో మా అడ్మిషన్ బృందం సహాయం చేస్తుంది.',
'Back':'వెనుకకు','Next':'తదుపరి','Submit enquiry':'వివరాలు పంపండి','Child name':'పిల్లల పేరు','Date of birth':'పుట్టిన తేదీ','Academic year':'విద్యా సంవత్సరం','Our team will confirm class eligibility against the school opening date.':'స్కూల్ ప్రారంభ తేదీ ప్రకారం మా బృందం తరగతి అర్హతను నిర్ధారిస్తుంది.','Head-office age review required':'ప్రధాన కార్యాలయం వయసు అర్హతను పరిశీలించాలి','Select':'ఎంచుకోండి','Completed':'పూర్తయింది','Currently studying':'ప్రస్తుతం చదువుతున్నారు','Not attended':'చదవలేదు','Fresh Nursery admission':'కొత్త నర్సరీ అడ్మిషన్','Previous school name':'గత స్కూల్ పేరు','Previous school city':'గత స్కూల్ నగరం','Parent or guardian name':'తల్లిదండ్రుల లేదా సంరక్షకుల పేరు','Mobile number':'మొబైల్ నంబర్','Your city':'మీ నగరం','Review your enquiry':'మీ వివరాలను సరిచూడండి','I agree that Neo School India may store these details and contact me about admission.':'ఈ వివరాలను నమోదు చేసి అడ్మిషన్ గురించి నన్ను సంప్రదించడానికి Neo School Indiaకు సమ్మతిస్తున్నాను.','Our team will contact you to discuss admission.':'అడ్మిషన్ గురించి మా బృందం మిమ్మల్ని సంప్రదిస్తుంది.','Our admissions team will review your details and contact you.':'మా అడ్మిషన్ బృందం మీ వివరాలను పరిశీలించి మిమ్మల్ని సంప్రదిస్తుంది.','Suggested class':'సూచించిన తరగతి','Previous school':'గత స్కూల్','Parent or guardian':'తల్లిదండ్రులు లేదా సంరక్షకులు','City':'నగరం','Nursery — previous study':'నర్సరీ — గత చదువు','LKG — previous study':'LKG — గత చదువు'};
let language='en';
const languagePicker=document.createElement('select');languagePicker.setAttribute('aria-label','Form language');languagePicker.style.cssText='width:130px;padding:7px;margin-bottom:8px';languagePicker.innerHTML='<option value="en">English</option><option value="te">తెలుగు</option>';form.insertBefore(languagePicker,form.firstChild);
const reverse=Object.fromEntries(Object.entries(translations).map(([k,v])=>[v,k]));
function translate(){dialog.lang=language;const walk=document.createTreeWalker(form,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode()){if(node.parentElement.closest('select[aria-label="Form language"], dd'))continue;const raw=node.textContent.trim(),english=reverse[raw]||raw;if(translations[english])node.textContent=language==='te'?translations[english]:english;}}
languagePicker.onchange=()=>{language=languagePicker.value;if(step===0||step===2||step===3)Object.assign(data,Object.fromEntries(new FormData(form)));if(step===1)data.previous=Object.fromEntries(new FormData(form));if(!next.hidden)render();translate();};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function input(key,label,type='text',max=120){return `<label style="display:block;margin:12px 0">${label}<input name="${key}" type="${type}" maxlength="${max}" required value="${escape(data[key])}" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label>`;}
function classify(){const d=new Date(data.dob+'T00:00:00Z'),y=+data.academic_year;const months=day=>(y-d.getUTCFullYear())*12+6-d.getUTCMonth()-(day<d.getUTCDate()?1:0);const band=m=>m<32?'Review':m<44?'Nursery':m<56?'LKG':m<72?'UKG':'Review';return band(months(1))===band(months(31))?band(months(1)):'Review';}
function levels(){return data.program==='Nursery'?[]:data.program==='LKG'?['Nursery']:['Nursery','LKG'];}
function render(){dialog.scrollTop=0;error.textContent='';back.hidden=step===0;next.textContent=step===4?'Submit enquiry':'Next';
if(step===0){const y=new Date().getFullYear();area.innerHTML=input('child_name','Child name')+input('dob','Date of birth','date',10)+`<label>Academic year<select name="academic_year" required style="display:block;padding:10px;width:100%">${Array.from({length:4},(_,i)=>`<option value="${y+i}" ${data.academic_year==y+i?'selected':''}>${y+i}–${y+i+1}</option>`).join('')}</select></label>`;area.querySelector('[name=dob]').max=new Date().toISOString().slice(0,10);}
if(step===1){area.innerHTML=`<p><b>${data.program==='Review'?'Head-office age review required':escape(data.program)}</b></p><p>Our team will confirm class eligibility against the school opening date.</p>`+levels().map(l=>`<label style="display:block;margin:12px 0">${l} — previous study<select required name="${l}" style="display:block;padding:10px;width:100%"><option value="">Select</option>${['Completed','Currently studying','Not attended'].map((v,i)=>`<option ${data.previous?.[l]===v?'selected':''} value="${v}">${v}</option>`).join('')}</select></label>`).join('');if(!levels().length)area.innerHTML+='<p>Fresh Nursery admission</p>';}
if(step===2){area.innerHTML=input('previous_school','Previous school name','text',160)+input('previous_city','Previous school city');}
if(step===3)area.innerHTML=input('name','Parent or guardian name')+input('mobile','Mobile number','tel',20)+input('city','Your city');
if(step===4){const rows={...data};delete rows.previous;area.innerHTML='<h3>Review your enquiry</h3><dl>'+Object.entries(rows).map(([k,v])=>`<dt>${escape(labels[k]||k)}</dt><dd>${escape(k==='academic_year'?v+'–'+(+v+1):k==='dob'?new Date(v+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):v)}</dd>`).join('')+Object.entries(data.previous||{}).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+'</dl><label><input type="checkbox" name="consent" required> I agree that Neo School India may store these details and contact me about admission.</label><p>Our team will contact you to discuss admission.</p>';}
translate();
}
function hasSchool(){return levels().some(l=>data.previous?.[l]!=='Not attended');}
start.onclick=()=>{if(!dialog.open){dialog.showModal();render();}};
dialog.querySelector('#intakeClose').onclick=()=>{if(!pending)dialog.close();};dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
back.onclick=()=>{if(step===2||step===3)Object.assign(data,Object.fromEntries(new FormData(form)));step--;if(step===2&&!hasSchool())step--;render();};
form.onsubmit=async e=>{e.preventDefault();if(pending||!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));
if(step===0){Object.assign(data,values);data.program=classify();data.previous={};}
if(step===1){data.previous=values;delete data.previous.consent;}
if(step===2||step===3)Object.assign(data,values);
if(step<4){step++;if(step===2&&!hasSchool()){delete data.previous_school;delete data.previous_city;step++;}render();return;}
pending=true;next.disabled=true;back.disabled=true;languagePicker.disabled=true;error.textContent=language==='te'?'మీ వివరాలు నమోదవుతున్నాయి…':'Saving your enquiry…';
try{const r=await fetch('https://neo-lead-crm-api.umakanthgilla.workers.dev/api/admission-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,consent:values.consent==='on'})});const result=await r.json();if(!r.ok||result.success!==true||!result.lead_id)throw Error(result.error||'Submission could not be confirmed.');area.textContent=(language==='te'?'ధన్యవాదాలు. మీ విచారణ సంఖ్య: ':'Thank you. Your enquiry reference is: ')+result.lead_id;error.textContent='Our admissions team will review your details and contact you.';next.hidden=true;back.hidden=true;start.disabled=true;data={};translate();}
catch(err){error.textContent=err.message||'Could not confirm submission. Contact Neo before retrying.';}
finally{pending=false;next.disabled=false;back.disabled=false;languagePicker.disabled=false;}
};render();
})();

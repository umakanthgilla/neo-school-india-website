(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
window.neoPrintTC=function(tc){
 if(!tc?.certificate_no)return false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const origin=location.origin,logo=origin+'/neo-top-logo.jpeg';
 const dobWords=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return '';const d=new Date(v+'T00:00:00');if(Number.isNaN(d.getTime()))return '';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d)};
 const details=[
  ['1. Name of the Student',tc.student_name],
  ["2. Father's / Mother's Name",tc.parent_name],
  ['3. Nationality, Religion, Caste',tc.nationality_religion_caste||'—'],
  ['4. Date of Birth (figures)',tc.dob],
  ['   Date of Birth (words)',dobWords(tc.dob)||'—'],
  ['5. Date of Admission & Class',(tc.admission_date||'—')+', '+(tc.admission_class||tc.program||'—')],
  ['6. Class in which last studied',tc.classroom_name||tc.program||'—'],
  ['7. Result of last examination',tc.last_result||'—'],
  ['8. Subjects studied',tc.subjects||'—'],
  ['9. Whether qualified for promotion',(tc.qualified_for_promotion||'—')+(tc.promotion_to_class?' · to '+tc.promotion_to_class:'')],
  ['10. Fees paid up to',tc.fees_paid_upto||'—'],
  ['11. Any fee concession availed',tc.fee_concession||'No'],
  ['12. Total working days / Present',(tc.working_days??'—')+' / '+(tc.present_days??'—')],
  ['13. Date of leaving the school',tc.withdrawal_date||'—'],
  ['14. Reason for leaving',tc.reason||'—'],
  ['15. General conduct',tc.conduct||'Good'],
  ['16. Remarks',tc.remarks||'—']
 ];
 const rows=details.map(([a,b])=>'<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('');
 const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(tc.certificate_no)+'</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;width:210mm;height:297mm;font-family:Arial,Helvetica,sans-serif;color:#1b2f4d}.sheet{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff}.top{height:7px;background:linear-gradient(90deg,#156dca,#12a6d6,#2eb678,#f0ca22,#ff8d1e,#ed1676)}header{text-align:center;padding:10mm 18mm 5mm;position:relative;z-index:2}header img{width:50mm}.meta{margin:0 18mm;padding:3mm 0;border-top:1px solid #dfe7f0;border-bottom:1px solid #dfe7f0;display:grid;grid-template-columns:1fr 1fr;gap:7px 20px;font-size:10px;position:relative;z-index:2}.content{padding:7mm 18mm 36mm;position:relative;z-index:2}.content h1{text-align:center;color:#12376b;font-size:19px;letter-spacing:.05em;margin:0 0 6mm}.content table{width:100%;border-collapse:collapse;font-size:10.6px}.content th,.content td{padding:5.5px 7px;border-bottom:1px solid #e6edf5;text-align:left;vertical-align:top}.content th{width:43%;color:#12376b;background:#f8fbff}.signgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;margin-top:22px}.signgrid div{text-align:center;padding-top:18px;border-top:1px solid #8fa3bb;font-size:9.8px;color:#43556f}.principal{margin-top:24px;display:flex;justify-content:flex-end}.principal div{width:38%;text-align:center;padding-top:22px;border-top:1px solid #8fa3bb;font-size:10px}.watermark{position:absolute;width:118mm;left:50%;top:54%;transform:translate(-50%,-50%);opacity:.035;z-index:1}.wave{position:absolute;left:-8%;right:-6%;bottom:8mm;height:22mm;border-radius:55% 45% 0 0/65% 40% 0 0;background:linear-gradient(90deg,#156dca,#12a6d6,#2eb678,#f0ca22,#ff8d1e,#ff3f4e,#ed1676);z-index:1}.line{position:absolute;left:9%;right:7%;bottom:5.5mm;height:2px;background:linear-gradient(90deg,#156dca,#12a6d6,#2eb678,#f0ca22,#ff8d1e,#ed1676);z-index:2}.foot{position:absolute;bottom:1.8mm;left:0;right:0;text-align:center;font-size:7.8px;color:#6d7b90;z-index:3}@media print{html,body{width:210mm;height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><main class="sheet"><div class="top"></div><img class="watermark" src="'+logo+'"><header><img src="'+logo+'"><div style="font-weight:800;color:#12376b;margin-top:4px">'+esc(tc.school_name||'Neo School India')+'</div><div style="font-size:10px;color:#6d7b90">'+esc(tc.school_city||'')+'</div></header><div class="meta"><span><b>TC No.:</b> '+esc(tc.certificate_no)+'</span><span><b>Admission No.:</b> '+esc(tc.admission_no||'—')+'</span><span><b>Date of Issue:</b> '+esc(tc.issued_on||'—')+'</span><span><b>Academic Year:</b> '+esc(tc.academic_year||'—')+'</span></div><main class="content"><h1>TRANSFER CERTIFICATE</h1><table>'+rows+'</table><div class="signgrid"><div>Prepared by</div><div>Checked by</div><div>Office Seal</div></div><div class="principal"><div><strong>Principal</strong><br>Authorised Signature<br>School Seal</div></div></main><div class="wave"></div><div class="line"></div><div class="foot"><b>Neo School India</b> · Official Transfer Certificate</div></main></body></html>';
 const win=window.open('','_blank');if(!win)return false;win.document.write(html);win.document.close();const imgs=[...win.document.images];let left=imgs.length;const go=()=>setTimeout(()=>win.print(),120);if(!left)go();else imgs.forEach(img=>{if(img.complete){if(--left===0)go()}else img.onload=img.onerror=()=>{if(--left===0)go()}});return true;
};})();

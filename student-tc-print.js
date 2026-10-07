(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
window.neoPrintTC=function(tc){
 if(!tc?.certificate_no)return false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const dobWords=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return '';const d=new Date(v+'T00:00:00');if(Number.isNaN(d.getTime()))return '';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d)};
 const details=[
  ['1. Name of the Student',tc.student_name],["2. Father's / Mother's Name",tc.parent_name],['3. Nationality, Religion, Caste',tc.nationality_religion_caste||'—'],['4. Date of Birth (figures)',tc.dob],['   Date of Birth (words)',dobWords(tc.dob)||'—'],['5. Date of Admission & Class',(tc.admission_date||'—')+', '+(tc.admission_class||tc.program||'—')],['6. Class in which last studied',tc.classroom_name||tc.program||'—'],['7. Result of last examination',tc.last_result||'—'],['8. Subjects studied',tc.subjects||'—'],['9. Whether qualified for promotion',(tc.qualified_for_promotion||'—')+(tc.promotion_to_class?' · to '+tc.promotion_to_class:'')],['10. Fees paid up to',tc.fees_paid_upto||'—'],['11. Any fee concession availed',tc.fee_concession||'No'],['12. Total working days / Present',(tc.working_days??'—')+' / '+(tc.present_days??'—')],['13. Date of leaving the school',tc.withdrawal_date||'—'],['14. Reason for leaving',tc.reason||'—'],['15. General conduct',tc.conduct||'Good'],['16. Remarks',tc.remarks||'—']
 ];
 const body='<table>'+details.map(([a,b])=>'<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('')+'</table><div class="sign-grid"><div>Prepared by</div><div>Checked by</div></div>';
 if(typeof window.neoOfficialPrintDocument!=='function')return false;
 window.neoOfficialPrintDocument({title:'Transfer Certificate',schoolName:tc.school_name||'Neo School India',city:tc.school_city||'',ref:tc.certificate_no,date:tc.issued_on||'',body,signatureHtml:'<div class="sign-one"><strong>Principal</strong><br>Authorised Signature<br>School Seal</div>',footerLabel:'Official Transfer Certificate',extraCss:'.content{padding-top:5mm}.content h1{margin-bottom:5mm}.content table{font-size:9.9px}.content th,.content td{padding:4.6px 6px}.sign-wrap{margin-top:18px}'});
 return true;
};})();

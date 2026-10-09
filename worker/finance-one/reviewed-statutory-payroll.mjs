/**
 * Reviewed statutory payroll breakdown (PF/ESI/PT/TDS) for staged accounting.
 * This does NOT compute statutory rates or claim legal compliance.
 * Values must originate from the original payroll and be certified independently.
 */
const FIELDS=Object.freeze([
 'employee_pf_paise','employee_esi_paise','professional_tax_paise','tds_paise',
 'employer_pf_paise','employer_esi_paise'
]);
const SOURCE=Object.freeze([
 'staff_id','month','gross_paise','late_deduction_paise','attendance_deduction_paise',
 'advance_recovery_paise','deductions_paise','net_paise',...FIELDS
]);
export const STATUTORY_FIELDS=FIELDS;
const positiveOrZero=x=>Number.isSafeInteger(x)&&x>=0;
function total(values){
 let sum=0;
 for(const v of values){sum+=v;if(!Number.isSafeInteger(sum))throw Error('Statutory deduction total overflow');}
 return sum;
}
export function statutoryAmounts(payroll){
 if(!payroll||typeof payroll!=='object')throw Error('Payroll source required');
 const fields=Object.fromEntries(FIELDS.map(k=>{
  const amount=payroll[k]===undefined?0:payroll[k];
  if(!positiveOrZero(amount))throw Error('Invalid statutory payroll amount: '+k);
  return [k,amount];
 }));
 return Object.freeze({
  ...fields,
  employeeTotalPaise:total(FIELDS.slice(0,4).map(k=>fields[k])),
  employerTotalPaise:total(FIELDS.slice(4).map(k=>fields[k]))
 });
}
export async function payrollStatutoryFingerprint(payroll){
 const stat=statutoryAmounts(payroll);
 const signature=JSON.stringify(SOURCE.map(k=>FIELDS.includes(k)?stat[k]:payroll[k]));
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function requireReviewedStatutoryPayroll(db,organizationId,schoolId,payrollRecordId,payroll){
 const stat=statutoryAmounts(payroll);
 const ref=payroll?.statutory_review_id;
 const hasValues=stat.employeeTotalPaise>0||stat.employerTotalPaise>0;
 if(!hasValues && ref===undefined)return Object.freeze({...stat,fingerprint:null,reviewed:false});
 if(typeof ref!=='string'||ref.trim().length<3)throw Error('Statutory review required for payroll withholding');
 const fingerprint=await payrollStatutoryFingerprint(payroll);
 const review=await db.prepare(`SELECT payroll_month,policy_reference,source_fingerprint,reviewed_by,reviewed_at,status,
   employee_pf_paise,employee_esi_paise,professional_tax_paise,tds_paise,
   employer_pf_paise,employer_esi_paise
   FROM neo_fin_payroll_statutory_reviews
   WHERE organization_id=? AND school_id=? AND payroll_record_id=?`)
   .bind(organizationId,schoolId,payrollRecordId).first();
 if(!review||review.status!=='approved'||review.policy_reference!==ref||
    review.payroll_month!==payroll.month||review.source_fingerprint!==fingerprint||
    typeof review.reviewed_by!=='string'||!review.reviewed_by.trim()||
    typeof review.reviewed_at!=='string'||!Number.isFinite(Date.parse(review.reviewed_at))||
    FIELDS.some(k=>review[k]!==stat[k]))throw Error('Statutory payroll approval or amounts mismatch');
 return Object.freeze({...stat,fingerprint,reviewed:true,policyReference:review.policy_reference});
}

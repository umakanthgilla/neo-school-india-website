import {requireReviewedStatutoryPayroll} from './reviewed-statutory-payroll.mjs';
/**
 * Staging-only evidence verifier for LEGACY payroll/vendor/advance payouts.
 *
 * Legacy Paid/Released and existing school Daily Ledger entries are NOT proof
 * of bank settlement. Only a separate approved Finance payment document with
 * verified bank settlement, plus the correct original voucher and ledger,
 * can produce an accounting cash mirror.
 *
 * Source id contract: <school_id>|<legacy_record_id>, both validated here.
 */
const TYPES=Object.freeze({
  vendor_payment:{kind:'vendor_payments',voucherPrefix:'VENDOR_',ledgerPrefix:'FIN_VENDOR_',voucherKind:'vendor_payment',amountKey:'amount_paise',allowed:['Paid']},
  payroll_payment:{kind:'payroll',voucherPrefix:'PAY_',ledgerPrefix:'FIN_PAY_',voucherKind:'payroll',amountKey:'net_paise',allowed:['Paid']},
  salary_advance_release:{kind:'salary_advances',voucherPrefix:'ADV_',ledgerPrefix:'FIN_ADV_',voucherKind:'salary_advance',amountKey:'amount_paise',allowed:['Released','Partially Recovered','Recovered']}
});
const idPattern=/^[A-Za-z0-9_-]{1,100}$/;
const parse=(str)=>{if(typeof str!=='string')return null;const parts=str.split('|');return parts.length===2&&parts.every(x=>idPattern.test(x))?parts:null;};
const amount=n=>Number.isSafeInteger(n)&&n>0;
async function record(db,schoolId,kind,id) {
 const row=await db.prepare('SELECT data FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?').bind(schoolId,kind,id).first();
 if(!row?.data)return null;
 try{return JSON.parse(row.data);}catch{return null;}
}
export async function verifyLegacyPayout(db,request) {
 const {organizationId,sourceKind,sourceId,sourceEventId}=request||{};
 const spec=Object.prototype.hasOwnProperty.call(TYPES,sourceKind)?TYPES[sourceKind]:null;
 const ids=parse(sourceId);
 if(!db?.prepare ||!spec ||!ids||!idPattern.test(organizationId||'')||!idPattern.test(sourceEventId||''))return null;
 const [schoolId,recordId]=ids;
 const payment=await record(db,schoolId,spec.kind,recordId);
 if(!payment||!spec.allowed.includes(payment.status)||!amount(payment[spec.amountKey]))return null;
 const payout=await db.prepare(`SELECT s.organization_id,s.id AS verification_id,s.document_id,
     s.amount_paise,s.bank_reference,s.verified_at,s.status,
     d.source_kind,d.source_id,d.document_type,d.status AS document_status,d.gross_paise
   FROM neo_fin_payment_settlements s
   JOIN neo_fin_documents d ON d.organization_id=s.organization_id AND d.id=s.document_id
   JOIN neo_fin_school_ownership o ON o.school_id=? AND o.organization_id=s.organization_id
     AND o.effective_to IS NULL AND date(s.verified_at)>=date(o.effective_from)
   WHERE s.organization_id=? AND s.id=? AND d.source_kind=? AND d.source_id=?
     AND s.status='verified' AND d.status='approved' AND d.document_type='payment'
   LIMIT 1`).bind(schoolId,organizationId,sourceEventId,sourceKind,sourceId).first();
 if(!payout||payout.organization_id!==organizationId||payout.verification_id!==sourceEventId||
   payout.source_id!==sourceId||payout.source_kind!==sourceKind||
   !amount(payout.amount_paise)||payout.amount_paise!==payment[spec.amountKey]||
   payout.gross_paise!==payment[spec.amountKey] ||
   typeof payout.bank_reference!=='string'||!payout.bank_reference.trim())return null;
 const settled=new Date(payout.verified_at);
 if(!Number.isFinite(settled.getTime()))return null;
 // Legacy financial workflows create one unique voucher per payment and a
 // deterministic corresponding school Daily Ledger entry.
 const voucherId=spec.voucherPrefix+recordId;
 const voucher=await record(db,schoolId,'vouchers',voucherId);
 if(!voucher||voucher.status!=='Paid'||voucher.source_kind!==spec.voucherKind||
   voucher.source_id!==recordId||voucher.amount_paise!==payment[spec.amountKey]||
   typeof voucher.voucher_no!=='string'||!voucher.voucher_no.trim()||
   (voucher.payment_mode==='Cash' || voucher.payment_mode==='Cheque'))return null;
 const entries=await db.prepare(`SELECT id,data FROM neo_portal_records
   WHERE school_id=? AND kind='daily_accounts'
     AND json_extract(data,'$.source_kind')='voucher'
     AND json_extract(data,'$.source_id')=? LIMIT 2`).bind(schoolId,voucherId).all();
 if(!entries?.results||entries.results.length!==1 ||
   entries.results[0].id!==spec.ledgerPrefix+recordId)return null;
 let ledger;
 try{ledger=JSON.parse(entries.results[0].data);}catch{return null;}
 if(ledger.direction!=='OUT'||ledger.status!=='Posted'||
   ledger.source_kind!=='voucher'||ledger.source_id!==voucherId||
   ledger.amount_paise!==payment[spec.amountKey]||ledger.reference!==voucher.voucher_no)return null;
 // A Paid payroll row and its voucher must not debit Salary Payable unless
 // the matching approved payroll has ALREADY recognized net payable and
 // advance recovery in a balanced posted accrual journal.
 if(sourceKind==='payroll_payment'){
  const parts=['gross_paise','late_deduction_paise','attendance_deduction_paise',
   'advance_recovery_paise','deductions_paise','net_paise'];
  if(parts.some(k=>!Number.isSafeInteger(payment[k])||payment[k]<0))return null;
  let statutory;
  try{statutory=await requireReviewedStatutoryPayroll(db,organizationId,schoolId,recordId,payment);}
  catch{return null;}
  const deductions=payment.late_deduction_paise+payment.attendance_deduction_paise+
    payment.advance_recovery_paise+statutory.employeeTotalPaise;
  const earned=payment.gross_paise-payment.late_deduction_paise-payment.attendance_deduction_paise;
  const payable=earned-statutory.employeeTotalPaise;
  if(!Number.isSafeInteger(deductions)||deductions!==payment.deductions_paise||
    !Number.isSafeInteger(earned)||earned<=0||!Number.isSafeInteger(payable)||payable<0||
    payment.net_paise+payment.advance_recovery_paise!==payable)return null;
  const breakdown=['gross_paise','late_deduction_paise','attendance_deduction_paise',
   'advance_recovery_paise','deductions_paise','net_paise'].map(k=>payment[k]).join(':');
  const accrualRef=schoolId.length+':'+schoolId+'|'+recordId.length+':'+recordId+'|'+breakdown+
    (statutory.fingerprint?'|ST:'+statutory.fingerprint:'');
  const accrual=await db.prepare(`SELECT d.gross_paise AS earned_paise,
   COUNT(l.line_no) AS line_count,
   SUM(l.debit_paise-l.credit_paise) AS balanced_paise,
   SUM(CASE WHEN a.account_code='5100' THEN l.debit_paise-l.credit_paise ELSE 0 END) AS expense_paise,
   SUM(CASE WHEN a.account_code='2100' THEN l.credit_paise-l.debit_paise ELSE 0 END) AS salary_payable_paise,
   SUM(CASE WHEN a.account_code='1200' THEN l.credit_paise-l.debit_paise ELSE 0 END) AS advance_recovery_paise,
   SUM(CASE WHEN a.account_code='5300' THEN l.debit_paise-l.credit_paise ELSE 0 END) AS employer_expense_paise,
   SUM(CASE WHEN a.account_code='2111' THEN l.credit_paise-l.debit_paise ELSE 0 END) AS pf_paise,
   SUM(CASE WHEN a.account_code='2112' THEN l.credit_paise-l.debit_paise ELSE 0 END) AS esi_paise,
   SUM(CASE WHEN a.account_code='2113' THEN l.credit_paise-l.debit_paise ELSE 0 END) AS pt_paise,
   SUM(CASE WHEN a.account_code='2114' THEN l.credit_paise-l.debit_paise ELSE 0 END) AS tds_paise
   FROM neo_fin_documents d JOIN neo_fin_journals j ON
    j.organization_id=d.organization_id AND j.source_kind='document' AND j.source_id=d.id AND j.status='posted'
   JOIN neo_fin_journal_lines l ON l.organization_id=j.organization_id AND l.journal_id=j.id
   JOIN neo_fin_accounts a ON a.organization_id=l.organization_id AND a.id=l.account_id
   WHERE d.organization_id=? AND d.source_kind='legacy_payroll' AND d.source_id=?
    AND d.document_type='payroll_liability' AND d.status='approved'
   GROUP BY d.id,d.gross_paise`).bind(organizationId,accrualRef).first();
  const expectedLines=1+(payable>0?1:0)+
   ['employee_pf_paise','employee_esi_paise','professional_tax_paise','tds_paise',
    'employer_pf_paise','employer_esi_paise'].filter(k=>statutory[k]>0).length+
   (statutory.employerTotalPaise>0?1:0);
  if(!accrual||accrual.earned_paise!==earned||accrual.expense_paise!==earned||
    accrual.salary_payable_paise!==payable||accrual.advance_recovery_paise!==0||
    accrual.employer_expense_paise!==statutory.employerTotalPaise||
    accrual.pf_paise!==statutory.employee_pf_paise+statutory.employer_pf_paise||
    accrual.esi_paise!==statutory.employee_esi_paise+statutory.employer_esi_paise||
    accrual.pt_paise!==statutory.professional_tax_paise||
    accrual.tds_paise!==statutory.tds_paise||
    accrual.balanced_paise!==0||accrual.line_count!==expectedLines)return null;
 }
 // One *full* independently verified settlement for each legacy payout.
 // The schema's separate trigger rejects a second verified settlement for
 // these school-qualified documents even during concurrent requests.
 const n=await db.prepare(`SELECT COUNT(*) AS n FROM neo_fin_payment_settlements
   WHERE organization_id=? AND document_id=? AND status='verified'`)
   .bind(organizationId,payout.document_id).first();
 if(n?.n!==1)return null;
 return Object.freeze({organizationId,sourceKind,sourceId,sourceEventId,
   amountPaise:payout.amount_paise,verificationReference:payout.bank_reference,
   effectiveAt:settled.toISOString()});
}

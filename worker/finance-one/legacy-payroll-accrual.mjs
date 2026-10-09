/**
 * STAGING ONLY — legacy employee payroll accrual to independent Finance journals.
 * Source: existing Neo School payroll after APPROVAL (not cash payment).
 * Gross -> late/attendance loss of pay + advance recovery + actual net salary.
 * Dr earned salary expense; Cr earned salary payable. Advance recovery offsets
 * salary payable only upon independently verified payroll settlement.
 * No statutory deduction is invented, no cash event, no old Daily Ledger mutation.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {requireReviewedStatutoryPayroll} from './reviewed-statutory-payroll.mjs';

const safe = n => Number.isSafeInteger(n) && n >= 0;
const sourceId = (schoolId,payrollId) => schoolId.length+':'+schoolId+'|'+payrollId.length+':'+payrollId;
const valid = s => typeof s==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(s);

function planForPayroll(p,payrollId) {
 if(!p || !['Approved','Paid'].includes(p.status) || p.attendance_complete!==true ||
   typeof p.staff_id!=='string' || !valid(p.staff_id) ||
   typeof p.month!=='string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(p.month) ||
   payrollId!==p.staff_id+'_'+p.month ||
   !Number.isFinite(Date.parse(p.approved_at||'')))
  throw Error('Approved and attendance-complete payroll source required');
 const keys=['gross_paise','late_deduction_paise','attendance_deduction_paise',
  'advance_recovery_paise','deductions_paise','net_paise'];
 if(keys.some(k=>!safe(p[k]))||p.gross_paise===0)throw Error('Invalid payroll paise breakdown');
 // Current legacy HR payroll supports attendance, late and advance recovery.
 // Statutory deductions require separate employee/employer liability accounts.
 for(const k of ['employee_pf_paise','employee_esi_paise','tds_paise','professional_tax_paise']){
  if(p[k]!==undefined && p[k]!==0)throw Error('Unmapped statutory withholding requires reviewed payroll accounting');
 }
 const componentDeductions=p.late_deduction_paise+p.attendance_deduction_paise+p.advance_recovery_paise;
 if(!Number.isSafeInteger(componentDeductions) || componentDeductions!==p.deductions_paise ||
    p.deductions_paise>p.gross_paise || p.gross_paise-p.deductions_paise!==p.net_paise)
  throw Error('Payroll deduction or net mismatch; reconcile before accrual');
 const earned=p.gross_paise-p.late_deduction_paise-p.attendance_deduction_paise;
 if(!safe(earned)||earned===0||p.net_paise+p.advance_recovery_paise!==earned)
  throw Error('Payroll expense, advance recovery and net do not balance');
 // Legacy HR changes the employee advance balance when Payroll becomes Paid.
 // Do not recognize recovery at Approved; wait for independently verified payout.
 const entries=[{code:'5100',debit:earned,credit:0},{code:'2100',debit:0,credit:earned}];
 return Object.freeze({earnedPaise:earned,entries,approvedAt:new Date(p.approved_at).toISOString()});
}

export async function postLegacyPayrollAccrual({db,authenticatedAccountId,organizationId,schoolId,payrollRecordId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'payroll','write');
 if(!valid(schoolId)||!valid(payrollRecordId))throw Error('Original school and payroll required');
 const row=await db.prepare(`SELECT school_id FROM neo_fin_school_ownership
 WHERE school_id=? AND organization_id=? AND effective_to IS NULL
   AND date(? || '-01')>=date(effective_from) LIMIT 1`);
 const stored=await db.prepare("SELECT data FROM neo_portal_records WHERE school_id=? AND kind='payroll' AND id=?")
   .bind(schoolId,payrollRecordId).first();
 if(!stored?.data)throw Error('Original payroll source unavailable');
 let payroll;
 try{payroll=JSON.parse(stored.data)}catch{throw Error('Original payroll malformed')}
 const plan=planForPayroll(payroll,payrollRecordId);
 const owner=await row.bind(schoolId,organizationId,payroll.month).first();
 if(!owner)throw Error('Original payroll outside independent business ownership');
 const originalSourceRef=sourceId(schoolId,payrollRecordId);
 // An immutable source snapshot makes retries reject changed advance/net splits
 // even if earned salary expense is coincidentally unchanged.
 const breakdown=['gross_paise','late_deduction_paise','attendance_deduction_paise',
  'advance_recovery_paise','deductions_paise','net_paise'].map(k=>payroll[k]).join(':');
 const sourceRef=originalSourceRef+'|'+breakdown;
 const documentId='PAY_ACCR|'+originalSourceRef;
 const document=()=>db.prepare('SELECT id,document_type,status,gross_paise,source_kind,source_id FROM neo_fin_documents WHERE organization_id=? AND id=?').bind(organizationId,documentId).first();
 const checkDocument=async()=>{
  const d=await document();
  if(!d || d.document_type!=='payroll_liability'||d.status!=='approved'||d.gross_paise!==plan.earnedPaise ||
     d.source_kind!=='legacy_payroll'||d.source_id!==sourceRef)throw Error('Conflicting source payroll document; reconcile');
 };
 let documentCreated=false;
 if(!await document()){
  const res=await db.prepare(`INSERT INTO neo_fin_documents
    (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
    VALUES (?,?,'payroll_liability','approved',?,'legacy_payroll',?)
    ON CONFLICT(organization_id,id) DO NOTHING`)
    .bind(organizationId,documentId,plan.earnedPaise,sourceRef).run();
  if(res?.success!==true||!Number.isSafeInteger(res?.meta?.changes))throw Error('Payroll accrual document write not confirmed');
  documentCreated=res.meta.changes===1;
 }
 await checkDocument();
 const codes=plan.entries.map(e=>e.code);
 const accountRows=await db.prepare('SELECT id,account_code,active FROM neo_fin_accounts WHERE organization_id=? AND account_code IN (?,?,?)')
   .bind(organizationId,'5100','2100','1200').all();
 const accountIds=new Map((accountRows.results||[]).filter(x=>x.active===1).map(x=>[x.account_code,x.id]));
 const lines=plan.entries.map(e=>({...e,accountId:accountIds.get(e.code)}));
 if(lines.some(l=>!l.accountId) || new Set(lines.map(l=>l.accountId)).size!==lines.length)throw Error('Independent payroll chart accounts unavailable');
 const journalId='JNL-DOC|'+documentId;
 const existingJournal=async()=>{
  const j=await db.prepare("SELECT id,status FROM neo_fin_journals WHERE organization_id=? AND source_kind='document' AND source_id=?")
   .bind(organizationId,documentId).first();
  if(!j)return false;
  if(j.status!=='posted')throw Error('Incomplete payroll accrual journal; reconcile');
  const actual=await db.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE organization_id=? AND journal_id=? ORDER BY line_no')
    .bind(organizationId,j.id).all();
  const result=actual.results||[];
  if(result.length!==lines.length || result.some((r,i)=>r.account_id!==lines[i].accountId ||
     r.debit_paise!==lines[i].debit || r.credit_paise!==lines[i].credit))
     throw Error('Conflicting source payroll deductions or journal; reconcile');
  return true;
 };
 if(await existingJournal())return Object.freeze({organizationId,documentId,journalId,documentCreated,journalCreated:false});
 const stmts=[
  db.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES (?,?,?,?)")
    .bind(organizationId,journalId,'document',documentId),
  ...lines.map((l,i)=>db.prepare(`INSERT INTO neo_fin_journal_lines
    (organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES (?,?,?,?,?,?)`)
    .bind(organizationId,journalId,i+1,l.accountId,l.debit,l.credit)),
  db.prepare("UPDATE neo_fin_journals SET status='posted',posted_at=? WHERE organization_id=? AND id=? AND status='draft'")
    .bind(plan.approvedAt,organizationId,journalId)
 ];
 try{
  const res=await db.batch(stmts);
  if(!Array.isArray(res)||res.length!==stmts.length||res.some(x=>x?.success!==true))throw Error('Payroll accrual batch not confirmed');
  return Object.freeze({organizationId,documentId,journalId,documentCreated,journalCreated:true});
 }catch(e){
  if(await existingJournal())return Object.freeze({organizationId,documentId,journalId,documentCreated,journalCreated:false});
  throw e;
 }
}

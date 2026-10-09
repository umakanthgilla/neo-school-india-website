import {auditFinanceCashJournals} from './cash-journal-audit.mjs';
import {auditFinanceAccrualJournals} from './accrual-journal-audit.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {postLegacyPayrollAccrual} from './legacy-payroll-accrual.mjs';
import {postAccrualJournalForDocument} from './accrual-journal.mjs';
import {payrollStatutoryFingerprint} from './reviewed-statutory-payroll.mjs';
import {syncLegacyPayoutDocument} from './sync-legacy-payout-document.mjs';
import {syncVerifiedLegacyPayout} from './sync-legacy-payout.mjs';
import {recoverMissingCashJournals} from './journal-recovery.mjs';
import {postJournalForCashEvent} from './source-journal.mjs';

const migrations=[
 'finance_payroll_one_foundation.sql','finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql','finance_payroll_one_legacy_payout_integrity.sql',
 'finance_payroll_one_statutory_review.sql'
].map(n=>readFileSync(new URL('../../migrations/'+n,import.meta.url),'utf8'));

function fixture(overrides={}){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 for(const migration of migrations)sql.exec(migration);
 sql.exec(`CREATE TABLE neo_portal_records(school_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(school_id,kind,id));
 INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Independent Center','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES('A','fin:alice','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_school_ownership(school_id,organization_id,effective_from) VALUES('SCHOOL_A','A','2026-01-01');
 INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES ('A','SAL_EXP','5100','Salary Expense','expense'),('A','SAL_LIAB','2100','Net Salary Payable','liability'),
 ('A','ADV','1200','Employee Advance Receivable','asset'),('A','BANK','1000','Bank','asset'),
 ('A','PF','2111','PF Payable','liability'),('A','ESI','2112','ESI Payable','liability'),
 ('A','PT','2113','PT Payable','liability'),('A','TDS','2114','TDS Payable','liability'),
 ('A','ER_EXP','5300','Employer contributions','expense');`);
 const payroll={staff_id:'STAFF1',month:'2026-09',status:'Approved',attendance_complete:true,
  approved_at:'2026-10-02T10:00:00Z',gross_paise:100000,late_deduction_paise:5000,
  attendance_deduction_paise:10000,advance_recovery_paise:20000,deductions_paise:35000,net_paise:65000,...overrides};
 sql.prepare("INSERT INTO neo_portal_records VALUES('SCHOOL_A','payroll','STAFF1_2026-09',?)").run(JSON.stringify(payroll));
 const db={
  prepare(q){return{bind(...args){const st=sql.prepare(q);return {
   first:async()=>st.get(...args),all:async()=>({results:st.all(...args)}),
   run:async()=>{const r=st.run(...args);return{success:true,meta:{changes:r.changes}}}
  }}}},
  async batch(stmts){sql.exec('BEGIN IMMEDIATE');try{const results=[];for(const st of stmts)results.push(await st.run());sql.exec('COMMIT');return results}catch(err){sql.exec('ROLLBACK');throw err}}
 };
 const params={db,authenticatedAccountId:'fin:alice',organizationId:'A',schoolId:'SCHOOL_A',payrollRecordId:'STAFF1_2026-09'};
 return{sql,db,params,update(p){sql.prepare("UPDATE neo_portal_records SET data=? WHERE school_id='SCHOOL_A' AND kind='payroll'").run(JSON.stringify(p));}};
}
const linesOf=sql=>sql.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines ORDER BY line_no').all();
test('approved payroll accrues earned salary payable, delays advance recovery until verified payout',async()=>{
 const f=fixture();const r=await postLegacyPayrollAccrual(f.params);
 assert.equal(r.documentCreated,true);assert.equal(r.journalCreated,true);
 const journalLines=linesOf(f.sql);
 assert.deepEqual(journalLines.map(r=>[r.account_id,r.debit_paise,r.credit_paise]),
  [['SAL_EXP',85000,0],['SAL_LIAB',0,85000]]);
 const doc=f.sql.prepare("SELECT document_type,source_kind,gross_paise FROM neo_fin_documents").get();
 assert.deepEqual({...doc},{document_type:'payroll_liability',source_kind:'legacy_payroll',gross_paise:85000});
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,0);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,0);
 const retry=await postLegacyPayrollAccrual(f.params);
 assert.equal(retry.documentCreated,false);assert.equal(retry.journalCreated,false);
 f.sql.close();
});
test('payroll with zero advance recovery creates a balanced two-line journal',async()=>{
 const f=fixture({advance_recovery_paise:0,deductions_paise:15000,net_paise:85000});
 await postLegacyPayrollAccrual(f.params);
 assert.deepEqual(linesOf(f.sql).map(x=>x.account_id),['SAL_EXP','SAL_LIAB']);
 f.sql.close();
});
test('fully recovered net-zero payroll accrues against advance receivable only',async()=>{
 const f=fixture({gross_paise:20000,late_deduction_paise:0,attendance_deduction_paise:0,advance_recovery_paise:20000,deductions_paise:20000,net_paise:0});
 await postLegacyPayrollAccrual(f.params);
 assert.deepEqual(linesOf(f.sql).map(x=>x.account_id),['SAL_EXP','SAL_LIAB']);
 f.sql.close();
});
test('unapproved or unfinished attendance payroll cannot accrue',async()=>{
 for(const patch of [{status:'Draft'},{attendance_complete:false},{approved_at:null}]){
  const f=fixture(patch);
  await assert.rejects(postLegacyPayrollAccrual(f.params),/Approved and attendance-complete/);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,0);
  f.sql.close();
 }
});
test('gross and deduction mismatch fails closed, never creates accounting document',async()=>{
 for(const patch of [
  {net_paise:64000},{deductions_paise:34000},{gross_paise:9000},
  {late_deduction_paise:9007199254740991}
 ]){
  const f=fixture(patch);
  await assert.rejects(postLegacyPayrollAccrual(f.params),/Payroll deduction|Payroll expense|Invalid payroll/);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,0);
  f.sql.close();
 }
});
test('unreviewed PF/ESI statutory deduction cannot be posted',async()=>{
 const f=fixture({employee_pf_paise:1200});
 await assert.rejects(postLegacyPayrollAccrual(f.params),/Statutory review required/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_journals').get().n,0);f.sql.close();
});
test('HO finance owner cannot accrue independent center payroll',async()=>{
 const f=fixture();
 await assert.rejects(postLegacyPayrollAccrual({...f.params,authenticatedAccountId:'fin:ho'}),/Finance access denied/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,0);f.sql.close();
});
test('school payroll before its legal business ownership date is rejected',async()=>{
 const f=fixture();
 f.sql.exec("UPDATE neo_fin_school_ownership SET effective_from='2026-10-01'");
 await assert.rejects(postLegacyPayrollAccrual(f.params),/outside independent business ownership/);
 f.sql.close();
});
test('changed advance deduction split on retry is detected even when gross expense is unchanged',async()=>{
 const f=fixture();
 await postLegacyPayrollAccrual(f.params);
 f.update({staff_id:'STAFF1',month:'2026-09',status:'Paid',attendance_complete:true,approved_at:'2026-10-02T10:00:00Z',
  gross_paise:100000,late_deduction_paise:5000,attendance_deduction_paise:10000,advance_recovery_paise:10000,
  deductions_paise:25000,net_paise:75000});
 await assert.rejects(postLegacyPayrollAccrual(f.params),/Conflicting source payroll document|Conflicting source payroll deductions/);
 f.sql.close();
});
test('generic gross-based payroll posting cannot overwrite deduction-aware legacy accrual',async()=>{
 const f=fixture();const x=await postLegacyPayrollAccrual(f.params);
 await assert.rejects(postAccrualJournalForDocument(f.db,'A',x.documentId),/deduction-aware/);
 f.sql.close();
});
test('journal DB batch failure can be retried safely without creating duplicate payroll document',async()=>{
 const f=fixture();
 f.sql.exec("CREATE TRIGGER fail_post BEFORE INSERT ON neo_fin_journal_lines BEGIN SELECT RAISE(ABORT,'forced'); END");
 await assert.rejects(postLegacyPayrollAccrual(f.params),/forced/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_journals').get().n,0);
 f.sql.exec('DROP TRIGGER fail_post');
 const retry=await postLegacyPayrollAccrual(f.params);
 assert.equal(retry.documentCreated,false);assert.equal(retry.journalCreated,true);
 f.sql.close();
});

function seedLegacyPaidPayrollVoucher(f){
 const originalId='STAFF1_2026-09',voucherId='PAY_'+originalId;
 const voucher={voucher_no:'PV-2026-77',date:'2026-10-09',category:'Salary payment',paid_to:'Staff 1',
   amount_paise:65000,source_kind:'payroll',source_id:originalId,status:'Paid',payment_mode:'Other'};
 const ledger={direction:'OUT',category:'Salary payment',amount_paise:65000,
   source_kind:'voucher',source_id:voucherId,reference:voucher.voucher_no,status:'Posted'};
 const insert=f.sql.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES('SCHOOL_A',?,?,?)");
 insert.run('vouchers',voucherId,JSON.stringify(voucher));
 insert.run('daily_accounts','FIN_PAY_'+originalId,JSON.stringify(ledger));
 return originalId;
}
test('real payroll source -> deduction-aware accrual -> Finance payout doc -> verified bank -> zero net salary payable',async()=>{
 const f=fixture({status:'Paid'});
 const originalId=seedLegacyPaidPayrollVoucher(f);
 const payoutParams={...f.params,legacyRecordId:originalId,sourceKind:'payroll_payment'};
 const source=await postLegacyPayrollAccrual(f.params);
 assert.equal(source.journalCreated,true);
 const accrued=await auditFinanceAccrualJournals({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(accrued.ready,true,JSON.stringify(accrued.findings));
 const paymentDoc=await syncLegacyPayoutDocument(payoutParams);
 assert.equal(paymentDoc.created,true);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,0);
 f.sql.prepare(`INSERT INTO neo_fin_payment_settlements
   (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
   VALUES('A','BANKPAY1',?,65000,'verified','BANK-2026-77','2026-10-09T11:00:00Z')`).run(paymentDoc.documentId);
 const posted=await syncVerifiedLegacyPayout({...payoutParams,settlementId:'BANKPAY1'});
 assert.equal(posted.cashCreated,true);assert.equal(posted.journalCreated,true);
 const account=f.sql.prepare(`SELECT SUM(l.credit_paise-l.debit_paise) AS balance
 FROM neo_fin_journal_lines l WHERE l.organization_id='A' AND l.account_id='SAL_LIAB'`).get();
 assert.equal(account.balance,0);
 const recovery=f.sql.prepare(`SELECT SUM(l.credit_paise-l.debit_paise) AS recovered
  FROM neo_fin_journal_lines l WHERE l.organization_id='A' AND l.account_id='ADV'`).get();
 assert.equal(recovery.recovered,20000);
 const audit=await auditFinanceCashJournals({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(audit.ready,true,JSON.stringify(audit.findings));
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,1);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
 const retry=await syncVerifiedLegacyPayout({...payoutParams,settlementId:'BANKPAY1'});
 assert.equal(retry.cashCreated,false);assert.equal(retry.journalCreated,false);
 f.sql.close();
});
test('bank settlement cannot debit Salary Payable before source payroll accrual has posted',async()=>{
 const f=fixture({status:'Paid'});
 const originalId=seedLegacyPaidPayrollVoucher(f);
 const payoutParams={...f.params,legacyRecordId:originalId,sourceKind:'payroll_payment'};
 const paymentDoc=await syncLegacyPayoutDocument(payoutParams);
 f.sql.prepare(`INSERT INTO neo_fin_payment_settlements
   (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
   VALUES('A','BANKPAY1',?,65000,'verified','BANK-2026-77','2026-10-09T11:00:00Z')`).run(paymentDoc.documentId);
 await assert.rejects(syncVerifiedLegacyPayout({...payoutParams,settlementId:'BANKPAY1'}),/Source verification failed/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,0);
 await postLegacyPayrollAccrual(f.params);
 const posted=await syncVerifiedLegacyPayout({...payoutParams,settlementId:'BANKPAY1'});
 assert.equal(posted.cashCreated,true);
 f.sql.close();
});

test('failed advance-recovery accounting repairs from verified cash without reposting cash ledger',async()=>{
 const f=fixture({status:'Paid'});const originalId=seedLegacyPaidPayrollVoucher(f);
 await postLegacyPayrollAccrual(f.params);
 const payoutParams={...f.params,legacyRecordId:originalId,sourceKind:'payroll_payment'};
 const doc=await syncLegacyPayoutDocument(payoutParams);
 f.sql.prepare(`INSERT INTO neo_fin_payment_settlements
   (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
   VALUES('A','BANKPAY1',?,65000,'verified','BANK-2026-77','2026-10-09T11:00:00Z')`).run(doc.documentId);
 f.sql.exec("UPDATE neo_fin_accounts SET active=0 WHERE organization_id='A' AND account_code='1200'");
 await assert.rejects(syncVerifiedLegacyPayout({...payoutParams,settlementId:'BANKPAY1'}),/accounts unavailable/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,1);
 f.sql.exec("UPDATE neo_fin_accounts SET active=1 WHERE organization_id='A' AND account_code='1200'");
 const recovery=await recoverMissingCashJournals({db:f.db,organizationId:'A'});
 assert.equal(recovery.failed.length,0);assert.equal(recovery.posted.length,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,1);
 const pay=f.sql.prepare("SELECT event_id FROM neo_fin_cash_events WHERE organization_id='A'").get();
 await assert.rejects(postJournalForCashEvent(f.db,'A',pay.event_id),/Legacy payroll requires/);
 const again=await recoverMissingCashJournals({db:f.db,organizationId:'A'});
 assert.equal(again.checked,0);f.sql.close();
});


const reviewedPayroll={
 employee_pf_paise:4000,employee_esi_paise:1000,professional_tax_paise:200,
 tds_paise:1800,employer_pf_paise:3500,employer_esi_paise:1500,
 statutory_review_id:'RULES-2026-09-REVIEWED',deductions_paise:42000,net_paise:58000
};
async function seedStatutoryReview(f){
 const payroll=JSON.parse(f.sql.prepare("SELECT data FROM neo_portal_records WHERE kind='payroll'").get().data);
 const fingerprint=await payrollStatutoryFingerprint(payroll);
 f.sql.prepare(`INSERT INTO neo_fin_payroll_statutory_reviews
  (organization_id,school_id,payroll_record_id,payroll_month,policy_reference,source_fingerprint,reviewed_by,reviewed_at,status,
  employee_pf_paise,employee_esi_paise,professional_tax_paise,tds_paise,employer_pf_paise,employer_esi_paise)
 VALUES('A','SCHOOL_A','STAFF1_2026-09','2026-09',?,?, 'fin:reviewer','2026-10-02T10:00:00Z','approved',?,?,?,?,?,?)`)
 .run(payroll.statutory_review_id,fingerprint,payroll.employee_pf_paise,payroll.employee_esi_paise,
   payroll.professional_tax_paise,payroll.tds_paise,payroll.employer_pf_paise,payroll.employer_esi_paise);
}
test('reviewed statutory payroll posts 9 balanced liability lines without invented tax rates',async()=>{
 const f=fixture(reviewedPayroll);await seedStatutoryReview(f);
 await postLegacyPayrollAccrual(f.params);
 const lines=linesOf(f.sql);
 assert.deepEqual(lines.map(x=>[x.account_id,x.debit_paise,x.credit_paise]),[
  ['SAL_EXP',85000,0],['SAL_LIAB',0,78000],['PF',0,4000],['ESI',0,1000],
  ['PT',0,200],['TDS',0,1800],['ER_EXP',5000,0],['PF',0,3500],['ESI',0,1500]
 ]);
 assert.equal(lines.reduce((n,l)=>n+l.debit_paise-l.credit_paise,0),0);
 const statutoryAudit=await auditFinanceAccrualJournals({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(statutoryAudit.ready,true,JSON.stringify(statutoryAudit.findings));
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,0);
 const again=await postLegacyPayrollAccrual(f.params);
 assert.equal(again.journalCreated,false);f.sql.close();
});
test('statutory approval mismatch and altered amount fail closed without journal',async()=>{
 const f=fixture(reviewedPayroll);await seedStatutoryReview(f);
 const source=JSON.parse(f.sql.prepare("SELECT data FROM neo_portal_records WHERE kind='payroll'").get().data);
 source.employee_pf_paise=5000;
 f.update(source);
 await assert.rejects(postLegacyPayrollAccrual(f.params),/Statutory payroll approval or amounts mismatch/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_journals').get().n,0);
 assert.throws(()=>f.sql.exec("DELETE FROM neo_fin_payroll_statutory_reviews"),/immutable/);
 f.sql.close();
});
test('statutory withheld salary stays payable until a bank-verified net salary settlement',async()=>{
 const f=fixture({...reviewedPayroll,status:'Paid'});await seedStatutoryReview(f);
 const payrollId=seedLegacyPaidPayrollVoucher(f);
 f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.amount_paise',58000) WHERE kind='vouchers'");
 f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.amount_paise',58000) WHERE kind='daily_accounts'");
 await postLegacyPayrollAccrual(f.params);
 const payoutParams={...f.params,legacyRecordId:payrollId,sourceKind:'payroll_payment'};
 const payout=await syncLegacyPayoutDocument(payoutParams);
 f.sql.prepare(`INSERT INTO neo_fin_payment_settlements
 (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
 VALUES ('A','SET-STAT',?,58000,'verified','BANK-STAT','2026-10-09T12:00:00Z')`).run(payout.documentId);
 const payment=await syncVerifiedLegacyPayout({...payoutParams,settlementId:'SET-STAT'});
 assert.equal(payment.journalCreated,true);
 assert.equal(f.sql.prepare("SELECT COALESCE(SUM(credit_paise-debit_paise),0) balance FROM neo_fin_journal_lines WHERE account_id='SAL_LIAB'").get().balance,0);
 assert.equal(f.sql.prepare("SELECT SUM(credit_paise) amount FROM neo_fin_journal_lines WHERE account_id='PF'").get().amount,7500);
 assert.equal(f.sql.prepare("SELECT SUM(credit_paise) amount FROM neo_fin_journal_lines WHERE account_id='ESI'").get().amount,2500);
 assert.equal(f.sql.prepare("SELECT amount_paise FROM neo_fin_cash_events").get().amount_paise,58000);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
 f.sql.close();
});

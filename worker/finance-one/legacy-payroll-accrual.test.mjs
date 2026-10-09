import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {postLegacyPayrollAccrual} from './legacy-payroll-accrual.mjs';
import {postAccrualJournalForDocument} from './accrual-journal.mjs';

const migrations=[
 'finance_payroll_one_foundation.sql','finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql'
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
 ('A','ADV','1200','Employee Advance Receivable','asset'),('A','BANK','1000','Bank','asset');`);
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
test('approved payroll posts earned expense, net salary payable and advance recovery, with NO cash movement',async()=>{
 const f=fixture();const r=await postLegacyPayrollAccrual(f.params);
 assert.equal(r.documentCreated,true);assert.equal(r.journalCreated,true);
 const journalLines=linesOf(f.sql);
 assert.deepEqual(journalLines.map(r=>[r.account_id,r.debit_paise,r.credit_paise]),
  [['SAL_EXP',85000,0],['SAL_LIAB',0,65000],['ADV',0,20000]]);
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
 assert.deepEqual(linesOf(f.sql).map(x=>x.account_id),['SAL_EXP','ADV']);
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
test('unmapped PF/ESI statutory deduction does not silently disappear',async()=>{
 const f=fixture({employee_pf_paise:1200});
 await assert.rejects(postLegacyPayrollAccrual(f.params),/Unmapped statutory withholding/);
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
 await assert.rejects(postLegacyPayrollAccrual(f.params),/Conflicting source payroll deductions/);
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

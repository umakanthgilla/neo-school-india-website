import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {auditFinanceAccrualJournals} from './accrual-journal-audit.mjs';
const migrationNames=['finance_payroll_one_foundation.sql','finance_payroll_one_accounting_journals.sql',
 'finance_payroll_one_statutory_review.sql'];
const migrations=migrationNames.map(n=>readFileSync(new URL('../../migrations/'+n,import.meta.url),'utf8'));
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Independent Center','independent_center'),('B','Other Center','independent_center'),
 ('HO','Head Office','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('A','fin:alice','owner'),('B','fin:bob','owner'),('HO','fin:ho','owner');`);
 for(const org of ['A','B']){
  const q=sql.prepare('INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type) VALUES(?,?,?,?,?)');
  const chart=[['1100','asset'],['4000','income'],['5200','expense'],['2000','liability'],
   ['5100','expense'],['2100','liability'],['5300','expense'],['2111','liability'],['2112','liability']];
  for(const [code,type] of chart)q.run(org,org+'_'+code,code,code,type);
 }
 const document=(id,type='sales_invoice',amount=10000,status='approved',org='A',kind=null,sourceId=null)=>{
  sql.prepare(`INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise,source_kind,source_id)
  VALUES(?,?,?,?,?,?,?)`).run(org,id,type,status,amount,kind,sourceId);
 };
 const post=(id,lines,org='A',sourceId=id,posted=true)=>{
  const jid='JNL_'+id;
  sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES (?,?,'document',?)").run(org,jid,sourceId);
  const stmt=sql.prepare(`INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise)
   VALUES (?,?,?,?,?,?)`);
  for(let i=0;i<lines.length;i++){const [code,debit,credit]=lines[i];stmt.run(org,jid,i+1,org+'_'+code,debit,credit);}
  if(posted)sql.prepare("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-09' WHERE organization_id=? AND id=?").run(org,jid);
 };
 const db={prepare(sqlText){return{bind(...args){const stmt=sql.prepare(sqlText);return{
  first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)})
 }}}}};
 return {sql,document,post,db,params:{db,authenticatedAccountId:'fin:alice',organizationId:'A'}};
}
test('approved fee invoice and purchase bill have exact debit and credit without cash events',async()=>{
 const f=fixture();f.document('INV1');
 f.post('INV1',[['1100',10000,0],['4000',0,10000]]);
 f.document('BILL1','purchase_bill',3000);
 f.post('BILL1',[['5200',3000,0],['2000',0,3000]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.ready,true);assert.equal(result.documentCount,2);
 assert.equal(result.issueCount,0);f.sql.close();
});
test('approved invoice missing posted journal blocks business reconciliation',async()=>{
 const f=fixture();f.document('INV1');
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.ready,false);assert.equal(result.counts.missing_accrual_journal,1);
 f.sql.close();
});
test('invoice journal in draft blocks readiness, even if its entries balance',async()=>{
 const f=fixture();f.document('INV1');
 f.post('INV1',[['1100',10000,0],['4000',0,10000]],'A','INV1',false);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.accrual_journal_not_posted,1);f.sql.close();
});
test('balanced sales invoice journal with wrong liability contra-account fails',async()=>{
 const f=fixture();f.document('INV1');
 f.post('INV1',[['1100',10000,0],['2000',0,10000]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.accrual_posting_mismatch,1);f.sql.close();
});
test('wrong invoice journal amount fails even though the journal is posted and balanced',async()=>{
 const f=fixture();f.document('INV1', 'sales_invoice',10000);
 f.post('INV1',[['1100',9000,0],['4000',0,9000]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.accrual_posting_mismatch,1);f.sql.close();
});
test('posted journal without source document is an accounting orphan',async()=>{
 const f=fixture();
 f.post('MISSING',[['1100',10000,0],['4000',0,10000]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.orphan_accrual_journal,1);
 assert.equal(result.orphanJournalCount,1);f.sql.close();
});
test('void document with posted journal fails independent accounting review',async()=>{
 const f=fixture();f.document('INV1','sales_invoice',10000,'void');
 f.post('INV1',[['1100',10000,0],['4000',0,10000]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.nonapproved_accrual_document,1);f.sql.close();
});
test('draft invoice with no journal is NOT yet a recognized accrual',async()=>{
 const f=fixture();f.document('INV1','sales_invoice',10000,'draft');
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.ready,true);assert.equal(result.documentCount,0);f.sql.close();
});
test('generic payroll liability journal uses earned payroll expense and payable',async()=>{
 const f=fixture();f.document('RUN1','payroll_liability',65000);
 f.post('RUN1',[['5100',65000,0],['2100',0,65000]]);
 assert.equal((await auditFinanceAccrualJournals(f.params)).ready,true);f.sql.close();
});

const payrollRef='8:SCHOOL_A|18:STAFF1_2026-09';
const payrollDoc='PAY_ACCR|'+payrollRef;
const plainSnapshot=payrollRef+'|100000:5000:10000:20000:35000:65000';
const statutorySnapshot=payrollRef+'|100000:5000:10000:20000:42000:58000|ST:'+'a'.repeat(64);
function seedReviewedPF(f,org='A',pf=7000,employer=2500){
 f.sql.prepare(`INSERT INTO neo_fin_payroll_statutory_reviews(
 organization_id,school_id,payroll_record_id,payroll_month,policy_reference,source_fingerprint,reviewed_by,reviewed_at,status,
 employee_pf_paise,employer_pf_paise)
 VALUES(?, 'SCHOOL_A','STAFF1_2026-09','2026-09','REVIEW-1',?,'fin:reviewer','2026-10-02T11:00:00Z','approved',?,?)`)
 .run(org,'a'.repeat(64),pf,employer);
}
test('unreviewed legacy payroll snapshot recognizes earned expense and exact full salary liability',async()=>{
 const f=fixture();f.document(payrollDoc,'payroll_liability',85000,'approved','A','legacy_payroll',plainSnapshot);
 f.post(payrollDoc,[['5100',85000,0],['2100',0,85000]]);
 assert.equal((await auditFinanceAccrualJournals(f.params)).ready,true);f.sql.close();
});
test('reviewed statutory payroll recognizes exact PF withholding, salary payable and employer PF',async()=>{
 const f=fixture();seedReviewedPF(f);
 f.document(payrollDoc,'payroll_liability',85000,'approved','A','legacy_payroll',statutorySnapshot);
 f.post(payrollDoc,[['5100',85000,0],['2100',0,78000],
  ['2111',0,7000],['5300',2500,0],['2111',0,2500]]);
 assert.equal((await auditFinanceAccrualJournals(f.params)).ready,true);f.sql.close();
});
test('salary payable changed but PF offset increased still balanced is REJECTED',async()=>{
 const f=fixture();seedReviewedPF(f);
 f.document(payrollDoc,'payroll_liability',85000,'approved','A','legacy_payroll',statutorySnapshot);
 f.post(payrollDoc,[['5100',85000,0],['2100',0,77000],
  ['2111',0,8000],['5300',2500,0],['2111',0,2500]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.accrual_posting_mismatch,1);f.sql.close();
});
test('same gross earned salary but altered employee advance/net snapshot rejects posted journal',async()=>{
 const f=fixture();
 const badSnapshot=payrollRef+'|100000:5000:10000:10000:35000:65000';
 f.document(payrollDoc,'payroll_liability',85000,'approved','A','legacy_payroll',badSnapshot);
 f.post(payrollDoc,[['5100',85000,0],['2100',0,85000]]);
 assert.equal((await auditFinanceAccrualJournals(f.params)).counts.accrual_posting_mismatch,1);f.sql.close();
});
test('reviewed PF journal cannot pass with missing/mismatched independent review evidence',async()=>{
 for(const kind of ['missing','mismatch']){
  const f=fixture();if(kind==='mismatch')seedReviewedPF(f,'A',6000);
  f.document(payrollDoc,'payroll_liability',85000,'approved','A','legacy_payroll',statutorySnapshot);
  f.post(payrollDoc,[['5100',85000,0],['2100',0,78000],
   ['2111',0,7000],['5300',2500,0],['2111',0,2500]]);
  assert.equal((await auditFinanceAccrualJournals(f.params)).counts.accrual_posting_mismatch,1);
  f.sql.close();
 }
});
test('malformed source ID and fake payroll document prefix block accrual audit',async()=>{
 const f=fixture();
 f.document('RUN1','payroll_liability',85000,'approved','A','legacy_payroll',plainSnapshot);
 f.post('RUN1',[['5100',85000,0],['2100',0,85000]]);
 assert.equal((await auditFinanceAccrualJournals(f.params)).counts.accrual_posting_mismatch,1);f.sql.close();
});
test('legacy payroll with unrelated credit posting fails even when balanced',async()=>{
 const f=fixture();f.document(payrollDoc,'payroll_liability',85000,'approved','A','legacy_payroll',plainSnapshot);
 f.post(payrollDoc,[['5100',85000,0],['2000',0,85000]]);
 const result=await auditFinanceAccrualJournals(f.params);
 assert.equal(result.counts.accrual_posting_mismatch,1);f.sql.close();
});
test('HO does not see independent Center accrual documents',async()=>{
 const f=fixture();f.document('INV1');f.document('INV_B','sales_invoice',999000,'approved','B');
 const r=await auditFinanceAccrualJournals(f.params);
 assert.equal(r.documentCount,1);
 await assert.rejects(auditFinanceAccrualJournals({...f.params,authenticatedAccountId:'fin:ho'}),/Finance access denied/);
 const b=await auditFinanceAccrualJournals({...f.params,authenticatedAccountId:'fin:bob',organizationId:'B'});
 assert.equal(b.documentCount,1);f.sql.close();
});

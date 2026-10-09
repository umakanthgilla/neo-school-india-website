import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

const ordered=[
 'finance_payroll_one_foundation.sql',
 'finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql',
 'finance_payroll_one_auth_accounts.sql',
 'finance_payroll_one_receipt_evidence.sql',
 'finance_payroll_one_legacy_payout_integrity.sql',
 'finance_payroll_one_statutory_review.sql',
 'finance_payroll_one_statutory_remittance.sql',
 'finance_payroll_one_session_revocations.sql',
 'finance_payroll_one_issued_document_immutability.sql'
];
const issued=/Issued Finance document immutable/;
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const path of ordered)sql.exec(readFileSync(new URL('../../migrations/'+path,import.meta.url),'utf8'));
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES
 ('A','Independent Center A','independent_center'),('B','Independent Center B','independent_center');`);
 function document({id,org='A',status='approved',amount=10000,kind='legacy_invoice',source='SCHOOL_A|INV1',type='sales_invoice'}){
  sql.prepare(`INSERT INTO neo_fin_documents
   (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
   VALUES(?,?,?,?,?,?,?)`).run(org,id,type,status,amount,kind,source);
 }
 return {sql,document};
}
test('issued Payroll document locks all source and money attributes, status, organization and ID',()=>{
 const {sql,document}=setup();
 document({id:'PAY1',type:'payroll_liability',kind:'legacy_payroll',source:'1:A|4:PAY1|100:0:0:0:0:100'});
 for(const statement of [
  "UPDATE neo_fin_documents SET gross_paise=1 WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET source_id='changed' WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET source_kind='legacy_invoice' WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET status='void' WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET currency='USD' WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET organization_id='B' WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET id='PAY2' WHERE id='PAY1'",
  "UPDATE neo_fin_documents SET gross_paise=gross_paise WHERE id='PAY1'",
  "DELETE FROM neo_fin_documents WHERE id='PAY1'"
 ])assert.throws(()=>sql.exec(statement),issued,statement);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM neo_fin_documents WHERE id='PAY1'").get().n,1);
 sql.close();
});
test('approved invoice and payment cannot be silently voided or deleted',()=>{
 const {sql,document}=setup();
 document({id:'INV1'});
 document({id:'OUT1',type:'payment',kind:'payroll_payment',source:'SCHOOL_A|PAY1'});
 assert.throws(()=>sql.exec("DELETE FROM neo_fin_documents WHERE id='INV1'"),issued);
 assert.throws(()=>sql.exec("UPDATE neo_fin_documents SET status='void' WHERE id='OUT1'"),issued);
 sql.close();
});
test('draft before issuance can be edited and approved once, then no longer changed',()=>{
 const {sql,document}=setup();
 document({id:'D1',status:'draft',kind:null,source:null});
 sql.exec("UPDATE neo_fin_documents SET gross_paise=15000,source_kind='legacy_invoice',source_id='SCHOOL_A|D1' WHERE id='D1'");
 sql.exec("UPDATE neo_fin_documents SET status='approved' WHERE id='D1'");
 assert.equal(sql.prepare("SELECT gross_paise FROM neo_fin_documents WHERE id='D1'").get().gross_paise,15000);
 assert.throws(()=>sql.exec("UPDATE neo_fin_documents SET gross_paise=20000 WHERE id='D1'"),issued);
 sql.close();
});
test('journal-linked draft is immutable even before approval; linked journal persists',()=>{
 const {sql,document}=setup();
 document({id:'DOC1',status:'draft'});
 sql.exec("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A','JNL1','document','DOC1')");
 assert.throws(()=>sql.exec("UPDATE neo_fin_documents SET source_id='FORGED' WHERE id='DOC1'"),issued);
 assert.throws(()=>sql.exec("DELETE FROM neo_fin_documents WHERE id='DOC1'"),issued);
 assert.equal(sql.prepare("SELECT source_id FROM neo_fin_journals WHERE id='JNL1'").get().source_id,'DOC1');
 sql.close();
});
test('even pending settlement locks its linked document against changing amount or owner',()=>{
 const {sql,document}=setup();
 document({id:'P1',status:'draft',kind:null,source:null,type:'payment'});
 sql.exec(`INSERT INTO neo_fin_payment_settlements
   (organization_id,id,document_id,amount_paise,status) VALUES('A','SETTLEMENT1','P1',10000,'pending')`);
 assert.throws(()=>sql.exec("UPDATE neo_fin_documents SET gross_paise=1 WHERE id='P1'"),issued);
 assert.throws(()=>sql.exec("UPDATE neo_fin_documents SET organization_id='B' WHERE id='P1'"),issued);
 assert.throws(()=>sql.exec("DELETE FROM neo_fin_documents WHERE id='P1'"),issued);
 sql.close();
});
test('statutory approved remittance links lock Finance payment source',()=>{
 const {sql,document}=setup();
 document({id:'STAT1',status:'draft',type:'payment',kind:'statutory_remittance_paid',source:'PF_SEP',amount:5000});
 sql.exec(`INSERT INTO neo_fin_statutory_remittances
 (organization_id,id,account_code,payroll_month,amount_paise,finance_document_id,voucher_number,approval_reference,approved_by,approved_at,status)
 VALUES('A','PF_SEP','2111','2026-09',5000,'STAT1','PV1','AUTH1','fin:reviewer','2026-10-09','approved')`);
 assert.throws(()=>sql.exec("UPDATE neo_fin_documents SET source_id='PF_OTHER' WHERE id='STAT1'"),issued);
 assert.throws(()=>sql.exec("DELETE FROM neo_fin_documents WHERE id='STAT1'"),issued);
 sql.close();
});
test('unlinked draft and independent organization documents remain editable',()=>{
 const {sql,document}=setup();
 document({id:'D1',status:'draft',org:'A',kind:null,source:null});
 document({id:'D2',status:'draft',org:'B',kind:null,source:null});
 sql.exec("UPDATE neo_fin_documents SET gross_paise=123 WHERE id='D1' AND organization_id='A'");
 sql.exec("DELETE FROM neo_fin_documents WHERE id='D2' AND organization_id='B'");
 assert.equal(sql.prepare("SELECT gross_paise FROM neo_fin_documents WHERE id='D1'").get().gross_paise,123);
 assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM neo_fin_documents WHERE organization_id='B'").get().n,0);
 sql.close();
});


test('second issued document cannot reuse same original Finance source in same legal business',()=>{
 const {sql,document}=setup();
 document({id:'PAY1',type:'payment',kind:'payroll_payment',source:'SCHOOL_A|PAY1'});
 assert.throws(()=>document({id:'PAY2',type:'payment',kind:'payroll_payment',source:'SCHOOL_A|PAY1'}),/UNIQUE constraint failed/);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM neo_fin_documents WHERE organization_id='A' AND source_kind='payroll_payment'").get().n,1);
 sql.close();
});
test('rejected source and amount edits never change originally issued Finance evidence',()=>{
 const {sql,document}=setup();
 document({id:'INV1',amount:12500,kind:'legacy_invoice',source:'SCHOOL_A|INV1'});
 for(const statement of [
  "UPDATE neo_fin_documents SET gross_paise=300000 WHERE id='INV1'",
  "UPDATE neo_fin_documents SET source_id='SCHOOL_B|INV2' WHERE id='INV1'"
 ])assert.throws(()=>sql.exec(statement),issued);
 assert.deepEqual(sql.prepare("SELECT gross_paise,source_id,status FROM neo_fin_documents WHERE id='INV1'").get(),
  {gross_paise:12500,source_id:'SCHOOL_A|INV1',status:'approved'});
 sql.close();
});

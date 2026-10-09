import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {syncVerifiedLegacyFeeReceipt} from './sync-legacy-fee-receipt.mjs';
import {verifyLegacyFeeReceipt} from './legacy-fee-receipt-verifier.mjs';
const migrations=[
 'finance_payroll_one_foundation.sql',
 'finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql',
 'finance_payroll_one_receipt_evidence.sql'
].map(p=>readFileSync(new URL('../../migrations/'+p,import.meta.url),'utf8'));

function setup({withEvidence=true,withInvoiceAccrual=true}={}){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 for(const statement of migrations)sql.exec(statement);
 sql.exec(`CREATE TABLE neo_portal_records(
 school_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,
 data TEXT NOT NULL,PRIMARY KEY(school_id,kind,id));`);
 sql.prepare("INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES(?,?,?)")
  .run('A','Center A','independent_center');
 sql.prepare("INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES(?,?,?)")
  .run('HO','Head Office','head_office');
 sql.exec("INSERT INTO neo_fin_school_ownership(school_id,organization_id,effective_from) VALUES('SCHOOL_A','A','2026-01-01')");
 sql.exec("INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES('A','fin:alice','owner'),('HO','fin:ho','owner')");
 sql.exec(`INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES('A','BANK','1000','Bank','asset'),('A','AR','1100','Accounts Receivable','asset'),('A','REVENUE','4000','Fee Revenue','income');`);
 sql.exec(`INSERT INTO neo_fin_documents
 (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
 VALUES('A','DOC_INV1','sales_invoice','approved',10000,'legacy_invoice','INV1');`);
 if(withInvoiceAccrual){
  sql.exec(`INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A','J_INV1','document','DOC_INV1');
  INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise)
   VALUES('A','J_INV1',1,'AR',10000,0),('A','J_INV1',2,'REVENUE',0,10000);
  UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-08T09:00:00Z' WHERE organization_id='A' AND id='J_INV1';`);
 }
 const payment={invoice_id:'INV1',receipt_no:'RCPT-2026-0001',amount_paise:10000,
   method:'UPI',date:'2026-10-08',status:'Recorded by school'};
 const ledger={source_kind:'fee_payment',source_id:'P1',direction:'IN',amount_paise:10000,
   reference:'RCPT-2026-0001',status:'Posted',transaction_date:'2026-10-08'};
 const stmt=sql.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)");
 stmt.run('SCHOOL_A','payments','P1',JSON.stringify(payment));
 stmt.run('SCHOOL_A','daily_accounts','FIN_FEE_P1',JSON.stringify(ledger));
 if(withEvidence){
  sql.prepare(`INSERT INTO neo_fin_receipt_verifications
   (organization_id,verification_id,school_id,payment_record_id,receipt_no,
    amount_paise,evidence_type,verification_reference,settled_at,verified_at,verified_by)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run('A','VER1','SCHOOL_A','P1','RCPT-2026-0001',10000,
     'bank_reconciled','BANK-ACK-1','2026-10-08T10:00:00Z','2026-10-09T06:00:00Z','fin:alice');
 }
 const db={
  prepare(statement){
   return{bind(...args){
    const prepared=sql.prepare(statement);
    return{
     first:async()=>prepared.get(...args),
     all:async()=>({results:prepared.all(...args)}),
     run:async()=>{const result=prepared.run(...args);return{success:true,meta:{changes:result.changes}};}
    };
   }};
  },
  async batch(statements){
   sql.exec('BEGIN IMMEDIATE');
   try{const output=[];for(const statement of statements)output.push(await statement.run());sql.exec('COMMIT');return output;}
   catch(err){sql.exec('ROLLBACK');throw err;}
  }
 };
 return{sql,db};
}
const request=({db},overrides={})=>({
 db,authenticatedAccountId:'fin:alice',organizationId:'A',
 paymentRecordId:'P1',verificationId:'VER1',...overrides
});
const rowCount=(sql,table)=>sql.prepare('SELECT COUNT(*) n FROM '+table).get().n;
test('verified fee receipt creates exactly one Finance cash mirror + balanced accounting journal',async()=>{
 const ctx=setup();
 const result=await syncVerifiedLegacyFeeReceipt(request(ctx));
 assert.equal(result.cashCreated,true);assert.equal(result.journalCreated,true);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),1);
 assert.equal(rowCount(ctx.sql,'neo_fin_journals'),2);
 assert.equal(rowCount(ctx.sql,'neo_fin_journal_lines'),4);
 assert.equal(ctx.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
 const mirror=ctx.sql.prepare("SELECT direction,amount_paise,effective_at FROM neo_fin_cash_events WHERE organization_id='A'").get();
 assert.equal(mirror.direction,'money_in');assert.equal(mirror.amount_paise,10000);
 assert.equal(mirror.effective_at,'2026-10-08T10:00:00.000Z');
 const totals=ctx.sql.prepare(`SELECT SUM(debit_paise) debit,SUM(credit_paise) credit
   FROM neo_fin_posted_journal_lines WHERE organization_id='A'`).get();
 assert.equal(totals.debit,totals.credit);
 ctx.sql.close();
});
test('fee sync retry never creates a second cash event, journal or legacy Daily Ledger entry',async()=>{
 const ctx=setup();await syncVerifiedLegacyFeeReceipt(request(ctx));
 const r=await syncVerifiedLegacyFeeReceipt(request(ctx));
 assert.equal(r.cashCreated,false);assert.equal(r.journalCreated,false);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),1);
 assert.equal(rowCount(ctx.sql,'neo_fin_journals'),2);
 assert.equal(ctx.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
 ctx.sql.close();
});
test('recorded by school is not sufficient without independently verified evidence',async()=>{
 const ctx=setup({withEvidence:false});
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx)),/Source verification failed/);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),0);
 ctx.sql.close();
});
test('missing posted invoice accrual prevents fee settlement from clearing Accounts Receivable',async()=>{
 const ctx=setup({withInvoiceAccrual:false});
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx)),/Source verification failed/);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),0);ctx.sql.close();
});
test('HO owner cannot initiate private Center fee accounting',async()=>{
 const ctx=setup();
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx,{authenticatedAccountId:'fin:ho'})),/Finance access denied/);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),0);ctx.sql.close();
});
test('receipt amount mismatch with bank verification is rejected',async()=>{
 const ctx=setup();
 ctx.sql.prepare("UPDATE neo_portal_records SET data=json_set(data,'$.amount_paise',8000) WHERE kind='payments'").run();
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx)),/Source verification failed/);
 ctx.sql.close();
});
test('duplicate legacy Daily Ledger source linkage prevents mirroring',async()=>{
 const ctx=setup();
 ctx.sql.prepare("INSERT INTO neo_portal_records VALUES('SCHOOL_A','daily_accounts','DUP_FEE',?)")
 .run(JSON.stringify({source_kind:'fee_payment',source_id:'P1',direction:'IN',amount_paise:10000,reference:'RCPT-2026-0001',status:'Posted'}));
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx)),/Source verification failed/);
 ctx.sql.close();
});
test('invalid Cash versus bank evidence method cannot be used as verified cash',async()=>{
 const ctx=setup();
 ctx.sql.prepare("UPDATE neo_portal_records SET data=json_set(data,'$.method','Cash') WHERE kind='payments'").run();
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx)),/Source verification failed/);
 ctx.sql.close();
});
test('receipt verification evidence cannot be modified, deleted or duplicated',()=>{
 const ctx=setup();
 assert.throws(()=>ctx.sql.exec("UPDATE neo_fin_receipt_verifications SET amount_paise=1"),/immutable/);
 assert.throws(()=>ctx.sql.exec("DELETE FROM neo_fin_receipt_verifications"),/immutable/);
 assert.throws(()=>ctx.sql.exec(`INSERT INTO neo_fin_receipt_verifications
 (organization_id,verification_id,school_id,payment_record_id,receipt_no,amount_paise,evidence_type,verification_reference,settled_at,verified_at,verified_by)
 VALUES ('A','VER2','SCHOOL_A','P1','RCPT-2026-0001',10000,'bank_reconciled','BANK-ACK-2','2026-10-08T10:00:00Z','2026-10-09T06:00:00Z','fin:alice')`),/UNIQUE/);
 ctx.sql.close();
});
test('failed journal can be retried without repeating verified cash movement',async()=>{
 const ctx=setup();
 ctx.sql.exec("UPDATE neo_fin_accounts SET active=0 WHERE organization_id='A' AND account_code='1000'");
 await assert.rejects(syncVerifiedLegacyFeeReceipt(request(ctx)),/accounts unavailable/);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),1);
 ctx.sql.exec("UPDATE neo_fin_accounts SET active=1 WHERE organization_id='A' AND account_code='1000'");
 const r=await syncVerifiedLegacyFeeReceipt(request(ctx));
 assert.equal(r.cashCreated,false);assert.equal(r.journalCreated,true);
 assert.equal(rowCount(ctx.sql,'neo_fin_cash_events'),1);
 assert.equal(ctx.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
 ctx.sql.close();
});

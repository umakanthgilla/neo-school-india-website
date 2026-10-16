import {auditFinanceCashJournals} from './cash-journal-audit.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {syncVerifiedStatutoryRemittance} from './sync-statutory-remittance.mjs';
import {postStatutoryRemittanceJournal} from './statutory-remittance-journal.mjs';
import {recoverMissingCashJournals} from './journal-recovery.mjs';
import {postJournalForCashEvent} from './source-journal.mjs';
import {readStatutoryLiabilities} from './statutory-liabilities.mjs';
const migrations=['finance_payroll_one_foundation.sql','finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql','finance_payroll_one_statutory_remittance.sql']
 .map(n=>readFileSync(new URL('../../migrations/'+n,import.meta.url),'utf8'));
function fixture({verified=true,liability=15000,bankActive=true,wrongVoucherReference=false}={}){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Center A','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('A','fin:alice','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES ('A','PF','2111','Provident Fund Payable','liability'),
 ('A','BANK','1000','Bank','asset'),('A','EXP','5100','Payroll','expense'),
 ('A','ESI','2112','ESI','liability'),('A','PT','2113','PT','liability'),
 ('A','TDS','2114','TDS','liability');`);
 if(!bankActive)sql.exec("UPDATE neo_fin_accounts SET active=0 WHERE id='BANK'");
 if(liability>0){
  sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A','SAL-1','document','SAL-1')").run();
  sql.prepare("INSERT INTO neo_fin_journal_lines VALUES('A','SAL-1',1,'EXP',?,0)").run(liability);
  sql.prepare("INSERT INTO neo_fin_journal_lines VALUES('A','SAL-1',2,'PF',0,?)").run(liability);
  sql.exec("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-08T09:00:00Z' WHERE id='SAL-1'");
 }
 function voucher(id,period,amount=10000,settlement='SET1'){
  const doc='DOC_'+id,number='PV_'+id;
  sql.prepare(`INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise,source_kind,source_id)
    VALUES('A',?,'payment','approved',?,'statutory_remittance_paid',?)`).run(doc,amount,id);
  sql.prepare(`INSERT INTO neo_fin_statutory_remittances
    (organization_id,id,account_code,payroll_month,amount_paise,finance_document_id,
     voucher_number,approval_reference,approved_by,approved_at,status)
    VALUES('A',?,'2111',?,?,?,?,'AUTH-1','fin:reviewer','2026-10-08T10:00:00Z','approved')`)
    .run(id,period,amount,doc,number);
  sql.prepare(`INSERT INTO neo_fin_payment_settlements
    (organization_id,id,document_id,bank_reference,amount_paise,status,verified_at,voucher_id)
    VALUES('A',?,'DOC_'||?,'BANK-'||?, ?,?,'2026-10-09T10:00:00Z',?)`)
    .run(settlement,id,settlement,amount,verified?'verified':'pending',wrongVoucherReference?'WRONG':number);
  return {doc,number};
 }
 voucher('PF_SEP','2026-09');
 const db={prepare(query){return{bind(...args){const stmt=sql.prepare(query);return{
  first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),
  run:async()=>{const result=stmt.run(...args);return{success:true,meta:{changes:result.changes}}}
 }}}},async batch(statements){sql.exec('BEGIN IMMEDIATE');try{
  const out=[];for(const stmt of statements)out.push(await stmt.run());
  sql.exec('COMMIT');return out;
 }catch(err){sql.exec('ROLLBACK');throw err}}};
 const params=(rest={})=>({db,authenticatedAccountId:'fin:alice',organizationId:'A',
  remittanceId:'PF_SEP',settlementId:'SET1',...rest});
 return {sql,db,voucher,params};
}
const count=(sql,table)=>sql.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
test('verified statutory voucher posts one payable Dr / Bank Cr and one Money Out',async()=>{
 const f=fixture();const result=await syncVerifiedStatutoryRemittance(f.params());
 assert.equal(result.cashCreated,true);assert.equal(result.journalCreated,true);
 assert.equal(count(f.sql,'neo_fin_cash_events'),1);
 const entry=f.sql.prepare('SELECT direction,amount_paise,source_kind FROM neo_fin_cash_events').get();
 assert.deepEqual({...entry},{direction:'money_out',amount_paise:10000,source_kind:'statutory_remittance_paid'});
 const journal=f.sql.prepare("SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE journal_id LIKE 'JNL|%' ORDER BY line_no").all();
 assert.deepEqual(journal.map(x=>[x.account_id,x.debit_paise,x.credit_paise]),
  [['PF',10000,0],['BANK',0,10000]]);
 const balance=await readStatutoryLiabilities({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(balance.items[0].balancePaise,5000);
 const audit=await auditFinanceCashJournals({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(audit.ready,true,JSON.stringify(audit.findings));
 assert.equal((await syncVerifiedStatutoryRemittance(f.params())).cashCreated,false);
 assert.equal(count(f.sql,'neo_fin_cash_events'),1);
 f.sql.close();
});
test('no independently verified bank evidence means no Money Out',async()=>{
 const f=fixture({verified:false});
 await assert.rejects(syncVerifiedStatutoryRemittance(f.params()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('bank-verified payout cannot exceed posted PF payable liability',async()=>{
 const f=fixture({liability:9000});
 await assert.rejects(syncVerifiedStatutoryRemittance(f.params()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('HO cannot post independent Center A statutory payments',async()=>{
 const f=fixture();
 await assert.rejects(syncVerifiedStatutoryRemittance(f.params({authenticatedAccountId:'fin:ho'})),/Finance access denied/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('original bank verification with mismatched voucher ID refuses cash posting',async()=>{
 const f=fixture({wrongVoucherReference:true});
 await assert.rejects(syncVerifiedStatutoryRemittance(f.params()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);
 f.sql.close();
});
test('second full verified settlement blocked by database trigger',()=>{
 const f=fixture();
 assert.throws(()=>f.sql.exec(`INSERT INTO neo_fin_payment_settlements(organization_id,id,document_id,
 bank_reference,amount_paise,status,verified_at,voucher_id)
 VALUES('A','SET2','DOC_PF_SEP','BANK2',10000,'verified','2026-10-09T11:00:00Z','DIFFERENT')`),/already verified/);
 f.sql.close();
});
test('bank settlement cannot claim partial amount against an approved full voucher',()=>{
 const f=fixture({verified:false});
 assert.throws(()=>f.sql.exec("UPDATE neo_fin_payment_settlements SET status='verified',amount_paise=1 WHERE id='SET1'"),/amount must match/);
 f.sql.close();
});
test('statutory remittance approval and verified bank evidence are immutable',()=>{
 const f=fixture();
 assert.throws(()=>f.sql.exec("DELETE FROM neo_fin_statutory_remittances"),/immutable/);
 assert.throws(()=>f.sql.exec("UPDATE neo_fin_payment_settlements SET amount_paise=12 WHERE id='SET1'"),/immutable/);
 f.sql.close();
});
test('missing account causes recoverable journal failure, not second cash event',async()=>{
 const f=fixture({bankActive:false});
 await assert.rejects(syncVerifiedStatutoryRemittance(f.params()),/account unavailable/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),1);
 f.sql.exec("UPDATE neo_fin_accounts SET active=1 WHERE id='BANK'");
 const recovered=await recoverMissingCashJournals({db:f.db,organizationId:'A'});
 assert.equal(recovered.posted.length,1);assert.equal(recovered.failed.length,0);
 assert.equal(count(f.sql,'neo_fin_cash_events'),1);
 assert.equal((await recoverMissingCashJournals({db:f.db,organizationId:'A'})).checked,0);
 const event=f.sql.prepare("SELECT event_id FROM neo_fin_cash_events").get();
 await assert.rejects(postJournalForCashEvent(f.db,'A',event.event_id),/Statutory voucher requires/);
 f.sql.close();
});
test('second period verified remittance cannot overclear residual statutory liability',async()=>{
 const f=fixture();
 await syncVerifiedStatutoryRemittance(f.params()); // 15k -> 5k
 f.voucher('PF_OCT','2026-10',10000,'SET2');
 await assert.rejects(syncVerifiedStatutoryRemittance(f.params({remittanceId:'PF_OCT',settlementId:'SET2'})),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),1);f.sql.close();
});
test('SQL journal posting trigger prevents concurrent overpayment, even if verification read was stale',async()=>{
 const f=fixture();
 await syncVerifiedStatutoryRemittance(f.params()); // 5k left
 const next=f.voucher('PF_OCT','2026-10',10000,'SET2');
 // Simulate a valid-looking cash event written by an earlier verification read.
 f.sql.prepare(`INSERT INTO neo_fin_cash_events
 (organization_id,event_id,source_kind,source_id,source_event_id,direction,amount_paise,effective_at,verification_reference)
 VALUES('A','E2','statutory_remittance_paid','PF_OCT','SET2','money_out',10000,'2026-10-09T10:00:00.000Z','BANK-SET2')`).run();
 const id='JNL|E2';
 f.sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A',?,'cash_event','E2')").run(id);
 f.sql.prepare("INSERT INTO neo_fin_journal_lines VALUES('A',?,1,'PF',10000,0)").run(id);
 f.sql.prepare("INSERT INTO neo_fin_journal_lines VALUES('A',?,2,'BANK',0,10000)").run(id);
 assert.throws(()=>f.sql.prepare("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-09' WHERE id=?").run(id),/exceeds posted payable/);
 f.sql.close();
});

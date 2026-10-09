import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {auditFinanceCashJournals} from './cash-journal-audit.mjs';

const migrationNames=['finance_payroll_one_foundation.sql',
 'finance_payroll_one_cash_projection.sql','finance_payroll_one_accounting_journals.sql'];
const migrations=migrationNames.map(n=>readFileSync(new URL('../../migrations/'+n,import.meta.url),'utf8'));
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES
  ('A','Center A','independent_center'),('B','Center B','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES
  ('A','fin:alice','owner'),('B','fin:bob','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES('A','BANK_A','1000','Bank','asset'),('A','AR_A','1100','Fee AR','asset'),
 ('A','AP_A','2000','Vendor AP','liability'),('A','SAL_A','2100','Salary payable','liability'),
 ('B','BANK_B','1000','Bank','asset'),('B','AR_B','1100','AR','asset');`);
 const event=(org,id,direction,amount=10000)=>{
  sql.prepare(`INSERT INTO neo_fin_cash_events
   (organization_id,event_id,source_kind,source_id,source_event_id,direction,amount_paise,effective_at,verification_reference)
   VALUES (?,?, 'fee_receipt', ?, 'ACK', ?, ?, '2026-10-09T10:00:00Z','VERIFIED')`)
   .run(org,id,'SOURCE_'+id,direction,amount);
 };
 const journal=(org,id,sourceId,lines,posted=true)=>{
  sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES(?,?,'cash_event',?)")
   .run(org,id,sourceId);
  const ins=sql.prepare(`INSERT INTO neo_fin_journal_lines
   (organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES(?,?,?,?,?,?)`);
  lines.forEach(([account,debit,credit],i)=>ins.run(org,id,i+1,account,debit,credit));
  if(posted)sql.prepare("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-09T11:00:00Z' WHERE organization_id=? AND id=?").run(org,id);
 };
 const db={prepare(q){return{bind(...args){const st=sql.prepare(q);
  return{first:async()=>st.get(...args),all:async()=>({results:st.all(...args)})};
 }}}};
 return{sql,db,event,journal,params:{db,authenticatedAccountId:'fin:alice',organizationId:'A'}};
}
test('correct fee receipt Bank Dr and vendor payout Bank Cr reconcile without findings',async()=>{
 const f=setup();f.event('A','E1','money_in');
 f.journal('A','JNL1','E1',[['BANK_A',10000,0],['AR_A',0,10000]]);
 f.event('A','E2','money_out',4000);
 f.journal('A','JNL2','E2',[['AP_A',4000,0],['BANK_A',0,4000]]);
 const r=await auditFinanceCashJournals(f.params);
 assert.equal(r.ready,true);assert.equal(r.cashEventCount,2);assert.equal(r.issueCount,0);
 assert.deepEqual(r.findings,[]);f.sql.close();
});
test('missing journal and draft-only journal both block financial reconciliation',async()=>{
 const f=setup();f.event('A','E1','money_in');
 f.event('A','E2','money_out',4000);
 f.journal('A','DRAFT','E2',[['AP_A',4000,0],['BANK_A',0,4000]],false);
 const r=await auditFinanceCashJournals(f.params);
 assert.equal(r.ready,false);
 assert.equal(r.counts.missing_journal,1);
 assert.equal(r.counts.journal_not_posted,1);
 f.sql.close();
});
test('balanced but wrong-direction bank journal is detected; balanced is not enough',async()=>{
 const f=setup();f.event('A','E1','money_in',10000);
 f.journal('A','WRONG','E1',[['AR_A',10000,0],['BANK_A',0,10000]]);
 const r=await auditFinanceCashJournals(f.params);
 assert.equal(r.issueCount,1);assert.equal(r.counts.bank_amount_mismatch,1);
 f.sql.close();
});
test('posted journal with wrong bank amount detects mismatch even when internally balanced',async()=>{
 const f=setup();f.event('A','E1','money_in',10000);
 f.journal('A','WRONG','E1',[['BANK_A',9000,0],['AR_A',0,9000]]);
 const r=await auditFinanceCashJournals(f.params);
 assert.equal(r.counts.bank_amount_mismatch,1);f.sql.close();
});
test('an orphan cash-origin journal with no matching cash event is flagged',async()=>{
 const f=setup();
 f.journal('A','ORPHAN','missing',[['BANK_A',8000,0],['AR_A',0,8000]]);
 const r=await auditFinanceCashJournals(f.params);
 assert.equal(r.cashEventCount,0);assert.equal(r.orphanJournalCount,1);
 assert.equal(r.findings[0].code,'orphan_cash_journal');f.sql.close();
});
test('the report is scoped to a business; HO cannot audit another Center',async()=>{
 const f=setup();f.event('B','B1','money_in',50000);
 const a=await auditFinanceCashJournals(f.params);
 assert.equal(a.ready,true);assert.equal(a.cashEventCount,0);
 const b=await auditFinanceCashJournals({...f.params,authenticatedAccountId:'fin:bob',organizationId:'B'});
 assert.equal(b.issueCount,1);
 await assert.rejects(auditFinanceCashJournals({...f.params,authenticatedAccountId:'fin:ho'}),/Finance access denied/);
 f.sql.close();
});
test('a recorded debit and credit to the same bank account fails the exact-movement invariant',async()=>{
 const f=setup();f.event('A','E1','money_in',10000);
 f.journal('A','SPLIT','E1',[['BANK_A',11000,0],['BANK_A',0,1000],['AR_A',0,10000]]);
 const r=await auditFinanceCashJournals(f.params);
 assert.equal(r.counts.bank_amount_mismatch,1);f.sql.close();
});

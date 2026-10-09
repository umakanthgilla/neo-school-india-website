import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {readStatutoryLiabilities} from './statutory-liabilities.mjs';
import {handleFinanceReadApi} from './finance-read-api.mjs';
const migrations=['finance_payroll_one_foundation.sql','finance_payroll_one_accounting_journals.sql']
 .map(x=>readFileSync(new URL('../../migrations/'+x,import.meta.url),'utf8'));
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Center A','independent_center'),('B','Center B','independent_center'),('HO','HO','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('A','fin:alice','owner'),('B','fin:bob','owner'),('HO','fin:ho','owner');`);
 for(const org of ['A','B']){
  for(const code of ['2111','2112','2113','2114'])
   sql.prepare('INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type) VALUES (?,?,?,?,?)')
    .run(org,code,code,code,'liability');
 }
 function journal(org,id,entries){
  sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES (?,?,?,?)").run(org,id,'document',id);
  // Include a balancing debit/credit account to simulate approved payroll accrual / statutory remittance.
  sql.prepare('INSERT OR IGNORE INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type) VALUES (?,?,?,?,?)').run(org,'CASH','1000','Cash','asset');
  sql.prepare('INSERT OR IGNORE INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type) VALUES (?,?,?,?,?)').run(org,'EXPENSE','5100','Salary Expense','expense');
  let net=0,line=1;
  for(const [code,debit,credit] of entries){
   sql.prepare('INSERT INTO neo_fin_journal_lines VALUES (?,?,?,?,?,?)').run(org,id,line++,code,debit,credit);
   net+=debit-credit;
  }
  sql.prepare('INSERT INTO neo_fin_journal_lines VALUES (?,?,?,?,?,?)').run(org,id,line,net<0?'EXPENSE':'CASH',Math.max(-net,0),Math.max(net,0));
  sql.prepare("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-09T10:00:00Z' WHERE organization_id=? AND id=?").run(org,id);
 }
 journal('A','SAL-1',[['2111',0,7500],['2112',0,2500],['2113',0,200],['2114',0,1000]]);
 journal('A','PF-REM-1',[['2111',5000,0]]);
 journal('B','SAL-B',[['2111',0,950000]]);
 const db={prepare(q){return{bind(...args){const st=sql.prepare(q);return{
  first:async()=>st.get(...args),all:async()=>({results:st.all(...args)}),
  run:async()=>{const result=st.run(...args);return{success:true,meta:{changes:result.changes}}}
 }}}}};
 return {sql,db};
}
test('posted payroll and remittance show correct organization-only statutory liability',async()=>{
 const {sql,db}=fixture();
 const r=await readStatutoryLiabilities({db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(r.items.length,4);assert.equal(r.items[0].balancePaise,2500);
 assert.equal(r.items[0].debitedPaise,5000);assert.equal(r.netLiabilityPaise,6200);
 assert.equal(r.requiresReview,false);
 assert.ok(!JSON.stringify(r).includes('950000'));sql.close();
});
test('other independent business sees only its own statutory liability',async()=>{
 const {sql,db}=fixture();
 const r=await readStatutoryLiabilities({db,authenticatedAccountId:'fin:bob',organizationId:'B'});
 assert.equal(r.items[0].balancePaise,950000);sql.close();
});
test('HO cannot inspect center statutory liabilities',async()=>{
 const {sql,db}=fixture();
 await assert.rejects(readStatutoryLiabilities({db,authenticatedAccountId:'fin:ho',organizationId:'A'}),/Finance access denied/);
 sql.close();
});
test('debit exceeding credited payable is flagged as review, not silently zeroed',async()=>{
 const {sql,db}=fixture();
 const account=sql.prepare("SELECT id FROM neo_fin_accounts WHERE organization_id='A' AND account_code='2111'").get().id;
 sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A','REV-1','cash_event','REV-1')").run();
 sql.prepare("INSERT INTO neo_fin_journal_lines VALUES('A','REV-1',1,?,6000,0)").run(account);
 sql.prepare("INSERT INTO neo_fin_journal_lines VALUES('A','REV-1',2,'CASH',0,6000)").run();
 sql.exec("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-09' WHERE id='REV-1'");
 const r=await readStatutoryLiabilities({db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(r.items[0].balancePaise,-3500);assert.equal(r.requiresReview,true);sql.close();
});
test('dedicated finance read API exposes read-only statutory balances',async()=>{
 const {sql,db}=fixture();
 const url='https://finance.example/api/finance-one/v1/organizations/A/statutory-liabilities';
 const res=await handleFinanceReadApi({db,authenticatedAccountId:'fin:alice',request:new Request(url)});
 assert.equal(res.status,200);assert.equal((await res.json()).items.length,4);
 const denied=await handleFinanceReadApi({db,authenticatedAccountId:'fin:ho',request:new Request(url)});
 assert.equal(denied.status,403);
 const write=await handleFinanceReadApi({db,authenticatedAccountId:'fin:alice',request:new Request(url,{method:'POST'})});
 assert.equal(write.status,405);sql.close();
});

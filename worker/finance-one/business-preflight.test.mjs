import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {STANDARD_CHART} from './accounting-chart.mjs';
import {financeOneBusinessPreflight} from './business-preflight.mjs';
const migrations=['finance_payroll_one_foundation.sql','finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql','finance_payroll_one_auth_accounts.sql']
 .map(n=>readFileSync(new URL('../../migrations/'+n,import.meta.url),'utf8'));

function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Independent Center','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('A','fin:alice','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations)
 VALUES('fin:alice','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',210000);`);
 const account=sql.prepare(`INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES('A',?,?,?,?)`);
 for(const [code,name,type] of STANDARD_CHART)account.run('SYS_'+code,code,name,type);
 const db={prepare(q){return{bind(...args){const s=sql.prepare(q);return{
  first:async()=>s.get(...args),all:async()=>({results:s.all(...args)})
 }}}}};
 return {sql,db,params:{db,authenticatedAccountId:'fin:alice',organizationId:'A'}};
}
test('valid center finance account, full chart and reconciled cash is staging-ready',async()=>{
 const f=fixture();const r=await financeOneBusinessPreflight(f.params);
 assert.equal(r.ready,true);assert.equal(r.configuredAccounts,STANDARD_CHART.length);
 assert.equal(r.unreconciledCashEvents,0);f.sql.close();
});
test('a HO Finance owner cannot audit private Center A readiness',async()=>{
 const f=fixture();await assert.rejects(financeOneBusinessPreflight({...f.params,authenticatedAccountId:'fin:ho'}),/Finance access denied/);
 f.sql.close();
});
test('missing and inactive chart accounts block business readiness',async()=>{
 const f=fixture();f.sql.exec("DELETE FROM neo_fin_accounts WHERE account_code='2114'");
 f.sql.exec("UPDATE neo_fin_accounts SET active=0 WHERE account_code='1200'");
 const r=await financeOneBusinessPreflight(f.params);
 assert.equal(r.ready,false);assert.equal(r.configuredAccounts,STANDARD_CHART.length-2);assert.ok(r.blockers.includes('Missing chart account: 2114'));
 assert.ok(r.blockers.includes('Inactive chart account: 1200'));f.sql.close();
});
test('reconciled bank event must have a posted journal; pending events block readiness',async()=>{
 const f=fixture();f.sql.exec(`INSERT INTO neo_fin_cash_events(organization_id,event_id,source_kind,source_id,source_event_id,
 direction,amount_paise,effective_at,verification_reference)
 VALUES('A','EVENT-1','fee_receipt','P1','V1','money_in',10000,'2026-10-09T10:00:00Z','BANK1')`);
 const r=await financeOneBusinessPreflight(f.params);
 assert.equal(r.ready,false);assert.equal(r.unreconciledCashEvents,1);
 assert.ok(r.blockers.includes('Unreconciled verified cash events: 1'));f.sql.close();
});
test('Finance owner credentials suspended -> not ready',async()=>{
 const f=fixture();
 f.sql.exec("UPDATE neo_fin_auth_accounts SET active=0,credential_version=credential_version+1");
 const r=await financeOneBusinessPreflight(f.params);
 assert.equal(r.ready,false);assert.ok(r.blockers.includes('Finance credentials missing or inactive'));f.sql.close();
});


test('a posted and balanced journal with WRONG Bank amount blocks Business staging',async()=>{
 const f=fixture();
 f.sql.exec(`INSERT INTO neo_fin_cash_events(organization_id,event_id,source_kind,source_id,
 source_event_id,direction,amount_paise,effective_at,verification_reference)
 VALUES('A','E1','fee_receipt','F1','V1','money_in',10000,'2026-10-09','BANK1');
 INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id)
 VALUES('A','JNL-E1','cash_event','E1');
 INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise)
 VALUES('A','JNL-E1',1,'SYS_1000',9000,0),('A','JNL-E1',2,'SYS_1100',0,9000);
 UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-09' WHERE id='JNL-E1';`);
 const result=await financeOneBusinessPreflight(f.params);
 assert.equal(result.unreconciledCashEvents,0,'A posted header alone is insufficient for release');
 assert.equal(result.ready,false);
 assert.equal(result.cashJournalAuditIssues,1);
 assert.ok(result.blockers.includes('Cash/Bank journal reconciliation issues: 1'));
 f.sql.close();
});

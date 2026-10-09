import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {getFinanceSnapshot} from './finance-reports.mjs';
function fixture(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY,status TEXT);
 CREATE TABLE neo_fin_memberships(organization_id TEXT,account_id TEXT,role TEXT,active INTEGER);
 CREATE TABLE neo_fin_accounts(organization_id TEXT,id TEXT,account_code TEXT,account_name TEXT,account_type TEXT);
 CREATE TABLE neo_fin_posted_journal_lines(organization_id TEXT,account_id TEXT,debit_paise INTEGER,credit_paise INTEGER);
 CREATE TABLE neo_fin_daily_ledger(organization_id TEXT,direction TEXT,amount_paise INTEGER);
 INSERT INTO neo_fin_organizations VALUES('HO','active'),('A','active'),('B','active');
 INSERT INTO neo_fin_memberships VALUES('HO','ho','owner',1),('A','alice','owner',1),('B','bob','owner',1);
 INSERT INTO neo_fin_accounts VALUES('A','bank','1000','Cash','asset'),('A','fee','4000','Fee Income','income'),('A','salary','5100','Salary Expense','expense'),('B','bfee','4000','Fee Income','income');
 INSERT INTO neo_fin_posted_journal_lines VALUES('A','bank',15000,0),('A','fee',0,15000),('A','salary',5000,0),('A','bank',0,5000),('B','bfee',0,999000),('B','bfee',999000,0);
 INSERT INTO neo_fin_daily_ledger VALUES('A','money_in',15000),('A','money_out',5000),('B','money_in',999000);`);
 return {sqlite:db,prepare(sql){return{bind(...args){const stmt=db.prepare(sql);return{all:async()=>({results:stmt.all(...args)})}}}}};
}
test('owner sees own balanced accounts and independently computed cash movements',async()=>{
 const db=fixture();const r=await getFinanceSnapshot({db,accountId:'alice',organizationId:'A'});
 assert.equal(r.balanced,true);assert.equal(r.moneyInPaise,15000);assert.equal(r.moneyOutPaise,5000);
 assert.equal(r.profitPaise,10000);assert.equal(r.totalDebitPaise,20000);assert.equal(r.totalCreditPaise,20000);db.sqlite.close();
});
test('HO cannot view private center statements',async()=>{
 const db=fixture();await assert.rejects(getFinanceSnapshot({db,accountId:'ho',organizationId:'A'}),/Finance access denied/);db.sqlite.close();
});
test('Center B has its own separate cash balance',async()=>{
 const db=fixture();const r=await getFinanceSnapshot({db,accountId:'bob',organizationId:'B'});
 assert.equal(r.moneyInPaise,999000);assert.equal(r.moneyOutPaise,0);assert.equal(r.profitPaise,0);db.sqlite.close();
});

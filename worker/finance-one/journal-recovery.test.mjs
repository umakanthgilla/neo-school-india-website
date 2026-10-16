import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {recoverMissingCashJournals} from './journal-recovery.mjs';
function init(){const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE neo_fin_cash_events(organization_id TEXT,event_id TEXT,source_kind TEXT,source_id TEXT,direction TEXT,amount_paise INTEGER,effective_at TEXT);
 CREATE TABLE neo_fin_accounts(organization_id TEXT,id TEXT,account_code TEXT,active INTEGER);
 CREATE TABLE neo_fin_journals(organization_id TEXT,id TEXT,source_kind TEXT,source_id TEXT,status TEXT DEFAULT 'draft',posted_at TEXT,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_journal_lines(organization_id TEXT,journal_id TEXT,line_no INTEGER,account_id TEXT,debit_paise INTEGER,credit_paise INTEGER);
 INSERT INTO neo_fin_cash_events VALUES('A','E1','payroll_payment','TEST_A','money_out',12000,'2026-10-09'),('B','E1','payroll_payment','TEST_B','money_out',85000,'2026-10-09');
 INSERT INTO neo_fin_accounts VALUES('A','cash','1000',1),('A','sal','2100',1),('B','cash','1000',1),('B','sal','2100',1);`);
 const bind=(s,args)=>{const stmt=sql.prepare(s);return{all:async()=>({results:stmt.all(...args)}),first:async()=>stmt.get(...args),run:async()=>({success:true,meta:{changes:stmt.run(...args).changes}})}};
 return {sql,prepare(s){return{bind(...args){return bind(s,args)}}},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
test('finds missing journals and recovers only specified business',async()=>{
 const db=init();const a=await recoverMissingCashJournals({db,organizationId:'A'});
 assert.equal(a.checked,1);assert.equal(a.posted.length,1);assert.equal(a.failed.length,0);
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM neo_fin_journals WHERE organization_id=?').get('A').n,1);
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM neo_fin_journals WHERE organization_id=?').get('B').n,0);
 const second=await recoverMissingCashJournals({db,organizationId:'A'});assert.equal(second.checked,0);db.sql.close();
});
test('reports insufficient account configuration without touching other business',async()=>{
 const db=init();db.sql.exec("DELETE FROM neo_fin_accounts WHERE organization_id='A' AND account_code='2100'");
 const r=await recoverMissingCashJournals({db,organizationId:'A'});
 assert.equal(r.failed.length,1);assert.equal(r.posted.length,0);
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM neo_fin_journals').get().n,0);db.sql.close();
});

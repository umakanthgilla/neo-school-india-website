import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {syncVerifiedPayout} from './sync-verified-payout.mjs';
function fixture(verified=true){
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY,status TEXT);
 CREATE TABLE neo_fin_memberships(organization_id TEXT,account_id TEXT,role TEXT,active INTEGER);
 CREATE TABLE neo_fin_documents(organization_id TEXT,id TEXT,document_type TEXT,status TEXT,source_kind TEXT,source_id TEXT,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_payment_settlements(organization_id TEXT,id TEXT,document_id TEXT,amount_paise INTEGER,bank_reference TEXT,verified_at TEXT,status TEXT,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_cash_events(organization_id TEXT,event_id TEXT,source_kind TEXT,source_id TEXT,source_event_id TEXT,direction TEXT,amount_paise INTEGER,effective_at TEXT,verification_reference TEXT,PRIMARY KEY(organization_id,event_id),UNIQUE(organization_id,source_kind,source_id,source_event_id));
 CREATE TABLE neo_fin_accounts(organization_id TEXT,id TEXT,account_code TEXT,active INTEGER,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_journals(organization_id TEXT,id TEXT,source_kind TEXT,source_id TEXT,status TEXT DEFAULT 'draft',posted_at TEXT,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source_kind,source_id));
 CREATE TABLE neo_fin_journal_lines(organization_id TEXT,journal_id TEXT,line_no INTEGER,account_id TEXT,debit_paise INTEGER,credit_paise INTEGER,PRIMARY KEY(organization_id,journal_id,line_no));
 INSERT INTO neo_fin_organizations VALUES('HO','active'),('A','active');
 INSERT INTO neo_fin_memberships VALUES('HO','ho','owner',1),('A','alice','owner',1);
 INSERT INTO neo_fin_documents VALUES('A','PAYDOC','payment','approved','payroll_payment','RUN-01');`);
 db.prepare('INSERT INTO neo_fin_payment_settlements VALUES (?,?,?,?,?,?,?)').run('A','SET-1','PAYDOC',25000,'BANK-1','2026-10-09T10:00:00Z',verified?'verified':'pending');
 for(const code of ['1000','2100'])db.prepare('INSERT INTO neo_fin_accounts VALUES(?,?,?,1)').run('A',code,code);
 const bind=(sql,vals)=>{const stmt=db.prepare(sql);return{first:async()=>stmt.get(...vals),all:async()=>({results:stmt.all(...vals)}),run:async()=>{const r=stmt.run(...vals);return{success:true,meta:{changes:r.changes}}}}};
 return {sqlite:db,prepare(sql){return{bind(...params){return bind(sql,params)}}},async batch(statements){db.exec('BEGIN');try{let out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e}}};
}
const opts=db=>({db,authenticatedAccountId:'alice',organizationId:'A',sourceKind:'payroll_payment',sourceId:'RUN-01',settlementId:'SET-1'});
test('paid payroll posts exactly one cash event and balanced journal',async()=>{
 const db=fixture();const x=await syncVerifiedPayout(opts(db));assert.equal(x.cashCreated,true);assert.equal(x.journalCreated,true);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM neo_fin_cash_events').get().n,1);
 let lines=db.sqlite.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines ORDER BY line_no').all();
 assert.deepEqual(lines.map(x=>x.account_id),['2100','1000']);assert.equal(lines[0].debit_paise,25000);assert.equal(lines[1].credit_paise,25000);
 const retry=await syncVerifiedPayout(opts(db));assert.equal(retry.cashCreated,false);assert.equal(retry.journalCreated,false);db.sqlite.close();
});
test('unverified payroll remains unposted',async()=>{
 const db=fixture(false);await assert.rejects(syncVerifiedPayout(opts(db)),/Source verification failed/);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM neo_fin_cash_events').get().n,0);db.sqlite.close();
});
test('HO cannot post Center A payroll',async()=>{
 const db=fixture();await assert.rejects(syncVerifiedPayout({...opts(db),authenticatedAccountId:'ho'}),/Finance access denied/);db.sqlite.close();
});
test('if accounting fails, retry repairs journal without duplicating cash',async()=>{
 const db=fixture();db.sqlite.exec("DELETE FROM neo_fin_accounts WHERE organization_id='A' AND account_code='2100'");
 await assert.rejects(syncVerifiedPayout(opts(db)),/accounts unavailable/);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM neo_fin_cash_events').get().n,1);
 db.sqlite.exec("INSERT INTO neo_fin_accounts VALUES('A','2100','2100',1)");
 let result=await syncVerifiedPayout(opts(db));assert.equal(result.cashCreated,false);assert.equal(result.journalCreated,true);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM neo_fin_cash_events').get().n,1);db.sqlite.close();
});

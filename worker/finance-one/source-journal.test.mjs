import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {journalPlanForEvent,postJournalForCashEvent} from './source-journal.mjs';
function init(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 db.exec(`CREATE TABLE neo_fin_cash_events(organization_id TEXT,event_id TEXT,source_kind TEXT,direction TEXT,amount_paise INTEGER,PRIMARY KEY(organization_id,event_id));
 CREATE TABLE neo_fin_accounts(organization_id TEXT,id TEXT,account_code TEXT,active INTEGER,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_journals(organization_id TEXT,id TEXT,source_kind TEXT,source_id TEXT,status TEXT DEFAULT 'draft',posted_at TEXT,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source_kind,source_id));
 CREATE TABLE neo_fin_journal_lines(organization_id TEXT,journal_id TEXT,line_no INTEGER,account_id TEXT,debit_paise INTEGER,credit_paise INTEGER,PRIMARY KEY(organization_id,journal_id,line_no));
 CREATE TRIGGER balance BEFORE UPDATE OF status ON neo_fin_journals WHEN NEW.status='posted' BEGIN SELECT CASE WHEN
  (SELECT COUNT(*) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)<>2 OR
  (SELECT SUM(debit_paise-credit_paise) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)<>0
 THEN RAISE(ABORT,'Unbalanced') END;END;`);
 for(const org of ['HO','A','B']){
  for(const c of ['1000','1100','1200','2000','2100','2200','5000']) db.prepare('INSERT INTO neo_fin_accounts VALUES (?,?,?,1)').run(org,c,c);
 }
 const bind=(sql,params)=>{const stmt=db.prepare(sql);return {first:async()=>stmt.get(...params),all:async()=>({results:stmt.all(...params)}),run:async()=>{const m=stmt.run(...params);return{success:true,meta:{changes:m.changes}}}}};
 return {sqlite:db,prepare(sql){return {bind(...params){return bind(sql,params);}}},async batch(statements){db.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());db.exec('COMMIT');return out;}catch(err){db.exec('ROLLBACK');throw err;}}};
}
const event=(org,kind,dir='money_in',amount=5000,id='E1')=>({organization_id:org,event_id:id,source_kind:kind,direction:dir,amount_paise:amount});
const seed=(db,e)=>db.sqlite.prepare('INSERT INTO neo_fin_cash_events VALUES (?,?,?,?,?)').run(e.organization_id,e.event_id,e.source_kind,e.direction,e.amount_paise);
test('fee collection maps to Bank Dr and A/R Cr, not duplicate fee revenue',()=>{
 const x=journalPlanForEvent(event('A','fee_receipt'));assert.equal(x.debitCode,'1000');assert.equal(x.creditCode,'1100');
});
test('payroll payment maps to salary payable Dr and Bank Cr',()=>{
 const x=journalPlanForEvent(event('A','payroll_payment','money_out'));assert.equal(x.debitCode,'2100');assert.equal(x.creditCode,'1000');
});
test('wrong direction / unsupported source are rejected',()=>{
 assert.throws(()=>journalPlanForEvent(event('A','payroll_payment')),/direction/);
 assert.throws(()=>journalPlanForEvent(event('A','manual_ledger')),/No approved/);
});
test('verified cash event creates one balanced posted journal; repeat idempotent',async()=>{
 const db=init();seed(db,event('A','fee_receipt'));
 const first=await postJournalForCashEvent(db,'A','E1',{postedAt:'2026-10-09T10:00:00Z'});
 assert.equal(first.created,true);
 const again=await postJournalForCashEvent(db,'A','E1');assert.equal(again.created,false);
 const rows=db.sqlite.prepare("SELECT * FROM neo_fin_journal_lines WHERE organization_id='A'").all();
 assert.equal(rows.length,2);assert.equal(rows[0].debit_paise,5000);assert.equal(rows[1].credit_paise,5000);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_cash_events').get().n,1);
 db.sqlite.close();
});
test('HO cannot post A event',async()=>{
 const db=init();seed(db,event('A','fee_receipt'));
 await assert.rejects(postJournalForCashEvent(db,'HO','E1'),/not found/);
 db.sqlite.close();
});
test('invalid account configuration cannot post journal',async()=>{
 const db=init();seed(db,event('A','fee_receipt'));
 db.sqlite.exec("DELETE FROM neo_fin_accounts WHERE organization_id='A' AND account_code='1100'");
 await assert.rejects(postJournalForCashEvent(db,'A','E1'),/accounts unavailable/);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_journals').get().n,0);db.sqlite.close();
});
test('duplicate journal with tampered amount fails closed',async()=>{
 const db=init();seed(db,event('A','fee_receipt'));
 await postJournalForCashEvent(db,'A','E1');
 db.sqlite.exec("UPDATE neo_fin_cash_events SET amount_paise=6000 WHERE organization_id='A'");
 await assert.rejects(postJournalForCashEvent(db,'A','E1'),/Conflicting posted journal/);
 db.sqlite.close();
});
test('staging transaction batch rollback if posting fails',async()=>{
 const db=init();seed(db,event('A','fee_receipt'));
 db.sqlite.exec("CREATE TRIGGER forced_failure BEFORE INSERT ON neo_fin_journal_lines BEGIN SELECT RAISE(ABORT,'forced error'); END;");
 await assert.rejects(postJournalForCashEvent(db,'A','E1'),/forced error/);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_journals').get().n,0);
 db.sqlite.close();
});

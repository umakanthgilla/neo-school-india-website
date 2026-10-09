import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {postAccrualJournalForDocument} from './accrual-journal.mjs';
function init(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE neo_fin_documents(organization_id TEXT,id TEXT,document_type TEXT,status TEXT,gross_paise INTEGER,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_accounts(organization_id TEXT,id TEXT,account_code TEXT,active INTEGER,PRIMARY KEY(organization_id,id));
 CREATE TABLE neo_fin_journals(organization_id TEXT,id TEXT,source_kind TEXT,source_id TEXT,status TEXT DEFAULT 'draft',posted_at TEXT,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source_kind,source_id));
 CREATE TABLE neo_fin_journal_lines(organization_id TEXT,journal_id TEXT,line_no INTEGER,account_id TEXT,debit_paise INTEGER,credit_paise INTEGER,PRIMARY KEY(organization_id,journal_id,line_no));
 CREATE TABLE neo_fin_cash_events(organization_id TEXT,event_id TEXT);
 CREATE TRIGGER balance BEFORE UPDATE OF status ON neo_fin_journals WHEN NEW.status='posted' BEGIN SELECT CASE WHEN
  (SELECT COUNT(*) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)<>2 OR
  (SELECT SUM(debit_paise-credit_paise) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)<>0
 THEN RAISE(ABORT,'Unbalanced') END;END;`);
 for(const org of ['HO','A','B'])for(const code of ['1000','1100','2000','2100','4000','5100','5200'])db.prepare('INSERT INTO neo_fin_accounts VALUES(?,?,?,1)').run(org,code,code);
 const bind=(sql,params)=>{const stmt=db.prepare(sql);return{first:async()=>stmt.get(...params),all:async()=>({results:stmt.all(...params)}),run:async()=>{let result=stmt.run(...params);return{success:true,meta:{changes:result.changes}}}}};
 return{sqlite:db,prepare(sql){return{bind(...params){return bind(sql,params)}}},async batch(statements){db.exec('BEGIN');try{let results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(err){db.exec('ROLLBACK');throw err}}};
}
const seed=(db,type='sales_invoice',status='approved',org='A')=>db.sqlite.prepare('INSERT INTO neo_fin_documents VALUES (?,?,?,?,?)').run(org,'DOC1',type,status,10000);
test('sales invoice posts AR debit and revenue credit without cash movement',async()=>{
 const db=init();seed(db);let r=await postAccrualJournalForDocument(db,'A','DOC1');assert.equal(r.created,true);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_cash_events').get().n,0);
 const x=db.sqlite.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines ORDER BY line_no').all();
 assert.deepEqual(x.map(y=>y.account_id),['1100','4000']);assert.equal(x[0].debit_paise,10000);assert.equal(x[1].credit_paise,10000);
 assert.equal((await postAccrualJournalForDocument(db,'A','DOC1')).created,false);db.sqlite.close();
});
test('vendor bill posts cost and accounts payable; no cash',async()=>{
 const db=init();seed(db,'purchase_bill');await postAccrualJournalForDocument(db,'A','DOC1');
 assert.deepEqual(db.sqlite.prepare('SELECT account_id FROM neo_fin_journal_lines ORDER BY line_no').all().map(x=>x.account_id),['5200','2000']);db.sqlite.close();
});
test('payroll accrues expense vs payable without creating cash ledger entry',async()=>{
 const db=init();seed(db,'payroll_liability');await postAccrualJournalForDocument(db,'A','DOC1');
 assert.deepEqual(db.sqlite.prepare('SELECT account_id FROM neo_fin_journal_lines ORDER BY line_no').all().map(x=>x.account_id),['5100','2100']);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_cash_events').get().n,0);db.sqlite.close();
});
test('HO cannot access Center A document',async()=>{
 const db=init();seed(db);await assert.rejects(postAccrualJournalForDocument(db,'HO','DOC1'),/Approved document/);db.sqlite.close();
});
test('unapproved invoice blocked',async()=>{
 const db=init();seed(db,'sales_invoice','draft');
 await assert.rejects(postAccrualJournalForDocument(db,'A','DOC1'),/Approved document/);db.sqlite.close();
});
test('wrong amount on retry rejected',async()=>{
 const db=init();seed(db);await postAccrualJournalForDocument(db,'A','DOC1');
 db.sqlite.exec('UPDATE neo_fin_documents SET gross_paise=40000');
 await assert.rejects(postAccrualJournalForDocument(db,'A','DOC1'),/Conflicting accrual/);db.sqlite.close();
});

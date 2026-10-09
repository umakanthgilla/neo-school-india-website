import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {syncLegacyPayoutDocument} from './sync-legacy-payout-document.mjs';
import {syncVerifiedLegacyPayout} from './sync-legacy-payout.mjs';
const migrationNames=['finance_payroll_one_foundation.sql','finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql','finance_payroll_one_legacy_payout_integrity.sql'];
const migrations=migrationNames.map(p=>readFileSync(new URL('../../migrations/'+p,import.meta.url),'utf8'));
function fixture(kind='payroll_payment'){
 const config={
  payroll_payment:{sourceKind:'payroll',kind:'payroll',amountKey:'net_paise',voucher:'PAY_P1',ledger:'FIN_PAY_P1',account:'2100',status:'Paid'},
  vendor_payment:{sourceKind:'vendor_payment',kind:'vendor_payments',amountKey:'amount_paise',voucher:'VENDOR_P1',ledger:'FIN_VENDOR_P1',account:'2000',status:'Paid'},
  salary_advance_release:{sourceKind:'salary_advance',kind:'salary_advances',amountKey:'amount_paise',voucher:'ADV_P1',ledger:'FIN_ADV_P1',account:'1200',status:'Released'}
 }[kind];
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec(`CREATE TABLE neo_portal_records(school_id TEXT,kind TEXT,id TEXT,data TEXT,PRIMARY KEY(school_id,kind,id));
 INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES('A','Center A','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_school_ownership(school_id,organization_id,effective_from) VALUES('SCHOOL_A','A','2026-01-01');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES('A','fin:alice','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES('A','BANK','1000','Bank','asset'),('A','SAL','2100','Salary Liability','liability'),
 ('A','AP','2000','Accounts Payable','liability'),('A','ADV','1200','Employee Advance','asset');`);
 const insert=sql.prepare('INSERT INTO neo_portal_records VALUES(?,?,?,?)');
 insert.run('SCHOOL_A',config.kind,'P1',JSON.stringify({status:config.status,[config.amountKey]:10000}));
 insert.run('SCHOOL_A','vouchers',config.voucher,JSON.stringify({status:'Paid',source_kind:config.sourceKind,source_id:'P1',amount_paise:10000,voucher_no:'PV-2026-1',payment_mode:'Bank transfer'}));
 insert.run('SCHOOL_A','daily_accounts',config.ledger,JSON.stringify({direction:'OUT',status:'Posted',source_kind:'voucher',source_id:config.voucher,amount_paise:10000,reference:'PV-2026-1'}));
 const db={
  prepare(q){return{bind(...args){const st=sql.prepare(q);return{first:async()=>st.get(...args),all:async()=>({results:st.all(...args)}),run:async()=>{const r=st.run(...args);return{success:true,meta:{changes:r.changes}}}}}}},
  async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const results=[];for(const st of statements)results.push(await st.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}
 };
 return {db,sql,kind,config,params(extra={}){return{db,authenticatedAccountId:'fin:alice',organizationId:'A',schoolId:'SCHOOL_A',legacyRecordId:'P1',sourceKind:kind,...extra}}};
}
for(const kind of ['payroll_payment','vendor_payment','salary_advance_release']){
 test(kind+' creates Finance payment document from existing source but NO cash',async()=>{
  const f=fixture(kind);
  const r=await syncLegacyPayoutDocument(f.params());
  assert.equal(r.created,true);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_journals').get().n,0);
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
  assert.equal((await syncLegacyPayoutDocument(f.params())).created,false);
  // Separately verified bank settlement is the only step that unlocks cash:
  f.sql.prepare(`INSERT INTO neo_fin_payment_settlements(organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
  VALUES('A','SET1',?,10000,'verified','BANK1','2026-10-09T09:00:00Z')`).run(r.documentId);
  const cash=await syncVerifiedLegacyPayout({...f.params(),settlementId:'SET1'});
  assert.equal(cash.cashCreated,true);assert.equal(cash.journalCreated,true);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_cash_events').get().n,1);
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
  f.sql.close();
 });
}
test('a HO account cannot create a center payout document',async()=>{
 const f=fixture();
 await assert.rejects(syncLegacyPayoutDocument(f.params({authenticatedAccountId:'fin:ho'})),/Finance access denied/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,0);f.sql.close();
});
test('mismatched legacy voucher amount blocks document import',async()=>{
 const f=fixture('vendor_payment');
 f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.amount_paise',9000) WHERE kind='vouchers'");
 await assert.rejects(syncLegacyPayoutDocument(f.params()),/voucher missing or mismatched/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,0);f.sql.close();
});
test('legacy duplicate Daily Ledger entries block source document import',async()=>{
 const f=fixture('salary_advance_release');
 f.sql.prepare("INSERT INTO neo_portal_records VALUES('SCHOOL_A','daily_accounts','DUP',?)")
  .run(JSON.stringify({direction:'OUT',status:'Posted',source_kind:'voucher',source_id:'ADV_P1',amount_paise:10000,reference:'PV-2026-1'}));
 await assert.rejects(syncLegacyPayoutDocument(f.params()),/missing or duplicated/);
 f.sql.close();
});
test('changed original payout amount is rejected on repeated sync',async()=>{
 const f=fixture();
 await syncLegacyPayoutDocument(f.params());
 f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.net_paise',20000) WHERE kind='payroll'");
 await assert.rejects(syncLegacyPayoutDocument(f.params()),/Original payout voucher missing or mismatched/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM neo_fin_documents').get().n,1);f.sql.close();
});

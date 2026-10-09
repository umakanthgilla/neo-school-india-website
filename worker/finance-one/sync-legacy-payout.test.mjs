import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {syncVerifiedLegacyPayout} from './sync-legacy-payout.mjs';
const files=[
 'finance_payroll_one_foundation.sql',
 'finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql',
 'finance_payroll_one_legacy_payout_integrity.sql'
];
const migrations=files.map(x=>readFileSync(new URL('../../migrations/'+x,import.meta.url),'utf8'));
const CASES={
 payroll_payment:{kind:'payroll',status:'Paid',vKind:'payroll',vId:'PAY_RUN1',ledgerId:'FIN_PAY_RUN1',amountKey:'net_paise',amount:25000,account:'2100'},
 vendor_payment:{kind:'vendor_payments',status:'Paid',vKind:'vendor_payment',vId:'VENDOR_RUN1',ledgerId:'FIN_VENDOR_RUN1',amountKey:'amount_paise',amount:17500,account:'2000'},
 salary_advance_release:{kind:'salary_advances',status:'Released',vKind:'salary_advance',vId:'ADV_RUN1',ledgerId:'FIN_ADV_RUN1',amountKey:'amount_paise',amount:40000,account:'1200'}
};
function fixture(sourceKind='payroll_payment', {verified=true}={}){
 const c=CASES[sourceKind];
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 for(const m of migrations)sql.exec(m);
 sql.exec('CREATE TABLE neo_portal_records(school_id TEXT,kind TEXT,id TEXT,data TEXT,PRIMARY KEY(school_id,kind,id))');
 sql.exec(`INSERT INTO neo_fin_organizations (id,legal_name,organization_type)
 VALUES ('A','Center A','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_school_ownership(school_id,organization_id,effective_from)
 VALUES('SCHOOL_A','A','2026-01-01');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('A','fin:alice','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES ('A','BANK','1000','Bank','asset'),('A','SAL','2100','Salary payable','liability'),
 ('A','AP','2000','Accounts payable','liability'),('A','ADV','1200','Employee advance','asset'),('A','SAL_EXP','5100','Salary expense','expense');`);
 const insert=sql.prepare('INSERT INTO neo_portal_records VALUES (?,?,?,?)');
 const source=sourceKind==='payroll_payment' ? {status:'Paid',net_paise:c.amount,gross_paise:c.amount+5000,late_deduction_paise:0,attendance_deduction_paise:0,advance_recovery_paise:5000,deductions_paise:5000}: {status:c.status,[c.amountKey]:c.amount};
 insert.run('SCHOOL_A',c.kind,'RUN1',JSON.stringify(source));
 const voucher={status:'Paid',source_kind:c.vKind,source_id:'RUN1',amount_paise:c.amount,voucher_no:'PV-2026-1',payment_mode:'Bank transfer'};
 insert.run('SCHOOL_A','vouchers',c.vId,JSON.stringify(voucher));
 const ledger={direction:'OUT',status:'Posted',source_kind:'voucher',source_id:c.vId,amount_paise:c.amount,reference:voucher.voucher_no};
 insert.run('SCHOOL_A','daily_accounts',c.ledgerId,JSON.stringify(ledger));
 sql.prepare(`INSERT INTO neo_fin_documents
 (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
 VALUES ('A','DOC1','payment','approved',?,?,?)`).run(c.amount,sourceKind,'SCHOOL_A|RUN1');
 if(sourceKind==='payroll_payment'){
  const accrualRef='8:SCHOOL_A|4:RUN1',accrualId='PAY_ACCR|'+accrualRef;
  sql.prepare(`INSERT INTO neo_fin_documents
  (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
  VALUES('A',?,'payroll_liability','approved',30000,'legacy_payroll',?)`).run(accrualId,accrualRef);
  sql.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A',?,'document',?)").run('JNL-DOC|'+accrualId,accrualId);
  const statement=sql.prepare(`INSERT INTO neo_fin_journal_lines
  (organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES('A',?,?,?,?,?)`);
  statement.run('JNL-DOC|'+accrualId,1,'SAL_EXP',30000,0);
  statement.run('JNL-DOC|'+accrualId,2,'SAL',0,25000);
  statement.run('JNL-DOC|'+accrualId,3,'ADV',0,5000);
  sql.prepare("UPDATE neo_fin_journals SET status='posted',posted_at='2026-10-08T10:00:00Z' WHERE organization_id='A' AND id=?").run('JNL-DOC|'+accrualId);
 }
 sql.prepare(`INSERT INTO neo_fin_payment_settlements
 (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
 VALUES ('A','SET1','DOC1',?,?,?,?)`).run(c.amount,verified?'verified':'pending','BANK1','2026-10-09T10:00:00Z');
 const db={
  prepare(sqlStr){return{bind(...args){const st=sql.prepare(sqlStr);return{
    first:async()=>st.get(...args),all:async()=>({results:st.all(...args)}),
    run:async()=>{const result=st.run(...args);return{success:true,meta:{changes:result.changes}}}
  }}}},
  async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const res=[];for(const st of statements)res.push(await st.run());sql.exec('COMMIT');return res}catch(e){sql.exec('ROLLBACK');throw e}}
 };
 const request=(other={})=>({db,authenticatedAccountId:'fin:alice',organizationId:'A',schoolId:'SCHOOL_A',legacyRecordId:'RUN1',sourceKind,settlementId:'SET1',...other});
 return {sql,db,request,c,insert};
}
const count=(s,t)=>s.prepare('SELECT COUNT(*) AS n FROM '+t).get().n;
for(const kind of Object.keys(CASES)){
 test(kind+' verified bank settlement posts one cash event and balanced journal without legacy duplicates',async()=>{
  const f=fixture(kind);
  const created=await syncVerifiedLegacyPayout(f.request());
  assert.equal(created.cashCreated,true);assert.equal(created.journalCreated,true);
  const event=f.sql.prepare('SELECT direction,amount_paise FROM neo_fin_cash_events').get();
  assert.equal(event.direction,'money_out');assert.equal(event.amount_paise,f.c.amount);
  const lines=f.sql.prepare("SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE journal_id LIKE 'JNL|%' ORDER BY line_no").all();
  assert.deepEqual(lines.map(l=>l.account_id),[f.c.account==='2100'?'SAL':f.c.account==='2000'?'AP':'ADV','BANK']);
  assert.equal(lines[0].debit_paise,f.c.amount);assert.equal(lines[1].credit_paise,f.c.amount);
  assert.equal(count(f.sql,'neo_fin_cash_events'),1);
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM neo_portal_records WHERE kind='daily_accounts'").get().n,1);
  const retry=await syncVerifiedLegacyPayout(f.request());
  assert.equal(retry.cashCreated,false);assert.equal(retry.journalCreated,false);
  f.sql.close();
 });
}
test('old Paid flag and original voucher never replace independent bank verification',async()=>{
 const f=fixture('payroll_payment',{verified:false});
 await assert.rejects(syncVerifiedLegacyPayout(f.request()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('HO account cannot access Center A payroll payout',async()=>{
 const f=fixture();
 await assert.rejects(syncVerifiedLegacyPayout(f.request({authenticatedAccountId:'fin:ho'})),/Finance access denied/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('verified settlement amount must match original payroll net and voucher',async()=>{
 const f=fixture();
 f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.net_paise',99000) WHERE kind='payroll'");
 await assert.rejects(syncVerifiedLegacyPayout(f.request()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('missing original voucher blocks Finance mirror',async()=>{
 const f=fixture('vendor_payment');
 f.sql.exec("DELETE FROM neo_portal_records WHERE kind='vouchers'");
 await assert.rejects(syncVerifiedLegacyPayout(f.request()),/Source verification failed/);
 f.sql.close();
});
test('orphan, duplicate or mismatched legacy ledger blocks Finance mirror',async()=>{
 const f=fixture('salary_advance_release');
 f.insert.run('SCHOOL_A','daily_accounts','COPY',JSON.stringify({source_kind:'voucher',source_id:'ADV_RUN1',direction:'OUT',amount_paise:40000,reference:'PV-2026-1',status:'Posted'}));
 await assert.rejects(syncVerifiedLegacyPayout(f.request()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);
 f.sql.close();
});
test('Cash and Cheque voucher modes do not qualify for bank-reconciled payout',async()=>{
 const f=fixture('vendor_payment');
 f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.payment_mode','Cash') WHERE kind='vouchers'");
 await assert.rejects(syncVerifiedLegacyPayout(f.request()),/Source verification failed/);
 assert.equal(count(f.sql,'neo_fin_cash_events'),0);f.sql.close();
});
test('database rejects second full verified settlement for the same legacy payment',()=>{
 const f=fixture('vendor_payment');
 assert.throws(()=>f.sql.exec(`INSERT INTO neo_fin_payment_settlements
 (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
 VALUES('A','SET2','DOC1',17500,'verified','BANK2','2026-10-09T11:00:00Z')`),/already settled/);
 f.sql.close();
});
test('database refuses partial verified settlements against a legacy full payout',()=>{
 const f=fixture('vendor_payment',{verified:false});
 assert.throws(()=>f.sql.exec("UPDATE neo_fin_payment_settlements SET amount_paise=1,status='verified' WHERE id='SET1'"),/exact full settlement/);
 f.sql.close();
});
test('original verified bank evidence cannot be edited or deleted',()=>{
 const f=fixture();
 assert.throws(()=>f.sql.exec("UPDATE neo_fin_payment_settlements SET status='reversed' WHERE id='SET1'"),/immutable/);
 assert.throws(()=>f.sql.exec("DELETE FROM neo_fin_payment_settlements WHERE id='SET1'"),/immutable/);
 f.sql.close();
});

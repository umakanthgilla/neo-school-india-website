import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {listPayoutSettlementStatus} from './settlement-status.mjs';
import {handleFinanceReadApi} from './finance-read-api.mjs';
const migration=readFileSync(new URL('../../migrations/finance_payroll_one_foundation.sql',import.meta.url),'utf8');
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(migration);
 sqlite.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Center A','independent_center'),('B','Center B','independent_center'),('HO','Head Office','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('A','fin:alice','owner'),('B','fin:bob','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise,source_kind,source_id)
 VALUES('A','PENDING','payment','approved',10000,'vendor_payment','SCHOOL_A|V1'),
 ('A','PAID','payment','approved',10000,'payroll_payment','SCHOOL_A|P1'),
 ('A','PART','payment','approved',10000,'vendor_payment','other-payout'),
 ('A','OVER','payment','approved',10000,'vendor_payment','over-payout'),
 ('B','ONLY_B','payment','approved',950000,'payroll_payment','SCHOOL_B|P1');`);
 const ins=sqlite.prepare(`INSERT INTO neo_fin_payment_settlements
 (organization_id,id,document_id,amount_paise,status,bank_reference,verified_at)
 VALUES(?,?,?,?,?,?,?)`);
 ins.run('A','S1','PAID',10000,'verified','BANK1','2026-10-09T10:00:00Z');
 ins.run('A','S2','PART',5000,'verified','BANK2','2026-10-09T10:00:00Z');
 ins.run('A','S3','OVER',12000,'verified','BANK3','2026-10-09T10:00:00Z');
 const db={prepare(q){return{bind(...args){const st=sqlite.prepare(q);return{all:async()=>({results:st.all(...args)}),first:async()=>st.get(...args)}}}}};
 return{sqlite,db};
}
test('a center sees only its payout reconciliation states',async()=>{
 const f=fixture();
 const report=await listPayoutSettlementStatus({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A'});
 assert.equal(report.entries.length,4);
 assert.deepEqual(Object.fromEntries(report.entries.map(x=>[x.documentId,x.status])),{
  PENDING:'pending',PAID:'verified',PART:'partially_verified',OVER:'over_verified'});
 assert.ok(report.entries.every(x=>x.sourceId!=='SCHOOL_B|P1'));
 f.sqlite.close();
});
test('HO and a different center cannot inspect private bank settlement status',async()=>{
 const f=fixture();
 await assert.rejects(listPayoutSettlementStatus({db:f.db,authenticatedAccountId:'fin:ho',organizationId:'A'}),/Finance access denied/);
 await assert.rejects(listPayoutSettlementStatus({db:f.db,authenticatedAccountId:'fin:bob',organizationId:'A'}),/Finance access denied/);
 f.sqlite.close();
});
test('unverified payout remains pending without a valid bank verification record',async()=>{
 const f=fixture();
 const x=await listPayoutSettlementStatus({db:f.db,authenticatedAccountId:'fin:bob',organizationId:'B'});
 assert.equal(x.entries[0].status,'pending');assert.equal(x.entries[0].verifiedAmountPaise,0);f.sqlite.close();
});
test('the Finance API exposes a read-only settlement status route with bound organization',async()=>{
 const f=fixture();
 const url='https://example.com/api/finance-one/v1/organizations/A/settlements?limit=2';
 const res=await handleFinanceReadApi({request:new Request(url),db:f.db,authenticatedAccountId:'fin:alice'});
 assert.equal(res.status,200);assert.equal((await res.json()).entries.length,2);
 const bad=await handleFinanceReadApi({request:new Request(url,{method:'POST'}),db:f.db,authenticatedAccountId:'fin:alice'});
 assert.equal(bad.status,405);f.sqlite.close();
});
test('settlement report limit must be a bounded integer',async()=>{
 const f=fixture();
 await assert.rejects(listPayoutSettlementStatus({db:f.db,authenticatedAccountId:'fin:alice',organizationId:'A',limit:0}),/limit/);
 f.sqlite.close();
});

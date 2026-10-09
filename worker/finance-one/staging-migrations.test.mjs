import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {financeOneStagingPreflight} from './staging-preflight.mjs';

const orderedMigrations=[
 'finance_payroll_one_foundation.sql',
 'finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql',
 'finance_payroll_one_auth_accounts.sql',
 'finance_payroll_one_receipt_evidence.sql',
 'finance_payroll_one_legacy_payout_integrity.sql',
 'finance_payroll_one_statutory_review.sql',
 'finance_payroll_one_statutory_remittance.sql'
];
const env={
 FINANCE_ONE_ENVIRONMENT:'staging',
 FINANCE_ONE_READ_API_ENABLED:'true',
 FINANCE_ONE_SESSION_SECRET:'temporary-test-secret-32-characters-minimum'
};
function database(stopAfter=orderedMigrations.length){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const path of orderedMigrations.slice(0,stopAfter)){
  sql.exec(readFileSync(new URL('../../migrations/'+path,import.meta.url),'utf8'));
 }
 return {
  sql,
  db:{prepare(query){const stmt=sql.prepare(query);return{all:async()=>({results:stmt.all()})}}}
 };
}
test('all eight SQL migrations apply in release order and pass real staging preflight',async()=>{
 const {sql,db}=database();
 const status=await financeOneStagingPreflight({db,env});
 assert.equal(status.ready,true,JSON.stringify(status.blockers));
 assert.equal(status.schema.tables>=13,true);
 assert.equal(status.schema.views>=2,true);
 assert.equal(status.schema.triggers>=19,true);
 assert.deepEqual(status.blockers,[]);
 sql.close();
});
test('leaving out last statutory remittance migration blocks release',async()=>{
 const {sql,db}=database(7);
 const result=await financeOneStagingPreflight({db,env});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes('Missing table neo_fin_statutory_remittances'));
 assert.ok(result.blockers.includes('Missing trigger neo_fin_stat_remit_no_overclear'));
 sql.close();
});
test('preflight never approves a production environment even with complete schema',async()=>{
 const {sql,db}=database();
 const status=await financeOneStagingPreflight({db,env:{...env,FINANCE_ONE_ENVIRONMENT:'production'}});
 assert.equal(status.ready,false);
 assert.ok(status.blockers.includes('Not explicitly marked staging'));
 sql.close();
});
test('staging auth, posted-journal and verified statutory evidence are enforced together',()=>{
 const {sql}=database();
 sql.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('A','Independent Center','independent_center');
 INSERT INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type)
 VALUES('A','PF','2111','PF Payable','liability'),('A','BANK','1000','Bank','asset');`);
 sql.exec(`INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations)
 VALUES('fin:a','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',210000)`);
 assert.throws(()=>sql.exec("UPDATE neo_fin_auth_accounts SET active=0 WHERE account_id='fin:a'"),/Credential change requires new version/);
 assert.throws(()=>sql.exec(`INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id,status,posted_at)
 VALUES('A','J1','document','D1','posted','2026-10-09')`),/Journal must start as draft/);
 sql.close();
});

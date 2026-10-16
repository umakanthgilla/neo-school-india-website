import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateStagingQaSeed,generateSyntheticSchoolSourceSql,STAGING_DATABASE_ID} from './staging-qa-seed.mjs';
import {STANDARD_CHART} from './accounting-chart.mjs';
test('source-only fixture contains isolated synthetic school records without credentials, evidence or Finance tables',()=>{
 const source=new DatabaseSync(':memory:');try{
  const sql=generateSyntheticSchoolSourceSql();assert.doesNotMatch(sql,/INSERT INTO neo_fin_|password|bank_reconciled|statutory_review_id/);
  source.exec(sql);assert.equal(source.prepare('SELECT count(*) n FROM neo_portal_records').get().n,15);
  assert.deepEqual(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name),['neo_portal_records']);
  assert.equal(source.prepare('SELECT count(DISTINCT school_id) n FROM neo_portal_records').get().n,3);
  assert.throws(()=>source.exec(sql),/UNIQUE constraint/);
 }finally{source.close();}
});
test('synthetic staging seed isolates ownership, never certifies evidence and refuses another target',async()=>{
 await assert.rejects(generateStagingQaSeed({databaseId:'a60f04c0-c504-4727-b042-f7f02fc846a8'}),/Only the dedicated/);
 const seed=await generateStagingQaSeed({databaseId:STAGING_DATABASE_ID});
 const db=new DatabaseSync(':memory:');try{
  db.exec('PRAGMA foreign_keys=ON');
  for(const name of ['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections','source_operations'])db.exec(readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8'));
  db.exec("INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES('EXISTING','Existing center','independent_center')");
  db.exec(seed.sql);
  assert.equal(db.prepare('SELECT count(*) n FROM neo_fin_organizations').get().n,4);
  assert.equal(db.prepare('SELECT count(*) n FROM neo_fin_accounts').get().n,3*STANDARD_CHART.length);
  assert.equal(db.prepare('SELECT count(*) n FROM neo_portal_records').get().n,15);
  assert.equal(db.prepare('SELECT count(*) n FROM neo_fin_memberships').get().n,5);
  assert.equal(new Set(seed.credentials.map(c=>c.password)).size,5);
  for(const c of seed.credentials){assert.ok(!seed.sql.includes(c.password));assert.ok(c.password.length>=32);}
  for(const table of ['neo_fin_documents','neo_fin_journals','neo_fin_cash_events','neo_fin_receipt_verifications','neo_fin_payroll_statutory_reviews'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,0);
  assert.throws(()=>db.exec(seed.sql),/UNIQUE constraint/);
  assert.equal(db.prepare("SELECT count(*) n FROM neo_fin_memberships WHERE organization_id='EXISTING'").get().n,0);
 }finally{db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {financeOneStagingPreflight} from './staging-preflight.mjs';
const env={FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:'safe-but-demo-only-finance-signing-secret',
 FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>({success:true})},
 FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async()=>({success:true})}};
const objects={
 table:['neo_fin_organizations','neo_fin_school_ownership','neo_fin_memberships','neo_fin_auth_accounts','neo_fin_documents','neo_fin_payment_settlements','neo_fin_accounts','neo_fin_journals','neo_fin_journal_lines','neo_fin_cash_events','neo_fin_receipt_verifications','neo_fin_payroll_statutory_reviews','neo_fin_statutory_remittances','neo_fin_session_revocations'],
 view:['neo_fin_daily_ledger','neo_fin_posted_journal_lines'],
 trigger:['neo_fin_cash_events_no_update','neo_fin_cash_events_no_delete','neo_fin_journal_post_balanced','neo_fin_journal_posted_immutable','neo_fin_auth_rotate_credentials',
 'neo_fin_receipt_verification_no_update','neo_fin_receipt_verification_no_delete',
 'neo_fin_legacy_payout_verify_insert','neo_fin_legacy_payout_verify_update',
 'neo_fin_legacy_payout_verified_immutable','neo_fin_legacy_payout_verified_no_delete','neo_fin_payroll_review_no_update','neo_fin_payroll_review_no_delete',
 'neo_fin_statutory_remittance_no_update','neo_fin_statutory_remittance_no_delete',
 'neo_fin_stat_remit_verify_insert','neo_fin_stat_remit_verify_update',
 'neo_fin_stat_remit_verified_no_update','neo_fin_stat_remit_verified_no_delete',
 'neo_fin_stat_remit_no_overclear','neo_fin_session_revocations_no_update',
 'neo_fin_document_locked_no_update','neo_fin_document_locked_no_delete']};
const rows=Object.entries(objects).flatMap(([type,names])=>names.map(name=>({type,name})));
const fakeDb=records=>({prepare(query){assert.match(query,/sqlite_master/);return{all:async()=>({results:records})}}});
test('complete staging schema and secure configuration pass without database writes',async()=>{
 const result=await financeOneStagingPreflight({db:fakeDb(rows),env});
 assert.equal(result.ready,true);assert.deepEqual(result.blockers,[]);assert.equal(result.schema.tables,14);
});
test('never approve a production environment or disabled Finance feature',async()=>{
 const result=await financeOneStagingPreflight({db:fakeDb(rows),env:{...env,FINANCE_ONE_ENVIRONMENT:'production',FINANCE_ONE_READ_API_ENABLED:'false'}});
 assert.equal(result.ready,false);assert.ok(result.blockers.includes('Not explicitly marked staging'));
});
test('missing immutable trigger blocks staging readiness',async()=>{
 const result=await financeOneStagingPreflight({db:fakeDb(rows.filter(r=>r.name!=='neo_fin_cash_events_no_update')),env});
 assert.equal(result.ready,false);assert.ok(result.blockers.includes('Missing trigger neo_fin_cash_events_no_update'));
});
test('missing schema fails closed with clear blocker information',async()=>{
 const result=await financeOneStagingPreflight({db:fakeDb([]),env});assert.equal(result.ready,false);assert.ok(result.blockers.length>=17);
});
test('missing database and failed inspection cannot certify staging',async()=>{
 const absent=await financeOneStagingPreflight({env});assert.equal(absent.ready,false);
 const bad=await financeOneStagingPreflight({db:{prepare(){throw Error('not ready')}},env});
 assert.equal(bad.ready,false);assert.ok(bad.blockers.includes('Finance schema inspection failed'));
});


test('staging API cannot be enabled without both native login abuse-limit bindings',async()=>{
 const full=await financeOneStagingPreflight({db:fakeDb(rows),env});
 assert.equal(full.ready,true);
 for(const missing of ['FINANCE_ONE_LOGIN_CLIENT_LIMIT','FINANCE_ONE_LOGIN_ACCOUNT_LIMIT']){
  const missingEnv={...env,[missing]:undefined};
  const result=await financeOneStagingPreflight({db:fakeDb(rows),env:missingEnv});
  assert.equal(result.ready,false);
  assert.ok(result.blockers.some(x=>x.includes('rate limiter missing')));
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {financeOneStagingPreflight} from './staging-preflight.mjs';
const env={FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:'safe-but-demo-only-finance-signing-secret'};
const objects={
 table:['neo_fin_organizations','neo_fin_school_ownership','neo_fin_memberships','neo_fin_auth_accounts','neo_fin_documents','neo_fin_payment_settlements','neo_fin_accounts','neo_fin_journals','neo_fin_journal_lines','neo_fin_cash_events'],
 view:['neo_fin_daily_ledger','neo_fin_posted_journal_lines'],
 trigger:['neo_fin_cash_events_no_update','neo_fin_cash_events_no_delete','neo_fin_journal_post_balanced','neo_fin_journal_posted_immutable','neo_fin_auth_rotate_credentials']};
const rows=Object.entries(objects).flatMap(([type,names])=>names.map(name=>({type,name})));
const fakeDb=records=>({prepare(query){assert.match(query,/sqlite_master/);return{all:async()=>({results:records})}}});
test('complete staging schema and secure configuration pass without database writes',async()=>{
 const result=await financeOneStagingPreflight({db:fakeDb(rows),env});
 assert.equal(result.ready,true);assert.deepEqual(result.blockers,[]);assert.equal(result.schema.tables,10);
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

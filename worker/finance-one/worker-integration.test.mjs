import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../neo-lead-crm-api-worker-transport-phase1.js';
const financePath='https://worker.example/api/finance-one/v1/organizations/CENTER_A/documents';
test('Finance ONE import leaves existing Worker fetch entrypoint intact',()=>{
 assert.equal(typeof worker.fetch,'function');
});
test('Finance endpoint is invisible without explicit staging feature flag',async()=>{
 const response=await worker.fetch(new Request(financePath),{});
 assert.equal(response.status,404);
 assert.equal((await response.json()).error,'Not found');
});
test('Finance endpoint fails closed without D1 database when opt-in enabled',async()=>{
 const response=await worker.fetch(new Request(financePath),{FINANCE_ONE_READ_API_ENABLED:'true'});
 assert.equal(response.status,503);
});
test('Finance endpoint requires independent finance bearer session',async()=>{
 const response=await worker.fetch(new Request(financePath),{FINANCE_ONE_READ_API_ENABLED:'true',DB:{}});
 assert.equal(response.status,401);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../../finance-one/portal.html',import.meta.url),'utf8');
test('Finance ONE portal contains separate login and required read-only sections',()=>{
 for(const id of ['login-form','org','account','password','dashboard-panel','money-in','money-out','net','profit','ledger-rows','document-rows','sign-out']){
  assert.match(page,new RegExp('id="'+id+'"'));
 }
 assert.match(page,/Cash Ledger/);
 assert.match(page,/view only/);
});
test('Finance portal JavaScript parses and never persists Finance bearer tokens in browser storage',()=>{
 const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Expected embedded portal script');
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.doesNotMatch(script,/localStorage|sessionStorage|document\.cookie|innerHTML/);
});
test('portal displays independent bank verification without write actions',()=>{
 assert.match(page,/id="settlement-rows"/);
 assert.match(page,/id="settlement-empty"/);
 assert.match(page,/call\(path\+'\/settlements\?limit=50'\)/);
 assert.match(page,/Awaiting bank verification/);
 assert.match(page,/Amount mismatch/);
});
test('Finance portal displays source data as text, not executable markup',()=>{
 assert.match(page,/node\.textContent=/);
 assert.match(page,/replaceChildren\(/);
});

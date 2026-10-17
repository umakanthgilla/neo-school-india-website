import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmployeeReviewAPI} from './employee-review.mjs';
test('employee session uses same-origin review routes without cookies and preserves idempotency',async()=>{
 const api=createEmployeeReviewAPI({getToken:()=>'individual-session',fetcher:async(path,options)=>{
  assert.equal(path,'/api/one-ai/drafts/generate');
  assert.equal(options.headers.authorization,'Bearer individual-session');
  assert.equal(options.headers['idempotency-key'],'retry-key');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.deepEqual(JSON.parse(options.body),{leadId:'enquiry:E1',language:'te'});
  return Response.json({id:'d1'});
 }});
 assert.deepEqual(await api('/api/drafts/generate',{method:'POST',idempotencyKey:'retry-key',body:{leadId:'enquiry:E1',language:'te'}}),{id:'d1'});
});
test('missing session, sending and external routes fail before network',async()=>{
 let calls=0;const api=createEmployeeReviewAPI({getToken:()=>'',fetcher:async()=>{calls++;}});
 for(const path of ['/api/drafts','/api/drafts/d1/send','https://foreign.example/api/drafts','//foreign.example/api/drafts'])
  await assert.rejects(api(path));
 assert.equal(calls,0);
});
test('logout/account change discards delayed responses and server denials remain errors',async()=>{
 let token='staff-a';
 const api=createEmployeeReviewAPI({getToken:()=>token,fetcher:async()=>{token='staff-b';return Response.json({drafts:[{message:'private'}]});}});
 await assert.rejects(api('/api/drafts'),/Session changed/);
 const denied=createEmployeeReviewAPI({getToken:()=>token,fetcher:async()=>Response.json({error:'Staff account is not provisioned'},{status:403})});
 await assert.rejects(denied('/api/drafts'),/not provisioned/);
});

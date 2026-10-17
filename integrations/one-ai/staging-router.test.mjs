import test from 'node:test';
import assert from 'node:assert/strict';
import router from './staging-router.mjs';
const origin='https://neo-stage.example';
const request=(path='/api/one-ai/drafts/generate',options={})=>new Request(origin+path,{
 method:'POST',headers:{authorization:'Bearer synthetic.session','content-type':'application/json',origin,'idempotency-key':'request-1'},
 body:JSON.stringify({leadId:'enquiry:E1',language:'te'}),...options
});
test('staging proxy preserves scope input and idempotency but strips cookies and forged identity headers',async()=>{
 let calls=0;
 const req=request();
 req.headers.set('cookie','admin=private');
 req.headers.set('x-tenant-id','forged');
 const result=await router.fetch(req,{ENABLE_ONE_AI:'true',CRM_ORIGIN:origin,ONE_AI_GATEWAY:{async fetch(r){
  calls++;
  assert.equal(r.url,'https://one-ai-gateway.internal/api/one-ai/drafts/generate');
  assert.equal(r.headers.get('authorization'),'Bearer synthetic.session');
  assert.equal(r.headers.get('idempotency-key'),'request-1');
  assert.equal(r.headers.has('cookie'),false);
  assert.equal(r.headers.has('x-tenant-id'),false);
  assert.deepEqual(await r.json(),{leadId:'enquiry:E1',language:'te'});
  return Response.json({id:'draft-1',state:'draft'},{status:201,headers:{'set-cookie':'private=1'}});
 }}});
 assert.equal(calls,1);assert.equal(result.status,201);
 assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(result.headers.has('set-cookie'),false);
});
test('disabled, send, foreign-origin, missing bearer, and oversized requests never reach gateway',async()=>{
 let calls=0;
 const env={ENABLE_ONE_AI:'true',CRM_ORIGIN:origin,ONE_AI_GATEWAY:{fetch(){calls++;throw Error('unexpected');}}};
 assert.equal((await router.fetch(request(),{...env,ENABLE_ONE_AI:'false'})).status,404);
 assert.equal((await router.fetch(request('/api/one-ai/drafts/d1/send'),env)).status,404);
 const foreign=request();foreign.headers.set('origin','https://foreign.example');
 assert.equal((await router.fetch(foreign,env)).status,403);
 const unsigned=request();unsigned.headers.delete('authorization');
 assert.equal((await router.fetch(unsigned,env)).status,401);
 assert.equal((await router.fetch(request(undefined,{body:'x'.repeat(12001)}),env)).status,413);
 assert.equal(calls,0);
});
test('legacy requests pass unchanged to the existing app; AI routes never fall through',async()=>{
 let calls=0;
 const req=new Request(origin+'/api/employee/me',{headers:{authorization:'Bearer staff.session'}});
 const env={NEO_APP:{fetch(r){calls++;assert.equal(r,req);return Response.json({account_id:'staff-1'});}}};
 assert.equal((await router.fetch(req,env)).status,200);
 assert.equal((await router.fetch(request(),env)).status,404);
 assert.equal(calls,1);
});
test('gateway rejection, failure and redirect remain closed',async()=>{
 for(const status of [401,403,409,429,503]){
  const r=await router.fetch(request(),{ENABLE_ONE_AI:'true',CRM_ORIGIN:origin,ONE_AI_GATEWAY:{fetch:async()=>Response.json({error:'denied'},{status})}});
  assert.equal(r.status,status);
 }
 for(const [fetch,status] of [[async()=>{throw Error('private upstream details')},503],[async()=>Response.redirect('https://foreign.example'),502]]){
  const r=await router.fetch(request(),{ENABLE_ONE_AI:'true',CRM_ORIGIN:origin,ONE_AI_GATEWAY:{fetch}});
  assert.equal(r.status,status);assert.doesNotMatch(await r.text(),/private upstream details/);
 }
});

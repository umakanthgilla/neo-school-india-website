import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './staging-entry.mjs';
const path='https://finance-staging.example.workers.dev/api/finance-one/v1/organizations/A/daily-ledger';
const config={FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_PORTAL_ORIGIN:'https://finance-staging.example.com',FINANCE_ONE_READ_API_ENABLED:'false'};
const request=(method='GET',url=path,origin)=>new Request(url,{method,headers:origin?{Origin:origin}:{}});
test('optional Access login button is exposed only with explicit complete configuration',async()=>{
 const html='<!doctype html><style></style><button id="access-sign-in" hidden>Continue</button><script></script>';
 const settings={...config,FINANCE_ONE_READ_API_ENABLED:'true',ASSETS:{fetch:async()=>new Response(html)}};
 const url='https://finance-staging.example.workers.dev/portal.html';
 for(const extra of [{},{FINANCE_ONE_ACCESS_LOGIN_ENABLED:'true'}]){
  assert.match(await (await worker.fetch(request('GET',url),{...settings,...extra})).text(),/id="access-sign-in" hidden/);
 }
 const response=await worker.fetch(request('GET',url),{...settings,FINANCE_ONE_ACCESS_LOGIN_ENABLED:'true',
  FINANCE_ONE_ACCESS_ISSUER:'https://finance-test.cloudflareaccess.com',FINANCE_ONE_ACCESS_AUDIENCE:'a'.repeat(64),
  FINANCE_ONE_ACCESS_IDENTITIES:JSON.stringify([{subject:'person-a',accountId:'fin:alice'}])});
 assert.doesNotMatch(await response.text(),/id="access-sign-in" hidden/);
});
test('Finance staging entry refuses non-staging deployments',async()=>{
 const response=await worker.fetch(request(),{...config,FINANCE_ONE_ENVIRONMENT:'production'});
 assert.equal(response.status,404);
});
test('Finance staging entry hides unrelated school routes',async()=>{
 const response=await worker.fetch(request('GET','https://finance-staging.example.workers.dev/api/portal/A/students'),config);
 assert.equal(response.status,404);
});
test('unexpected cross-origin Finance requests are rejected',async()=>{
 const response=await worker.fetch(request('GET',path,'https://evil.example'),config);
 assert.equal(response.status,403);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('approved staging portal origin receives scoped CORS preflight',async()=>{
 const response=await worker.fetch(request('OPTIONS',path,'https://finance-staging.example.com'),config);
 assert.equal(response.status,204);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://finance-staging.example.com');
 assert.match(response.headers.get('Access-Control-Allow-Headers'),/Authorization/);
});
test('GET Finance route cannot be accessed while feature flag disabled',async()=>{
 const response=await worker.fetch(request('GET',path,'https://finance-staging.example.com'),config);
 assert.equal(response.status,404);
});
test('enabled staging Finance route requires D1 database and credentials',async()=>{
 const response=await worker.fetch(request('GET',path),{...config,FINANCE_ONE_READ_API_ENABLED:'true'});
 assert.equal(response.status,503);
});

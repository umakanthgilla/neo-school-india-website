import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from './staging-entry.mjs';
const html=readFileSync(new URL('../../finance-one/portal.html',import.meta.url),'utf8');
const url='https://finance-one-staging.example.invalid';
const config={
 FINANCE_ONE_ENVIRONMENT:'staging',
 FINANCE_ONE_READ_API_ENABLED:'true',
 FINANCE_ONE_PORTAL_ORIGIN:'https://other-staging.example.invalid',
 ASSETS:{async fetch(request){
  assert.equal(new URL(request.url).pathname,'/portal.html');
  return new Response(html,{status:200,headers:{'content-type':'text/html'}});
 }}
};
const req=(path='/',method='GET',origin)=>new Request(url+path,{method,headers:origin?{Origin:origin}:{}});
test('staging portal never opens if feature is disabled, even when assets exist',async()=>{
 const response=await worker.fetch(req('/portal.html'),{...config,FINANCE_ONE_READ_API_ENABLED:'false'});
 assert.equal(response.status,404);
 assert.doesNotMatch(await response.text(),/Finance ONE Login/);
});
test('production environment cannot expose staging Finance portal assets',async()=>{
 const response=await worker.fetch(req('/'),{...config,FINANCE_ONE_ENVIRONMENT:'production'});
 assert.equal(response.status,404);
});
test('Finance portal serves from same Worker only behind active staging with strong per-response CSP',async()=>{
 const first=await worker.fetch(req('/portal.html'),config);
 const second=await worker.fetch(req('/'),config);
 assert.equal(first.status,200);assert.equal(second.status,200);
 const page=await first.text();
 assert.match(page,/Finance ONE Login/);
 assert.match(page,/id="statutory-rows"/);
 assert.equal(first.headers.get('cache-control'),'no-store');
 assert.equal(first.headers.get('x-frame-options'),'DENY');
 assert.equal(first.headers.get('x-content-type-options'),'nosniff');
 assert.equal(first.headers.get('referrer-policy'),'no-referrer');
 const nonceStyle=page.match(/<style nonce="([^"]+)">/);
 const nonceScript=page.match(/<script nonce="([^"]+)">/);
 assert.ok(nonceStyle);assert.ok(nonceScript);
 assert.equal(nonceStyle[1],nonceScript[1]);
 const csp=first.headers.get('content-security-policy');
 assert.match(csp,/default-src 'none'/);
 assert.match(csp,/connect-src 'self'/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.ok(csp.includes("'nonce-"+nonceStyle[1]+"'"));
 assert.notEqual(nonceStyle[1],(await second.text()).match(/<script nonce="([^"]+)">/)[1]);
 assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);
});
test('unconfigured Worker assets fail without exposing a partial page',async()=>{
 const response=await worker.fetch(req('/portal.html'),{...config,ASSETS:undefined});
 assert.equal(response.status,503);
 assert.doesNotMatch(await response.text(),/Finance ONE Login/);
});
test('Worker refuses inline-event-handler HTML even if asset response is 200',async()=>{
 const malicious='<html><style>body{}</style><img src=x onerror="x()"><script>void 0</script></html>';
 const response=await worker.fetch(req('/'),{...config,ASSETS:{fetch:async()=>new Response(malicious)}});
 assert.equal(response.status,503);
});
test('non-portal assets and unsupported methods are not served',async()=>{
 assert.equal((await worker.fetch(req('/secret.txt'),config)).status,404);
 assert.equal((await worker.fetch(req('/portal.html','POST'),config)).status,405);
});
test('same-origin portal browser requests are allowed; foreign origins are refused',async()=>{
 const api='/api/finance-one/v1/organizations/CENTER_A/documents';
 const same=await worker.fetch(req(api,'GET',url),{...config,DB:null});
 assert.equal(same.status,503);
 assert.equal(same.headers.get('Access-Control-Allow-Origin'),url);
 const foreign=await worker.fetch(req(api,'GET','https://attacker.example.invalid'),config);
 assert.equal(foreign.status,403);
 assert.equal(foreign.headers.get('Access-Control-Allow-Origin'),null);
});
test('staging Wrangler assets MUST invoke Worker first, before serving public HTML',()=>{
 const source=readFileSync(new URL('../../wrangler.finance-one.staging.toml.example',import.meta.url),'utf8');
 assert.match(source,/\[assets\][\s\S]*directory\s*=\s*"\.\/finance-one"/);
 assert.match(source,/\[assets\][\s\S]*run_worker_first\s*=\s*true/);
 assert.match(source,/FINANCE_ONE_READ_API_ENABLED\s*=\s*"false"/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {checkFinanceLoginClientLimit,checkFinanceLoginAccountLimit} from './login-rate-limit.mjs';
import {readFileSync} from 'node:fs';

const request=ip=>new Request('https://staging.example.invalid/api/finance-one/v1/session',{
 method:'POST',headers:ip?{'CF-Connecting-IP':ip}:{}
});
test('client rate limiter keeps distinct verified edge IPs in separate buckets',async()=>{
 const keys=[];
 const env={FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async({key})=>{keys.push(key);return{success:true}}}};
 assert.equal(await checkFinanceLoginClientLimit({request:request('203.0.113.30'),env}),null);
 assert.equal(await checkFinanceLoginClientLimit({request:request('203.0.113.31'),env}),null);
 assert.equal(keys.length,2);
 assert.notEqual(keys[0],keys[1]);
 assert.ok(keys[0].includes('203.0.113.30'));
});
test('client limiter does not trust forged forwarded-for header',async()=>{
 let key;
 const env={FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async(data)=>{key=data.key;return{success:true}}}};
 const untrusted=new Request('https://staging.example.invalid/api/finance-one/v1/session',{
  headers:{'X-Forwarded-For':'203.0.113.200'}});
 await checkFinanceLoginClientLimit({request:untrusted,env});
 assert.equal(key,'login:client:unidentified-client');
});
test('blocked native client and account counters return 429 without authenticating',async()=>{
 const env={
  FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>({success:false})},
  FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async()=>({success:false})}
 };
 const byClient=await checkFinanceLoginClientLimit({request:request('203.0.113.30'),env});
 const byAccount=await checkFinanceLoginAccountLimit({env,accountId:'fin:alice'});
 for(const blocked of [byClient,byAccount]){
  assert.equal(blocked.status,429);
  assert.equal(blocked.headers.get('Retry-After'),'60');
  assert.equal(blocked.headers.get('cache-control'),'no-store');
  assert.deepEqual(await blocked.json(),{error:'Too many login attempts'});
 }
});
test('missing or faulty binding always fails closed, never falls through to password work',async()=>{
 const a=await checkFinanceLoginClientLimit({request:request('203.0.113.33'),env:{}});
 assert.equal(a.status,503);
 const b=await checkFinanceLoginAccountLimit({env:{},accountId:'fin:alice'});
 assert.equal(b.status,503);
 const env={FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>{throw Error('Cloudflare counter unavailable')}}};
 assert.equal((await checkFinanceLoginClientLimit({request:request('203.0.113.33'),env})).status,503);
});
test('account limiter hashes identity before calling provider and groups same account across devices',async()=>{
 const keys=[];
 const env={FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async({key})=>{keys.push(key);return{success:true}}}};
 assert.equal(await checkFinanceLoginAccountLimit({env,accountId:'fin:alice'}),null);
 assert.equal(await checkFinanceLoginAccountLimit({env,accountId:'fin:alice'}),null);
 assert.equal(await checkFinanceLoginAccountLimit({env,accountId:'fin:bob'}),null);
 assert.equal(keys[0],keys[1]);
 assert.notEqual(keys[0],keys[2]);
 assert.ok(!keys.join().includes('alice'));
 assert.ok(keys.every(k=>/^login:account:[0-9a-f]{64}$/.test(k)));
});
test('native rate limiting is explicitly configured in staging Wrangler only',()=>{
 // Triggered from the same GitHub test workflow that validates Wrangler dry-run.
 // Keep limits strict enough to protect PBKDF2 without locking a whole school.
 const source=readFileSync(new URL('../../wrangler.finance-one.staging.toml.example',import.meta.url),'utf8');
 assert.match(source,/name = "FINANCE_ONE_LOGIN_CLIENT_LIMIT"[\s\S]*simple = \{ limit = 20, period = 60 \}/);
 assert.match(source,/name = "FINANCE_ONE_LOGIN_ACCOUNT_LIMIT"[\s\S]*simple = \{ limit = 8, period = 60 \}/);
});

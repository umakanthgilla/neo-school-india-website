import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {accessConfiguration,verifyAccessIdentity,accessFailure} from './access-identity.mjs';
import {handleFinanceLogin} from './finance-login.mjs';
import {readFinanceOneSession} from './finance-session.mjs';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const issuer='https://finance-test.cloudflareaccess.com',audience='a'.repeat(64),now=Date.now();
const env={FINANCE_ONE_ACCESS_ISSUER:issuer,FINANCE_ONE_ACCESS_AUDIENCE:audience,
 FINANCE_ONE_ACCESS_IDENTITIES:JSON.stringify([{subject:'person-a',accountId:'fin:alice'}])};
const config=accessConfiguration(env);
const encode=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function assertion(claims={},header={}){
 const data=encode({alg:'RS256',kid:jwk.kid,...header})+'.'+encode({iss:issuer,aud:[audience],type:'app',sub:'person-a',iat:Math.floor(now/1000)-5,exp:Math.floor(now/1000)+600,...claims});
 return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data))).toString('base64url');
}
const request=token=>new Request('https://finance.test/api/finance-one/v1/session/access',{method:'POST',headers:{'content-type':'application/json',...(token?{'Cf-Access-Jwt-Assertion':token}:{})},body:JSON.stringify({organizationId:'CENTER_A',accountId:'fin:attacker'})});
const fetcher=async url=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
test('default Access key fetch retains the native global receiver',async()=>{
 const original=globalThis.fetch,otherIssuer='https://receiver-test.cloudflareaccess.com';let called=false;
 globalThis.fetch=async function(url){assert.equal(this,globalThis);assert.equal(url,otherIssuer+'/cdn-cgi/access/certs');called=true;return Response.json({keys:[jwk]});};
 try{assert.equal((await verifyAccessIdentity(request(await assertion({iss:otherIssuer})),{...config,issuer:otherIssuer},{now})).accountId,'fin:alice');assert.equal(called,true);}
 finally{globalThis.fetch=original;}
});
test('Access failure diagnostics identify the failed stage without exposing tokens, claims or native errors',async()=>{
 for(const [claims,code] of [[{iss:'https://other.cloudflareaccess.com'},'ACCESS_ASSERTION_ISSUER'],[{aud:['b'.repeat(64)]},'ACCESS_ASSERTION_AUDIENCE'],[{exp:1},'ACCESS_ASSERTION_TIME'],[{type:'service'},'ACCESS_ASSERTION_IDENTITY'],[{sub:'unlinked'},'ACCESS_IDENTITY_UNLINKED']]){
  const token=await assertion(claims);
  await assert.rejects(verifyAccessIdentity(request(token),config,{fetcher,now}),error=>{
   assert.deepEqual(accessFailure(error),{code,status:401});assert.ok(!JSON.stringify(accessFailure(error)).includes(token));return true;
  });
 }
 await assert.rejects(verifyAccessIdentity(request(await assertion()),config,{fetcher:async()=>{throw Error('PRIVATE-NATIVE-DETAILS');},now}),error=>{
  assert.deepEqual(accessFailure(error),{code:'ACCESS_KEYS_FETCH',status:503});assert.ok(!error.message.includes('PRIVATE-NATIVE-DETAILS'));return true;
 });
 assert.deepEqual(accessFailure(Error('PRIVATE-DETAILS')),{code:'ACCESS_VERIFICATION_UNAVAILABLE',status:503});
 assert.deepEqual(accessFailure({accessCode:'PRIVATE-DETAILS'}),{code:'ACCESS_VERIFICATION_UNAVAILABLE',status:503});
});
test('Access validates real RSA signature and explicit subject mapping; ignores email header',async()=>{
 const token=await assertion();const r=request(token);r.headers.set('Cf-Access-Authenticated-User-Email','untrusted@example.com');
 assert.equal((await verifyAccessIdentity(r,config,{fetcher,now})).accountId,'fin:alice');
 await assert.rejects(verifyAccessIdentity(request(null),config,{fetcher,now}));
 const parts=token.split('.');parts[1]=encode({sub:'attacker'});
 await assert.rejects(verifyAccessIdentity(request(parts.join('.')),config,{fetcher,now}));
 // Same claims, altered signature.
 const bad=token.slice(0,-4)+(token.endsWith('AAAA')?'BBBB':'AAAA');
 await assert.rejects(verifyAccessIdentity(request(bad),config,{fetcher,now}));
});
test('Access rejects wrong application, issuer, expiry, service identities and algorithm confusion',async()=>{
 for(const claims of [{iss:'https://attacker.cloudflareaccess.com'},{aud:['b'.repeat(64)]},{exp:Math.floor(now/1000)-1},{iat:Math.floor(now/1000)+5},{nbf:Math.floor(now/1000)+5},{type:'service'},{sub:'unlinked'},{exp:'9999999999'}]){
  await assert.rejects(verifyAccessIdentity(request(await assertion(claims)),config,{fetcher,now}));
 }
 for(const header of [{alg:'HS256'},{jku:'https://attacker.test/keys'},{crit:['ignored']},{kid:'unknown'}])
  await assert.rejects(verifyAccessIdentity(request(await assertion({},header)),config,{fetcher,now}));
});
test('Access configuration fails closed for ambiguous maker/checker identities and untrusted key hosts',()=>{
 for(const rows of [[{subject:'same',accountId:'fin:a'},{subject:'same',accountId:'fin:b'}],[{subject:'a',accountId:'fin:a'},{subject:'b',accountId:'fin:a'}]])
  assert.throws(()=>accessConfiguration({...env,FINANCE_ONE_ACCESS_IDENTITIES:JSON.stringify(rows)}));
 for(const url of ['http://finance-test.cloudflareaccess.com','https://evil.test','https://finance-test.cloudflareaccess.com/','https://finance-test.cloudflareaccess.com@evil.test'])
  assert.throws(()=>accessConfiguration({...env,FINANCE_ONE_ACCESS_ISSUER:url}));
 assert.throws(()=>accessConfiguration({...env,FINANCE_ONE_ACCESS_AUDIENCE:''}));
});
test('Access key retrieval is bounded, pinned and fails closed',async()=>{
 for(const response of [new Response('no',{status:503}),Response.json({keys:[]}),new Response('x'.repeat(65537))])
  await assert.rejects(verifyAccessIdentity(request(await assertion()),config,{fetcher:async()=>response,now}));
 await assert.rejects(verifyAccessIdentity(request(await assertion()),config,{fetcher:async()=>{throw Error('offline');},now}));
});
test('Access login requires existing active Finance credentials and selected organization membership without password hashing',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE neo_fin_auth_accounts(account_id TEXT,credential_version INTEGER,active INTEGER,locked_until INTEGER);
 CREATE TABLE neo_fin_memberships(account_id TEXT,organization_id TEXT,role TEXT,active INTEGER);
 CREATE TABLE neo_fin_organizations(id TEXT,status TEXT);
 INSERT INTO neo_fin_auth_accounts VALUES('fin:alice',3,1,NULL);
 INSERT INTO neo_fin_memberships VALUES('fin:alice','CENTER_A','accountant',1);
 INSERT INTO neo_fin_organizations VALUES('CENTER_A','active');`);
 const DB={prepare(query){assert.doesNotMatch(query,/password_hash|salt|iterations/);return {bind(...args){return {first:async()=>sql.prepare(query).get(...args)};}};}};
 const rate={limit:async()=>({success:true})};
 const settings={...env,DB,FINANCE_ONE_ACCESS_LOGIN_ENABLED:'true',FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:'test-only-finance-session-secret-32-plus',FINANCE_ONE_LOGIN_CLIENT_LIMIT:rate,FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:rate};
 const original=globalThis.fetch;globalThis.fetch=fetcher;
 try{
  const token=await assertion();
  const response=await handleFinanceLogin({request:request(token),env:settings});assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.organizationId,'CENTER_A');assert.ok(result.expiresInSeconds<=600);
  const session=await readFinanceOneSession(new Request('https://finance.test',{headers:{Authorization:'Bearer '+result.token}}),settings);
  assert.equal(session.accountId,'fin:alice');assert.equal(session.credentialVersion,3);
  const denied=await handleFinanceLogin({request:request(await assertion({aud:['b'.repeat(64)]})),env:settings});
  assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'Finance Access identity could not be verified',code:'ACCESS_ASSERTION_AUDIENCE'});
  const unavailableIssuer='https://unavailable-keys.cloudflareaccess.com';
  globalThis.fetch=async()=>{throw Error('PRIVATE-ERROR-CONTENT');};
  const unavailable=await handleFinanceLogin({request:request(await assertion({iss:unavailableIssuer})),env:{...settings,FINANCE_ONE_ACCESS_ISSUER:unavailableIssuer}});
  assert.equal(unavailable.status,503);assert.deepEqual(await unavailable.json(),{error:'Finance Access verification temporarily unavailable',code:'ACCESS_KEYS_FETCH'});
  globalThis.fetch=fetcher;
  for(const statement of ["UPDATE neo_fin_memberships SET active=0","UPDATE neo_fin_auth_accounts SET active=0","UPDATE neo_fin_organizations SET status='inactive'"]){
   sql.exec('UPDATE neo_fin_memberships SET active=1;UPDATE neo_fin_auth_accounts SET active=1;UPDATE neo_fin_organizations SET status=\'active\';'+statement);
   assert.equal((await handleFinanceLogin({request:request(token),env:settings})).status,401);
  }
  assert.equal((await handleFinanceLogin({request:request(token),env:{...settings,FINANCE_ONE_ACCESS_LOGIN_ENABLED:'false'}})).status,404);
  assert.equal((await handleFinanceLogin({request:request(token),env:{...settings,FINANCE_ONE_ENVIRONMENT:'production'}})).status,404);
 }finally{globalThis.fetch=original;sql.close();}
});

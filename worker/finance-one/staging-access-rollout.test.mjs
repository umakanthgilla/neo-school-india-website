import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './staging-entry.mjs';
import {STANDARD_CHART} from './accounting-chart.mjs';
import {rolloutInputs,stagingConfig,releaseFiles,validBlob,stagingAccessSmoke,SOURCE_SHA} from './staging-access-rollout.mjs';
const input={audience:'a'.repeat(64),subject:'11111111-2222-5333-8444-555555555555',email:'reviewer@example.test'};
test('rollout validates reviewed identity before any remote or local mutation',()=>{
 for(const extra of [{audience:'[link](link)'},{subject:'bad\nsubject'},{email:'bad\nemail'},{subject:undefined}])assert.throws(()=>rolloutInputs({...input,...extra}));
 assert.deepEqual(rolloutInputs(input),input);
});
test('rollout cannot target production, broaden tenant ownership or enable accounting operations',()=>{
 const config=stagingConfig({...input,workerName:'production',databaseId:'production',accountId:'fin:ho'});
 assert.match(config,/name = "neo-finance-one-staging"/);assert.match(config,/17c1d0d7-aab1-4e4a-9afe-6b36554b8f93/);
 assert.match(config,/fin:qa20261014_a_checker/);assert.doesNotMatch(config,/fin:ho|production|SCHOOL_SOURCE_DB/);
 for(const key of ['FINANCE_ONE_OPERATIONS_ENABLED','FINANCE_ONE_SOURCE_OPERATIONS_ENABLED','FINANCE_ONE_SEPARATE_SOURCE_ENABLED'])assert.ok(config.includes(key+' = "false"'));
 assert.match(config,/namespace_id = "1791554520"/);assert.match(config,/namespace_id = "1791554521"/);
 assert.ok(!config.includes(input.email));assert.equal(SOURCE_SHA,'bda278e7e5272bacd37ef53b7e92d60cef581c5a');
});
test('downloaded source must match its Git blob fingerprint; modified content fails',()=>{
 const bytes=Buffer.from('pinned source\n');const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(validBlob(bytes,sha),true);assert.equal(validBlob(Buffer.from('altered'),sha),false);
});
test('truncated, unpinned and incomplete release inventories are rejected',()=>{
 for(const tree of [{},{sha:'bad',truncated:false,tree:[]},{sha:'105ca2c45e089649076271f058a25f77534847c9',truncated:true,tree:[]},{sha:'105ca2c45e089649076271f058a25f77534847c9',truncated:false,tree:[]}])assert.throws(()=>releaseFiles(tree));
});
test('cloud smoke uses three bounded sessions and no financial writes; no unexpected tenant or operation is accepted',async()=>{
 const calls=[];let count=0;
 const request=async(url,options)=>{
  const path=new URL(url).pathname;calls.push({path,...options});assert.equal(options.redirect,'manual');assert.equal(options.headers['cf-access-token'],'private-access-value');
  const authorized=Boolean(options.headers.Authorization),json=v=>Response.json(v);
  if(path==='/portal.html')return new Response('<button id="access-sign-in">Continue</button>',{headers:{'cache-control':'no-store'}});
  if(path.endsWith('/session/access')){assert.deepEqual(JSON.parse(options.body),{organizationId:'QA_FIN_20261014_A'});return json({token:'session-'+(++count),organizationId:'QA_FIN_20261014_A'});}
  if(path.endsWith('/session/logout'))return new Response(null,{status:204});
  if(path.endsWith('/summary'))return json({organizationId:'QA_FIN_20261014_A',balanced:true,trialBalance:Array(16).fill({})});
  if(path.endsWith('/source-operations')||path.endsWith('/corrections'))return new Response(null,{status:404});
  if(path.includes('/QA_FIN_20261014_B/')||path.includes('/QA_FIN_20261014_HO/')||options.headers.Origin.endsWith('untrusted.invalid'))return new Response(null,{status:403});
  return new Response(null,{status:401});
 };
 const result=await stagingAccessSmoke('private-access-value',{request});assert.equal(result.sessions,3);assert.equal(result.passed,29);
 const writes=calls.filter(c=>c.method!=='GET');assert.equal(writes.length,6);assert.ok(writes.every(c=>/\/session\/(access|logout)$/.test(c.path)));
});
test('a failed smoke still revokes the newly issued Finance session',async()=>{
 let revoked=false;
 await assert.rejects(stagingAccessSmoke('private-access-value',{request:async(url,options)=>{
  if(url.endsWith('/portal.html'))return new Response('<button id="access-sign-in">Continue</button>',{headers:{'cache-control':'no-store'}});
  if(url.endsWith('/session/access'))return Response.json({token:'private-finance-token',organizationId:'QA_FIN_20261014_A'});
  if(url.endsWith('/session/logout')){revoked=true;return new Response(null,{status:204});}
  if(url.endsWith('/summary'))return new Response(null,{status:503,headers:{'cf-ray':'synthetic-ray'}});
  return new Response(null,{status:401});
 }}));assert.equal(revoked,true);
});
test('the rollout smoke passes the real Worker with signed Access identity, actual schema, tenant denial and revocations',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of ['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections','source_operations'])
  sql.exec(readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8'));
 const db={prepare(q){const stmt=sql.prepare(q),bound=args=>({first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),run:async()=>({success:true,meta:{changes:stmt.run(...args).changes}})});return {...bound([]),bind:(...args)=>bound(args)};}};
 for(const suffix of ['A','B','HO'])sql.prepare('INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES(?,?,?)').run('QA_FIN_20261014_'+suffix,'Synthetic '+suffix,suffix==='HO'?'head_office':'independent_center');
 const org='QA_FIN_20261014_A',account='fin:qa20261014_a_checker';
 sql.prepare('INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES(?,?,?)').run(org,account,'owner');
 sql.prepare('INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations) VALUES(?,?,?,210000)').run(account,'a'.repeat(32),'b'.repeat(64));
 for(const [code,name,type] of STANDARD_CHART)sql.prepare('INSERT INTO neo_fin_accounts VALUES(?,?,?,?,?,1)').run(org,code,code,name,type);
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'rollout-fixture',alg:'RS256',use:'sig'};
 const issuer='https:'+'//'+'lingering-bird-11ec.cloudflareaccess.com',seconds=Math.floor(Date.now()/1000);
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const signed=encode({alg:'RS256',kid:jwk.kid})+'.'+encode({iss:issuer,aud:[input.audience],type:'app',sub:input.subject,email:input.email,iat:seconds-5,exp:seconds+1800});
 const assertion=signed+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(signed))).toString('base64url');
 const env={DB:db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_ACCESS_LOGIN_ENABLED:'true',
  FINANCE_ONE_ACCESS_ISSUER:issuer,FINANCE_ONE_ACCESS_AUDIENCE:input.audience,FINANCE_ONE_ACCESS_IDENTITIES:JSON.stringify([{subject:input.subject,accountId:account}]),
  FINANCE_ONE_SESSION_SECRET:'synthetic-only-finance-session-secret-32-plus',FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>({success:true})},FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async()=>({success:true})},
  ASSETS:{fetch:async()=>new Response(readFileSync(new URL('../../finance-one/portal.html',import.meta.url),'utf8'))}};
 const original=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 try{
  const result=await stagingAccessSmoke(assertion,{request:async(url,options)=>{const headers=new Headers(options.headers);headers.set('Cf-Access-Jwt-Assertion',assertion);return worker.fetch(new Request(url,{...options,headers}),env);}});
  assert.equal(result.passed,29);assert.equal(sql.prepare('SELECT count(*) n FROM neo_fin_session_revocations').get().n,3);
  for(const table of ['neo_fin_cash_events','neo_fin_documents','neo_fin_journals'])assert.equal(sql.prepare('SELECT count(*) n FROM '+table).get().n,0);
 }finally{globalThis.fetch=original;sql.close();}
});

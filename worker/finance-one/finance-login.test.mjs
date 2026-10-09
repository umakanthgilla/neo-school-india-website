import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createFinancePasswordRecord,verifyFinancePassword} from './finance-password.mjs';
import {handleFinanceLogin} from './finance-login.mjs';
import {readFinanceOneSession} from './finance-session.mjs';
import {financeOneWorkerGate} from './worker-gate.mjs';

const secret='finance-one-demo-signing-key-is-not-a-production-secret';
const password='VeryStrongPassphrase12345';
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE neo_fin_auth_accounts(account_id TEXT PRIMARY KEY,salt TEXT,password_hash TEXT,iterations INTEGER,active INTEGER,failed_attempts INTEGER DEFAULT 0,locked_until INTEGER,credential_version INTEGER);
 CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY,status TEXT);
 CREATE TABLE neo_fin_memberships(organization_id TEXT,account_id TEXT,role TEXT,active INTEGER);
 CREATE TABLE neo_fin_documents(organization_id TEXT,id TEXT,document_type TEXT,party_id TEXT,status TEXT,currency TEXT,gross_paise INTEGER,created_at TEXT);
 INSERT INTO neo_fin_organizations VALUES ('CENTER_A','active'),('CENTER_B','active'),('HO','active');
 INSERT INTO neo_fin_memberships VALUES ('CENTER_A','fin:alice','owner',1),('CENTER_B','fin:bob','owner',1),('HO','fin:ho','owner',1);
 INSERT INTO neo_fin_documents VALUES ('CENTER_A','INV-A','sales_invoice',NULL,'approved','INR',10000,'2026-10-09');`);
 return {sql,prepare(query){const stmt=sql.prepare(query);return {bind(...params){return{
  first:async()=>stmt.get(...params),
  all:async()=>({results:stmt.all(...params)}),
  run:async()=>{const r=stmt.run(...params);return {success:true,meta:{changes:r.changes}};}
 };}}}};
}
async function seed(db,accountId='fin:alice'){
 const record=await createFinancePasswordRecord({accountId,password});
 db.sql.prepare('INSERT INTO neo_fin_auth_accounts VALUES (?,?,?,?,1,0,NULL,1)').run(record.accountId,record.salt,record.passwordHash,record.iterations);
}
const unrestricted={limit:async()=>({success:true})};
const env=db=>({DB:db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:secret,
 FINANCE_ONE_LOGIN_CLIENT_LIMIT:unrestricted,FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:unrestricted});
const login=(accountId='fin:alice',pw=password,organizationId='CENTER_A')=>new Request('https://test.local/api/finance-one/v1/session',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId,password:pw,organizationId})});
const docs=(token,org='CENTER_A')=>new Request('https://test.local/api/finance-one/v1/organizations/'+org+'/documents',{headers:{Authorization:'Bearer '+token}});
test('PBKDF2 passwords use salted hashes, not plaintext',async()=>{
 const db=fixture();await seed(db);
 const rec=db.sql.prepare('SELECT salt,password_hash FROM neo_fin_auth_accounts').get();
 assert.equal(rec.salt.length,32);assert.equal(rec.password_hash.length,64);assert.notEqual(rec.password_hash,password);
 assert.equal((await verifyFinancePassword({db,accountId:'fin:alice',password})).accountId,'fin:alice');
 db.sql.close();
});
test('valid Finance credentials produce a revocable signed session token',async()=>{
 const db=fixture();await seed(db);
 const resp=await handleFinanceLogin({request:login(),env:env(db)});assert.equal(resp.status,200);
 const token=(await resp.json()).token;
 const session=await readFinanceOneSession(docs(token),env(db));
 assert.equal(session.accountId,'fin:alice');assert.equal(session.credentialVersion,1);db.sql.close();
});
test('Finance login to documents API is scoped to its owning business',async()=>{
 const db=fixture();await seed(db);
 const token=(await (await financeOneWorkerGate({request:login(),env:env(db)})).json()).token;
 const result=await financeOneWorkerGate({request:docs(token),env:env(db)});
 assert.equal(result.status,200);
 assert.equal((await result.json()).documents[0].id,'INV-A');
 assert.equal((await financeOneWorkerGate({request:docs(token,'CENTER_B'),env:env(db)})).status,403);
 db.sql.close();
});
test('generic school session cannot impersonate independent finance identity',async()=>{
 const db=fixture();await seed(db);
 assert.equal((await financeOneWorkerGate({request:docs('legacy.school.token'),env:env(db)})).status,401);db.sql.close();
});
test('unknown user, invalid password and wrong business are rejected consistently',async()=>{
 const db=fixture();await seed(db);
 for(const r of [login('fin:unknown'),login('fin:alice','wrongpassword'),login('fin:alice',password,'CENTER_B')]){
  const x=await handleFinanceLogin({request:r,env:env(db)});assert.equal(x.status,401);
  assert.equal((await x.json()).error,'Invalid credentials');
 }db.sql.close();
});
test('five failed logins trigger a temporary lock',async()=>{
 const db=fixture();await seed(db);
 for(let i=0;i<5;i++)assert.equal((await handleFinanceLogin({request:login('fin:alice','wrongpassword'),env:env(db)})).status,401);
 const rec=db.sql.prepare('SELECT failed_attempts,locked_until FROM neo_fin_auth_accounts').get();
 assert.equal(rec.failed_attempts,5);assert.ok(rec.locked_until>Date.now());
 assert.equal((await handleFinanceLogin({request:login(),env:env(db)})).status,401);db.sql.close();
});
test('expired account lockout resets attempts on the next wrong password',async()=>{
 const db=fixture();await seed(db);db.sql.exec('UPDATE neo_fin_auth_accounts SET failed_attempts=6,locked_until=1');
 await handleFinanceLogin({request:login('fin:alice','wrongpassword'),env:env(db)});
 const rec=db.sql.prepare('SELECT failed_attempts,locked_until FROM neo_fin_auth_accounts').get();
 assert.equal(rec.failed_attempts,1);assert.equal(rec.locked_until,null);db.sql.close();
});
test('account suspension immediately revokes issued Finance tokens',async()=>{
 const db=fixture();await seed(db);const token=(await (await handleFinanceLogin({request:login(),env:env(db)})).json()).token;
 assert.equal((await financeOneWorkerGate({request:docs(token),env:env(db)})).status,200);
 db.sql.exec('UPDATE neo_fin_auth_accounts SET active=0,credential_version=credential_version+1');
 assert.equal((await financeOneWorkerGate({request:docs(token),env:env(db)})).status,401);
 db.sql.close();
});
test('credential rotation immediately revokes old signed sessions',async()=>{
 const db=fixture();await seed(db);const token=(await (await handleFinanceLogin({request:login(),env:env(db)})).json()).token;
 db.sql.exec('UPDATE neo_fin_auth_accounts SET credential_version=credential_version+1');
 assert.equal((await financeOneWorkerGate({request:docs(token),env:env(db)})).status,401);db.sql.close();
});
test('separate Finance API is disabled by default',async()=>{
 const db=fixture();await seed(db);
 assert.equal((await financeOneWorkerGate({request:login(),env:{...env(db),FINANCE_ONE_READ_API_ENABLED:'false'}})).status,404);db.sql.close();
});
test('oversized login body is rejected safely',async()=>{
 const db=fixture();const r=new Request('https://test.local/api/finance-one/v1/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:'fin:alice',password:'x'.repeat(5000),organizationId:'CENTER_A'})});
 assert.equal((await handleFinanceLogin({request:r,env:env(db)})).status,400);db.sql.close();
});


test('concurrent failed attempts cannot let a stale valid password bypass newly locked account',async()=>{
 const db=fixture();await seed(db);
 // Simulate a read of an unlocked credential racing with five bad attempts.
 const racingDb={prepare(sql){
  const p=db.prepare(sql);
  return{bind(...params){
   const statement=p.bind(...params);
   return {...statement,first:async()=>{
    const snapshot=await statement.first();
    if(sql.startsWith('SELECT account_id,salt,password_hash')){
     db.sql.prepare('UPDATE neo_fin_auth_accounts SET failed_attempts=5,locked_until=? WHERE account_id=?')
       .run(Date.now()+15*60*1000,'fin:alice');
    }
    return snapshot;
   }};
  }};
 }};
 const result=await verifyFinancePassword({db:racingDb,accountId:'fin:alice',password});
 assert.equal(result,null,'The last update must fail closed after a concurrent lock');
 const row=db.sql.prepare("SELECT failed_attempts,locked_until FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get();
 assert.equal(row.failed_attempts,5);assert.ok(row.locked_until>Date.now());
 db.sql.close();
});
test('inflight wrong password cannot extend a lock set after reading unlocked state',async()=>{
 const db=fixture();await seed(db);
 const until=Date.now()+15*60*1000;
 const racingDb={prepare(sql){
  const p=db.prepare(sql);
  return{bind(...params){
   const statement=p.bind(...params);
   return {...statement,first:async()=>{
    const row=await statement.first();
    if(sql.startsWith('SELECT account_id,salt,password_hash')){
     db.sql.prepare('UPDATE neo_fin_auth_accounts SET failed_attempts=5,locked_until=? WHERE account_id=?')
       .run(until,'fin:alice');
    }
    return row;
   }};
  }};
 }};
 assert.equal(await verifyFinancePassword({db:racingDb,accountId:'fin:alice',password:'incorrect'}),null);
 const row=db.sql.prepare("SELECT failed_attempts,locked_until FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get();
 assert.equal(row.failed_attempts,5);assert.equal(row.locked_until,until);
 db.sql.close();
});
test('expired lockout still admits correct Finance password and clears failed attempts',async()=>{
 const db=fixture();await seed(db);
 db.sql.exec('UPDATE neo_fin_auth_accounts SET failed_attempts=5,locked_until=1');
 const identity=await verifyFinancePassword({db,accountId:'fin:alice',password});
 assert.equal(identity?.accountId,'fin:alice');
 const row=db.sql.prepare("SELECT failed_attempts,locked_until FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get();
 assert.equal(row.failed_attempts,0);assert.equal(row.locked_until,null);
 db.sql.close();
});


test('direct Finance login handler fails closed in production even with feature flag enabled',async()=>{
 const db=fixture();await seed(db);
 const result=await handleFinanceLogin({request:login(),env:{...env(db),FINANCE_ONE_ENVIRONMENT:'production'}});
 assert.equal(result.status,404);
 const missing=await handleFinanceLogin({request:login(),env:{...env(db),FINANCE_ONE_ENVIRONMENT:undefined}});
 assert.equal(missing.status,404);
 assert.equal(db.sql.prepare("SELECT failed_attempts FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get().failed_attempts,0);
 db.sql.close();
});


test('client native throttle returns 429 before Finance password is checked',async()=>{
 const db=fixture();await seed(db);
 const limitEnv={...env(db),FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>({success:false})}};
 const response=await handleFinanceLogin({request:login(),env:limitEnv});
 assert.equal(response.status,429);
 assert.equal(response.headers.get('Retry-After'),'60');
 assert.equal(db.sql.prepare('SELECT failed_attempts FROM neo_fin_auth_accounts').get().failed_attempts,0);
 db.sql.close();
});
test('account native throttle applies before both valid and invalid passwords',async()=>{
 const db=fixture();await seed(db);
 const calls=[];
 const limitEnv={...env(db),FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async x=>{calls.push(x.key);return{success:false}}}};
 for(const pwd of [password,'wrong']){
  const response=await handleFinanceLogin({request:login('fin:alice',pwd),env:limitEnv});
  assert.equal(response.status,429);
 }
 assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);
 assert.equal(db.sql.prepare('SELECT failed_attempts FROM neo_fin_auth_accounts').get().failed_attempts,0);
 db.sql.close();
});
test('missing Cloudflare login bindings fail closed without issuing tokens',async()=>{
 const db=fixture();await seed(db);
 const noClient=await handleFinanceLogin({request:login(),env:{...env(db),FINANCE_ONE_LOGIN_CLIENT_LIMIT:undefined}});
 assert.equal(noClient.status,503);
 const noAccount=await handleFinanceLogin({request:login(),env:{...env(db),FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:undefined}});
 assert.equal(noAccount.status,503);
 db.sql.close();
});

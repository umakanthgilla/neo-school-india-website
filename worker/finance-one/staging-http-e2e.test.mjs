/**
 * Full staging-entrypoint HTTP smoke test with actual Finance SQL migrations.
 * Calls Worker.fetch in-process; this does NOT deploy to Cloudflare.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createFinancePasswordRecord} from './finance-password.mjs';
import stagingWorker from './staging-entry.mjs';

const migrations=[
 'finance_payroll_one_foundation.sql',
 'finance_payroll_one_cash_projection.sql',
 'finance_payroll_one_accounting_journals.sql',
 'finance_payroll_one_auth_accounts.sql',
 'finance_payroll_one_receipt_evidence.sql',
 'finance_payroll_one_legacy_payout_integrity.sql',
 'finance_payroll_one_statutory_review.sql',
 'finance_payroll_one_statutory_remittance.sql',
 'finance_payroll_one_session_revocations.sql',
 'finance_payroll_one_issued_document_immutability.sql'
].map(name=>readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8'));
const api='https://staging-worker.example.invalid/api/finance-one/v1';
const portal='https://finance-preview.example.invalid';
const password='StagingOnlyExamplePassword!1234';
const secret='staging-e2e-example-secret-please-never-deploy';

async function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const migration of migrations)sqlite.exec(migration);
 sqlite.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type)
 VALUES('CENTER_A','Independent Center A','independent_center'),
 ('CENTER_B','Independent Center B','independent_center'),
 ('HO','Independent HO','head_office');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role)
 VALUES('CENTER_A','fin:alice','owner'),('CENTER_B','fin:bob','owner'),('HO','fin:ho','owner');
 INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise)
 VALUES('CENTER_A','DOC_A','sales_invoice','approved',10000),
 ('CENTER_B','DOC_B','sales_invoice','approved',950000);
 INSERT INTO neo_fin_cash_events(organization_id,event_id,source_kind,source_id,
 source_event_id,direction,amount_paise,effective_at,verification_reference)
 VALUES('CENTER_A','PAY_A','fee_receipt','ORIGINAL_A','ACK_A','money_in',10000,'2026-10-09T10:00:00Z','BANK-A'),
 ('CENTER_B','PAY_B','fee_receipt','ORIGINAL_B','ACK_B','money_in',950000,'2026-10-09T10:00:00Z','BANK-B');`);
 const cred=await createFinancePasswordRecord({accountId:'fin:alice',password});
 sqlite.prepare(`INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations)
 VALUES(?,?,?,?)`).run(cred.accountId,cred.salt,cred.passwordHash,cred.iterations);
 const db={prepare(query){const statement=sqlite.prepare(query);return {
  bind(...args){return{
   first:async()=>statement.get(...args),
   all:async()=>({results:statement.all(...args)}),
   run:async()=>{const result=statement.run(...args);return{success:true,meta:{changes:result.changes}}}
  }}
 }}};
 const env={DB:db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',
  FINANCE_ONE_PORTAL_ORIGIN:portal,FINANCE_ONE_SESSION_SECRET:secret,
  FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>({success:true})},
  FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async()=>({success:true})}};
 const http=(resource,token=null,org='CENTER_A',origin=portal,method='GET')=>{
  const headers={Origin:origin};
  if(token)headers.Authorization='Bearer '+token;
  return new Request(api+'/organizations/'+org+'/'+resource,{method,headers});
 };
 const login=()=>new Request(api+'/session',{method:'POST',
  headers:{Origin:portal,'content-type':'application/json'},
  body:JSON.stringify({organizationId:'CENTER_A',accountId:'fin:alice',password})});
 async function token(){
  const response=await stagingWorker.fetch(login(),env);
  assert.equal(response.status,200);
  return(await response.json()).token;
 }
 return{sqlite,env,http,token};
}
test('real-schema staging login accesses only Center A original documents and verified cash',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  const docs=await stagingWorker.fetch(f.http('documents',token),f.env);
  assert.equal(docs.status,200);assert.equal(docs.headers.get('Access-Control-Allow-Origin'),portal);
  assert.deepEqual((await docs.json()).documents.map(d=>d.id),['DOC_A']);
  const ledger=await stagingWorker.fetch(f.http('daily-ledger',token),f.env);
  assert.equal(ledger.status,200);assert.deepEqual((await ledger.json()).entries.map(e=>e.event_id),['PAY_A']);
  assert.equal(ledger.headers.get('Cache-Control'),'no-store');
 }finally{f.sqlite.close();}
});
test('independent Finance token cannot read Center B or HO data',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  for(const org of ['CENTER_B','HO']){
   const response=await stagingWorker.fetch(f.http('documents',token,org),f.env);
   assert.equal(response.status,403);
  }
 }finally{f.sqlite.close();}
});
test('production mode and disabled staging flag never expose Finance HTTP data',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  for(const env of [
   {...f.env,FINANCE_ONE_ENVIRONMENT:'production'},
   {...f.env,FINANCE_ONE_READ_API_ENABLED:'false'}
  ]){
   assert.equal((await stagingWorker.fetch(f.http('documents',token),env)).status,404);
  }
 }finally{f.sqlite.close();}
});
test('outside browser origin receives no protected session, even with correct password',async()=>{
 const f=await fixture();try{
  const request=new Request(api+'/session',{method:'POST',
   headers:{Origin:'https://untrusted.example.invalid','content-type':'application/json'},
   body:JSON.stringify({accountId:'fin:alice',password,organizationId:'CENTER_A'})});
  const response=await stagingWorker.fetch(request,f.env);
  assert.equal(response.status,403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
 }finally{f.sqlite.close();}
});
test('credential version rotation invalidates an already signed staging Finance session',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  f.sqlite.exec("UPDATE neo_fin_auth_accounts SET credential_version=credential_version+1 WHERE account_id='fin:alice'");
  assert.equal((await stagingWorker.fetch(f.http('documents',token),f.env)).status,401);
 }finally{f.sqlite.close();}
});
test('HTTP read-only enforcement refuses attempts to edit Finance Daily Ledger',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  const before=f.sqlite.prepare("SELECT COUNT(*) AS n FROM neo_fin_cash_events").get().n;
  const response=await stagingWorker.fetch(f.http('daily-ledger',token,'CENTER_A',portal,'POST'),f.env);
  assert.equal(response.status,405);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM neo_fin_cash_events").get().n,before);
 }finally{f.sqlite.close();}
});


test('server sign-out immediately revokes only current Finance token, not another device',async()=>{
 const f=await fixture();try{
  const first=await f.token();
  const second=await f.token();
  assert.notEqual(first,second,'Every Finance login must issue an independent random token');
  assert.equal((await stagingWorker.fetch(f.http('documents',first),f.env)).status,200);
  const signOut=new Request(api+'/session/logout',{method:'POST',
   headers:{Origin:portal,Authorization:'Bearer '+first}});
  const done=await stagingWorker.fetch(signOut,f.env);
  assert.equal(done.status,204);
  assert.equal(done.headers.get('Cache-Control'),'no-store');
  assert.equal((await stagingWorker.fetch(f.http('documents',first),f.env)).status,401);
  assert.equal((await stagingWorker.fetch(f.http('documents',second),f.env)).status,200);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM neo_fin_session_revocations').get().n,1);
  const account=f.sqlite.prepare("SELECT credential_version FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get();
  assert.equal(account.credential_version,1,'Other Finance devices must not be revoked');
 }finally{f.sqlite.close();}
});
test('Finance session logout endpoint is POST-only, requires a valid token',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  const get=new Request(api+'/session/logout',{headers:{Origin:portal,Authorization:'Bearer '+token}});
  assert.equal((await stagingWorker.fetch(get,f.env)).status,405);
  const unauth=new Request(api+'/session/logout',{method:'POST',headers:{Origin:portal}});
  assert.equal((await stagingWorker.fetch(unauth,f.env)).status,401);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM neo_fin_session_revocations').get().n,0);
 }finally{f.sqlite.close();}
});
test('missing revocation schema blocks Finance access instead of silently accepting bearer',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  f.sqlite.exec('DROP TABLE neo_fin_session_revocations');
  const denied=await stagingWorker.fetch(f.http('documents',token),f.env);
  assert.equal(denied.status,503);
 }finally{f.sqlite.close();}
});


test('cash reconciliation API detects missing journals for own Center and hides other Center data',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  const own=await stagingWorker.fetch(f.http('cash-reconciliation',token),f.env);
  assert.equal(own.status,200);
  const report=await own.json();
  assert.equal(report.organizationId,'CENTER_A');
  assert.equal(report.ready,false);
  assert.equal(report.cashEventCount,1);
  assert.equal(report.counts.missing_journal,1);
  assert.ok(report.findings.every(x=>x.eventId!=='PAY_B'));
  assert.equal((await stagingWorker.fetch(f.http('cash-reconciliation',token,'CENTER_B'),f.env)).status,403);
  const post=await stagingWorker.fetch(f.http('cash-reconciliation',token,'CENTER_A',portal,'POST'),f.env);
  assert.equal(post.status,405);
 }finally{f.sqlite.close();}
});

test('isolated Finance accrual audit flags missing approved Center journal, not foreign Center data',async()=>{
 const f=await fixture();try{
  const token=await f.token();
  const response=await stagingWorker.fetch(f.http('accrual-reconciliation',token),f.env);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.organizationId,'CENTER_A');
  assert.equal(result.ready,false);
  assert.equal(result.counts.missing_accrual_journal,1);
  assert.ok(result.findings.some(x=>x.documentId==='DOC_A'));
  assert.ok(!result.findings.some(x=>x.documentId==='DOC_B'));
  assert.equal((await stagingWorker.fetch(f.http('accrual-reconciliation',token,'CENTER_B'),f.env)).status,403);
  assert.equal((await stagingWorker.fetch(f.http('accrual-reconciliation',token,'CENTER_A',portal,'POST'),f.env)).status,405);
 }finally{f.sqlite.close();}
});

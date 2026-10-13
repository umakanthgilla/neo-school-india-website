import stagingWorker from './staging-entry.mjs';
import {issueFinanceOneToken} from './finance-session.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleCorrectionsApi} from './corrections-api.mjs';
import {postAccrualJournalForDocument} from './accrual-journal.mjs';
import {financeOneStagingPreflight} from './staging-preflight.mjs';
async function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of ['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections'])
  sql.exec(readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8'));
 const db={prepare(query){const stmt=sql.prepare(query);const bound=args=>({first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),run:async()=>({success:true,meta:{changes:stmt.run(...args).changes}})});return {...bound([]),bind:(...args)=>bound(args)};},async batch(stmts){sql.exec('BEGIN');try{const results=[];for(const stmt of stmts)results.push(await stmt.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 for(const org of ['A','B','HO']){
  sql.prepare('INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES(?,?,?)').run(org,org,org==='HO'?'head_office':'independent_center');
  for(const [account,role] of [['maker','accountant'],['checker','owner'],['admin','finance_admin'],['reader','auditor'],['payroll','payroll_admin']])sql.prepare('INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES(?,?,?)').run(org,org+account,role);
  for(const [code,type] of [['1100','asset'],['4000','income'],['5200','expense'],['2000','liability']])sql.prepare('INSERT INTO neo_fin_accounts VALUES(?,?,?,?,?,1)').run(org,code,code,code,type);
  sql.prepare("INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise) VALUES(?,'INV','sales_invoice','approved',10000)").run(org);
  await postAccrualJournalForDocument(db,org,'INV');
 }
 const call=async(account='Amaker',method='GET',suffix='corrections',data,org='A',enabled=true)=>handleCorrectionsApi({db,authenticatedAccountId:account,enabled,request:new Request('https://staging.invalid/api/finance-one/v1/organizations/'+org+'/'+suffix,{method,headers:{'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})})});
 const create=(id='request-001',account='Amaker')=>call(account,'POST','corrections',{requestId:id,journalId:'JNL-DOC|INV',reason:'Duplicate invoice accrual confirmed'});
 const decide=(decision='approved',account='Achecker',id='request-001')=>call(account,'POST','corrections/'+id+'/decision',{decision,reviewNote:'Checked original source and approved accounting treatment'});
 return{sql,db,call,create,decide};
}
test('independent approval atomically posts opposite accrual and retains original, zero cash',async()=>{
 const f=await fixture();try{
  assert.equal((await f.create()).status,201);assert.equal((await f.decide()).status,200);
  assert.equal(f.sql.prepare("SELECT status FROM neo_fin_journals WHERE organization_id='A' AND id='JNL-DOC|INV'").get().status,'posted');
  assert.deepEqual(f.sql.prepare("SELECT account_id,sum(debit_paise-credit_paise) n FROM neo_fin_journal_lines WHERE organization_id='A' GROUP BY account_id").all().map(x=>x.n),[0,0]);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM neo_fin_cash_events').get().n,0);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM neo_fin_correction_decisions').get().n,1);
  assert.equal((await f.decide()).status,200);
  assert.equal(f.sql.prepare("SELECT count(*) n FROM neo_fin_journals WHERE source_kind='approved_correction'").get().n,1);
 }finally{f.sql.close();}
});
test('same actor cannot approve even when owner; accountant/auditor/payroll cannot approve',async()=>{
 const f=await fixture();try{
  await f.create('request-001','Achecker');
  for(const account of ['Achecker','Amaker','Areader','Apayroll','Bchecker','HOchecker'])assert.equal((await f.decide('approved',account)).status,403);
  assert.equal((await f.decide('approved','Aadmin')).status,200);
 }finally{f.sql.close();}
});
test('request and decision audit trails cannot be amended or erased',async()=>{
 const f=await fixture();try{
  await f.create();await f.decide();
  for(const table of ['neo_fin_correction_requests','neo_fin_correction_decisions']){
   assert.throws(()=>f.sql.exec('DELETE FROM '+table),/immutable/);
   assert.throws(()=>f.sql.exec('UPDATE '+table+" SET organization_id='B'"),/immutable/);
  }
  assert.throws(()=>f.sql.exec("UPDATE neo_fin_journal_lines SET debit_paise=100 WHERE journal_id='REV|request-001'"),/immutable/);
 }finally{f.sql.close();}
});
test('rejected request creates no journal and cannot change decision; new independent request allowed',async()=>{
 const f=await fixture();try{
  await f.create();assert.equal((await f.decide('rejected')).status,200);
  assert.equal((await f.decide()).status,409);
  assert.equal(f.sql.prepare("SELECT count(*) n FROM neo_fin_journals WHERE source_kind='approved_correction'").get().n,0);
  assert.equal((await f.create('request-002')).status,201);
  assert.equal((await f.decide('approved','Achecker','request-002')).status,200);
 }finally{f.sql.close();}
});
test('competing approvals cannot reverse the same original twice',async()=>{
 const f=await fixture();try{
  await f.create();await f.create('request-002');await f.decide();
  assert.equal((await f.decide('approved','Aadmin','request-002')).status,409);
  assert.equal(f.sql.prepare("SELECT count(*) n FROM neo_fin_correction_decisions").get().n,1);
  assert.equal((await f.create('request-003')).status,409);
 }finally{f.sql.close();}
});
test('posting failure rolls back the approval as well as journal lines',async()=>{
 const f=await fixture();try{
  await f.create();f.sql.exec("CREATE TRIGGER failure BEFORE INSERT ON neo_fin_journal_lines WHEN NEW.journal_id LIKE 'REV|%' BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  assert.equal((await f.decide()).status,409);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM neo_fin_correction_decisions').get().n,0);
  assert.equal(f.sql.prepare("SELECT count(*) n FROM neo_fin_journals WHERE id LIKE 'REV|%'").get().n,0);
  f.sql.exec('DROP TRIGGER failure');assert.equal((await f.decide()).status,200);
 }finally{f.sql.close();}
});
test('request retries are idempotent; changed payload and spoofed identity are refused',async()=>{
 const f=await fixture();try{
  await f.create();assert.equal((await f.create()).status,200);
  assert.equal((await f.create('request-001','Achecker')).status,409);
  assert.equal((await f.call('Amaker','POST','corrections',{requestId:'request-001',journalId:'JNL-DOC|INV',reason:'Changed reason is forbidden'})).status,409);
  assert.equal((await f.call('Amaker','POST','corrections',{requestId:'request-004',journalId:'JNL-DOC|INV',reason:'Valid original source reason',requested_by:'Achecker'})).status,400);
 }finally{f.sql.close();}
});
test('read and write tenant isolation and disabled operations flag',async()=>{
 const f=await fixture();try{
  await f.create();
  for(const actor of ['Bchecker','HOchecker'])for(const resource of ['corrections','correction-journals'])assert.equal((await f.call(actor,'GET',resource)).status,403);
  assert.equal((await f.create('request-002','Areader')).status,403);
  assert.equal((await f.call('Amaker','GET','corrections',undefined,'A',false)).status,404);
  const list=await(await f.call('Areader')).json();assert.equal(list.requests[0].requested_by,'Amaker');assert.equal(list.canReview,false);
 }finally{f.sql.close();}
});
test('revoked reviewer membership and suspended organization block approval at DB boundary',async()=>{
 const f=await fixture();try{
  await f.create();f.sql.exec("UPDATE neo_fin_memberships SET active=0 WHERE account_id='Achecker'");
  assert.equal((await f.decide()).status,403);
  assert.throws(()=>f.sql.exec("INSERT INTO neo_fin_correction_decisions VALUES('A','request-001','JNL-DOC|INV','approved','Reviewed original carefully','Achecker',CURRENT_TIMESTAMP)"),/reviewer/);
  f.sql.exec("UPDATE neo_fin_organizations SET status='suspended' WHERE id='A'");assert.equal((await f.decide('approved','Aadmin')).status,403);
 }finally{f.sql.close();}
});
test('inactive original account prevents reversal and posts no decision',async()=>{
 const f=await fixture();try{await f.create();f.sql.exec("UPDATE neo_fin_accounts SET active=0 WHERE organization_id='A' AND account_code='4000'");assert.equal((await f.decide()).status,409);assert.equal(f.sql.prepare('SELECT count(*) n FROM neo_fin_correction_decisions').get().n,0);}finally{f.sql.close();}
});
test('cash, payroll, unknown and reversal journals cannot use invoice correction workflow',async()=>{
 const f=await fixture();try{
  for(const [id,kind] of [['cash','cash_event'],['salary','document'],['reverse','approved_correction']]){
   if(kind!=='approved_correction')f.sql.prepare('INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES(?,?,?,?)').run('A',id,kind,id);
   const response=await f.call('Amaker','POST','corrections',{requestId:'request-'+id,journalId:id,reason:'Original correction requested'});assert.equal(response.status,409);
  }
 }finally{f.sql.close();}
});
test('oversized bodies, unexpected methods and short reasons are refused',async()=>{
 const f=await fixture();try{
  assert.equal((await f.call('Amaker','POST','corrections',{reason:'x'.repeat(9000)})).status,400);
  assert.equal((await f.call('Amaker','DELETE')).status,405);
  assert.equal((await f.call('Amaker','POST','correction-journals',{})).status,405);
  assert.equal((await f.call('Amaker','POST','corrections',{requestId:'request-001',journalId:'JNL-DOC|INV',reason:'short'})).status,400);
 }finally{f.sql.close();}
});
test('operations preflight requires migration 11 security triggers',async()=>{
 const f=await fixture();try{
  const env={FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_OPERATIONS_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:'test-only-secret-at-least-32-characters',FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit(){}},FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit(){}}};
  assert.equal((await financeOneStagingPreflight({db:f.db,env})).ready,true);
  f.sql.exec('DROP TRIGGER neo_fin_correction_post');const result=await financeOneStagingPreflight({db:f.db,env});assert.equal(result.ready,false);assert.ok(result.blockers.includes('Missing trigger neo_fin_correction_post'));
 }finally{f.sql.close();}
});

test('forged correction journal without approved decision is refused by SQL',async()=>{
 const f=await fixture();try{
  assert.throws(()=>f.sql.exec("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES('A','REV|forged','approved_correction','forged')"),/Approved correction required/);
 }finally{f.sql.close();}
});
test('a multi-role owner retains review capability without allowing self-approval',async()=>{
 const f=await fixture();try{
  f.sql.exec("INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES('A','Achecker','accountant')");
  await f.create();assert.equal((await f.decide()).status,200);
 }finally{f.sql.close();}
});

test('signed Worker HTTP boundary enforces origin, environment, operation flag and reviewer identity',async()=>{
 const f=await fixture();try{
  const secret='test-only-finance-operations-secret-32-characters';
  f.sql.exec("UPDATE neo_fin_memberships SET account_id='fin:'||account_id");
  for(const account of ['fin:Amaker','fin:Achecker'])f.sql.prepare("INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations) VALUES(?,?,?,210000)").run(account,'a'.repeat(32),'b'.repeat(64));
  const env={DB:f.db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_OPERATIONS_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:secret};
  const token=await issueFinanceOneToken({accountId:'fin:Amaker',credentialVersion:1,secret});
  const send=(environment=env,origin='https://staging.invalid',auth=token)=>stagingWorker.fetch(new Request('https://staging.invalid/api/finance-one/v1/organizations/A/corrections',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify({requestId:'http-request-001',journalId:'JNL-DOC|INV',reason:'Duplicate source accounting reviewed'})}),environment);
  assert.equal((await send({...env,FINANCE_ONE_OPERATIONS_ENABLED:'false'})).status,404);
  assert.equal((await send({...env,FINANCE_ONE_ENVIRONMENT:'production'})).status,404);
  assert.equal((await send(env,'https://foreign.invalid')).status,403);
  assert.equal((await send(env,'https://staging.invalid','invalid-token')).status,401);
  assert.equal((await send()).status,201);
  const reviewer=await issueFinanceOneToken({accountId:'fin:Achecker',credentialVersion:1,secret});
  const approved=await stagingWorker.fetch(new Request('https://staging.invalid/api/finance-one/v1/organizations/A/corrections/http-request-001/decision',{method:'POST',headers:{Origin:'https://staging.invalid','Content-Type':'application/json',Authorization:'Bearer '+reviewer},body:JSON.stringify({decision:'approved',reviewNote:'Verified original invoice error and treatment'})}),env);
  assert.equal(approved.status,200);assert.equal(approved.headers.get('Cache-Control'),'no-store');
  assert.equal(f.sql.prepare("SELECT status FROM neo_fin_journals WHERE organization_id='A' AND id='REV|http-request-001'").get().status,'posted');
 }finally{f.sql.close();}
});

test('online corrections fail closed if a posting trigger or duplicate-reversal index is missing',async()=>{
 for(const object of ['TRIGGER neo_fin_correction_post','INDEX neo_fin_one_approved_reversal']){
  const f=await fixture();try{
   await f.create();f.sql.exec('DROP '+object);
   assert.equal((await f.decide()).status,503);
   assert.equal(f.sql.prepare('SELECT count(*) n FROM neo_fin_correction_decisions').get().n,0);
  }finally{f.sql.close();}
 }
});

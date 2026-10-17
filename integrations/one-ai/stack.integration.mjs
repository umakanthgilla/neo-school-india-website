// Real application handlers + real SQLite; only Workers AI is a synthetic stub.
// Run explicitly with ONE_AI_ENGINE_PATH pointing at the pinned engine checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import neo from '../../worker/neo-lead-crm-api-worker-transport-phase1.js';
import router from './staging-router.mjs';
import connector from './worker.mjs';
if(!process.env.ONE_AI_ENGINE_PATH)throw Error('ONE_AI_ENGINE_PATH must identify the pinned engine checkout');
const source=pathToFileURL(resolve(process.env.ONE_AI_ENGINE_PATH)+'/');
const {default:engine}=await import(new URL('worker.mjs',source));
const {default:gateway}=await import(new URL('integrations/gateway-worker.mjs',source));
const {D1}=await import(new URL('test/d1.mjs',source));
class NeoDB {
 constructor(){this.sqlite=new DatabaseSync(':memory:');}
 prepare(sql){
  const db=this.sqlite;let args=[];
  return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},
   async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}};}};
 }
 async batch(statements){
  this.sqlite.exec('BEGIN');
  try{const results=[];for(const s of statements)results.push(await s.run());this.sqlite.exec('COMMIT');return results;}
  catch(e){this.sqlite.exec('ROLLBACK');throw e;}
 }
}
async function fixture(t){
 const appDB=new NeoDB(),engineDB=new D1('neo-school-india');
 t.after(()=>{appDB.sqlite.close();engineDB.close();});
 appDB.sqlite.exec("CREATE TABLE neo_schools(school_id TEXT PRIMARY KEY,name TEXT,city TEXT,active INTEGER); INSERT INTO neo_schools VALUES ('A','Synthetic A','Test',1),('B','Synthetic B','Test',1);");
 const appEnv={DB:appDB,ADMIN_PASSWORD:'synthetic-local-only-app-key-'.repeat(3)};
 const app={fetch:r=>neo.fetch(r,appEnv,{waitUntil(){}})};
 // Initialize the actual employee schema through the actual unauthenticated endpoint.
 assert.equal((await app.fetch(new Request('https://neo.internal/api/employee/me'))).status,401);
 const ids={staff:'NT-TESTSTAFF1',manager:'NT-TESTMANAGER1',other:'NT-TESTOTHER1'};
 const password='Synthetic-Password-1!',salt='synthetic-salt';
 const hash=pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url');
 const memberships={};
 for(const [role,id] of Object.entries(ids)){
  const school=role==='other'?'B':'A',tenant=role==='other'?'tenant-b':'tenant-a';
  appDB.sqlite.prepare('INSERT INTO neo_employee_accounts VALUES (?,?,?,?,?,?,?,1)').run(id,school,id,'Synthetic '+role,'Administration',hash,salt);
  appDB.sqlite.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,'staff',?,?)").run(school,id,JSON.stringify({status:'Active',name:'PRIVATE STAFF'}));
  memberships[id]={active:true,schoolId:school,tenantId:tenant,authVersion:1};
  engineDB.principal(tenant,id,role==='manager'?'manager':'staff');
 }
 appDB.sqlite.prepare("INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES ('A','enquiries','E1',?)")
  .run(JSON.stringify({status:'New',name:'PRIVATE PARENT',mobile:'9999999999',child_name:'PRIVATE CHILD'}));
 const origin='https://synthetic-stage.example',audience='one-ai:neo-school-india:staging';
 const contextEnv={NEO_DB:appDB,ENGINE_AUDIENCE:audience,CRM_TOKEN_SECRET:'synthetic-only-crm-key-'.repeat(3),TENANT_SCHOOLS_JSON:'{"tenant-a":"A","tenant-b":"B"}'};
 let modelCalls=0;const modelInputs=[];
 const engineEnv={DB:engineDB,PRODUCT:'neo-school-india',TOKEN_ISSUER:'neo-staging',TOKEN_AUDIENCE:audience,ONE_AI_TOKEN_SECRET:'synthetic-only-engine-key-'.repeat(3),CRM_TOKEN_SECRET:contextEnv.CRM_TOKEN_SECRET,
  CRM:{fetch:r=>connector.fetch(r,contextEnv)},AI:{async run(_model,input){modelCalls++;modelInputs.push(input);return {response:input.messages[0].content.includes('Telugu')?'నమస్కారం. మా సిబ్బందితో మాట్లాడాలనుకుంటున్నారా?':input.messages[0].content.includes('Hindi')?'नमस्ते। क्या आप हमारी टीम से बात करना चाहेंगे?':'Hello. Would you like our team to call you?'};}}};
 const gatewayEnv={...engineEnv,CRM_ORIGIN:origin,SESSION_MEMBERSHIPS_JSON:JSON.stringify(memberships),NEO_APP:app,ONE_AI:{fetch:r=>engine.fetch(r,engineEnv)}};
 const routerEnv={ENABLE_ONE_AI:'true',CRM_ORIGIN:origin,NEO_APP:app,ONE_AI_GATEWAY:{fetch:r=>gateway.fetch(r,gatewayEnv)}};
 const sessions={};
 for(const [role,id] of Object.entries(ids)){
  const r=await router.fetch(new Request(origin+'/api/employee/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account_id:id,password})}),routerEnv);
  assert.equal(r.status,200);sessions[role]=(await r.json()).token;
 }
 async function call(path,body,role='staff',key=crypto.randomUUID()){
  const response=await router.fetch(new Request(origin+'/api/one-ai'+path,{
   method:body===undefined?'GET':'POST',headers:{origin,authorization:'Bearer '+sessions[role],'content-type':'application/json','idempotency-key':key},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  }),routerEnv);
  return {status:response.status,data:await response.json()};
 }
 return {call,appDB,engineDB,engineEnv,gatewayEnv,ids,sessions,modelInputs,get modelCalls(){return modelCalls;}};
}
test('real employee login -> router -> gateway -> engine -> encoded CRM lookup -> review -> separate approval',async t=>{
 const f=await fixture(t);
 for(const language of ['te','en','hi']){
  const key='stack-'+language,body={leadId:'enquiry:E1',language};
  const made=await f.call('/drafts/generate',body,'staff',key);
  assert.equal(made.status,201,JSON.stringify(made.data));const d=made.data;
  const replay=await f.call('/drafts/generate',body,'staff',key);
  assert.equal(replay.status,200);assert.equal(replay.data.id,d.id);
  assert.equal((await f.call('/drafts/'+d.id+'/transition',{action:'submit',version:1})).data.state,'pending_approval');
  assert.equal((await f.call('/drafts/'+d.id+'/transition',{action:'approve',version:2})).status,403);
  assert.equal((await f.call('/drafts/'+d.id+'/transition',{action:'approve',version:2},'manager')).data.state,'approved');
  assert.equal((await f.call('/drafts/'+d.id,undefined,'other')).status,404);
  assert.equal((await f.call('/drafts/'+d.id+'/send',{},'manager')).status,404);
  const events=await f.call('/drafts/'+d.id+'/events');
  assert.deepEqual(events.data.events.map(e=>e.action),['create','submit','approve']);
 }
 assert.equal(f.modelCalls,3);
 assert.doesNotMatch(JSON.stringify(f.modelInputs),/PRIVATE|9999999999|enquiry:E1|NT-TEST/);
 assert.equal((await f.call('/drafts/generate',{leadId:'enquiry:E1',language:'te'},'other')).status,404);
});
test('actual employee revocation, password change and school disable invalidate existing sessions',async t=>{
 const f=await fixture(t);
 f.appDB.sqlite.prepare('UPDATE neo_employee_accounts SET active=0 WHERE account_id=?').run(f.ids.staff);
 assert.equal((await f.call('/drafts')).status,401);
 f.appDB.sqlite.prepare('UPDATE neo_employee_accounts SET active=1,password_hash=? WHERE account_id=?').run('changed',f.ids.staff);
 assert.equal((await f.call('/drafts')).status,401);
 f.appDB.sqlite.exec("UPDATE neo_schools SET active=0 WHERE school_id='A'");
 assert.equal((await f.call('/drafts',undefined,'manager')).status,401);
 assert.equal(f.modelCalls,0);
});
test('engine principal revocation and forged scope fail before model invocation',async t=>{
 const f=await fixture(t);
 assert.equal((await f.call('/drafts/generate',{leadId:'enquiry:E1',language:'en',tenantId:'tenant-b'})).status,400);
 f.engineDB.sqlite.prepare('UPDATE one_ai_principals SET active=0 WHERE actor_id=?').run(f.ids.staff);
 assert.equal((await f.call('/drafts')).status,401);
 assert.equal(f.modelCalls,0);
});
test('closed and unknown admissions statuses fail before drafting, and provider errors leave no draft',async t=>{
 const f=await fixture(t);
 for(const [status,expected] of [['Converted',409],['Lost',409],['Closed',502]]){
  f.appDB.sqlite.prepare("UPDATE neo_portal_records SET data=? WHERE kind='enquiries' AND id='E1'").run(JSON.stringify({status}));
  assert.equal((await f.call('/drafts/generate',{leadId:'enquiry:E1',language:'te'})).status,expected);
 }
 assert.equal(f.modelCalls,0);
 f.appDB.sqlite.prepare("UPDATE neo_portal_records SET data=? WHERE kind='enquiries' AND id='E1'").run('{"status":"New"}');
 f.engineEnv.AI.run=async()=>{throw Error('synthetic provider failure');};
 assert.equal((await f.call('/drafts/generate',{leadId:'enquiry:E1',language:'te'})).status,500);
 assert.equal(f.engineDB.sqlite.prepare('SELECT count(*) AS n FROM one_ai_drafts').get().n,0);
 assert.equal(f.engineDB.sqlite.prepare('SELECT count(*) AS n FROM one_ai_events').get().n,0);
});

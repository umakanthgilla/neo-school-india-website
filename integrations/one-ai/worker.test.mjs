import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from './worker.mjs';
import {signClaims} from './auth.mjs';
test('real SQLite admissions queries enforce branch ownership and return no parent/student PII',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE leads(lead_id TEXT,status TEXT,enquiry_type TEXT,name TEXT,mobile TEXT);
 CREATE TABLE neo_growth_lead_meta(lead_id TEXT,branch_id TEXT);
 CREATE TABLE neo_schools(school_id TEXT,active INTEGER);
 CREATE TABLE neo_portal_records(school_id TEXT,kind TEXT,id TEXT,data TEXT);
 INSERT INTO neo_schools VALUES ('A',1),('B',1);
 INSERT INTO leads VALUES ('L1','New','Preschool Admission','PRIVATE','9999999999'),('F1','New','Franchise Enquiry','PRIVATE','9999999999');
 INSERT INTO neo_growth_lead_meta VALUES ('L1','A'),('F1','A');
 INSERT INTO neo_portal_records VALUES ('A','enquiries','E1','{"status":"Interested","child_name":"PRIVATE","mobile":"9999999999"}');`);
 let queries=0;
 const env={ENABLE_GROWTH_CONTEXT:'true',CRM_TOKEN_SECRET:'test-crm-secret-'.repeat(3),ENGINE_AUDIENCE:'one-ai:neo:staging',TENANT_SCHOOLS_JSON:'{"tenant-a":"A","tenant-b":"B"}',
 NEO_DB:{prepare(sql){queries++;assert.ok(/^SELECT/.test(sql));let args;return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;}};}}};
 async function call(leadId,tenantId='tenant-a',patch={},pathLead=leadId) {
  const now=Math.floor(Date.now()/1000);const token=await signClaims({iss:env.ENGINE_AUDIENCE,aud:'one-ai-crm',product:'neo-school-india',tenantId,sub:'staff',version:1,jti:crypto.randomUUID(),leadId,iat:now,exp:now+60,...patch},env.CRM_TOKEN_SECRET);
  const r=await worker.fetch(new Request('https://crm.internal/context/'+pathLead,{headers:{authorization:'Bearer '+token}}),env);return {status:r.status,data:await r.json()};
 }
 for(const leadId of ['growth:L1','enquiry:E1']) {
  const r=await call(leadId);assert.equal(r.status,200);assert.deepEqual(Object.keys(r.data).sort(),['leadId','product','status','tenantId']);
  assert.equal((await call(leadId,'tenant-a',{},encodeURIComponent(leadId))).status,200);
  assert.equal((await call(leadId,'tenant-b')).status,404);
 }
 assert.equal((await call('growth:F1')).status,404);
 assert.equal((await call('growth:L1','unmapped')).status,404);
 const count=queries;assert.equal((await call('growth:L1','tenant-a',{product:'usha-one'})).status,401);
 assert.equal((await call('growth:L1','tenant-a',{},'growth:OTHER')).status,401);assert.equal(queries,count);
 env.ENABLE_GROWTH_CONTEXT='false';const beforeDisabled=queries;assert.equal((await call('growth:L1')).status,404);assert.equal(queries,beforeDisabled);env.ENABLE_GROWTH_CONTEXT='true';
 // Check every stored school status, including its distinct visit label.
 for(const [stored,canonical] of [['New','New'],['Contacted','Contacted'],['Visit planned','Visit / Meeting'],['Converted','Converted'],['Lost','Lost']]){
  db.prepare("UPDATE neo_portal_records SET data=? WHERE id='E1'").run(JSON.stringify({status:stored}));
  const r=await call('enquiry:E1');assert.equal(r.status,200);assert.equal(r.data.status,canonical);
 }
 for(const invalid of [null,'','Unknown','Closed','Admitted']){
  db.prepare("UPDATE neo_portal_records SET data=? WHERE id='E1'").run(JSON.stringify({status:invalid}));
  const r=await call('enquiry:E1');assert.equal(r.status,409);assert.equal(Object.hasOwn(r.data,'status'),false);
  db.prepare("UPDATE leads SET status=? WHERE lead_id='L1'").run(invalid);
  assert.equal((await call('growth:L1')).status,409);
 }
 db.exec("UPDATE neo_schools SET active=0 WHERE school_id='A'");assert.equal((await call('growth:L1')).status,404);
});

test('context Worker rejects forged, expired, wrong-audience and missing credentials before querying',async()=>{
 let queries=0;
 const env={NEO_DB:{prepare(){queries++;throw Error('must not query');}},
 ENGINE_AUDIENCE:'one-ai:neo:staging',CRM_TOKEN_SECRET:'test-crm-secret-'.repeat(3),
 TENANT_SCHOOLS_JSON:'{"tenant-a":"A"}',ENABLE_GROWTH_CONTEXT:'true'};
 const path='https://crm.internal/context/enquiry:E1';
 const now=Math.floor(Date.now()/1000);
 const base={iss:env.ENGINE_AUDIENCE,aud:'one-ai-crm',product:'neo-school-india',
 tenantId:'tenant-a',sub:'staff',version:1,jti:'unique-1',leadId:'enquiry:E1',iat:now,exp:now+60};
 const checks=[
  {headers:{}},
  {headers:{authorization:'Bearer forged.signature'}},
  {claims:{...base,aud:'wrong'}},
  {claims:{...base,iss:'wrong'}},
  {claims:{...base,exp:now-1}},
  {claims:{...base,iat:now-400,exp:now+1}},
  {claims:{...base,leadId:'enquiry:OTHER'}}
 ];
 for(const check of checks){
  const token=check.claims?await signClaims(check.claims,env.CRM_TOKEN_SECRET):null;
  const headers=token?{authorization:'Bearer '+token}:check.headers;
  const response=await worker.fetch(new Request(path,{headers}),env);
  assert.equal(response.status,401);
 }
 assert.equal(queries,0);
 for(const suffix of ['enquiry%ZZ','enquiry%253AE1','enquiry%3AE1%2Fother']){
  const response=await worker.fetch(new Request('https://crm.internal/context/'+suffix),env);
  assert.ok([401,404].includes(response.status));
 }
 assert.equal(queries,0);
});

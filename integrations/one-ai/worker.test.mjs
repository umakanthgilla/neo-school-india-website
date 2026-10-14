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
 const env={CRM_TOKEN_SECRET:'test-crm-secret-'.repeat(3),ENGINE_AUDIENCE:'one-ai:neo:staging',TENANT_SCHOOLS_JSON:'{"tenant-a":"A","tenant-b":"B"}',
 NEO_DB:{prepare(sql){queries++;assert.ok(/^SELECT/.test(sql));let args;return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;}};}}};
 async function call(leadId,tenantId='tenant-a',patch={},pathLead=leadId) {
  const now=Math.floor(Date.now()/1000);const token=await signClaims({iss:env.ENGINE_AUDIENCE,aud:'one-ai-crm',product:'neo-school-india',tenantId,sub:'staff',version:1,jti:crypto.randomUUID(),leadId,iat:now,exp:now+60,...patch},env.CRM_TOKEN_SECRET);
  const r=await worker.fetch(new Request('https://crm.internal/context/'+pathLead,{headers:{authorization:'Bearer '+token}}),env);return {status:r.status,data:await r.json()};
 }
 for(const leadId of ['growth:L1','enquiry:E1']) {
  const r=await call(leadId);assert.equal(r.status,200);assert.deepEqual(Object.keys(r.data).sort(),['leadId','product','status','tenantId']);
  assert.equal((await call(leadId,'tenant-b')).status,404);
 }
 assert.equal((await call('growth:F1')).status,404);
 assert.equal((await call('growth:L1','unmapped')).status,404);
 const count=queries;assert.equal((await call('growth:L1','tenant-a',{product:'usha-one'})).status,401);
 assert.equal((await call('growth:L1','tenant-a',{},'growth:OTHER')).status,401);assert.equal(queries,count);
 db.exec("UPDATE neo_schools SET active=0 WHERE school_id='A'");assert.equal((await call('growth:L1')).status,404);
});

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
const source='worker/neo-lead-crm-api-worker-transport-phase1.js';
writeFileSync('transport-qa-worker.mjs',readFileSync(source,'utf8')+'\nexport {transportPortal};\n');
const {transportPortal}=await import('./transport-qa-worker.mjs');
const db=new DatabaseSync(':memory:');
const DB={
 prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this},async first(){return db.prepare(this.sql).get(...this.args)||null},async all(){return {results:db.prepare(this.sql).all(...this.args)}},async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}}}}},
 async batch(stmts){db.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}
};
const env={DB,ADMIN_PASSWORD:'transport-qa-secret'};
const schoolId='TESTSCHOOL',secret=env.ADMIN_PASSWORD;
const token=async(role,id,version)=>{
 const payload=Buffer.from(JSON.stringify({role,...id,version,exp:Date.now()+3600000})).toString('base64url');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');
 return payload+'.'+sig;
};
const schoolToken=await token('school',{school_id:schoolId},'school-hash');
const req=(path,method='GET',body,auth=schoolToken)=>new Request('https://example.test/api/transport/'+path,{method,headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function call(path,method,body,auth){const r=await transportPortal(req(path,method,body,auth),env,new URL('https://example.test/api/transport/'+path));return {status:r.status,body:await r.json()}}
const assert=(c,m)=>{if(!c)throw Error(m)};
db.exec('CREATE TABLE neo_schools(school_id TEXT PRIMARY KEY,name TEXT,city TEXT,owner TEXT,password_hash TEXT,salt TEXT,active INTEGER DEFAULT 1)');
await call('school/routes/'+schoolId);
db.prepare('INSERT INTO neo_schools(school_id,name,city,owner,password_hash,salt) VALUES (?,?,?,?,?,?)').run(schoolId,'Test School','Jagtial','QA','school-hash','salt');
const put=(kind,id,data)=>db.prepare('INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').run(schoolId,kind,id,JSON.stringify(data));
put('staff','DRIVER01',{name:'Test Driver',status:'Active'});
put('students','CHILD001',{name:'Child A',program:'LKG'});
put('students','CHILD002',{name:'Child B',program:'UKG'});
let r=await call('school/vehicles/'+schoolId,'POST',{request_id:'VEHICLE01',registration_no:'TS01AB1234',label:'Bus 1',capacity:1});assert(r.status===201,'create vehicle '+JSON.stringify(r));
r=await call('school/routes/'+schoolId,'POST',{request_id:'ROUTE001',name:'Route 1',vehicle_id:'VEHICLE01',driver_staff_id:'DRIVER01',stops:['Market','School']});assert(r.status===201,'create route '+JSON.stringify(r));
r=await call('school/assignments/'+schoolId,'POST',{request_id:'ASSIGN001',route_id:'ROUTE001',student_id:'CHILD001',stop:'Market'});assert(r.status===201,'assign child '+JSON.stringify(r));
r=await call('school/assignments/'+schoolId,'POST',{request_id:'ASSIGN002',route_id:'ROUTE001',student_id:'CHILD002',stop:'Market'});assert(r.status===409,'capacity must fail '+JSON.stringify(r));
const today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
r=await call('school/trips/'+schoolId,'POST',{request_id:'TRIP0001',route_id:'ROUTE001',date:today,direction:'Pickup'});assert(r.status===201,'create trip '+JSON.stringify(r));
r=await call('school/trips/'+schoolId,'POST',{request_id:'TRIP0002',route_id:'ROUTE001',date:today,direction:'Pickup'});assert(r.status===409,'duplicate trip must fail '+JSON.stringify(r));
r=await call('school/trips/'+schoolId+'/TRIP0001','PATCH',{status:'Started'});assert(r.status===200,'start trip '+JSON.stringify(r));
r=await call('school/trips/'+schoolId+'/TRIP0001','PATCH',{status:'Completed'});assert(r.status===409,'incomplete manifest must fail '+JSON.stringify(r));
r=await call('school/trips/'+schoolId+'/TRIP0001','PATCH',{status:'',student_id:'CHILD001',event_type:'Picked up'});assert(r.status===200,'pickup event '+JSON.stringify(r));
r=await call('school/trips/'+schoolId+'/TRIP0001','PATCH',{status:'',student_id:'CHILD001',event_type:'Dropped at school'});assert(r.status===200,'school drop event '+JSON.stringify(r));
r=await call('school/trips/'+schoolId+'/TRIP0001','PATCH',{status:'Completed'});assert(r.status===200,'complete trip '+JSON.stringify(r));
db.prepare('INSERT INTO neo_parent_accounts(account_id,school_id,student_id,password_hash,salt) VALUES (?,?,?,?,?)').run('NP-PARENT01',schoolId,'CHILD001','parent-hash','salt');
db.prepare('INSERT INTO neo_parent_accounts(account_id,school_id,student_id,password_hash,salt) VALUES (?,?,?,?,?)').run('NP-PARENT02',schoolId,'CHILD002','parent-hash-2','salt');
db.prepare('INSERT INTO neo_employee_accounts(account_id,school_id,staff_id,name,staff_type,password_hash,salt) VALUES (?,?,?,?,?,?,?)').run('NT-DRIVER01',schoolId,'DRIVER01','Driver','Transport','driver-hash','salt');
db.prepare('INSERT INTO neo_employee_accounts(account_id,school_id,staff_id,name,staff_type,password_hash,salt) VALUES (?,?,?,?,?,?,?)').run('NT-OTHER001',schoolId,'OTHER001','Other','Admin','other-hash','salt');
const parent1=await token('parent',{account_id:'NP-PARENT01'},'parent-hash');
const parent2=await token('parent',{account_id:'NP-PARENT02'},'parent-hash-2');
const driver=await token('employee',{account_id:'NT-DRIVER01'},'driver-hash');
const other=await token('employee',{account_id:'NT-OTHER001'},'other-hash');
r=await call('parent/me','GET',null,parent1);assert(r.status===200&&r.body.trips.length===1&&r.body.trips[0].events.length===2,'parent own child '+JSON.stringify(r));
r=await call('parent/me','GET',null,parent2);assert(r.status===200&&r.body.trips.length===0,'other parent cannot see trip '+JSON.stringify(r));
r=await call('driver/me','GET',null,driver);assert(r.status===200&&r.body.trips.length===1,'assigned driver sees trip '+JSON.stringify(r));
r=await call('driver/trips/'+schoolId+'/TRIP0001','PATCH',{status:'Started'},other);assert(r.status===403,'other employee denied '+JSON.stringify(r));
console.log('Transport smoke: route, capacity, duplicate, child events, completion and role isolation passed.');

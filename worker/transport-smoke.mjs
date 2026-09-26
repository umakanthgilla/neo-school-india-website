import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
const source='worker/neo-lead-crm-api-worker-transport-phase1.js';
writeFileSync('worker/transport-qa-worker.mjs',readFileSync(source,'utf8')+'\nexport {transportPortal,transportOperations};\n');
const {transportPortal,transportOperations}=await import('./transport-qa-worker.mjs');
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
async function call(path,method,body,auth){const request=req(path,method,body,auth),url=new URL('https://example.test/api/transport/'+path);const r=await transportOperations(request,env,url)||await transportPortal(request,env,url);return {status:r.status,body:await r.json()}}
const assert=(c,m)=>{if(!c)throw Error(m)};
db.exec('CREATE TABLE neo_schools(school_id TEXT PRIMARY KEY,name TEXT,city TEXT,owner TEXT,password_hash TEXT,salt TEXT,active INTEGER DEFAULT 1)');
await call('school/routes/'+schoolId);
db.prepare('INSERT INTO neo_schools(school_id,name,city,owner,password_hash,salt) VALUES (?,?,?,?,?,?)').run(schoolId,'Test School','Jagtial','QA','school-hash','salt');
const put=(kind,id,data)=>db.prepare('INSERT INTO neo_portal_records(school_id,kind,id,data) VALUES (?,?,?,?)').run(schoolId,kind,id,JSON.stringify(data));
put('staff','DRIVER01',{name:'Test Driver',status:'Active'});
put('classrooms','CLASS001',{name:'LKG A',program:'LKG',academic_year:'2026'});
put('classrooms','CLASS002',{name:'UKG A',program:'UKG',academic_year:'2026'});
put('students','CHILD001',{name:'Child A',program:'LKG',classroom_id:'CLASS001'});
put('students','CHILD002',{name:'Child B',program:'UKG',classroom_id:'CLASS002'});
put('students','CHILD003',{name:'Child C',program:'LKG',classroom_id:'CLASS001'});
let r=await call('school/vehicles/'+schoolId,'POST',{request_id:'VEHICLE01',registration_no:'TS01AB1234',label:'Bus 1',capacity:2,insurance_expiry:'2027-12-01',pollution_expiry:'2027-12-01',fitness_expiry:'2027-12-01',tax_expiry:'2027-12-01'});assert(r.status===201,'vehicle '+JSON.stringify(r));
r=await call('school/routes/'+schoolId,'POST',{request_id:'ROUTE001',name:'Route 1',vehicle_id:'VEHICLE01',driver_staff_id:'DRIVER01',stops:['Market','School'],trip_count:2});assert(r.status===201,'route '+JSON.stringify(r));
r=await call('school/assignments/'+schoolId,'POST',{request_id:'WRONGCLASS',route_id:'ROUTE001',student_id:'CHILD001',classroom_id:'CLASS002',stop:'Market'});assert(r.status===400,'wrong class');
r=await call('school/assignments/'+schoolId,'POST',{request_id:'ASSIGN001',route_id:'ROUTE001',student_id:'CHILD001',classroom_id:'CLASS001',stop:'Market',run_no:1});assert(r.status===201,'assign '+JSON.stringify(r));
r=await call('school/assignments/'+schoolId,'POST',{request_id:'ASSIGN002',route_id:'ROUTE001',student_id:'CHILD002',classroom_id:'CLASS002',stop:'School',run_no:1});assert(r.status===201,'assign second');
r=await call('school/assignments/'+schoolId,'POST',{request_id:'ASSIGN003',route_id:'ROUTE001',student_id:'CHILD003',classroom_id:'CLASS001',stop:'Market',run_no:2});assert(r.status===201,'second run capacity independent');
r=await call('school/assignments/'+schoolId,'POST',{request_id:'DUPLICATE',route_id:'ROUTE001',student_id:'CHILD001',classroom_id:'CLASS001',stop:'School'});assert(r.status===409,'duplicate child');
r=await call('school/assignments/'+schoolId+'/ASSIGN001','PATCH',{active:false});assert(r.status===403,'locked assignment');
r=await call('school/trips/'+schoolId,'POST',{request_id:'SCHOOLOPS',route_id:'ROUTE001'});assert(r.status===403,'school cannot operate trips');
r=await call('school/access/'+schoolId,'POST',{staff_id:'DRIVER01',role:'Driver',password:'TestDriver1!'});assert(r.status===201,'create transport access '+JSON.stringify(r));const account=r.body.account_id;
r=await call('login','POST',{account_id:account,password:'TestDriver1!'},'');assert(r.status===200,'driver login '+JSON.stringify(r));const driver=r.body.token;
r=await call('driver/me','GET',null,driver);assert(r.status===200&&r.body.routes.length===1&&r.body.students.length===3,'scoped manifest');
const photo='data:image/jpeg;base64,'+Buffer.from([255,216,1,2,255,217]).toString('base64');
r=await call('driver/start','POST',{route_id:'ROUTE001',direction:'Pickup',run_no:1,fuel_ok:true,tyres_ok:true,condition_ok:true,odometer_km:100,photo},schoolToken);assert(r.status===401,'school cannot start');
r=await call('driver/start','POST',{route_id:'ROUTE001',direction:'Pickup',run_no:1,fuel_ok:true,tyres_ok:true,condition_ok:true,odometer_km:100,photo},driver);assert(r.status===201,'driver start '+JSON.stringify(r));const trip=r.body.id;
r=await call('driver/start','POST',{route_id:'ROUTE001',direction:'Pickup',run_no:2,fuel_ok:true,tyres_ok:true,condition_ok:true,odometer_km:100,photo},driver);assert(r.status===201,'independent second run '+JSON.stringify(r));
r=await call('driver/start','POST',{route_id:'ROUTE001',direction:'Pickup',run_no:1,fuel_ok:true,tyres_ok:true,condition_ok:true,odometer_km:100,photo},driver);assert(r.status===409,'same run duplicate');
r=await call('driver/finish','POST',{trip_id:trip,odometer_km:101,photo},driver);assert(r.status===409,'finish needs child events');
r=await call('driver/event','POST',{trip_id:trip,student_id:'CHILD002',event_type:'Picked up'},driver);assert(r.status===409,'stop order');
r=await call('driver/event','POST',{trip_id:trip,student_id:'CHILD001',event_type:'Picked up'},driver);assert(r.status===200,'first child '+JSON.stringify(r));
r=await call('driver/event','POST',{trip_id:trip,student_id:'CHILD002',event_type:'Absent'},driver);assert(r.status===200,'second child');
r=await call('driver/finish','POST',{trip_id:trip,odometer_km:102,photo},driver);assert(r.status===200,'finish '+JSON.stringify(r));
const parent=await token('parent',{account_id:'NP-PARENT01'},'parent-hash');
db.prepare('INSERT INTO neo_parent_accounts(account_id,school_id,student_id,password_hash,salt) VALUES (?,?,?,?,?)').run('NP-PARENT01',schoolId,'CHILD001','parent-hash','salt');
r=await call('parent/me','GET',null,parent);assert(r.status===200&&r.body.trips.length===1&&r.body.alerts.length===1,'child-scoped parent view '+JSON.stringify(r));
console.log('Transport smoke: class lock, separate login, trip start, alerts, event order, finish passed.');

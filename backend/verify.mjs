import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('./worker.js',import.meta.url))).toString('base64'));
const db=new DatabaseSync(':memory:');
function stmt(sql,args=[]){return {bind(...v){return stmt(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}}}
const env={ADMIN_PASSWORD:'test-only-admin-secret',DB:{prepare:stmt,async batch(items){db.exec('BEGIN');try{const out=[];for(const x of items)out.push(await x.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}}};
async function req(path,method='GET',data,token){const r=await worker.fetch(new Request('https://unit.test'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:r.status,body:await r.json()}}
let r=await req('/api/admin/login','POST',{password:env.ADMIN_PASSWORD});assert.equal(r.status,200);const admin=r.body.token;
assert.equal((await req('/api/franchise/setup','POST',{})).status,401);
assert.equal((await req('/api/franchise/setup','POST',{},admin)).status,200);
assert.equal((await req('/api/franchise/setup','POST',{},admin)).status,200);
const create=async name=>(await req('/api/franchise/schools','POST',{name,city:'Jagtial',owner:'Test owner',password:'test-password-123'},admin)).body.school_id;
const one=await create('School one'),two=await create('School two');assert.ok(one&&two);
r=await req('/api/franchise/login','POST',{school_id:one,password:'test-password-123'});assert.equal(r.status,200);const school=r.body.token;
r=await req('/api/franchise/me','GET',null,school);assert.equal(r.body.tasks.length,6);assert.equal(r.body.school.password_hash,undefined);
assert.equal((await req('/api/franchise/schools/'+two,'GET',null,school)).status,403);
assert.equal((await req('/api/franchise/schools','GET',null,school)).status,403);
assert.equal((await req('/api/franchise/schools/'+one,'PATCH',{task:'Launch approval',completed:true},school)).status,403);
assert.equal((await req('/api/admin/leads','GET',null,school)).status,401);
assert.equal((await req('/api/franchise/schools/'+one,'PATCH',{task:'Location review',completed:true},admin)).status,200);
r=await req('/api/franchise/me','GET',null,school);assert.equal(r.body.tasks.find(t=>t.task==='Location review').completed,1);
await req('/api/franchise/schools/'+one,'PATCH',{password:'replacement-password-123'},admin);
assert.equal((await req('/api/franchise/me','GET',null,school)).status,401);
r=await req('/api/franchise/login','POST',{school_id:one,password:'replacement-password-123'});const fresh=r.body.token;assert.ok(fresh);
await req('/api/franchise/schools/'+one,'PATCH',{active:false},admin);
assert.equal((await req('/api/franchise/me','GET',null,fresh)).status,401);
for(let i=0;i<10;i++)await req('/api/franchise/login','POST',{school_id:two,password:'wrong'});
assert.equal((await req('/api/franchise/login','POST',{school_id:two,password:'wrong'})).status,429);
console.log('PASS: setup, accounts, school isolation, admin restrictions, readiness persistence, reset, suspension, login throttling.');
db.exec(`CREATE TABLE leads (
lead_id TEXT PRIMARY KEY,status TEXT,priority TEXT,assigned_to TEXT,
next_follow_up TEXT,follow_up_result TEXT,notes TEXT,converted_date TEXT,
lost_reason TEXT,last_contact TEXT,updated_at TEXT);
INSERT INTO leads VALUES ('test-lead','Contacted','Warm','Team',
'2026-10-01T09:00','Call back','Keep notes',NULL,'Old reason',NULL,NULL);`);
const patchLead=data=>req('/api/admin/leads/test-lead','PATCH',data,admin);
assert.equal((await patchLead({priority:'Hot'})).status,200);
let lead=db.prepare("SELECT * FROM leads WHERE lead_id='test-lead'").get();
assert.equal(lead.notes,'Keep notes');assert.equal(lead.next_follow_up,'2026-10-01T09:00');
assert.equal((await patchLead({assigned_to:'',next_follow_up:'',follow_up_result:'',notes:'',lost_reason:''})).status,200);
lead=db.prepare("SELECT * FROM leads WHERE lead_id='test-lead'").get();
for(const key of ['assigned_to','next_follow_up','follow_up_result','notes','lost_reason'])assert.equal(lead[key],null,key);
assert.equal((await patchLead({nextFollowUp:'2026-11-02T10:00',notes:'New notes'})).status,200);
assert.equal((await patchLead({next_follow_up:'',nextFollowUp:'2026-12-01'})).status,200);
lead=db.prepare("SELECT * FROM leads WHERE lead_id='test-lead'").get();
assert.equal(lead.next_follow_up,null);assert.equal(lead.notes,'New notes');
console.log('PASS: CRM partial updates preserve omitted fields and clear explicit blanks, including alias precedence.');

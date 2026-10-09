import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureBusinessChart,STANDARD_CHART} from './accounting-chart.mjs';
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE neo_fin_memberships(organization_id TEXT,account_id TEXT,role TEXT,active INTEGER);
 CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY,status TEXT);
 INSERT INTO neo_fin_organizations VALUES('HO','active'),('A','active'),('B','active');
 CREATE TABLE neo_fin_accounts(organization_id TEXT,id TEXT,account_code TEXT,account_name TEXT,account_type TEXT,active INTEGER DEFAULT 1,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,account_code));
 INSERT INTO neo_fin_memberships VALUES('HO','ho','owner',1),('A','alice','owner',1),('B','bob','owner',1),('A','auditor','auditor',1);`);
 const bind=(sql,vals)=>{const st=db.prepare(sql);return {first:async()=>st.get(...vals),all:async()=>({results:st.all(...vals)}),run:async()=>{const x=st.run(...vals);return{success:true,meta:{changes:x.changes}}}}};
 return {sqlite:db,prepare(sql){return{bind(...values){return bind(sql,values)}}},async batch(queries){db.exec('BEGIN');try{let out=[];for(const q of queries)out.push(await q.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
test('owner can bootstrap only their business and repeat safely',async()=>{
 const db=setup();let a=await ensureBusinessChart(db,'alice','A');assert.equal(a.accountCount,STANDARD_CHART.length);
 await ensureBusinessChart(db,'alice','A');
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM neo_fin_accounts WHERE organization_id='A'").get().n,STANDARD_CHART.length);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM neo_fin_accounts WHERE organization_id='HO'").get().n,0);
 db.sqlite.close();
});
test('HO owner cannot bootstrap a center',async()=>{
 const db=setup();await assert.rejects(ensureBusinessChart(db,'ho','A'),/Finance access denied/);db.sqlite.close();
});
test('auditor cannot bootstrap business accounts',async()=>{
 const db=setup();await assert.rejects(ensureBusinessChart(db,'auditor','A'),/Finance access denied/);db.sqlite.close();
});
test('conflicting account code fails closed',async()=>{
 const db=setup();db.sqlite.exec("INSERT INTO neo_fin_accounts VALUES('A','OTHER','1000','Misconfigured','liability',1)");
 await assert.rejects(ensureBusinessChart(db,'alice','A'),/Chart account conflict/);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM neo_fin_accounts WHERE organization_id='A'").get().n,1);
 db.sqlite.close();
});

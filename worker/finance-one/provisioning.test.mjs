import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {provisionFinanceIdentityInternal} from './provisioning.mjs';

const testPassword='FinanceExamplePassword%2026';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec(`CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY,status TEXT NOT NULL);
 CREATE TABLE neo_fin_auth_accounts(account_id TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL,iterations INTEGER NOT NULL);
 CREATE TABLE neo_fin_memberships(organization_id TEXT NOT NULL,account_id TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL,
  PRIMARY KEY(organization_id,account_id,role), FOREIGN KEY(organization_id) REFERENCES neo_fin_organizations(id), FOREIGN KEY(account_id) REFERENCES neo_fin_auth_accounts(account_id));
 INSERT INTO neo_fin_organizations VALUES ('HO','active'),('CENTER_A','active'),('CENTER_B','suspended');`);
 const db={sqlite,prepare(q){return{bind(...args){const st=sqlite.prepare(q);return{
   first:async()=>st.get(...args),run:async()=>{const res=st.run(...args);return{success:true,meta:{changes:res.changes}}}
 }}}},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const st of statements)out.push(await st.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 return db;
}
const props=db=>({db,accountId:'fin:alice',password:testPassword,organizationId:'CENTER_A',role:'owner',authorizedOperator:true});
test('a separately authorized operator provisions a Finance account for one center',async()=>{
 const db=fixture();const r=await provisionFinanceIdentityInternal(props(db));
 assert.equal(r.organizationId,'CENTER_A');
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_auth_accounts').get().n,1);
 assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM neo_fin_memberships WHERE organization_id='HO'").get().n,0);
 const credential=db.sqlite.prepare("SELECT password_hash,salt FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get();
 assert.equal(credential.password_hash.length,64);assert.notEqual(credential.password_hash,testPassword);
 db.sqlite.close();
});
test('public or unauthorized provisioning is rejected before any query',async()=>{
 const db=fixture();await assert.rejects(provisionFinanceIdentityInternal({...props(db),authorizedOperator:false}),/authorized operator/);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_auth_accounts').get().n,0);db.sqlite.close();
});
test('a suspended independent center cannot receive new Finance accounts',async()=>{
 const db=fixture();await assert.rejects(provisionFinanceIdentityInternal({...props(db),organizationId:'CENTER_B'}),/Active independent business/);db.sqlite.close();
});
test('duplicate identity cannot overwrite an existing password or membership',async()=>{
 const db=fixture();await provisionFinanceIdentityInternal(props(db));
 const before=db.sqlite.prepare("SELECT password_hash FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get();
 await assert.rejects(provisionFinanceIdentityInternal(props(db)),/already exists/);
 assert.equal(db.sqlite.prepare("SELECT password_hash FROM neo_fin_auth_accounts WHERE account_id='fin:alice'").get().password_hash,before.password_hash);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_memberships').get().n,1);db.sqlite.close();
});
test('unsupported roles and invalid business identifiers are rejected',async()=>{
 const db=fixture();await assert.rejects(provisionFinanceIdentityInternal({...props(db),role:'employee'}),/Invalid finance identity/);
 await assert.rejects(provisionFinanceIdentityInternal({...props(db),organizationId:'HO OR 1=1'}),/Invalid finance identity/);db.sqlite.close();
});
test('transaction rollback prevents credentials without membership',async()=>{
 const db=fixture();db.sqlite.exec("CREATE TRIGGER fail_member BEFORE INSERT ON neo_fin_memberships BEGIN SELECT RAISE(ABORT,'blocked membership');END;");
 await assert.rejects(provisionFinanceIdentityInternal(props(db)),/blocked membership/);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM neo_fin_auth_accounts').get().n,0);db.sqlite.close();
});

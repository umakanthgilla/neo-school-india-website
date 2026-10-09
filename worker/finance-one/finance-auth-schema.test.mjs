import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const schema=readFileSync(new URL('../../migrations/finance_payroll_one_auth_accounts.sql',import.meta.url),'utf8');
const seed="INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations) VALUES ('fin:test','01234567890123456789012345678901','0123456789012345678901234567890123456789012345678901234567890123',210000)";
test('Finance authentication migration runs on SQLite',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);db.exec(seed);
 assert.equal(db.prepare("SELECT credential_version FROM neo_fin_auth_accounts WHERE account_id='fin:test'").get().credential_version,1);db.close();
});
test('Finance password replacement requires credential version rotation',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);db.exec(seed);
 assert.throws(()=>db.exec("UPDATE neo_fin_auth_accounts SET password_hash='abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' WHERE account_id='fin:test'"),/Credential change requires new version/);
 db.exec("UPDATE neo_fin_auth_accounts SET password_hash='abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',credential_version=credential_version+1 WHERE account_id='fin:test'");
 assert.equal(db.prepare("SELECT credential_version FROM neo_fin_auth_accounts").get().credential_version,2);db.close();
});
test('Finance account disable immediately requires credential rotation',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);db.exec(seed);
 assert.throws(()=>db.exec("UPDATE neo_fin_auth_accounts SET active=0 WHERE account_id='fin:test'"),/Credential change requires new version/);
 db.exec("UPDATE neo_fin_auth_accounts SET active=0,credential_version=credential_version+1 WHERE account_id='fin:test'");
 assert.equal(db.prepare("SELECT active FROM neo_fin_auth_accounts").get().active,0);db.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {auditSchoolForFinanceMember} from './authorized-legacy-audit.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY,status TEXT);
 CREATE TABLE neo_fin_memberships(organization_id TEXT,account_id TEXT,role TEXT,active INTEGER);
 CREATE TABLE neo_fin_school_ownership(school_id TEXT PRIMARY KEY,organization_id TEXT);
 CREATE TABLE neo_portal_records(school_id TEXT,kind TEXT,id TEXT,data TEXT,PRIMARY KEY(school_id,kind,id));
 INSERT INTO neo_fin_organizations VALUES ('HO','active'),('A','active'),('B','active');
 INSERT INTO neo_fin_memberships VALUES ('HO','ho_owner','owner',1),('A','alice','owner',1),('B','bob','owner',1);
 INSERT INTO neo_fin_school_ownership VALUES ('SCHOOL_A','A'),('SCHOOL_B','B');
 INSERT INTO neo_portal_records VALUES ('SCHOOL_A','payments','P1','{"amount_paise":5000,"receipt_no":"R1"}');
 INSERT INTO neo_portal_records VALUES ('SCHOOL_A','daily_accounts','FIN_FEE_P1','{"source_kind":"fee_payment","source_id":"P1","direction":"IN","amount_paise":5000,"reference":"R1"}');
 INSERT INTO neo_portal_records VALUES ('SCHOOL_B','payments','P1','{"amount_paise":9000,"receipt_no":"R2"}');`);
 return {prepare(sql){const stmt=db.prepare(sql);return{bind(...p){return{first:async()=>stmt.get(...p),all:async()=>({results:stmt.all(...p)})};}}},close(){db.close()}};
}
test('Center A audit contains only A records',async()=>{
 const db=fixture();const x=await auditSchoolForFinanceMember({db,accountId:'alice',schoolId:'SCHOOL_A'});
 assert.equal(x.organizationId,'A');assert.equal(x.postings,1);assert.equal(x.findings.length,0);db.close();
});
test('HO and other center owners cannot inspect Center A',async()=>{
 const db=fixture();
 await assert.rejects(auditSchoolForFinanceMember({db,accountId:'ho_owner',schoolId:'SCHOOL_A'}));
 await assert.rejects(auditSchoolForFinanceMember({db,accountId:'bob',schoolId:'SCHOOL_A'}));
 db.close();
});
test('Center B gets independent missing-posting report',async()=>{
 const db=fixture();const x=await auditSchoolForFinanceMember({db,accountId:'bob',schoolId:'SCHOOL_B'});
 assert.equal(x.postings,0);assert.equal(x.findings[0].code,'MISSING_DAILY_LEDGER');db.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './staging-entry.mjs';
import {issueFinanceOneToken} from './finance-session.mjs';
import {STANDARD_CHART} from './accounting-chart.mjs';
import {verifyLegacyFeeReceipt} from './legacy-fee-receipt-verifier.mjs';
const migrations=['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections','source_operations','receipt_evidence_review'];
const wrap=sql=>({prepare(q){const s=sql.prepare(q),bound=args=>({first:async()=>s.get(...args),all:async()=>({results:s.all(...args)}),run:async()=>({success:true,meta:{changes:s.run(...args).changes}})});return {...bound([]),bind:(...args)=>bound(args)};},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}});
async function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of migrations)sql.exec(readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8'));
 const source=new DatabaseSync(':memory:');source.exec('CREATE TABLE neo_portal_records(school_id TEXT,kind TEXT,id TEXT,data TEXT,PRIMARY KEY(school_id,kind,id))');
 const put=(kind,id,data)=>source.prepare("INSERT INTO neo_portal_records VALUES('S_A',?,?,?)").run(kind,id,JSON.stringify(data));
 put('students','ST1',{});put('fee_structures','FS1',{});
 put('invoices','INV1',{student_id:'ST1',fee_structure_id:'FS1',amount_paise:10000,due_date:'2026-10-08'});
 put('payments','P1',{invoice_id:'INV1',receipt_no:'R1',amount_paise:10000,method:'UPI'});
 put('daily_accounts','FIN_FEE_P1',{source_kind:'fee_payment',source_id:'P1',direction:'IN',amount_paise:10000,reference:'R1',status:'Posted'});
 const original=source.prepare('SELECT * FROM neo_portal_records ORDER BY kind,id').all();source.exec('PRAGMA query_only=ON');
 const secret='receipt-evidence-synthetic-test-secret-over-32';const tokens={};
 for(const org of ['A','B','HO']){
  sql.prepare('INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES(?,?,?)').run(org,org,org==='HO'?'head_office':'independent_center');
  sql.prepare('INSERT INTO neo_fin_school_ownership VALUES(?,?,?,NULL)').run('S_'+org,org,'2026-01-01');
  for(const [actor,role] of [['maker','accountant'],['checker','owner'],['reader','auditor']]){
   const account='fin:'+org+actor;
   sql.prepare('INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES(?,?,?)').run(org,account,role);
   sql.prepare('INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations) VALUES(?,?,?,210000)').run(account,'a'.repeat(32),'b'.repeat(64));
   tokens[org+actor]=await issueFinanceOneToken({accountId:account,credentialVersion:1,secret});
  }
  for(const [code,name,type] of STANDARD_CHART)sql.prepare('INSERT INTO neo_fin_accounts VALUES(?,?,?,?,?,1)').run(org,code,code,name,type);
 }
 const db=wrap(sql),sourceDb=wrap(source);
 const env={DB:db,SCHOOL_SOURCE_DB:sourceDb,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:secret,FINANCE_ONE_SEPARATE_SOURCE_ENABLED:'true',FINANCE_ONE_SOURCE_ENVIRONMENT:'staging',FINANCE_ONE_SOURCE_OPERATIONS_ENABLED:'true',FINANCE_ONE_EVIDENCE_OPERATIONS_ENABLED:'true'};
 const call=(path,{actor='Amaker',org='A',body,override={},origin='https://staging.test'}={})=>worker.fetch(new Request('https://staging.test/api/finance-one/v1/organizations/'+org+'/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+tokens[actor],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{...env,...override});
 const input={requestId:'evidence-request-1',schoolId:'S_A',paymentRecordId:'P1',verificationReference:'SYNTHETIC-BANK-REF',archiveReference:'SYNTHETIC-ARCHIVE/statement-1',evidenceSha256:'a'.repeat(64),settledAt:'2026-10-08T10:00:00Z'};
 const decision={decision:'approved',reviewNote:'Synthetic independent bank evidence reviewed',reviewedEvidenceSha256:'a'.repeat(64)};
 const count=t=>sql.prepare('SELECT COUNT(*) AS n FROM '+t).get().n;
 return {sql,source,db,sourceDb,original,call,input,decision,count,close(){sql.close();source.close();}};
}
test('signed receipt intake, independent approval, source import, ledger and accounting work with two physical databases',async()=>{
 const f=await fixture();try{
 assert.equal((await f.call('source-operations',{body:{requestId:'invoice-import-1',action:'invoice',source:{schoolId:'S_A',invoiceRecordId:'INV1'}}})).status,200);
 assert.equal((await f.call('receipt-evidence',{body:f.input})).status,201);
 assert.equal(f.count('neo_fin_receipt_verifications'),0);assert.equal(f.count('neo_fin_cash_events'),0);
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{body:f.decision})).status,403);
 const approved=await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:f.decision});assert.equal(approved.status,200,await approved.clone().text());
 const proof=(await approved.json()).verificationId;
 assert.equal(f.count('neo_fin_receipt_verifications'),1);assert.equal(f.count('neo_fin_cash_events'),0);
 const importBody={requestId:'receipt-import-1',action:'receipt',source:{paymentRecordId:'P1',verificationId:proof}};
 for(let i=0;i<2;i++)assert.equal((await f.call('source-operations',{body:importBody})).status,200);
 const snapshot=await(await f.call('summary')).json();assert.equal(snapshot.balanced,true);assert.equal(snapshot.moneyInPaise,10000);assert.equal(snapshot.incomePaise,10000);assert.equal(f.count('neo_fin_cash_events'),1);
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:f.decision})).status,200);
 assert.equal(f.count('neo_fin_receipt_evidence_decisions'),1);
 const audit=await(await f.call('receipt-evidence',{actor:'Areader'})).json();assert.equal(audit.requests[0].reviewed_by,'fin:Achecker');assert.equal(audit.requests[0].requested_by,'fin:Amaker');
 assert.deepEqual(f.source.prepare('SELECT * FROM neo_portal_records ORDER BY kind,id').all(),f.original);
 const verification={organizationId:'A',sourceKind:'fee_receipt',sourceId:'P1',sourceEventId:proof};
 assert.ok(await verifyLegacyFeeReceipt(f.db,verification,f.sourceDb));
 f.source.exec("PRAGMA query_only=OFF; UPDATE neo_portal_records SET data=json_set(data,'$.invoice_id','OTHER') WHERE kind='payments'; PRAGMA query_only=ON;");
 assert.equal(await verifyLegacyFeeReceipt(f.db,verification,f.sourceDb),null);
 }finally{f.close();}
});
test('evidence intake rejects forged fields, auditor writes, other Center/HO, foreign Origin and flag-off use',async()=>{
 const f=await fixture();try{
 for(const actor of ['Areader','Bchecker','HOchecker'])assert.equal((await f.call('receipt-evidence',{actor,body:f.input})).status,403);
 assert.equal((await f.call('receipt-evidence',{body:f.input,origin:'https://foreign.test'})).status,403);
 assert.equal((await f.call('receipt-evidence',{body:f.input,override:{FINANCE_ONE_EVIDENCE_OPERATIONS_ENABLED:'false'}})).status,404);
 for(const patch of [{amountPaise:1},{requestedBy:'fin:Achecker'},{verified:true},{evidenceSha256:'invalid'},{schoolId:'S_B'},{settledAt:'2099-01-01'}])assert.ok([400,409].includes((await f.call('receipt-evidence',{body:{...f.input,...patch}})).status));
 assert.equal(f.count('neo_fin_receipt_evidence_requests'),0);
 }finally{f.close();}
});
test('source changes, wrong reviewed file and finalized decision conflicts fail closed',async()=>{
 const f=await fixture();try{
 await f.call('receipt-evidence',{body:f.input});
 assert.equal((await f.call('receipt-evidence',{body:{...f.input,archiveReference:'DIFFERENT-ARCHIVE'}})).status,409);
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:{...f.decision,reviewedEvidenceSha256:'b'.repeat(64)}})).status,409);
 f.source.exec("PRAGMA query_only=OFF; UPDATE neo_portal_records SET data=json_set(data,'$.invoice_id','OTHER') WHERE kind='payments'; PRAGMA query_only=ON;");
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:f.decision})).status,409);
 assert.equal(f.count('neo_fin_receipt_verifications'),0);
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:{...f.decision,decision:'rejected'}})).status,200);
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:f.decision})).status,409);
 }finally{f.close();}
});
test('receipt evidence SQL guards prevent direct self-approval, edits, duplicate verification and partial decision commits',async()=>{
 const f=await fixture();try{
 await f.call('receipt-evidence',{body:f.input});
 const insert=f.sql.prepare('INSERT INTO neo_fin_receipt_evidence_decisions(organization_id,request_id,decision,review_note,reviewed_evidence_sha256,reviewed_by) VALUES(?,?,?,?,?,?)');
 assert.throws(()=>insert.run('A',f.input.requestId,'approved','Synthetic self review rejected','a'.repeat(64),'fin:Amaker'));
 for(const table of ['neo_fin_receipt_evidence_requests']){assert.throws(()=>f.sql.exec('UPDATE '+table+" SET requested_by='fin:Achecker'"));assert.throws(()=>f.sql.exec('DELETE FROM '+table));}
 await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:f.decision});
 await f.call('receipt-evidence',{body:{...f.input,requestId:'evidence-request-2'}});
 assert.equal((await f.call('receipt-evidence/evidence-request-2/decision',{actor:'Achecker',body:f.decision})).status,409);
 assert.equal(f.count('neo_fin_receipt_evidence_decisions'),1);assert.equal(f.count('neo_fin_receipt_verifications'),1);
 assert.throws(()=>f.sql.exec("UPDATE neo_fin_receipt_evidence_decisions SET decision='rejected'"));assert.throws(()=>f.sql.exec('DELETE FROM neo_fin_receipt_evidence_decisions'));
 f.source.exec("PRAGMA query_only=OFF; UPDATE neo_portal_records SET data=json_set(data,'$.invoice_id','OTHER') WHERE kind='payments'; PRAGMA query_only=ON;");
 assert.equal(await verifyLegacyFeeReceipt(f.db,{organizationId:'A',sourceKind:'fee_receipt',sourceId:'P1',sourceEventId:'MANUAL_RECEIPT_'+f.input.requestId},f.sourceDb),null);
 }finally{f.close();}
});
test('missing evidence guard disables all evidence operations before a write',async()=>{
 const f=await fixture();try{
 f.sql.exec('DROP TRIGGER neo_fin_receipt_evidence_approve');
 assert.equal((await f.call('receipt-evidence',{body:f.input})).status,503);
 assert.equal(f.count('neo_fin_receipt_evidence_requests'),0);
 }finally{f.close();}
});

test('an owner who made the request cannot self-approve through API or direct SQL',async()=>{
 const f=await fixture();try{
 assert.equal((await f.call('receipt-evidence',{actor:'Achecker',body:f.input})).status,201);
 assert.equal((await f.call('receipt-evidence/evidence-request-1/decision',{actor:'Achecker',body:f.decision})).status,403);
 assert.throws(()=>f.sql.prepare('INSERT INTO neo_fin_receipt_evidence_decisions(organization_id,request_id,decision,review_note,reviewed_evidence_sha256,reviewed_by) VALUES(?,?,?,?,?,?)').run('A',f.input.requestId,'approved','Owner self approval must fail','a'.repeat(64),'fin:Achecker'));
 assert.equal(f.count('neo_fin_receipt_verifications'),0);
 }finally{f.close();}
});

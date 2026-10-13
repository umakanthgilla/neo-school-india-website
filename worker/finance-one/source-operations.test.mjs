import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker from './staging-entry.mjs';
import {issueFinanceOneToken} from './finance-session.mjs';
import {STANDARD_CHART} from './accounting-chart.mjs';
import {payrollStatutoryFingerprint} from './reviewed-statutory-payroll.mjs';
import {financeOneStagingPreflight} from './staging-preflight.mjs';
const migrations=['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections','source_operations'];
async function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of migrations)sql.exec(readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8'));
 sql.exec('CREATE TABLE neo_portal_records(school_id TEXT,kind TEXT,id TEXT,data TEXT,PRIMARY KEY(school_id,kind,id))');
 const db={prepare(q){const s=sql.prepare(q),bound=a=>({first:async()=>s.get(...a),all:async()=>({results:s.all(...a)}),run:async()=>({success:true,meta:{changes:s.run(...a).changes}})});return {...bound([]),bind:(...a)=>bound(a)};},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const secret='test-only-source-operations-secret-32-characters';
 const tokens={};
 for(const org of ['A','B','HO']){
  sql.prepare('INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES(?,?,?)').run(org,org,org==='HO'?'head_office':'independent_center');
  sql.prepare('INSERT INTO neo_fin_school_ownership(school_id,organization_id,effective_from) VALUES(?,?,?)').run('S_'+org,org,'2026-01-01');
  for(const [name,role] of [['owner','owner'],['maker','accountant'],['reader','auditor']]){
   const account='fin:'+org+name;
   sql.prepare('INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES(?,?,?)').run(org,account,role);
   sql.prepare('INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations) VALUES(?,?,?,210000)').run(account,'a'.repeat(32),'b'.repeat(64));
   tokens[org+name]=await issueFinanceOneToken({accountId:account,credentialVersion:1,secret});
  }
  for(const [code,name,type] of STANDARD_CHART)sql.prepare('INSERT INTO neo_fin_accounts VALUES(?,?,?,?,?,1)').run(org,code,code,name,type);
 }
 const put=(kind,id,data)=>sql.prepare("INSERT INTO neo_portal_records VALUES('S_A',?,?,?)").run(kind,id,JSON.stringify(data));
 put('students','ST1',{});put('fee_structures','FS1',{});
 put('invoices','INV1',{student_id:'ST1',fee_structure_id:'FS1',amount_paise:10000,due_date:'2026-10-08'});
 put('payments','P1',{invoice_id:'INV1',receipt_no:'R1',amount_paise:10000,method:'UPI'});
 put('daily_accounts','FIN_FEE_P1',{source_kind:'fee_payment',source_id:'P1',direction:'IN',amount_paise:10000,reference:'R1',status:'Posted'});
 sql.exec(`INSERT INTO neo_fin_receipt_verifications(organization_id,verification_id,school_id,payment_record_id,receipt_no,amount_paise,evidence_type,verification_reference,settled_at,verified_at,verified_by)
 VALUES('A','VER1','S_A','P1','R1',10000,'bank_reconciled','TEST-BANK-1','2026-10-08T10:00:00Z','2026-10-09T10:00:00Z','synthetic-reviewer');`);
 const payroll={staff_id:'STAFF1',month:'2026-09',status:'Paid',attendance_complete:true,approved_at:'2026-10-02T10:00:00Z',gross_paise:20000,late_deduction_paise:0,attendance_deduction_paise:0,advance_recovery_paise:0,deductions_paise:0,net_paise:20000,statutory_review_id:'TEST-NIL-REVIEW'};
 put('payroll','STAFF1_2026-09',payroll);
 sql.prepare(`INSERT INTO neo_fin_payroll_statutory_reviews(organization_id,school_id,payroll_record_id,payroll_month,policy_reference,source_fingerprint,reviewed_by,reviewed_at,status)
 VALUES('A','S_A','STAFF1_2026-09','2026-09','TEST-NIL-REVIEW',?,'synthetic-reviewer','2026-10-02T10:00:00Z','approved')`).run(await payrollStatutoryFingerprint(payroll));
 for(const [kind,id,sourceKind,prefix,ledger,amount] of [['payroll','STAFF1_2026-09','payroll','PAY_','FIN_PAY_',20000],['vendor_payments','V1','vendor_payment','VENDOR_','FIN_VENDOR_',5000],['salary_advances','ADV1','salary_advance','ADV_','FIN_ADV_',1000]]){
  if(kind!=='payroll')put(kind,id,{status:kind==='salary_advances'?'Released':'Paid',amount_paise:amount});
  put('vouchers',prefix+id,{source_kind:sourceKind,source_id:id,status:'Paid',amount_paise:amount,voucher_no:'PV-'+id,payment_mode:'Bank transfer'});
  put('daily_accounts',ledger+id,{source_kind:'voucher',source_id:prefix+id,status:'Posted',direction:'OUT',amount_paise:amount,reference:'PV-'+id});
 }
 const env={DB:db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SOURCE_OPERATIONS_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:secret,FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit(){}},FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit(){}}};
 let next=0;
 const call=(action,source,{actor='Aowner',org='A',requestId='request-'+String(++next).padStart(4,'0'),overrideEnv={},origin='https://staging.invalid',extra={}}={})=>worker.fetch(new Request('https://staging.invalid/api/finance-one/v1/organizations/'+org+'/source-operations',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Authorization:'Bearer '+tokens[actor]},body:JSON.stringify({requestId,action,source,...extra})}),{...env,...overrideEnv});
 const read=(resource='source-operations',actor='Areader',org='A')=>worker.fetch(new Request('https://staging.invalid/api/finance-one/v1/organizations/'+org+'/'+resource,{headers:{Authorization:'Bearer '+tokens[actor]}}),env);
 const invoice=()=>call('invoice',{schoolId:'S_A',invoiceRecordId:'INV1'});
 return{sql,db,env,call,read,invoice,tokens};
}
const count=(f,t)=>f.sql.prepare('SELECT COUNT(*) n FROM '+t).get().n;
test('signed invoice → verified receipt → ledger, accounting and reports; retries do not duplicate source or cash',async()=>{
 const f=await fixture();try{
  const before=count(f,'neo_portal_records');assert.equal((await f.invoice()).status,200);
  assert.equal(count(f,'neo_fin_cash_events'),0);
  for(let i=0;i<2;i++)assert.equal((await f.call('receipt',{paymentRecordId:'P1',verificationId:'VER1'},{requestId:'receipt-request-1'})).status,200);
  assert.equal(count(f,'neo_fin_cash_events'),1);assert.equal(count(f,'neo_portal_records'),before);
  const report=await(await f.read('summary')).json();assert.equal(report.balanced,true);assert.equal(report.moneyInPaise,10000);assert.equal(report.profitPaise,10000);
  assert.equal(report.trialBalance.find(a=>a.code==='1100').debitPaise,10000);
  assert.equal(report.trialBalance.find(a=>a.code==='1100').creditPaise,10000);
  for(const resource of ['cash-reconciliation','accrual-reconciliation'])assert.equal((await(await f.read(resource)).json()).ready,true);
  const history=await(await f.read()).json();assert.equal(history.entries.length,3);assert.ok(history.entries.every(r=>r.requested_by==='fin:Aowner'&&r.status==='succeeded'));
 }finally{f.sql.close();}
});
test('payroll accrual and verified payroll/vendor/advance vouchers reuse original source workflows',async()=>{
 const f=await fixture();try{
  const before=count(f,'neo_portal_records');
  assert.equal((await f.call('payroll_accrual',{schoolId:'S_A',payrollRecordId:'STAFF1_2026-09'})).status,200);
  for(const [sourceKind,id,amount] of [['payroll_payment','STAFF1_2026-09',20000],['vendor_payment','V1',5000],['salary_advance_release','ADV1',1000]]){
   const source={schoolId:'S_A',legacyRecordId:id,sourceKind};
   const document=await(await f.call('payout_document',source)).json();assert.ok(document.result?.documentId);
   const settlementId='SET-'+id;
   assert.equal((await f.call('payout',{...source,settlementId})).status,409,'Paid alone must not settle');
   f.sql.prepare("INSERT INTO neo_fin_payment_settlements(organization_id,id,document_id,amount_paise,status,bank_reference,verified_at) VALUES('A',?,?,?,'verified',?,'2026-10-09T12:00:00Z')").run(settlementId,document.result.documentId,amount,'TEST-BANK-'+id);
   for(let i=0;i<2;i++)assert.equal((await f.call('payout',{...source,settlementId})).status,200);
  }
  assert.equal(count(f,'neo_fin_cash_events'),3);assert.equal(count(f,'neo_portal_records'),before);
  const report=await(await f.read('summary')).json();assert.equal(report.moneyOutPaise,26000);assert.equal(report.balanced,true);
  assert.equal((await(await f.read('cash-reconciliation')).json()).ready,true);
 }finally{f.sql.close();}
});
test('role, tenant, origin, environment, disabled flag and forged fields prevent source mutations',async()=>{
 const f=await fixture();try{
  const source={schoolId:'S_A',invoiceRecordId:'INV1'};
  for(const actor of ['Bowner','HOowner','Areader'])assert.equal((await f.call('invoice',source,{actor})).status,403);
  assert.equal((await f.call('invoice',source,{origin:'https://evil.invalid'})).status,403);
  assert.equal((await f.call('invoice',source,{overrideEnv:{FINANCE_ONE_ENVIRONMENT:'production'}})).status,404);
  assert.equal((await f.call('invoice',source,{overrideEnv:{FINANCE_ONE_SOURCE_OPERATIONS_ENABLED:'false'}})).status,404);
  for(const extra of [{authenticatedAccountId:'fin:Aowner'},{amountPaise:1},{verified:true}])assert.equal((await f.call('invoice',source,{extra})).status,400);
  assert.equal((await f.call('invoice',{...source,amountPaise:1})).status,400);
  assert.equal((await f.call('payroll_accrual',{schoolId:'S_A',payrollRecordId:'STAFF1_2026-09'},{actor:'Amaker'})).status,403);
  assert.equal(count(f,'neo_fin_source_requests'),0);assert.equal(count(f,'neo_fin_documents'),0);
  for(const actor of ['Bowner','HOowner'])assert.equal((await f.read('source-operations',actor)).status,403);
 }finally{f.sql.close();}
});
test('audit writes fail closed before posting; immutable retries reject actor/content changes',async()=>{
 const f=await fixture();try{
  const source={schoolId:'S_A',invoiceRecordId:'INV1'},options={requestId:'fixed-request-001'};
  f.sql.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON neo_fin_source_attempts BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await f.call('invoice',source,options)).status,503);assert.equal(count(f,'neo_fin_documents'),0);
  f.sql.exec('DROP TRIGGER audit_failure');assert.equal((await f.call('invoice',source,options)).status,200);
  assert.equal((await f.call('invoice',source,{...options,actor:'Amaker'})).status,409);
  assert.equal((await f.call('invoice',{...source,invoiceRecordId:'other'},options)).status,409);
  for(const table of ['neo_fin_source_requests','neo_fin_source_attempts','neo_fin_source_outcomes']){
   assert.throws(()=>f.sql.exec('DELETE FROM '+table),/immutable/);assert.throws(()=>f.sql.exec('UPDATE '+table+" SET organization_id='B'"),/immutable/);
  }
  f.sql.exec("UPDATE neo_portal_records SET data=json_set(data,'$.amount_paise',20000) WHERE kind='invoices'");
  assert.equal((await f.call('invoice',source,options)).status,409);
 }finally{f.sql.close();}
});
test('journal failure remains auditable and safe retry recovers the one cash event',async()=>{
 const f=await fixture();try{
  await f.invoice();f.sql.exec("UPDATE neo_fin_accounts SET active=0 WHERE organization_id='A' AND account_code='1000'");
  const source={paymentRecordId:'P1',verificationId:'VER1'},options={requestId:'retry-receipt-001'};
  assert.equal((await f.call('receipt',source,options)).status,409);assert.equal(count(f,'neo_fin_cash_events'),1);
  f.sql.exec("UPDATE neo_fin_accounts SET active=1 WHERE organization_id='A' AND account_code='1000'");
  assert.equal((await f.call('receipt',source,options)).status,200);assert.equal(count(f,'neo_fin_cash_events'),1);
  assert.deepEqual(f.sql.prepare("SELECT status FROM neo_fin_source_outcomes o JOIN neo_fin_source_attempts a ON a.organization_id=o.organization_id AND a.id=o.attempt_id WHERE a.request_id='retry-receipt-001' ORDER BY o.rowid").all().map(r=>r.status),['failed','succeeded']);
 }finally{f.sql.close();}
});
test('source operations preflight requires all audit protections and missing migration refuses writes',async()=>{
 const f=await fixture();try{
  assert.equal((await financeOneStagingPreflight({db:f.db,env:f.env})).ready,true);
  f.sql.exec('DROP TRIGGER neo_fin_source_outcome_no_delete');assert.equal((await financeOneStagingPreflight({db:f.db,env:f.env})).ready,false);assert.equal((await f.invoice()).status,503);assert.equal(count(f,'neo_fin_documents'),0);
  f.sql.exec('DROP TABLE neo_fin_source_outcomes');f.sql.exec('DROP TABLE neo_fin_source_attempts');f.sql.exec('DROP TABLE neo_fin_source_requests');
  assert.equal((await f.invoice()).status,503);assert.equal(count(f,'neo_fin_documents'),0);
 }finally{f.sql.close();}
});
test('unconfirmed outcome remains visible and safe retry revalidates instead of claiming prior success',async()=>{
 const f=await fixture();try{
  f.sql.exec("CREATE TRIGGER outcome_failure BEFORE INSERT ON neo_fin_source_outcomes BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  const source={schoolId:'S_A',invoiceRecordId:'INV1'},options={requestId:'outcome-request-001'};
  assert.equal((await f.call('invoice',source,options)).status,503);assert.equal(count(f,'neo_fin_journals'),1);
  assert.equal((await(await f.read()).json()).entries[0].status,null);
  f.sql.exec('DROP TRIGGER outcome_failure');assert.equal((await f.call('invoice',source,options)).status,200);assert.equal(count(f,'neo_fin_journals'),1);
 }finally{f.sql.close();}
});

// Local recovery rehearsal only; not evidence of a Cloudflare D1 backup.
test('disposable SQLite backup restores source audit, posted balances and immutable protections',async()=>{
 const f=await fixture();const dir=mkdtempSync(join(tmpdir(),'neo-finance-restore-'));let restored;
 try{
  await f.invoice();await f.call('receipt',{paymentRecordId:'P1',verificationId:'VER1'});
  const file=join(dir,'backup.sqlite');f.sql.prepare('VACUUM INTO ?').run(file);
  restored=new DatabaseSync(file);restored.exec('PRAGMA foreign_keys=ON');
  assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  for(const table of ['neo_fin_cash_events','neo_fin_journals','neo_fin_journal_lines','neo_fin_source_requests','neo_fin_source_attempts','neo_fin_source_outcomes'])assert.equal(restored.prepare('SELECT count(*) n FROM '+table).get().n,count(f,table));
  assert.equal(restored.prepare('SELECT sum(debit_paise-credit_paise) n FROM neo_fin_posted_journal_lines').get().n,0);
  assert.throws(()=>restored.exec('DELETE FROM neo_fin_cash_events'),/immutable/);
  assert.throws(()=>restored.exec('DELETE FROM neo_fin_source_outcomes'),/immutable/);
 }finally{restored?.close();f.sql.close();rmSync(dir,{recursive:true,force:true});}
});

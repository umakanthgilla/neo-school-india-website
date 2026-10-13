/** Staging source imports only. No source editing, evidence certification or payment execution. */
import {FinanceAccessError,resolveFinanceOrganization} from './organization-access.mjs';
import {syncLegacyFeeInvoice} from './sync-legacy-fee-invoice.mjs';
import {syncVerifiedLegacyFeeReceipt} from './sync-legacy-fee-receipt.mjs';
import {syncLegacyPayoutDocument} from './sync-legacy-payout-document.mjs';
import {syncVerifiedLegacyPayout} from './sync-legacy-payout.mjs';
import {postLegacyPayrollAccrual} from './legacy-payroll-accrual.mjs';
import {readOperationBody} from './operation-body.mjs';
const route=/^\/api\/finance-one\/v1\/organizations\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/source-operations$/;
const actions={invoice:syncLegacyFeeInvoice,receipt:syncVerifiedLegacyFeeReceipt,payout_document:syncLegacyPayoutDocument,payout:syncVerifiedLegacyPayout,payroll_accrual:postLegacyPayrollAccrual};
const fields={invoice:['schoolId','invoiceRecordId'],receipt:['paymentRecordId','verificationId'],payout_document:['schoolId','legacyRecordId','sourceKind'],payout:['schoolId','legacyRecordId','sourceKind','settlementId'],payroll_accrual:['schoolId','payrollRecordId']};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function run(statement){if((await statement.run())?.success!==true)throw Error('Audit write not confirmed');}
export async function handleSourceOperations({request,db,authenticatedAccountId,enabled}){
 const match=new URL(request.url).pathname.match(route);if(!match)return null;
 if(!enabled)return reply({error:'Source operations disabled'},404);
 const organizationId=match[1];
 try{
  if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
  await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance',request.method==='GET'?'read':'write');
  if(request.method==='GET'){
   const rows=await db.prepare(`SELECT r.id,r.action,r.source_json,r.requested_by,r.created_at,
    a.id AS attempt_id,a.created_at AS attempted_at,o.status,o.created_at AS completed_at
    FROM neo_fin_source_requests r LEFT JOIN neo_fin_source_attempts a
     ON a.organization_id=r.organization_id AND a.request_id=r.id
    LEFT JOIN neo_fin_source_outcomes o ON o.organization_id=a.organization_id AND o.attempt_id=a.id
    WHERE r.organization_id=? ORDER BY a.rowid DESC,r.rowid DESC LIMIT 100`).bind(organizationId).all();
   return reply({organizationId,entries:rows.results||[],limit:100});
  }
  const schema=await db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE
   (type='table' AND name IN ('neo_fin_source_requests','neo_fin_source_attempts','neo_fin_source_outcomes')) OR
   (type='trigger' AND name IN ('neo_fin_source_request_authorized','neo_fin_source_request_no_update','neo_fin_source_request_no_delete','neo_fin_source_attempt_no_update','neo_fin_source_attempt_no_delete','neo_fin_source_outcome_no_update','neo_fin_source_outcome_no_delete'))`).first();
  if(schema?.n!==10)return reply({error:'Source audit schema incomplete; imports disabled'},503);
  const input=await readOperationBody(request,['requestId','action','source']);
  if(typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(input.requestId)||typeof input.action!=='string'||!Object.hasOwn(actions,input.action))throw new FinanceAccessError('Invalid request ID or action',400);
  const source=input.source,keys=fields[input.action];
  if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).length!==keys.length||
   keys.some(k=>typeof source[k]!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(source[k])))throw new FinanceAccessError('Only original source identifiers are accepted',400);
  if(source.sourceKind&&!['vendor_payment','payroll_payment','salary_advance_release'].includes(source.sourceKind))throw new FinanceAccessError('Invalid payout kind',400);
  // Payroll accrual has stricter authority than general Finance imports.
  if(input.action==='payroll_accrual')await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'payroll','write');
  const sourceJson=JSON.stringify(Object.fromEntries(keys.map(k=>[k,source[k]])));
  const prior=()=>db.prepare('SELECT action,source_json,requested_by FROM neo_fin_source_requests WHERE organization_id=? AND id=?').bind(organizationId,input.requestId).first();
  const same=r=>r?.action===input.action&&r.source_json===sourceJson&&r.requested_by===authenticatedAccountId;
  const existing=await prior();
  if(existing&&!same(existing))return reply({error:'Request ID already used for different content or actor'},409);
  if(!existing){
   try{await run(db.prepare('INSERT INTO neo_fin_source_requests(organization_id,id,action,source_json,requested_by) VALUES(?,?,?,?,?)').bind(organizationId,input.requestId,input.action,sourceJson,authenticatedAccountId));}
   catch(e){if(!same(await prior()))throw e;}
  }
  // An immutable attempt MUST precede any posting. Retries rerun the existing
  // idempotent source validators, so changed sources cannot reuse stale success.
  const attemptId=crypto.randomUUID();
  await run(db.prepare('INSERT INTO neo_fin_source_attempts(organization_id,id,request_id) VALUES(?,?,?)').bind(organizationId,attemptId,input.requestId));
  let result;
  try{result=await actions[input.action]({db,authenticatedAccountId,organizationId,...source});}
  catch{
   await run(db.prepare("INSERT INTO neo_fin_source_outcomes(organization_id,attempt_id,status) VALUES(?,?,'failed')").bind(organizationId,attemptId));
   return reply({error:'Source import incomplete. Review original approval, ownership, statutory review, verified evidence and reconciliation; retry the same request after resolving the issue. A cash mirror may require journal recovery.',requestId:input.requestId,attemptId},409);
  }
  await run(db.prepare("INSERT INTO neo_fin_source_outcomes(organization_id,attempt_id,status) VALUES(?,?,'succeeded')").bind(organizationId,attemptId));
  return reply({requestId:input.requestId,attemptId,result});
 }catch(error){
  if(error instanceof FinanceAccessError)return reply({error:error.message},error.status);
  return reply({error:'Source operation or audit unavailable. Check migrations and reconciliation before retrying; completion is not confirmed.'},503);
 }
}

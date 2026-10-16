/** Manual review of retained receipt evidence. No payment execution or ledger write. */
import {FinanceAccessError,resolveFinanceOrganization} from './organization-access.mjs';
import {readOperationBody} from './operation-body.mjs';
import {readOnlySchoolSource} from './school-source.mjs';
import {readReceiptEvidenceSource} from './receipt-evidence-source.mjs';
import {receiptEvidenceSchemaReady} from './receipt-evidence-schema.mjs';
const route=/^\/api\/finance-one\/v1\/organizations\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/receipt-evidence(?:\/([A-Za-z0-9_-]{8,80})\/decision)?$/;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const invalid=()=>{throw new FinanceAccessError('Invalid receipt evidence input',400);};
function text(value,min,max){if(typeof value!=='string'||value.trim().length<min||value.length>max)invalid();return value.trim();}
const hash=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))invalid();return value;};
async function run(statement){if((await statement.run())?.success!==true)throw Error('Evidence write not confirmed');}
export async function handleReceiptEvidenceApi({request,db,sourceDb=db,authenticatedAccountId,enabled}){
 const match=new URL(request.url).pathname.match(route);if(!match)return null;
 if(!enabled)return reply({error:'Receipt evidence review disabled'},404);
 const [,org,id]=match;
 try{
  if(!['GET','POST'].includes(request.method)||id&&request.method!=='POST')return reply({error:'Method not allowed'},405);
  await resolveFinanceOrganization(db,authenticatedAccountId,org,'finance',request.method==='GET'?'read':'write');
  if(!await receiptEvidenceSchemaReady(db))return reply({error:'Receipt evidence schema incomplete; review disabled'},503);
  const reviewer=await db.prepare("SELECT account_id FROM neo_fin_memberships WHERE organization_id=? AND account_id=? AND active=1 AND role IN ('owner','finance_admin') LIMIT 1").bind(org,authenticatedAccountId).first();
  if(request.method==='GET'){
   const rows=await db.prepare(`SELECT r.*,COALESCE(d.decision,'pending') AS status,d.review_note,d.reviewed_by,d.created_at AS reviewed_at
    FROM neo_fin_receipt_evidence_requests r LEFT JOIN neo_fin_receipt_evidence_decisions d ON d.organization_id=r.organization_id AND d.request_id=r.id
    WHERE r.organization_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 100`).bind(org).all();
   return reply({organizationId:org,accountId:authenticatedAccountId,canReview:Boolean(reviewer),requests:rows.results||[],limit:100});
  }
  const source=readOnlySchoolSource(sourceDb);
  if(!source||sourceDb!==db&&await source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='neo_fin_organizations'").first())return reply({error:'Isolated school source unavailable'},503);
  if(id){
   if(!reviewer)throw new FinanceAccessError('Independent owner or Finance administrator review required');
   const input=await readOperationBody(request,['decision','reviewNote','reviewedEvidenceSha256']);
   if(!['approved','rejected'].includes(input.decision))invalid();
   const note=text(input.reviewNote,10,1000),reviewedHash=hash(input.reviewedEvidenceSha256);
   const record=await db.prepare('SELECT * FROM neo_fin_receipt_evidence_requests WHERE organization_id=? AND id=?').bind(org,id).first();
   if(!record)return reply({error:'Receipt evidence request not found'},404);
   if(record.requested_by===authenticatedAccountId)throw new FinanceAccessError('A different Finance approver must review this evidence');
   if(record.evidence_sha256!==reviewedHash)return reply({error:'Reviewed file does not match the submitted evidence fingerprint'},409);
   const prior=()=>db.prepare('SELECT * FROM neo_fin_receipt_evidence_decisions WHERE organization_id=? AND request_id=?').bind(org,id).first();
   const same=r=>r?.decision===input.decision&&r.review_note===note&&r.reviewed_by===authenticatedAccountId&&r.reviewed_evidence_sha256===reviewedHash;
   const existing=await prior();
   if(existing){if(!same(existing))return reply({error:'Evidence review already finalized'},409);return reply({requestId:id,status:input.decision,replayed:true});}
   if(input.decision==='approved'){
    const original=await readReceiptEvidenceSource({db,sourceDb:source,organizationId:org,schoolId:record.school_id,paymentRecordId:record.payment_record_id});
    if(original.fingerprint!==record.source_fingerprint)return reply({error:'Original receipt changed; approval refused'},409);
   }
   try{await run(db.prepare('INSERT INTO neo_fin_receipt_evidence_decisions(organization_id,request_id,decision,review_note,reviewed_evidence_sha256,reviewed_by) VALUES(?,?,?,?,?,?)').bind(org,id,input.decision,note,reviewedHash,authenticatedAccountId));}
   catch(error){if(!same(await prior()))throw error;}
   return reply({requestId:id,status:input.decision,verificationId:input.decision==='approved'?'MANUAL_RECEIPT_'+id:null});
  }
  const input=await readOperationBody(request,['requestId','schoolId','paymentRecordId','verificationReference','archiveReference','evidenceSha256','settledAt']);
  if(typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(input.requestId)||![input.schoolId,input.paymentRecordId].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x)))invalid();
  const reference=text(input.verificationReference,3,200),archive=text(input.archiveReference,8,400),sha=hash(input.evidenceSha256);
  const settled=new Date(input.settledAt);
  if(typeof input.settledAt!=='string'||!Number.isFinite(settled.getTime())||settled.getTime()>Date.now())invalid();
  const original=await readReceiptEvidenceSource({db,sourceDb:source,organizationId:org,schoolId:input.schoolId,paymentRecordId:input.paymentRecordId});
  if(settled.toISOString().slice(0,10)<String(original.effectiveFrom).slice(0,10))invalid();
  const fields={school_id:input.schoolId,payment_record_id:input.paymentRecordId,receipt_no:original.receiptNo,amount_paise:original.amountPaise,source_fingerprint:original.fingerprint,evidence_type:original.evidenceType,verification_reference:reference,archive_reference:archive,evidence_sha256:sha,settled_at:settled.toISOString(),requested_by:authenticatedAccountId};
  const prior=()=>db.prepare('SELECT * FROM neo_fin_receipt_evidence_requests WHERE organization_id=? AND id=?').bind(org,input.requestId).first();
  const same=r=>r&&Object.entries(fields).every(([key,value])=>r[key]===value);
  const existing=await prior();
  if(existing){if(!same(existing))return reply({error:'Evidence request ID already used for different content'},409);return reply({requestId:input.requestId,replayed:true});}
  const columns=Object.keys(fields);
  try{await run(db.prepare('INSERT INTO neo_fin_receipt_evidence_requests(organization_id,id,'+columns.join(',')+') VALUES('+Array(columns.length+2).fill('?').join(',')+')').bind(org,input.requestId,...Object.values(fields)));}
  catch(error){if(!same(await prior()))throw error;}
  return reply({requestId:input.requestId,status:'pending'},201);
 }catch(error){
  if(error instanceof FinanceAccessError)return reply({error:error.message},error.status);
  return reply({error:'Receipt evidence review could not complete. Check source, ownership, active identities and conflicting verifications; no cash posting was requested.'},409);
 }
}

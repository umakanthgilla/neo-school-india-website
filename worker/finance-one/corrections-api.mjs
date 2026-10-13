import {readOperationBody as body} from './operation-body.mjs';
/** Staging operations. Reviewed full accrual reversal; never a cash refund. */
import {correctionSchemaReady} from './corrections-schema.mjs';
import {FinanceAccessError,resolveFinanceOrganization} from './organization-access.mjs';
const route=/^\/api\/finance-one\/v1\/organizations\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/(correction-journals|corrections)(?:\/([A-Za-z0-9_-]{8,80})\/decision)?$/;
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const invalid=message=>{throw new FinanceAccessError(message,400);};

function string(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.length>max)invalid('Invalid '+label);return value.trim();}
async function run(statement){const r=await statement.run();if(r?.success!==true)throw Error('Write failed');}
export async function handleCorrectionsApi({request,db,authenticatedAccountId,enabled}){
 const match=new URL(request.url).pathname.match(route);if(!match)return null;
 if(!enabled)return reply({error:'Correction operations disabled'},404);
 const [,org,resource,id]=match;
 try{
  const write=request.method==='POST';
  if(!['GET','POST'].includes(request.method)||resource==='correction-journals'&&(write||id)||id&&!write)return reply({error:'Method not allowed'},405);
  const context=await resolveFinanceOrganization(db,authenticatedAccountId,org,'finance',write?'write':'read');
  try{if(!await correctionSchemaReady(db))return reply({error:'Correction schema incomplete; operations unavailable'},503);}
  catch{return reply({error:'Correction schema checks unavailable'},503);}
  const reviewer=await db.prepare("SELECT account_id FROM neo_fin_memberships WHERE organization_id=? AND account_id=? AND active=1 AND role IN ('owner','finance_admin') LIMIT 1").bind(org,authenticatedAccountId).first();
  if(!write){
   if(resource==='correction-journals'){
    const r=await db.prepare(`SELECT j.id,d.id AS document_id,d.document_type,d.gross_paise,
     EXISTS(SELECT 1 FROM neo_fin_correction_decisions c WHERE c.organization_id=j.organization_id AND c.journal_id=j.id AND c.decision='approved') AS reversed
     FROM neo_fin_journals j JOIN neo_fin_documents d ON d.organization_id=j.organization_id AND d.id=j.source_id
     WHERE j.organization_id=? AND j.source_kind='document' AND j.status='posted' AND d.status='approved'
     AND d.currency='INR' AND d.document_type IN ('sales_invoice','purchase_bill') ORDER BY j.created_at DESC,j.id DESC LIMIT 100`).bind(org).all();
    return reply({organizationId:org,journals:r.results||[],limit:100});
   }
   const r=await db.prepare(`SELECT r.id,r.journal_id,r.reason,r.requested_by,r.created_at,
    COALESCE(d.decision,'pending') AS status,d.reviewed_by,d.review_note,d.created_at AS reviewed_at
    FROM neo_fin_correction_requests r LEFT JOIN neo_fin_correction_decisions d
     ON d.organization_id=r.organization_id AND d.request_id=r.id
    WHERE r.organization_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 100`).bind(org).all();
   return reply({organizationId:org,accountId:authenticatedAccountId,canReview:Boolean(reviewer),requests:r.results||[],limit:100});
  }
  if(id){
   if(!Boolean(reviewer))throw new FinanceAccessError('Owner or Finance administrator review required');
   const input=await body(request,['decision','reviewNote']);
   if(!['approved','rejected'].includes(input.decision))invalid('Decision');
   const note=string(input.reviewNote,10,1000,'review note');
   const r=await db.prepare('SELECT journal_id,requested_by FROM neo_fin_correction_requests WHERE organization_id=? AND id=?').bind(org,id).first();
   if(!r)return reply({error:'Correction request not found'},404);
   if(r.requested_by===authenticatedAccountId)throw new FinanceAccessError('A different Finance approver must review this request');
   const prior=()=>db.prepare('SELECT decision,review_note,reviewed_by FROM neo_fin_correction_decisions WHERE organization_id=? AND request_id=?').bind(org,id).first();
   const same=p=>p?.decision===input.decision&&p.review_note===note&&p.reviewed_by===authenticatedAccountId;
   const existing=await prior();
   if(existing){if(!same(existing))return reply({error:'Review already finalized'},409);return reply({requestId:id,status:input.decision,replayed:true});}
   try{await run(db.prepare(`INSERT INTO neo_fin_correction_decisions(organization_id,request_id,journal_id,decision,review_note,reviewed_by) VALUES(?,?,?,?,?,?)`).bind(org,id,r.journal_id,input.decision,note,authenticatedAccountId));}
   catch(error){if(!same(await prior()))throw error;}
   return reply({requestId:id,status:input.decision,journalId:input.decision==='approved'?'REV|'+id:null});
  }
  const input=await body(request,['requestId','journalId','reason']);
  if(typeof input.requestId!=='string'||! /^[A-Za-z0-9_-]{8,80}$/.test(input.requestId))invalid('request ID');
  const journal=string(input.journalId,1,400,'journal'),reason=string(input.reason,10,1000,'reason');
  const prior=()=>db.prepare('SELECT journal_id,reason,requested_by FROM neo_fin_correction_requests WHERE organization_id=? AND id=?').bind(org,input.requestId).first();
  const same=p=>p?.journal_id===journal&&p.reason===reason&&p.requested_by===authenticatedAccountId;
  const existing=await prior();
  if(existing){if(!same(existing))return reply({error:'Request ID already used for different content'},409);return reply({requestId:input.requestId,replayed:true});}
  try{await run(db.prepare('INSERT INTO neo_fin_correction_requests(organization_id,id,journal_id,reason,requested_by) VALUES(?,?,?,?,?)').bind(org,input.requestId,journal,reason,authenticatedAccountId));}
  catch(error){if(!same(await prior()))throw error;}
  return reply({requestId:input.requestId,status:'pending'},201);
 }catch(error){
  if(error instanceof FinanceAccessError)return reply({error:error.message},error.status);
  // Do not expose SQL, source contents or tenant identities.
  return reply({error:'Correction could not be completed. Check migration 11, original accrual, active accounts and existing reviews.'},409);
 }
}

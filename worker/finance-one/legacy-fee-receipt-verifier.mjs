/**
 * Trusted, staging-only verifier for existing Neo School India fee payments.
 * The legacy 'Recorded by school' and 'Posted' labels are NOT bank verification.
 * Requires independent immutable settlement evidence + exactly one source-linked
 * legacy Daily Ledger entry + a pre-posted invoice accrual journal.
 * Does not insert another legacy Daily Ledger row.
 */
export async function verifyLegacyFeeReceipt(db,request){
 const {organizationId,sourceKind,sourceId,sourceEventId}=request||{};
 if(!db?.prepare || sourceKind!=='fee_receipt' ||
   ![organizationId,sourceId,sourceEventId].every(v=>typeof v==='string' && v.length>0))return null;
 const evidence=await db.prepare(`SELECT v.organization_id,v.verification_id,v.school_id,v.payment_record_id,
     v.receipt_no,v.amount_paise,v.evidence_type,v.verification_reference,
     v.settled_at,v.verified_at,v.verified_by
   FROM neo_fin_receipt_verifications v
   JOIN neo_fin_school_ownership o
     ON o.school_id=v.school_id AND o.organization_id=v.organization_id AND o.effective_to IS NULL
   WHERE v.organization_id=? AND v.verification_id=? AND v.payment_record_id=? AND v.status='verified'
   LIMIT 1`).bind(organizationId,sourceEventId,sourceId).first();
 if(!evidence || evidence.organization_id!==organizationId ||
   evidence.payment_record_id!==sourceId || evidence.verification_id!==sourceEventId ||
   !Number.isSafeInteger(evidence.amount_paise)||evidence.amount_paise<=0||
   typeof evidence.verified_by!=='string'||!evidence.verified_by.trim() ||
   typeof evidence.verification_reference!=='string'||!evidence.verification_reference.trim())return null;
 const settled=new Date(evidence.settled_at),verified=new Date(evidence.verified_at);
 if(!Number.isFinite(settled.getTime())||!Number.isFinite(verified.getTime())||
   verified.getTime()<settled.getTime())return null;
 const record=await db.prepare("SELECT data FROM neo_portal_records WHERE school_id=? AND kind='payments' AND id=?")
   .bind(evidence.school_id,sourceId).first();
 if(!record?.data)return null;
 let fee;
 try{fee=JSON.parse(record.data);}catch{return null;}
 if(fee?.receipt_no!==evidence.receipt_no || fee?.amount_paise!==evidence.amount_paise ||
   typeof fee.invoice_id!=='string'||!fee.invoice_id.trim() ||
   !['Cash','UPI','Bank transfer','Cheque'].includes(fee.method))return null;
 if((fee.method==='Cash')!==(evidence.evidence_type==='cash_counted'))return null;
 // An old posted flag is useful for linkage only; it does not prove settlement.
 // Check for duplicate source projections, not just the deterministic legacy id.
 const postings=await db.prepare(`SELECT id,data FROM neo_portal_records
   WHERE school_id=? AND kind='daily_accounts'
   AND json_extract(data,'$.source_kind')='fee_payment'
   AND json_extract(data,'$.source_id')=? LIMIT 2`).bind(evidence.school_id,sourceId).all();
 if(!postings?.results||postings.results.length!==1)return null;
 const ledger=postings.results[0];
 if(ledger.id!=='FIN_FEE_'+sourceId)return null;
 let cash;
 try{cash=JSON.parse(ledger.data);}catch{return null;}
 if(cash.direction!=='IN'||cash.amount_paise!==fee.amount_paise||
   cash.source_kind!=='fee_payment'||cash.source_id!==sourceId||
   cash.reference!==fee.receipt_no||cash.status!=='Posted')return null;
 // Never credit A/R unless this particular invoice has already recognized revenue.
 const invoice=await db.prepare(`SELECT d.id FROM neo_fin_documents d
   JOIN neo_fin_journals j ON j.organization_id=d.organization_id AND
     j.source_kind='document' AND j.source_id=d.id AND j.status='posted'
   WHERE d.organization_id=? AND d.document_type='sales_invoice'
     AND d.source_kind='legacy_invoice' AND d.source_id=? AND d.status='approved'
   LIMIT 1`).bind(organizationId,fee.invoice_id).first();
 if(!invoice)return null;
 return Object.freeze({
   organizationId,sourceKind:'fee_receipt',sourceId,sourceEventId,
   amountPaise:evidence.amount_paise,
   verificationReference:evidence.verification_reference,
   effectiveAt:settled.toISOString()
 });
}

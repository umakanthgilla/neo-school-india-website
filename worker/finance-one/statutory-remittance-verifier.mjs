/**
 * Verifier: Finance-approved statutory payment voucher + independent verified
 * bank settlement. No browser "paid" flag, no tax rate assumption, no filing claim.
 */
export async function verifyStatutoryBankRemittance(db,request){
 const {organizationId,sourceKind,sourceId,sourceEventId}=request||{};
 if(sourceKind!=='statutory_remittance_paid'||![organizationId,sourceId,sourceEventId]
  .every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x)))return null;
 const row=await db.prepare(`SELECT r.organization_id,r.id AS remittance_id,
   r.account_code,r.amount_paise AS order_amount,r.voucher_number,r.approved_at,r.approved_by,r.status AS approval_status,
   d.source_kind,d.source_id,d.document_type,d.status AS document_status,d.gross_paise,
   s.id AS settlement_id,s.status AS settlement_status,s.amount_paise,
   s.bank_reference,s.verified_at,s.voucher_id
   FROM neo_fin_statutory_remittances r
   JOIN neo_fin_documents d ON d.organization_id=r.organization_id AND d.id=r.finance_document_id
   JOIN neo_fin_payment_settlements s ON s.organization_id=d.organization_id AND s.document_id=d.id
   WHERE r.organization_id=? AND r.id=? AND s.id=? LIMIT 1`)
   .bind(organizationId,sourceId,sourceEventId).first();
 if(!row||row.organization_id!==organizationId||row.remittance_id!==sourceId||
    row.settlement_id!==sourceEventId||row.approval_status!=='approved'||
    row.document_type!=='payment'||row.document_status!=='approved'||
    row.source_kind!==sourceKind||row.source_id!==sourceId||
    row.settlement_status!=='verified'||!['2111','2112','2113','2114'].includes(row.account_code)||
    !Number.isSafeInteger(row.order_amount)||row.order_amount<=0||
    row.amount_paise!==row.order_amount||row.gross_paise!==row.order_amount||
    row.voucher_number!==row.voucher_id||!row.bank_reference||
    !row.approved_by||!row.voucher_number)return null;
 const verifiedAt=Date.parse(row.verified_at),approvedAt=Date.parse(row.approved_at);
 if(!Number.isFinite(verifiedAt)||!Number.isFinite(approvedAt)||verifiedAt<approvedAt)return null;
 const duplicates=await db.prepare(`SELECT COUNT(*) AS n FROM neo_fin_payment_settlements s
  JOIN neo_fin_statutory_remittances r ON r.organization_id=s.organization_id
   AND r.finance_document_id=s.document_id
  WHERE s.organization_id=? AND r.id=? AND s.status='verified'`)
  .bind(organizationId,sourceId).first();
 if(duplicates?.n!==1)return null;
 // The approved voucher must not invent a liability. A posted journal for this
 // exact event allows valid idempotent retries after its liability was cleared.
 const journalId=[organizationId,sourceKind,sourceId,sourceEventId].map(v=>v.length+':'+v).join('|');
 const prior=await db.prepare(`SELECT j.id FROM neo_fin_journals j
  WHERE j.organization_id=? AND j.source_kind='cash_event' AND j.source_id=?
  AND j.status='posted' LIMIT 1`).bind(organizationId,journalId).first();
 if(!prior){
  const balance=await db.prepare(`SELECT COALESCE(SUM(l.credit_paise-l.debit_paise),0) AS balance
   FROM neo_fin_posted_journal_lines l
   JOIN neo_fin_accounts a ON a.organization_id=l.organization_id AND a.id=l.account_id
   WHERE l.organization_id=? AND a.account_code=?`).bind(organizationId,row.account_code).first();
  if(!Number.isSafeInteger(balance?.balance)||balance.balance<row.order_amount)return null;
 }
 return Object.freeze({organizationId,sourceKind,sourceId,sourceEventId,
  amountPaise:row.amount_paise,verificationReference:row.bank_reference,
  effectiveAt:new Date(verifiedAt).toISOString()});
}

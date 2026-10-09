/**
 * Read-only payout reconciliation summary. A legacy Paid flag is NOT bank proof.
 * All rows are scoped to one authorized independent legal business.
 * This view never changes source transactions, bank verification, or Daily Ledger.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export async function listPayoutSettlementStatus({db,authenticatedAccountId,organizationId,limit=50}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid settlement report limit');
 const result=await db.prepare(`SELECT d.id,d.source_kind,d.source_id,d.gross_paise,
    COUNT(CASE WHEN s.status='verified' THEN 1 END) AS verified_count,
    COALESCE(SUM(CASE WHEN s.status='verified' THEN s.amount_paise ELSE 0 END),0) AS verified_paise
  FROM neo_fin_documents d
  LEFT JOIN neo_fin_payment_settlements s
    ON s.organization_id=d.organization_id AND s.document_id=d.id
  WHERE d.organization_id=? AND d.document_type='payment' AND d.status='approved'
  GROUP BY d.organization_id,d.id,d.source_kind,d.source_id,d.gross_paise
  ORDER BY d.id DESC LIMIT ?`).bind(organizationId,limit).all();
 const entries=(result.results||[]).map(x=>{
  if(!integer(x.gross_paise)||!integer(x.verified_paise)||!integer(x.verified_count))throw Error('Invalid settlement totals');
  const status=x.verified_paise===0?'pending':
   x.verified_paise<x.gross_paise?'partially_verified':
   x.verified_paise===x.gross_paise?'verified':'over_verified';
  return Object.freeze({
   documentId:x.id,sourceKind:x.source_kind,sourceId:x.source_id,
   amountPaise:x.gross_paise,verifiedAmountPaise:x.verified_paise,
   verificationCount:x.verified_count,status
  });
 });
 return Object.freeze({organizationId,entries});
}

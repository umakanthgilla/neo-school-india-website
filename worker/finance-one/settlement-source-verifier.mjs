// Staging-only verifier for settlement-backed cash events.
// A source can post only when its own organization's settlement is verified.
// This is not connected to the live Worker or bank providers.
export async function verifySettlementSource(db, request) {
 const {organizationId,sourceKind,sourceId,sourceEventId}=request||{};
 if(!db||![organizationId,sourceKind,sourceId,sourceEventId].every(x=>typeof x==='string'&&x.length>0))return null;
 const sources={vendor_payment:'money_out',payroll_payment:'money_out',salary_advance_release:'money_out',refund_paid:'money_out'};
 if(!Object.hasOwn(sources,sourceKind))return null;
 // Source event IDs must be real settlement IDs, not caller-supplied proof.
 const row=await db.prepare(
   `SELECT s.id,s.organization_id,s.document_id,s.amount_paise,s.bank_reference,s.verified_at,s.status,
           d.document_type,d.source_kind,d.source_id
      FROM neo_fin_payment_settlements s
      JOIN neo_fin_documents d ON d.organization_id=s.organization_id AND d.id=s.document_id
     WHERE s.organization_id=? AND s.id=? AND d.source_id=?
       AND s.status='verified' AND d.status='approved'
     LIMIT 1`
 ).bind(organizationId,sourceEventId,sourceId).first();
 if(!row||row.organization_id!==organizationId||row.status!=='verified'||!row.bank_reference||!row.verified_at)return null;
 if(row.document_type!=='payment'||row.source_kind!==sourceKind||row.source_id!==sourceId)return null;
 if(!Number.isSafeInteger(row.amount_paise)||row.amount_paise<=0)return null;
 const effectiveAt=new Date(row.verified_at);
 if(!Number.isFinite(effectiveAt.getTime()))return null;
 return Object.freeze({organizationId,sourceKind,sourceId,sourceEventId,amountPaise:row.amount_paise,
   verificationReference:row.bank_reference,effectiveAt:effectiveAt.toISOString()});
}

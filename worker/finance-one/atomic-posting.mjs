// Staging-only atomic posting adapter. No public endpoint or production integration.
// Caller MUST originate from authenticated server workflow. Never trust input.verified from browser.
import {cashEventFromVerifiedSource} from './cash-projection.mjs';
import {assertValidOrganizationId, FinanceAccessError} from './organization-access.mjs';
export async function postVerifiedSourceEvent({db,organizationId,source,verifySource}) {
 if(!db || typeof verifySource!=='function') throw new Error('Trusted source verifier required');
 assertValidOrganizationId(organizationId);
 if(!source || source.organizationId!==organizationId) throw new FinanceAccessError('Cross-business source rejected');
 // verifySource MUST read original receipt/voucher/payment record from DB, validate ownership,
 // settlement and unique bank/source reference. Caller must not implement as return input.verified.
 const verified = await verifySource(db,{organizationId,sourceKind:source.sourceKind,sourceId:source.sourceId,sourceEventId:source.sourceEventId});
 if(!verified || verified.organizationId!==organizationId || verified.sourceKind!==source.sourceKind || verified.sourceId!==source.sourceId || verified.sourceEventId!==source.sourceEventId) throw new FinanceAccessError('Source verification failed');
 const event=cashEventFromVerifiedSource({...verified,verified:true});
 const key=[event.organizationId,event.sourceKind,event.sourceId,event.sourceEventId];
 // Deterministic event id; uniqueness is enforced by composite unique index in SQL.
 const eventId=key.map(v=>v.length+':'+v).join('|');
 // Recheck invoice reversal in the same SQL statement as the cash insertion.
 // The trusted verifier supplies this link; no browser field reaches it.
 const guardInvoice=typeof verified.accrualDocumentId==='string' && Boolean(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('neo_fin_correction_decisions').first());
 const postingGuard=guardInvoice?` WHERE NOT EXISTS (
  SELECT 1 FROM neo_fin_correction_decisions c JOIN neo_fin_journals j
   ON j.organization_id=c.organization_id AND j.id=c.journal_id
  WHERE c.organization_id=? AND j.source_kind='document' AND j.source_id=? AND c.decision='approved')`:'';
 const result=await db.prepare(
  `INSERT INTO neo_fin_cash_events
   (organization_id,event_id,source_kind,source_id,source_event_id,direction,amount_paise,effective_at,verification_reference)
   SELECT ?,?,?,?,?,?,?,?,?${postingGuard} ON CONFLICT(organization_id,source_kind,source_id,source_event_id) DO NOTHING`
 ).bind(event.organizationId,eventId,event.sourceKind,event.sourceId,event.sourceEventId,event.direction,event.amountPaise,event.effectiveAt,event.verificationReference,...(guardInvoice?[organizationId,verified.accrualDocumentId]:[])).run();
 if(result?.success!==true || !Number.isInteger(result?.meta?.changes)) throw new Error('Database posting not confirmed');
 const created=result.meta.changes===1;
 if(!created){
  // A repeated event must match the original exactly: never silently ignore
  // a changed amount/direction/reference disguised as an idempotent retry.
  const existing=await db.prepare(
   'SELECT direction,amount_paise,effective_at,verification_reference FROM neo_fin_cash_events WHERE organization_id=? AND source_kind=? AND source_id=? AND source_event_id=?'
  ).bind(event.organizationId,event.sourceKind,event.sourceId,event.sourceEventId).first();
  if(!existing || existing.direction!==event.direction ||
    existing.amount_paise!==event.amountPaise ||
    existing.effective_at!==event.effectiveAt ||
    existing.verification_reference!==event.verificationReference)
    throw new Error('Conflicting source event; reconciliation required');
 }
 return Object.freeze({eventId,created});
}
// Idempotent write protects repeated source delivery. Real verifier + DB migration still required.

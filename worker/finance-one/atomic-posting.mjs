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
 const result=await db.prepare(
  `INSERT INTO neo_fin_cash_events
   (organization_id,event_id,source_kind,source_id,source_event_id,direction,amount_paise,effective_at,verification_reference)
   VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,source_kind,source_id,source_event_id) DO NOTHING`
 ).bind(event.organizationId,eventId,event.sourceKind,event.sourceId,event.sourceEventId,event.direction,event.amountPaise,event.effectiveAt,event.verificationReference).run();
 if(result?.success===false) throw new Error('Database posting failed');
 return Object.freeze({eventId,created:Number(result?.meta?.changes||0)===1});
}
// Idempotent write protects repeated source delivery. Real verifier + DB migration still required.

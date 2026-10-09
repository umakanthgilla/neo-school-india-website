// Staging-only internal finance bridge. Never expose as an unauthenticated route.
import {resolveFinanceOrganization} from './organization-access.mjs';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
import {verifySettlementSource} from './settlement-source-verifier.mjs';
import {postJournalForCashEvent} from './source-journal.mjs';
const PAYOUT_SOURCES=new Set(['vendor_payment','payroll_payment','salary_advance_release','refund_paid']);
export async function syncVerifiedPayout({db,authenticatedAccountId,organizationId,sourceKind,sourceId,settlementId}){
 if(!PAYOUT_SOURCES.has(sourceKind))throw Error('Unsupported payout source');
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 const posting=await postVerifiedSourceEvent({db,organizationId,source:{organizationId,sourceKind,sourceId,sourceEventId:settlementId},verifySource:verifySettlementSource});
 // If journal posting fails, the cash event remains verified. Idempotent retry
 // completes its journal without entering a second Daily Ledger transaction.
 const journal=await postJournalForCashEvent(db,organizationId,posting.eventId);
 return Object.freeze({organizationId,settlementId,eventId:posting.eventId,journalId:journal.journalId,cashCreated:posting.created,journalCreated:journal.created});
}

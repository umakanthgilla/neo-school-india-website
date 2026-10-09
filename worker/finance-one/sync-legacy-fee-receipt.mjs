/**
 * Finance ONE staging-only legacy Fee Receipt -> verified cash mirror ->
 * balanced journal. No write to existing neo_portal_records/daily_accounts.
 * Independent receipt evidence and invoice accrual are prerequisites.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
import {verifyLegacyFeeReceipt} from './legacy-fee-receipt-verifier.mjs';
import {postJournalForCashEvent} from './source-journal.mjs';

export async function syncVerifiedLegacyFeeReceipt({
 db,authenticatedAccountId,organizationId,paymentRecordId,verificationId
}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 if(typeof paymentRecordId!=='string'||!paymentRecordId.trim()||
    typeof verificationId!=='string'||!verificationId.trim())throw new Error('Receipt and verified evidence required');
 const result=await postVerifiedSourceEvent({
   db,organizationId,
   source:{organizationId,sourceKind:'fee_receipt',sourceId:paymentRecordId,sourceEventId:verificationId},
   verifySource:verifyLegacyFeeReceipt
 });
 // Accounting posting may temporarily fail after cash is mirrored. Safe retries
 // and journal-recovery complete the journal without a second cash movement.
 const journal=await postJournalForCashEvent(db,organizationId,result.eventId);
 return Object.freeze({
   organizationId,paymentRecordId,verificationId,eventId:result.eventId,
   journalId:journal.journalId,cashCreated:result.created,journalCreated:journal.created
 });
}

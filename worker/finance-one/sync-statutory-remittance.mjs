/**
 * Internal-only, authenticated statutory payment voucher sync.
 * Cash event only from independent verified bank source; balance journal
 * may be repaired safely without duplicating Daily Ledger Money Out.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
import {verifyStatutoryBankRemittance} from './statutory-remittance-verifier.mjs';
import {postStatutoryRemittanceJournal} from './statutory-remittance-journal.mjs';
export async function syncVerifiedStatutoryRemittance({
 db,authenticatedAccountId,organizationId,remittanceId,settlementId
}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 const sourceKind='statutory_remittance_paid';
 const event=await postVerifiedSourceEvent({db,organizationId,
  source:{organizationId,sourceKind,sourceId:remittanceId,sourceEventId:settlementId},
  verifySource:verifyStatutoryBankRemittance});
 const journal=await postStatutoryRemittanceJournal(db,organizationId,event.eventId);
 return Object.freeze({organizationId,remittanceId,settlementId,eventId:event.eventId,
  journalId:journal.journalId,cashCreated:event.created,journalCreated:journal.created});
}

/**
 * Internal-only legacy source payout accounting mirror. No HTTP write route.
 * Requires approved, independently verified bank payout and exact existing
 * voucher + legacy ledger linkage. Legacy Daily Ledger is NEVER modified.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
import {postJournalForCashEvent} from './source-journal.mjs';
import {postLegacyPayrollSettlementJournal} from './legacy-payroll-settlement-journal.mjs';
import {verifyLegacyPayout} from './legacy-payout-verifier.mjs';
const KINDS=new Set(['vendor_payment','payroll_payment','salary_advance_release']);
const ID=/^[A-Za-z0-9_-]{1,100}$/;
export async function syncVerifiedLegacyPayout({
 db,authenticatedAccountId,organizationId,schoolId,legacyRecordId,sourceKind,settlementId
}){
 if(!KINDS.has(sourceKind)||![schoolId,legacyRecordId,settlementId].every(x=>typeof x==='string'&&ID.test(x)))
  throw new Error('Invalid original payout or bank settlement');
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 const sourceId=schoolId+'|'+legacyRecordId;
 const cash=await postVerifiedSourceEvent({
  db,organizationId,
  source:{organizationId,sourceKind,sourceId,sourceEventId:settlementId},
  verifySource:verifyLegacyPayout
 });
 const journal=sourceKind==='payroll_payment'
  ? await postLegacyPayrollSettlementJournal(db,organizationId,cash.eventId)
  : await postJournalForCashEvent(db,organizationId,cash.eventId);
 return Object.freeze({
  organizationId,schoolId,legacyRecordId,sourceKind,settlementId,
  cashCreated:cash.created,journalCreated:journal.created,eventId:cash.eventId,journalId:journal.journalId
 });
}

/**
 * Internal scheduled recovery for verified cash events missing posted accounting
 * journals. Tenant-isolated; never creates a new cash ledger event.
 * Wire to a server-side scheduled job only after staging validation.
 */
import {postJournalForCashEvent} from './source-journal.mjs';
import {postLegacyPayrollSettlementJournal} from './legacy-payroll-settlement-journal.mjs';
import {postStatutoryRemittanceJournal} from './statutory-remittance-journal.mjs';
export async function recoverMissingCashJournals({db,organizationId,limit=100}) {
 if(!db||typeof organizationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(organizationId))throw new Error('Valid organization required');
 if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Invalid recovery limit');
 const pending=await db.prepare(`SELECT c.event_id,c.source_kind,c.source_id
 FROM neo_fin_cash_events c
 LEFT JOIN neo_fin_journals j ON j.organization_id=c.organization_id AND j.source_kind='cash_event' AND j.source_id=c.event_id AND j.status='posted'
 WHERE c.organization_id=? AND j.id IS NULL
 ORDER BY c.effective_at,c.event_id LIMIT ?`).bind(organizationId,limit).all();
 const failed=[],posted=[];
 for(const entry of pending.results||[]) {
  try{
   const payroll=entry.source_kind==='payroll_payment' && typeof entry.source_id==='string' && entry.source_id.includes('|');
   const r=entry.source_kind==='statutory_remittance_paid'
     ?await postStatutoryRemittanceJournal(db,organizationId,entry.event_id)
     :payroll?await postLegacyPayrollSettlementJournal(db,organizationId,entry.event_id)
     :await postJournalForCashEvent(db,organizationId,entry.event_id);
   posted.push({eventId:entry.event_id,created:r.created});
  }
  catch(error){failed.push({eventId:entry.event_id,error:error?.message||'Journal failure'});}
 }
 return Object.freeze({organizationId,checked:(pending.results||[]).length,posted,failed});
}

/**
 * Finance ONE cash↔journal reconciliation — read-only, per legal business.
 * Detects missing/draft cash-event journals, incorrect Bank (1000) movement,
 * unbalanced posted journals, and journals without a verified cash event.
 *
 * IMPORTANT: This checks INTERNAL consistency only; it does not independently
 * verify real bank settlements or prove that journal source evidence was valid.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const MAX_FINDINGS=50;
function countFinding(report,code,identity){
 report.issueCount++;
 report.counts[code]=(report.counts[code]||0)+1;
 if(report.findings.length<MAX_FINDINGS)
  report.findings.push(Object.freeze({code,...identity}));
}
export async function auditFinanceCashJournals({db,authenticatedAccountId,organizationId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 const cash=await db.prepare(`SELECT c.event_id,c.source_kind,c.direction,c.amount_paise,
 j.id AS journal_id,j.status AS journal_status,
 COUNT(l.line_no) AS line_count,
 COALESCE(SUM(l.debit_paise),0) AS debit_paise,
 COALESCE(SUM(l.credit_paise),0) AS credit_paise,
 COALESCE(SUM(CASE WHEN a.account_code='1000' THEN l.debit_paise ELSE 0 END),0) AS bank_debit_paise,
 COALESCE(SUM(CASE WHEN a.account_code='1000' THEN l.credit_paise ELSE 0 END),0) AS bank_credit_paise
 FROM neo_fin_cash_events c
 LEFT JOIN neo_fin_journals j ON j.organization_id=c.organization_id
  AND j.source_kind='cash_event' AND j.source_id=c.event_id
 LEFT JOIN neo_fin_journal_lines l ON l.organization_id=j.organization_id AND l.journal_id=j.id
 LEFT JOIN neo_fin_accounts a ON a.organization_id=l.organization_id AND a.id=l.account_id
 WHERE c.organization_id=?
 GROUP BY c.event_id,c.source_kind,c.direction,c.amount_paise,j.id,j.status
 ORDER BY c.event_id`).bind(organizationId).all();
 const orphan=await db.prepare(`SELECT j.id AS journal_id,j.source_id AS event_id
 FROM neo_fin_journals j
 LEFT JOIN neo_fin_cash_events c ON c.organization_id=j.organization_id
   AND c.event_id=j.source_id
 WHERE j.organization_id=? AND j.source_kind='cash_event' AND c.event_id IS NULL
 ORDER BY j.id`).bind(organizationId).all();
 if(!Array.isArray(cash?.results)||!Array.isArray(orphan?.results))
  throw Error('Finance cash journal audit query failed');
 const report={organizationId,cashEventCount:cash.results.length,
  orphanJournalCount:orphan.results.length,issueCount:0,counts:{},findings:[]};
 for(const row of cash.results){
  const identity={eventId:row.event_id,sourceKind:row.source_kind};
  if(!row.journal_id){countFinding(report,'missing_journal',identity);continue;}
  if(row.journal_status!=='posted'){countFinding(report,'journal_not_posted',identity);continue;}
  if(![row.amount_paise,row.line_count,row.debit_paise,row.credit_paise,
   row.bank_debit_paise,row.bank_credit_paise].every(safe) ||
   row.amount_paise===0 || row.line_count<2){
   countFinding(report,'invalid_journal_values',identity);continue;
  }
  if(row.debit_paise!==row.credit_paise)
   countFinding(report,'unbalanced_journal',identity);
  const expectedDr=row.direction==='money_in'?row.amount_paise:0;
  const expectedCr=row.direction==='money_out'?row.amount_paise:0;
  if((row.direction!=='money_in'&&row.direction!=='money_out')||
     row.bank_debit_paise!==expectedDr||row.bank_credit_paise!==expectedCr)
   countFinding(report,'bank_amount_mismatch',identity);
 }
 for(const row of orphan.results)
  countFinding(report,'orphan_cash_journal',{eventId:row.event_id,journalId:row.journal_id});
 return Object.freeze({
  organizationId,ready:report.issueCount===0,cashEventCount:report.cashEventCount,
  orphanJournalCount:report.orphanJournalCount,issueCount:report.issueCount,
  counts:Object.freeze(report.counts),findings:Object.freeze(report.findings),
  findingsTruncated:report.issueCount>report.findings.length,
  note:'Internal cash/journal reconciliation only; not independent proof of bank settlement'
 });
}

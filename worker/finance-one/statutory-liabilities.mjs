/**
 * Read-only current statutory balances from POSTED journals only.
 * Never calculate PF/ESI/PT/TDS rates or infer whether a government filing
 * was completed. Values represent independently-owned business ledger balances.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
const CODES=Object.freeze({
 '2111':'PF','2112':'ESI','2113':'Professional Tax','2114':'Payroll TDS'
});
const safe=n=>Number.isSafeInteger(n)&&n>=0;
export async function readStatutoryLiabilities({db,authenticatedAccountId,organizationId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 const result=await db.prepare(`SELECT a.account_code,
 COALESCE(SUM(l.credit_paise),0) AS credited_paise,
 COALESCE(SUM(l.debit_paise),0) AS debited_paise
 FROM neo_fin_accounts a LEFT JOIN neo_fin_posted_journal_lines l
 ON l.organization_id=a.organization_id AND l.account_id=a.id
 WHERE a.organization_id=? AND a.account_code IN ('2111','2112','2113','2114')
 AND a.active=1
 GROUP BY a.account_code ORDER BY a.account_code`).bind(organizationId).all();
 const found=new Map((result.results||[]).map(x=>[x.account_code,x]));
 const items=[];let netTotal=0;let needsReview=false;
 for(const [code,label] of Object.entries(CODES)){
  const r=found.get(code);
  if(!r)throw new Error('Statutory chart account missing: '+code);
  if(!safe(r.credited_paise)||!safe(r.debited_paise))throw new Error('Invalid statutory journal amount');
  const balancePaise=r.credited_paise-r.debited_paise;
  if(!Number.isSafeInteger(balancePaise))throw new Error('Statutory balance overflow');
  if(balancePaise<0)needsReview=true;
  netTotal+=balancePaise;
  if(!Number.isSafeInteger(netTotal))throw new Error('Statutory balance overflow');
  items.push(Object.freeze({code,label,creditedPaise:r.credited_paise,debitedPaise:r.debited_paise,
    balancePaise,requiresReview:balancePaise<0}));
 }
 return Object.freeze({organizationId,items,netLiabilityPaise:netTotal,requiresReview:needsReview,
  note:'Posted-journal balances only; debits may include adjustments rather than remittances; not proof of government filing, challan or statutory compliance'});
}

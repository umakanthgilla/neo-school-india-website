// Staging-only independent-business reporting, not a public route.
import {resolveFinanceOrganization} from './organization-access.mjs';
const safe=(n)=>{if(!Number.isSafeInteger(n))throw new Error('Financial amount overflow');return n;};
export async function getFinanceSnapshot({db,accountId,organizationId}) {
 await resolveFinanceOrganization(db,accountId,organizationId,'finance','read');
 const journal=await db.prepare(`SELECT a.account_code,a.account_name,a.account_type,
   COALESCE(SUM(l.debit_paise),0) AS debit_paise,
   COALESCE(SUM(l.credit_paise),0) AS credit_paise
   FROM neo_fin_accounts a LEFT JOIN neo_fin_posted_journal_lines l
   ON l.organization_id=a.organization_id AND l.account_id=a.id
   WHERE a.organization_id=?
   GROUP BY a.id,a.account_code,a.account_name,a.account_type
   ORDER BY a.account_code`).bind(organizationId).all();
 const cash=await db.prepare(`SELECT direction,COALESCE(SUM(amount_paise),0) AS amount_paise
   FROM neo_fin_daily_ledger WHERE organization_id=? GROUP BY direction`).bind(organizationId).all();
 let totalDebits=0,totalCredits=0,income=0,expense=0;
 const trialBalance=(journal.results||[]).map(r=>{
  const debit=safe(r.debit_paise),credit=safe(r.credit_paise);
  totalDebits=safe(totalDebits+debit);totalCredits=safe(totalCredits+credit);
  if(r.account_type==='income')income=safe(income+credit-debit);
  if(r.account_type==='expense')expense=safe(expense+debit-credit);
  return {code:r.account_code,name:r.account_name,type:r.account_type,debitPaise:debit,creditPaise:credit};
 });
 let moneyIn=0,moneyOut=0;
 for(const row of cash.results||[]){
  if(row.direction==='money_in')moneyIn=safe(moneyIn+safe(row.amount_paise));
  else if(row.direction==='money_out')moneyOut=safe(moneyOut+safe(row.amount_paise));
  else throw new Error('Unknown cash direction');
 }
 return Object.freeze({organizationId,trialBalance,balanced:totalDebits===totalCredits,totalDebitPaise:totalDebits,totalCreditPaise:totalCredits,
  moneyInPaise:moneyIn,moneyOutPaise:moneyOut,netCashMovementPaise:safe(moneyIn-moneyOut),incomePaise:income,expensePaise:expense,profitPaise:safe(income-expense)});
}

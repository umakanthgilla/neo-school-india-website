// Staging-only: create an independent Chart of Accounts for an authorized business.
import {resolveFinanceOrganization} from './organization-access.mjs';
export const STANDARD_CHART = Object.freeze([
 ['1000','Cash / Bank Clearing','asset'],['1100','Accounts Receivable','asset'],
 ['1200','Employee Salary Advances','asset'],['2000','Accounts Payable','liability'],
 ['2100','Salary Payable','liability'],['2200','Customer Refunds Payable','liability'],
 ['3100','Owners Equity','equity'],['4000','Fee Revenue','income'],
 ['5000','Operating Expenses','expense'],['5100','Payroll Expense','expense'],
 ['5200','Cost of Goods Sold','expense'],
 ['5300','Employer Statutory Contributions','expense'],
 ['2111','Provident Fund Payable','liability'],
 ['2112','ESI Payable','liability'],
 ['2113','Professional Tax Payable','liability'],
 ['2114','Payroll TDS Payable','liability']
]);
export async function ensureBusinessChart(db,authenticatedAccountId,organizationId){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 const existing=await db.prepare('SELECT account_code,account_type,active FROM neo_fin_accounts WHERE organization_id=?').bind(organizationId).all();
 const current=new Map((existing.results||[]).map(r=>[r.account_code,r]));
 for(const [code,,type] of STANDARD_CHART){
  const row=current.get(code);
  if(row && (row.account_type!==type || row.active!==1))throw new Error('Chart account conflict: '+code);
 }
 const statements=STANDARD_CHART.map(([code,name,type])=>db.prepare(
   'INSERT OR IGNORE INTO neo_fin_accounts(organization_id,id,account_code,account_name,account_type) VALUES (?,?,?,?,?)'
 ).bind(organizationId,'SYS_'+code,code,name,type));
 const results=await db.batch(statements);
 if(!Array.isArray(results)||results.length!==statements.length||results.some(r=>r?.success!==true))throw new Error('Chart bootstrap was not confirmed');
 const read=await db.prepare('SELECT account_code,account_type,active FROM neo_fin_accounts WHERE organization_id=?').bind(organizationId).all();
 const byCode=new Map((read.results||[]).map(r=>[r.account_code,r]));
 for(const [code,,type] of STANDARD_CHART){
  const account=byCode.get(code);
  if(!account||account.account_type!==type||account.active!==1)throw new Error('Chart account conflict: '+code);
 }
 return Object.freeze({organizationId,accountCount:STANDARD_CHART.length});
}

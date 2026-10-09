/**
 * Organization-specific read-only Finance ONE readiness, staging only.
 * Schema-wide checks alone are not sufficient for an individual legal business.
 * No account creation, password issuance or production changes.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {STANDARD_CHART} from './accounting-chart.mjs';

export async function financeOneBusinessPreflight({db,authenticatedAccountId,organizationId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 const required=new Map(STANDARD_CHART.map(([code,,type])=>[code,type]));
 const rows=await db.prepare(`SELECT id,account_code,account_type,active
  FROM neo_fin_accounts WHERE organization_id=?`).bind(organizationId).all();
 const available=new Map((rows.results||[]).map(r=>[r.account_code,r]));
 const blockers=[];
 let configuredAccounts=0;
 for(const [code,type] of required){
  const account=available.get(code);
  if(!account)blockers.push('Missing chart account: '+code);
  else if(account.account_type!==type)blockers.push('Wrong account type: '+code);
  else if(account.active!==1)blockers.push('Inactive chart account: '+code);
  else configuredAccounts++;
 }
 const auth=await db.prepare(`SELECT active,credential_version FROM neo_fin_auth_accounts
  WHERE account_id=? LIMIT 1`).bind(authenticatedAccountId).first();
 if(!auth||auth.active!==1||!Number.isSafeInteger(auth.credential_version)||auth.credential_version<1)
  blockers.push('Finance credentials missing or inactive');
 // Check that no current projected money moves lack a balanced posted journal.
 const unsynced=await db.prepare(`SELECT COUNT(*) AS total FROM neo_fin_cash_events c
  LEFT JOIN neo_fin_journals j ON j.organization_id=c.organization_id
    AND j.source_kind='cash_event' AND j.source_id=c.event_id AND j.status='posted'
  WHERE c.organization_id=? AND j.id IS NULL`).bind(organizationId).first();
 if(!Number.isSafeInteger(unsynced?.total)||unsynced.total<0)
  blockers.push('Cash/accounting reconciliation unavailable');
 else if(unsynced.total>0)blockers.push('Unreconciled verified cash events: '+unsynced.total);
 return Object.freeze({organizationId,ready:blockers.length===0,
  requiredAccounts:required.size,configuredAccounts,
  unreconciledCashEvents:unsynced?.total??null,blockers});
}

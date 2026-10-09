/**
 * Read-only staging deployment checklist. Does not alter DB or flip feature flags.
 * Require an explicit staging environment to prevent accidental production rollout.
 */
const REQUIRED_TABLES=Object.freeze([
 'neo_fin_organizations','neo_fin_school_ownership','neo_fin_memberships',
 'neo_fin_auth_accounts','neo_fin_documents','neo_fin_payment_settlements',
 'neo_fin_accounts','neo_fin_journals','neo_fin_journal_lines','neo_fin_cash_events',
 'neo_fin_receipt_verifications','neo_fin_payroll_statutory_reviews'
]);
const REQUIRED_VIEWS=Object.freeze(['neo_fin_daily_ledger','neo_fin_posted_journal_lines']);
const REQUIRED_TRIGGERS=Object.freeze(['neo_fin_cash_events_no_update','neo_fin_cash_events_no_delete',
 'neo_fin_journal_post_balanced','neo_fin_journal_posted_immutable','neo_fin_auth_rotate_credentials',
 'neo_fin_receipt_verification_no_update','neo_fin_receipt_verification_no_delete',
 'neo_fin_legacy_payout_verify_insert','neo_fin_legacy_payout_verify_update',
 'neo_fin_legacy_payout_verified_immutable','neo_fin_legacy_payout_verified_no_delete',
 'neo_fin_payroll_review_no_update','neo_fin_payroll_review_no_delete']);
export async function financeOneStagingPreflight({db,env}) {
 const blockers=[];
 if(env?.FINANCE_ONE_ENVIRONMENT!=='staging')blockers.push('Not explicitly marked staging');
 if(env?.FINANCE_ONE_READ_API_ENABLED!=='true')blockers.push('Finance API feature flag not enabled for staging');
 if(typeof env?.FINANCE_ONE_SESSION_SECRET!=='string'||env.FINANCE_ONE_SESSION_SECRET.length<32)
   blockers.push('Dedicated Finance session secret missing');
 if(!db?.prepare)return Object.freeze({ready:false,blockers:[...blockers,'D1 database unavailable'],schema:{tables:0,views:0,triggers:0}});
 let rows;
 try {
  const result=await db.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','view','trigger') AND name LIKE 'neo_fin_%'").all();
  rows=result?.results;
  if(!Array.isArray(rows))throw new Error('No schema data');
 }catch{return Object.freeze({ready:false,blockers:[...blockers,'Finance schema inspection failed'],schema:{tables:0,views:0,triggers:0}});}
 const names={table:new Set(),view:new Set(),trigger:new Set()};
 for(const row of rows)if(names[row.type])names[row.type].add(row.name);
 for(const name of REQUIRED_TABLES)if(!names.table.has(name))blockers.push('Missing table '+name);
 for(const name of REQUIRED_VIEWS)if(!names.view.has(name))blockers.push('Missing view '+name);
 for(const name of REQUIRED_TRIGGERS)if(!names.trigger.has(name))blockers.push('Missing trigger '+name);
 return Object.freeze({ready:blockers.length===0,blockers,schema:{tables:names.table.size,views:names.view.size,triggers:names.trigger.size}});
}

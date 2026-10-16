/**
 * Finance ONE internal-only identity bootstrap. Never expose as a public route.
 * Invoked by an audited, independently authorized deployment/operator workflow.
 * Does not derive access from legacy school or global HO credentials.
 */
import {createFinancePasswordRecord} from './finance-password.mjs';

const VALID_ID=/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/;
const VALID_ORG=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const ROLES=new Set(['owner','finance_admin','payroll_admin','accountant','auditor']);

export async function provisionFinanceIdentityInternal({db,accountId,password,organizationId,role,authorizedOperator}) {
  if (authorizedOperator !== true) throw new Error('Independently authorized operator required');
  if (!db?.batch || !db?.prepare) throw new Error('Transactional database required');
  if (typeof accountId!=='string' || !accountId.startsWith('fin:') || !VALID_ID.test(accountId) ||
      typeof organizationId!=='string' || !VALID_ORG.test(organizationId) || !ROLES.has(role)) {
    throw new Error('Invalid finance identity or organization');
  }
  const org=await db.prepare("SELECT id FROM neo_fin_organizations WHERE id=? AND status='active'").bind(organizationId).first();
  if (!org) throw new Error('Active independent business required');
  const existing=await db.prepare('SELECT account_id FROM neo_fin_auth_accounts WHERE account_id=?').bind(accountId).first();
  if(existing) throw new Error('Finance account already exists; use audited membership invitation or password reset');
  const credential=await createFinancePasswordRecord({accountId,password});
  // D1 batch is transactional: credentials + membership must commit together.
  const result=await db.batch([
    db.prepare('INSERT INTO neo_fin_auth_accounts (account_id,salt,password_hash,iterations) VALUES (?,?,?,?)')
      .bind(accountId,credential.salt,credential.passwordHash,credential.iterations),
    db.prepare('INSERT INTO neo_fin_memberships (organization_id,account_id,role,active) VALUES (?,?,?,1)')
      .bind(organizationId,accountId,role)
  ]);
  if(!Array.isArray(result) || result.length!==2 || result.some(r=>r?.success!==true||r?.meta?.changes!==1))
    throw new Error('Finance identity setup not confirmed');
  return Object.freeze({accountId,organizationId,role,created:true});
}

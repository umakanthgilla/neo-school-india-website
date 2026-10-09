// Neo Finance & Payroll ONE — isolated business authorization foundation.
// Standalone module. Deliberately NOT wired into production Worker.
// Never trust organization IDs supplied in request bodies.
export class FinanceAccessError extends Error {
  constructor(message = 'Finance access denied', status = 403) {
    super(message);
    this.name = 'FinanceAccessError';
    this.status = status;
  }
}
const validatedContexts = new WeakSet();
const ALLOWED_ROLES = new Set(['owner','finance_admin','payroll_admin','accountant','auditor','employee']);
const READ_ROLES = {
  finance: new Set(['owner','finance_admin','accountant','auditor']),
  payroll: new Set(['owner','payroll_admin','accountant','auditor']),
};
const WRITE_ROLES = {
  finance: new Set(['owner','finance_admin','accountant']),
  payroll: new Set(['owner','payroll_admin']),
};
export function assertValidOrganizationId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) {
    throw new FinanceAccessError('Invalid organization identifier',400);
  }
  return value;
}
export function assertFinanceCapability(membership, domain, operation='read') {
  if (!membership || membership.active !== 1 || !ALLOWED_ROLES.has(membership.role)) {
    throw new FinanceAccessError();
  }
  const roles = operation==='read' ? READ_ROLES[domain] : operation==='write' ? WRITE_ROLES[domain] : null;
  if (!roles || !roles.has(membership.role)) throw new FinanceAccessError();
  return true;
}
export async function resolveFinanceOrganization(db, accountId, organizationId, domain='finance', operation='read') {
  if (typeof accountId !== 'string' || !accountId.trim()) throw new FinanceAccessError('Login required',401);
  assertValidOrganizationId(organizationId);
  // The caller must derive accountId from a validated server-side session, never request JSON.
  const result = await db.prepare(
    "SELECT m.organization_id, m.account_id, m.role, m.active FROM neo_fin_memberships m JOIN neo_fin_organizations o ON o.id=m.organization_id WHERE m.organization_id=? AND m.account_id=? AND m.active=1 AND o.status='active'"
  ).bind(organizationId,accountId).all();
  const memberships = result.results || [];
  const granted = memberships.find(m => {
    try { return assertFinanceCapability(m,domain,operation); } catch { return false; }
  });
  if (!granted) throw new FinanceAccessError();
  const ctx = Object.freeze({organizationId:granted.organization_id, accountId, role:granted.role, domain, operation});
  validatedContexts.add(ctx);
  return ctx;
}
export async function listOwnDocuments(db, context, limit=50) {
  if (!context || !validatedContexts.has(context) || context.domain !== 'finance') throw new FinanceAccessError();
  assertFinanceCapability({role:context.role,active:1},'finance','read');
  const bounded = Math.max(1,Math.min(100,Number.isInteger(limit)?limit:50));
  return (await db.prepare(
    'SELECT id,document_type,party_id,status,currency,gross_paise,created_at FROM neo_fin_documents WHERE organization_id=? ORDER BY created_at DESC,id DESC LIMIT ?'
  ).bind(context.organizationId,bounded).all()).results || [];
}
// This is ONLY an access-control library, not an active API endpoint or payout engine.

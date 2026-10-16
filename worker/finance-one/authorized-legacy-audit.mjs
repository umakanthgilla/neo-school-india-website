import { resolveFinanceOrganization } from './organization-access.mjs';
import { auditLegacyLedgerRows, readLegacySchoolRows } from './legacy-ledger-audit.mjs';
export async function auditSchoolForFinanceMember({db, accountId, schoolId}) {
  const mapping = await db.prepare('SELECT organization_id FROM neo_fin_school_ownership WHERE school_id=?').bind(schoolId).first();
  if (!mapping?.organization_id) throw new Error('Organization mapping required');
  await resolveFinanceOrganization(db, accountId, mapping.organization_id, 'finance', 'read');
  const rows = await readLegacySchoolRows(db, schoolId);
  return {schoolId, organizationId:mapping.organization_id, ...auditLegacyLedgerRows(rows)};
}

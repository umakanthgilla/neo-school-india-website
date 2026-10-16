/** Migration 11 is optional only for older read-only staging databases. */
export async function isAccrualReversed(db,organizationId,documentId){
 const schema=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('neo_fin_correction_decisions').first();
 if(!schema)return false;
 return Boolean(await db.prepare(`SELECT c.request_id FROM neo_fin_correction_decisions c
  JOIN neo_fin_journals j ON j.organization_id=c.organization_id AND j.id=c.journal_id
  WHERE c.organization_id=? AND j.source_kind='document' AND j.source_id=? AND c.decision='approved' LIMIT 1`).bind(organizationId,documentId).first());
}

-- Finance ONE staging receipt evidence. NOT a manual cash ledger entry.
-- One separately verified piece of settlement evidence per existing school fee receipt.
-- Do not apply to production without ownership mapping / independent finance approvals.
CREATE TABLE IF NOT EXISTS neo_fin_receipt_verifications (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  verification_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  payment_record_id TEXT NOT NULL,
  receipt_no TEXT NOT NULL CHECK(length(trim(receipt_no)) > 0),
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('bank_reconciled','cash_counted')),
  verification_reference TEXT NOT NULL CHECK(length(trim(verification_reference)) > 0),
  settled_at TEXT NOT NULL CHECK(length(trim(settled_at)) > 0),
  verified_at TEXT NOT NULL CHECK(length(trim(verified_at)) > 0),
  verified_by TEXT NOT NULL CHECK(length(trim(verified_by)) > 0),
  status TEXT NOT NULL DEFAULT 'verified' CHECK(status = 'verified'),
  PRIMARY KEY(organization_id,verification_id),
  UNIQUE(organization_id,school_id,payment_record_id),
  UNIQUE(organization_id,verification_reference),
  FOREIGN KEY(organization_id) REFERENCES neo_fin_organizations(id)
);
CREATE INDEX IF NOT EXISTS neo_fin_receipt_by_school
  ON neo_fin_receipt_verifications(organization_id,school_id,payment_record_id);
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_verification_no_update
BEFORE UPDATE ON neo_fin_receipt_verifications
BEGIN SELECT RAISE(ABORT,'Verified receipt evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_verification_no_delete
BEFORE DELETE ON neo_fin_receipt_verifications
BEGIN SELECT RAISE(ABORT,'Verified receipt evidence immutable'); END;
-- Verification evidence is produced solely by a trusted, reviewed bank-reconciliation
-- or independently attested cash-count workflow, never from a browser-supplied
-- "verified" boolean or the legacy "Recorded by school" status.

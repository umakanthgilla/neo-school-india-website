-- Finance ONE staging: statutory remittance voucher sources.
-- Created only by an approved internal Finance workflow. Never via Daily Ledger edit.
CREATE TABLE IF NOT EXISTS neo_fin_statutory_remittances (
 organization_id TEXT NOT NULL,
 id TEXT NOT NULL,
 account_code TEXT NOT NULL CHECK(account_code IN ('2111','2112','2113','2114')),
 payroll_month TEXT NOT NULL,
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0),
 finance_document_id TEXT NOT NULL,
 voucher_number TEXT NOT NULL CHECK(length(trim(voucher_number))>0),
 approval_reference TEXT NOT NULL CHECK(length(trim(approval_reference))>0),
 approved_by TEXT NOT NULL CHECK(length(trim(approved_by))>0),
 approved_at TEXT NOT NULL CHECK(length(trim(approved_at))>0),
 status TEXT NOT NULL CHECK(status='approved'),
 PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,account_code,payroll_month),
 UNIQUE(organization_id,voucher_number),
 FOREIGN KEY(organization_id,finance_document_id)
  REFERENCES neo_fin_documents(organization_id,id)
);
CREATE TRIGGER IF NOT EXISTS neo_fin_statutory_remittance_no_update
 BEFORE UPDATE ON neo_fin_statutory_remittances
 BEGIN SELECT RAISE(ABORT,'Statutory remittance approval immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_statutory_remittance_no_delete
 BEFORE DELETE ON neo_fin_statutory_remittances
 BEGIN SELECT RAISE(ABORT,'Statutory remittance approval immutable'); END;

-- A full verified bank settlement is unique for a statutory payment voucher.
CREATE TRIGGER IF NOT EXISTS neo_fin_stat_remit_verify_insert
 BEFORE INSERT ON neo_fin_payment_settlements
 WHEN NEW.status='verified' AND EXISTS(
  SELECT 1 FROM neo_fin_documents d WHERE d.organization_id=NEW.organization_id
   AND d.id=NEW.document_id AND d.source_kind='statutory_remittance_paid')
 BEGIN
  SELECT CASE WHEN NEW.amount_paise<>(SELECT gross_paise FROM neo_fin_documents
   WHERE organization_id=NEW.organization_id AND id=NEW.document_id)
   THEN RAISE(ABORT,'Statutory payment amount must match voucher') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM neo_fin_payment_settlements s
   WHERE s.organization_id=NEW.organization_id AND s.document_id=NEW.document_id
   AND s.status='verified') THEN RAISE(ABORT,'Statutory payment already verified') END;
 END;
CREATE TRIGGER IF NOT EXISTS neo_fin_stat_remit_verify_update
 BEFORE UPDATE OF status ON neo_fin_payment_settlements
 WHEN NEW.status='verified' AND OLD.status<>'verified' AND EXISTS(
  SELECT 1 FROM neo_fin_documents d WHERE d.organization_id=NEW.organization_id
  AND d.id=NEW.document_id AND d.source_kind='statutory_remittance_paid')
 BEGIN
  SELECT CASE WHEN NEW.amount_paise<>(SELECT gross_paise FROM neo_fin_documents
   WHERE organization_id=NEW.organization_id AND id=NEW.document_id)
   THEN RAISE(ABORT,'Statutory payment amount must match voucher') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM neo_fin_payment_settlements s
   WHERE s.organization_id=NEW.organization_id AND s.document_id=NEW.document_id
   AND s.id<>NEW.id AND s.status='verified')
   THEN RAISE(ABORT,'Statutory payment already verified') END;
 END;
CREATE TRIGGER IF NOT EXISTS neo_fin_stat_remit_verified_no_update
 BEFORE UPDATE ON neo_fin_payment_settlements
 WHEN OLD.status='verified' AND EXISTS(SELECT 1 FROM neo_fin_documents d
   WHERE d.organization_id=OLD.organization_id AND d.id=OLD.document_id
   AND d.source_kind='statutory_remittance_paid')
 BEGIN SELECT RAISE(ABORT,'Verified statutory bank evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_stat_remit_verified_no_delete
 BEFORE DELETE ON neo_fin_payment_settlements
 WHEN OLD.status='verified' AND EXISTS(SELECT 1 FROM neo_fin_documents d
  WHERE d.organization_id=OLD.organization_id AND d.id=OLD.document_id
  AND d.source_kind='statutory_remittance_paid')
 BEGIN SELECT RAISE(ABORT,'Verified statutory bank evidence immutable'); END;

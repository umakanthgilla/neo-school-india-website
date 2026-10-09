-- Staging only: enforce a single full verified bank settlement for each
-- school-qualified *legacy* payout payment document.
-- Real split/partial vendor settlement remains supported on separate non-legacy
-- payment document workflows. Legacy payouts are already individual payments.
CREATE TRIGGER IF NOT EXISTS neo_fin_legacy_payout_verify_insert
BEFORE INSERT ON neo_fin_payment_settlements
WHEN NEW.status='verified' AND EXISTS (
 SELECT 1 FROM neo_fin_documents d
 WHERE d.organization_id=NEW.organization_id AND d.id=NEW.document_id
 AND d.document_type='payment' AND d.source_kind IN
  ('payroll_payment','vendor_payment','salary_advance_release')
 AND instr(d.source_id,'|')>0
)
BEGIN
 SELECT CASE WHEN NEW.amount_paise<>(
  SELECT d.gross_paise FROM neo_fin_documents d
  WHERE d.organization_id=NEW.organization_id AND d.id=NEW.document_id
 ) THEN RAISE(ABORT,'Legacy payout requires exact full settlement') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM neo_fin_payment_settlements s
  WHERE s.organization_id=NEW.organization_id AND s.document_id=NEW.document_id
   AND s.status='verified'
 ) THEN RAISE(ABORT,'Legacy payout already settled') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_legacy_payout_verify_update
BEFORE UPDATE OF status ON neo_fin_payment_settlements
WHEN NEW.status='verified' AND OLD.status<>'verified' AND EXISTS (
 SELECT 1 FROM neo_fin_documents d
 WHERE d.organization_id=NEW.organization_id AND d.id=NEW.document_id
 AND d.document_type='payment' AND d.source_kind IN
  ('payroll_payment','vendor_payment','salary_advance_release')
 AND instr(d.source_id,'|')>0
)
BEGIN
 SELECT CASE WHEN NEW.amount_paise<>(
  SELECT d.gross_paise FROM neo_fin_documents d
  WHERE d.organization_id=NEW.organization_id AND d.id=NEW.document_id
 ) THEN RAISE(ABORT,'Legacy payout requires exact full settlement') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM neo_fin_payment_settlements s
  WHERE s.organization_id=NEW.organization_id AND s.document_id=NEW.document_id
   AND s.id<>NEW.id AND s.status='verified'
 ) THEN RAISE(ABORT,'Legacy payout already settled') END;
END;
-- Verified settlements must remain an immutable audit fact. Chargebacks/reversals
-- require separate compensating events, not rewriting bank evidence in place.
CREATE TRIGGER IF NOT EXISTS neo_fin_legacy_payout_verified_immutable
BEFORE UPDATE ON neo_fin_payment_settlements
WHEN OLD.status='verified' AND EXISTS (
 SELECT 1 FROM neo_fin_documents d
 WHERE d.organization_id=OLD.organization_id AND d.id=OLD.document_id
 AND d.document_type='payment' AND d.source_kind IN
 ('payroll_payment','vendor_payment','salary_advance_release')
 AND instr(d.source_id,'|')>0
)
BEGIN SELECT RAISE(ABORT,'Verified legacy payout immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_legacy_payout_verified_no_delete
BEFORE DELETE ON neo_fin_payment_settlements
WHEN OLD.status='verified' AND EXISTS (
 SELECT 1 FROM neo_fin_documents d
 WHERE d.organization_id=OLD.organization_id AND d.id=OLD.document_id
 AND d.document_type='payment' AND d.source_kind IN
 ('payroll_payment','vendor_payment','salary_advance_release')
 AND instr(d.source_id,'|')>0
)
BEGIN SELECT RAISE(ABORT,'Verified legacy payout immutable'); END;

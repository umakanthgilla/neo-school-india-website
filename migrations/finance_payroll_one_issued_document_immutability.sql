-- Neo Finance ONE STAGING ONLY / migration 10.
-- Freeze approved document identity, amounts, currency, source provenance and
-- approval status once issued. A later correction needs an independently
-- reviewed compensating document, never an in-place edit/delete.
-- Existing approved documents may be inserted already approved by an
-- authenticated source adapter; no new draft-only ingestion rule is imposed.
CREATE TRIGGER IF NOT EXISTS neo_fin_document_locked_no_update
 BEFORE UPDATE ON neo_fin_documents
 WHEN OLD.status='approved'
   OR EXISTS(
     SELECT 1 FROM neo_fin_journals j
     WHERE j.organization_id=OLD.organization_id
       AND j.source_kind='document' AND j.source_id=OLD.id
   )
   OR EXISTS(
     SELECT 1 FROM neo_fin_payment_settlements s
     WHERE s.organization_id=OLD.organization_id AND s.document_id=OLD.id
   )
   OR EXISTS(
     SELECT 1 FROM neo_fin_statutory_remittances r
     WHERE r.organization_id=OLD.organization_id
       AND r.finance_document_id=OLD.id
   )
 BEGIN SELECT RAISE(ABORT,'Issued Finance document immutable; use approved compensation'); END;

CREATE TRIGGER IF NOT EXISTS neo_fin_document_locked_no_delete
 BEFORE DELETE ON neo_fin_documents
 WHEN OLD.status='approved'
   OR EXISTS(
     SELECT 1 FROM neo_fin_journals j
     WHERE j.organization_id=OLD.organization_id
       AND j.source_kind='document' AND j.source_id=OLD.id
   )
   OR EXISTS(
     SELECT 1 FROM neo_fin_payment_settlements s
     WHERE s.organization_id=OLD.organization_id AND s.document_id=OLD.id
   )
   OR EXISTS(
     SELECT 1 FROM neo_fin_statutory_remittances r
     WHERE r.organization_id=OLD.organization_id
       AND r.finance_document_id=OLD.id
   )
 BEGIN SELECT RAISE(ABORT,'Issued Finance document immutable; use approved compensation'); END;

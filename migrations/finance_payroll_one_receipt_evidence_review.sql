-- Migration 13: manual receipt evidence review; STAGING ONLY. No cash posting.
CREATE TABLE IF NOT EXISTS neo_fin_receipt_evidence_requests (
 organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
 id TEXT NOT NULL CHECK(length(id) BETWEEN 8 AND 80),
 school_id TEXT NOT NULL, payment_record_id TEXT NOT NULL,
 receipt_no TEXT NOT NULL CHECK(length(trim(receipt_no))>0),
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0),
 source_fingerprint TEXT NOT NULL CHECK(length(source_fingerprint)=64 AND source_fingerprint NOT GLOB '*[^0-9a-f]*'),
 evidence_type TEXT NOT NULL CHECK(evidence_type IN ('bank_reconciled','cash_counted')),
 verification_reference TEXT NOT NULL CHECK(length(trim(verification_reference)) BETWEEN 3 AND 200),
 archive_reference TEXT NOT NULL CHECK(length(trim(archive_reference)) BETWEEN 8 AND 400),
 evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64 AND evidence_sha256 NOT GLOB '*[^0-9a-f]*'),
 settled_at TEXT NOT NULL CHECK(julianday(settled_at) IS NOT NULL),
 requested_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,id)
);
CREATE TABLE IF NOT EXISTS neo_fin_receipt_evidence_decisions (
 organization_id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 review_note TEXT NOT NULL CHECK(length(trim(review_note)) BETWEEN 10 AND 1000),
 reviewed_evidence_sha256 TEXT NOT NULL CHECK(length(reviewed_evidence_sha256)=64 AND reviewed_evidence_sha256 NOT GLOB '*[^0-9a-f]*'),
 reviewed_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,request_id),
 FOREIGN KEY(organization_id,request_id) REFERENCES neo_fin_receipt_evidence_requests(organization_id,id)
);
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_request_validate BEFORE INSERT ON neo_fin_receipt_evidence_requests BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM neo_fin_memberships m JOIN neo_fin_organizations o ON o.id=m.organization_id JOIN neo_fin_auth_accounts a ON a.account_id=m.account_id
  WHERE m.organization_id=NEW.organization_id AND m.account_id=NEW.requested_by AND m.active=1 AND a.active=1 AND o.status='active' AND m.role IN ('owner','finance_admin','accountant'))
 THEN RAISE(ABORT,'Authorized receipt evidence maker required') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM neo_fin_school_ownership o WHERE o.school_id=NEW.school_id AND o.organization_id=NEW.organization_id AND o.effective_to IS NULL AND date(NEW.settled_at)>=date(o.effective_from))
 OR julianday(NEW.settled_at)>julianday('now') THEN RAISE(ABORT,'Owned receipt and valid settlement date required') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_decision_validate BEFORE INSERT ON neo_fin_receipt_evidence_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM neo_fin_receipt_evidence_requests r JOIN neo_fin_memberships m ON m.organization_id=r.organization_id
 JOIN neo_fin_organizations o ON o.id=m.organization_id JOIN neo_fin_auth_accounts a ON a.account_id=m.account_id
 JOIN neo_fin_school_ownership s ON s.school_id=r.school_id AND s.organization_id=r.organization_id AND s.effective_to IS NULL
 WHERE r.organization_id=NEW.organization_id AND r.id=NEW.request_id AND r.requested_by<>NEW.reviewed_by
 AND m.account_id=NEW.reviewed_by AND m.active=1 AND a.active=1 AND o.status='active' AND m.role IN ('owner','finance_admin')
 AND r.evidence_sha256=NEW.reviewed_evidence_sha256 AND date(r.settled_at)>=date(s.effective_from))
 THEN RAISE(ABORT,'Independent authorized receipt evidence review required') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_approve AFTER INSERT ON neo_fin_receipt_evidence_decisions WHEN NEW.decision='approved' BEGIN
 INSERT INTO neo_fin_receipt_verifications(organization_id,verification_id,school_id,payment_record_id,receipt_no,amount_paise,evidence_type,verification_reference,settled_at,verified_at,verified_by,status)
 SELECT organization_id,'MANUAL_RECEIPT_'||id,school_id,payment_record_id,receipt_no,amount_paise,evidence_type,verification_reference,settled_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.reviewed_by,'verified'
 FROM neo_fin_receipt_evidence_requests WHERE organization_id=NEW.organization_id AND id=NEW.request_id;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_request_no_update BEFORE UPDATE ON neo_fin_receipt_evidence_requests BEGIN SELECT RAISE(ABORT,'Receipt evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_request_no_delete BEFORE DELETE ON neo_fin_receipt_evidence_requests BEGIN SELECT RAISE(ABORT,'Receipt evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_decision_no_update BEFORE UPDATE ON neo_fin_receipt_evidence_decisions BEGIN SELECT RAISE(ABORT,'Receipt evidence review immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_receipt_evidence_decision_no_delete BEFORE DELETE ON neo_fin_receipt_evidence_decisions BEGIN SELECT RAISE(ABORT,'Receipt evidence review immutable'); END;

-- Migration 12: append-only staging source-import invocation audit.
-- These records do not certify bank evidence or replace original approvals.
CREATE TABLE IF NOT EXISTS neo_fin_source_requests (
 organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
 id TEXT NOT NULL CHECK(length(id) BETWEEN 8 AND 80),
 action TEXT NOT NULL CHECK(action IN ('invoice','receipt','payout_document','payout','payroll_accrual')),
 source_json TEXT NOT NULL CHECK(json_valid(source_json) AND length(source_json)<=2048),
 requested_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,id)
);
CREATE TABLE IF NOT EXISTS neo_fin_source_attempts (
 organization_id TEXT NOT NULL,
 id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,request_id) REFERENCES neo_fin_source_requests(organization_id,id)
);
CREATE TABLE IF NOT EXISTS neo_fin_source_outcomes (
 organization_id TEXT NOT NULL,
 attempt_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('succeeded','failed')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,attempt_id),
 FOREIGN KEY(organization_id,attempt_id) REFERENCES neo_fin_source_attempts(organization_id,id)
);
CREATE TRIGGER IF NOT EXISTS neo_fin_source_request_authorized BEFORE INSERT ON neo_fin_source_requests BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM neo_fin_memberships m JOIN neo_fin_organizations o ON o.id=m.organization_id
  WHERE m.organization_id=NEW.organization_id AND m.account_id=NEW.requested_by
   AND m.active=1 AND o.status='active' AND m.role IN ('owner','finance_admin','accountant')
 ) THEN RAISE(ABORT,'Source import authority required') END;
 SELECT CASE WHEN NEW.action='payroll_accrual' AND NOT EXISTS (
  SELECT 1 FROM neo_fin_memberships WHERE organization_id=NEW.organization_id
   AND account_id=NEW.requested_by AND active=1 AND role IN ('owner','payroll_admin')
 ) THEN RAISE(ABORT,'Payroll authority required') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_source_request_no_update BEFORE UPDATE ON neo_fin_source_requests
BEGIN SELECT RAISE(ABORT,'Source audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_source_request_no_delete BEFORE DELETE ON neo_fin_source_requests
BEGIN SELECT RAISE(ABORT,'Source audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_source_attempt_no_update BEFORE UPDATE ON neo_fin_source_attempts
BEGIN SELECT RAISE(ABORT,'Source audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_source_attempt_no_delete BEFORE DELETE ON neo_fin_source_attempts
BEGIN SELECT RAISE(ABORT,'Source audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_source_outcome_no_update BEFORE UPDATE ON neo_fin_source_outcomes
BEGIN SELECT RAISE(ABORT,'Source audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_source_outcome_no_delete BEFORE DELETE ON neo_fin_source_outcomes
BEGIN SELECT RAISE(ABORT,'Source audit immutable'); END;

-- Finance ONE ledger projection (STAGING ONLY; do not deploy or backfill blindly).
-- One source event per organization. Daily ledger is a read-only projection of verified cash movements.
CREATE TABLE IF NOT EXISTS neo_fin_cash_events (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  event_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('money_in','money_out')),
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  effective_at TEXT NOT NULL,
  verification_reference TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(organization_id,event_id),
  UNIQUE(organization_id,source_kind,source_id,source_event_id)
);
CREATE INDEX IF NOT EXISTS neo_fin_cash_events_date ON neo_fin_cash_events(organization_id,effective_at,event_id);
-- Never expose direct INSERT/UPDATE/DELETE routes for cash_events to clients.
-- Only privileged, verified receipt and voucher source adapters may insert.
-- Edits must be recorded as new compensating source events (not in-place ledger edits).
CREATE TRIGGER IF NOT EXISTS neo_fin_cash_events_no_update
BEFORE UPDATE ON neo_fin_cash_events BEGIN
 SELECT RAISE(ABORT,'Cash event immutable; use source reversal');
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_cash_events_no_delete
BEFORE DELETE ON neo_fin_cash_events BEGIN
 SELECT RAISE(ABORT,'Cash event immutable; use source reversal');
END;
CREATE VIEW IF NOT EXISTS neo_fin_daily_ledger AS
SELECT organization_id,event_id,source_kind,source_id,direction,amount_paise,effective_at,verification_reference
FROM neo_fin_cash_events;

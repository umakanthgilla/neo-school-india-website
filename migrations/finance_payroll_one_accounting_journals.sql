-- Finance ONE: staging-only double-entry accounting journal, separate from Daily Cash Ledger.
-- All journals originate from verified workflow contracts. No manual ledger write endpoint.
CREATE TABLE IF NOT EXISTS neo_fin_accounts (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  id TEXT NOT NULL, account_code TEXT NOT NULL, account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK(account_type IN ('asset','liability','equity','income','expense')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(organization_id,id), UNIQUE(organization_id,account_code)
);
CREATE TABLE IF NOT EXISTS neo_fin_journals (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  id TEXT NOT NULL, source_kind TEXT NOT NULL, source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted')),
  posted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(organization_id,id), UNIQUE(organization_id,source_kind,source_id),
  CHECK(status='draft' OR posted_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS neo_fin_journal_lines (
  organization_id TEXT NOT NULL, journal_id TEXT NOT NULL,
  line_no INTEGER NOT NULL CHECK(line_no>0), account_id TEXT NOT NULL,
  debit_paise INTEGER NOT NULL DEFAULT 0 CHECK(debit_paise>=0),
  credit_paise INTEGER NOT NULL DEFAULT 0 CHECK(credit_paise>=0),
  PRIMARY KEY(organization_id,journal_id,line_no),
  FOREIGN KEY(organization_id,journal_id) REFERENCES neo_fin_journals(organization_id,id),
  FOREIGN KEY(organization_id,account_id) REFERENCES neo_fin_accounts(organization_id,id),
  CHECK((debit_paise>0 AND credit_paise=0) OR (debit_paise=0 AND credit_paise>0))
);
CREATE INDEX IF NOT EXISTS neo_fin_journal_account_lookup
 ON neo_fin_journal_lines(organization_id,account_id,journal_id);
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_post_balanced
BEFORE UPDATE OF status ON neo_fin_journals
WHEN NEW.status='posted' AND OLD.status='draft'
BEGIN
 SELECT CASE WHEN
 (SELECT COUNT(*) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)<2
 OR (SELECT COALESCE(SUM(debit_paise-credit_paise),0) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)<>0
 THEN RAISE(ABORT,'Journal must balance before posting') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_posted_immutable
BEFORE UPDATE ON neo_fin_journals WHEN OLD.status='posted'
BEGIN SELECT RAISE(ABORT,'Posted journal immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_posted_no_delete
BEFORE DELETE ON neo_fin_journals WHEN OLD.status='posted'
BEGIN SELECT RAISE(ABORT,'Posted journal immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_lines_no_insert_posted
BEFORE INSERT ON neo_fin_journal_lines
WHEN (SELECT status FROM neo_fin_journals WHERE organization_id=NEW.organization_id AND id=NEW.journal_id)='posted'
BEGIN SELECT RAISE(ABORT,'Posted journal immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_lines_no_update_posted
BEFORE UPDATE ON neo_fin_journal_lines
WHEN (SELECT status FROM neo_fin_journals WHERE organization_id=OLD.organization_id AND id=OLD.journal_id)='posted'
 OR (SELECT status FROM neo_fin_journals WHERE organization_id=NEW.organization_id AND id=NEW.journal_id)='posted'
BEGIN SELECT RAISE(ABORT,'Posted journal immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_lines_no_delete_posted
BEFORE DELETE ON neo_fin_journal_lines
WHEN (SELECT status FROM neo_fin_journals WHERE organization_id=OLD.organization_id AND id=OLD.journal_id)='posted'
BEGIN SELECT RAISE(ABORT,'Posted journal immutable'); END;
CREATE VIEW IF NOT EXISTS neo_fin_posted_journal_lines AS
SELECT j.organization_id,j.id AS journal_id,j.source_kind,j.source_id,j.posted_at,
l.line_no,l.account_id,l.debit_paise,l.credit_paise
FROM neo_fin_journals j JOIN neo_fin_journal_lines l
ON l.organization_id=j.organization_id AND l.journal_id=j.id WHERE j.status='posted';

-- Prevent bypassing the balancing trigger by inserting an already-posted header.
CREATE TRIGGER IF NOT EXISTS neo_fin_journal_must_start_draft
BEFORE INSERT ON neo_fin_journals WHEN NEW.status<>'draft'
BEGIN SELECT RAISE(ABORT,'Journal must start as draft'); END;

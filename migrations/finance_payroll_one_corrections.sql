-- Migration 11. Isolated staging only. Full invoice/bill accounting reversal.
-- No cash movement, no payroll reversal, and no change to the original document.
CREATE TABLE IF NOT EXISTS neo_fin_correction_requests (
 organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
 id TEXT NOT NULL,
 journal_id TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
 requested_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,id,journal_id),
 FOREIGN KEY(organization_id,journal_id) REFERENCES neo_fin_journals(organization_id,id)
);
CREATE TABLE IF NOT EXISTS neo_fin_correction_decisions (
 organization_id TEXT NOT NULL,
 request_id TEXT NOT NULL,
 journal_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 review_note TEXT NOT NULL CHECK(length(trim(review_note)) BETWEEN 10 AND 1000),
 reviewed_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,request_id),
 FOREIGN KEY(organization_id,request_id,journal_id)
  REFERENCES neo_fin_correction_requests(organization_id,id,journal_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS neo_fin_one_approved_reversal
 ON neo_fin_correction_decisions(organization_id,journal_id) WHERE decision='approved';
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_request_validate
BEFORE INSERT ON neo_fin_correction_requests BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM neo_fin_memberships m JOIN neo_fin_organizations o ON o.id=m.organization_id
  WHERE m.organization_id=NEW.organization_id AND m.account_id=NEW.requested_by
   AND m.active=1 AND m.role IN ('owner','finance_admin','accountant') AND o.status='active'
 ) THEN RAISE(ABORT,'Correction requester not authorized') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM neo_fin_journals j JOIN neo_fin_documents d
  ON d.organization_id=j.organization_id AND d.id=j.source_id
  WHERE j.organization_id=NEW.organization_id AND j.id=NEW.journal_id
  AND j.status='posted' AND j.source_kind='document' AND d.status='approved'
  AND d.currency='INR' AND d.document_type IN ('sales_invoice','purchase_bill')
 ) THEN RAISE(ABORT,'Only posted INR invoice or bill accruals can be reversed') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM neo_fin_correction_decisions WHERE organization_id=NEW.organization_id
   AND journal_id=NEW.journal_id AND decision='approved'
 ) THEN RAISE(ABORT,'Journal already reversed') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_decision_validate
BEFORE INSERT ON neo_fin_correction_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM neo_fin_correction_requests r
   JOIN neo_fin_memberships m ON m.organization_id=r.organization_id
   JOIN neo_fin_organizations o ON o.id=r.organization_id
  WHERE r.organization_id=NEW.organization_id AND r.id=NEW.request_id
   AND r.journal_id=NEW.journal_id AND r.requested_by<>NEW.reviewed_by
   AND m.account_id=NEW.reviewed_by AND m.active=1
   AND m.role IN ('owner','finance_admin') AND o.status='active'
 ) THEN RAISE(ABORT,'Independent authorized reviewer required') END;
 -- Refuse to compensate a malformed or nonstandard original posting.
 SELECT CASE WHEN NEW.decision='approved' AND NOT EXISTS (
  SELECT 1 FROM neo_fin_journals j JOIN neo_fin_documents d
   ON d.organization_id=j.organization_id AND d.id=j.source_id
  WHERE j.organization_id=NEW.organization_id AND j.id=NEW.journal_id
   AND j.status='posted' AND j.source_kind='document' AND d.status='approved' AND d.currency='INR'
   AND d.gross_paise>0 AND d.gross_paise<=9007199254740991
   AND d.document_type IN ('sales_invoice','purchase_bill')
   AND (SELECT COUNT(*) FROM neo_fin_journal_lines l WHERE l.organization_id=j.organization_id AND l.journal_id=j.id)=2
   AND (SELECT COUNT(*) FROM neo_fin_journal_lines l JOIN neo_fin_accounts a ON a.organization_id=l.organization_id AND a.id=l.account_id
    WHERE l.organization_id=j.organization_id AND l.journal_id=j.id AND a.active=1 AND (
     (l.line_no=1 AND l.debit_paise=d.gross_paise AND l.credit_paise=0 AND
      ((d.document_type='sales_invoice' AND a.account_code='1100' AND a.account_type='asset') OR
       (d.document_type='purchase_bill' AND a.account_code='5200' AND a.account_type='expense')))
     OR (l.line_no=2 AND l.credit_paise=d.gross_paise AND l.debit_paise=0 AND
      ((d.document_type='sales_invoice' AND a.account_code='4000' AND a.account_type='income') OR
       (d.document_type='purchase_bill' AND a.account_code='2000' AND a.account_type='liability')))
    ))=2
 ) THEN RAISE(ABORT,'Original accrual requires reconciliation') END;
END;
-- One SQL statement commits review + compensation together, or rolls back all.
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_post
AFTER INSERT ON neo_fin_correction_decisions WHEN NEW.decision='approved' BEGIN
 INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id)
 VALUES(NEW.organization_id,'REV|'||NEW.request_id,'approved_correction',NEW.request_id);
 INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise)
 SELECT organization_id,'REV|'||NEW.request_id,line_no,account_id,credit_paise,debit_paise
 FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.journal_id;
 UPDATE neo_fin_journals SET status='posted',posted_at=NEW.created_at
 WHERE organization_id=NEW.organization_id AND id='REV|'||NEW.request_id;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_request_no_update BEFORE UPDATE ON neo_fin_correction_requests
BEGIN SELECT RAISE(ABORT,'Correction audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_request_no_delete BEFORE DELETE ON neo_fin_correction_requests
BEGIN SELECT RAISE(ABORT,'Correction audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_decision_no_update BEFORE UPDATE ON neo_fin_correction_decisions
BEGIN SELECT RAISE(ABORT,'Correction audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_decision_no_delete BEFORE DELETE ON neo_fin_correction_decisions
BEGIN SELECT RAISE(ABORT,'Correction audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_journal_authorized
BEFORE INSERT ON neo_fin_journals WHEN NEW.source_kind='approved_correction' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM neo_fin_correction_decisions c
  WHERE c.organization_id=NEW.organization_id AND c.request_id=NEW.source_id
   AND c.decision='approved' AND NEW.id='REV|'||c.request_id)
 THEN RAISE(ABORT,'Approved correction required') END;
END;
CREATE TRIGGER IF NOT EXISTS neo_fin_correction_journal_exact
BEFORE UPDATE OF status ON neo_fin_journals
WHEN NEW.source_kind='approved_correction' AND NEW.status='posted' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM neo_fin_correction_decisions c
  WHERE c.organization_id=NEW.organization_id AND c.request_id=NEW.source_id
   AND c.decision='approved' AND NEW.id='REV|'||c.request_id AND NEW.posted_at=c.created_at
   AND (SELECT COUNT(*) FROM neo_fin_journal_lines WHERE organization_id=NEW.organization_id AND journal_id=NEW.id)=2
   AND (SELECT COUNT(*) FROM neo_fin_journal_lines r JOIN neo_fin_journal_lines original
    ON original.organization_id=r.organization_id AND original.journal_id=c.journal_id
     AND original.line_no=r.line_no AND original.account_id=r.account_id
     AND original.debit_paise=r.credit_paise AND original.credit_paise=r.debit_paise
    WHERE r.organization_id=NEW.organization_id AND r.journal_id=NEW.id)=2)
 THEN RAISE(ABORT,'Correction must exactly reverse approved original') END;
END;

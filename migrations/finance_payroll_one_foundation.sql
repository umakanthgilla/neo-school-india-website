-- NEO Finance & Payroll ONE | foundation migration (NOT DEPLOYED)
-- Additive tables only. Never infer that school_id is the legal owner.
-- Run only after reviewing D1 configuration, historic data and tenant authorization.
CREATE TABLE IF NOT EXISTS neo_fin_organizations (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK(organization_type IN ('head_office','independent_center')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS neo_fin_school_ownership (
  school_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  CHECK(effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS neo_fin_ownership_org ON neo_fin_school_ownership(organization_id);
CREATE TABLE IF NOT EXISTS neo_fin_memberships (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','finance_admin','payroll_admin','accountant','auditor','employee')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(organization_id,account_id,role)
);
CREATE INDEX IF NOT EXISTS neo_fin_member_account ON neo_fin_memberships(account_id,active);
CREATE TABLE IF NOT EXISTS neo_fin_parties (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  party_type TEXT NOT NULL CHECK(party_type IN ('customer','vendor','both')),
  related_organization_id TEXT REFERENCES neo_fin_organizations(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(organization_id,id)
);
CREATE TABLE IF NOT EXISTS neo_fin_documents (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK(document_type IN ('sales_invoice','purchase_bill','credit_note','debit_note','receipt','payment','journal','payroll_liability')),
  party_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','void')),
  currency TEXT NOT NULL DEFAULT 'INR',
  gross_paise INTEGER NOT NULL CHECK(gross_paise >= 0),
  source_kind TEXT,
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(organization_id,id),
  FOREIGN KEY (organization_id,party_id) REFERENCES neo_fin_parties(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS neo_fin_source_unique ON neo_fin_documents(organization_id,document_type,source_kind,source_id) WHERE source_kind IS NOT NULL AND source_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS neo_fin_payment_settlements (
  organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
  id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  bank_reference TEXT,
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  status TEXT NOT NULL CHECK(status IN ('pending','verified','failed','reversed')),
  verified_at TEXT,
  voucher_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(organization_id,id),
  FOREIGN KEY(organization_id,document_id) REFERENCES neo_fin_documents(organization_id,id),
  CHECK(status <> 'verified' OR (bank_reference IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS neo_fin_verified_reference ON neo_fin_payment_settlements(organization_id,bank_reference) WHERE bank_reference IS NOT NULL AND status='verified';
CREATE UNIQUE INDEX IF NOT EXISTS neo_fin_settlement_voucher ON neo_fin_payment_settlements(organization_id,voucher_id) WHERE voucher_id IS NOT NULL;
-- No financial write API is enabled in this migration.
-- All API reads/writes must resolve the authenticated account's membership server-side.
-- Never accept client-provided organization_id as authorization.
-- Do not copy or automatically share a counterparty's financial records.

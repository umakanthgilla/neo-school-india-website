-- Finance ONE staging only.
CREATE TABLE IF NOT EXISTS neo_fin_payroll_statutory_reviews (
 organization_id TEXT NOT NULL REFERENCES neo_fin_organizations(id),
 school_id TEXT NOT NULL,
 payroll_record_id TEXT NOT NULL,
 payroll_month TEXT NOT NULL,
 policy_reference TEXT NOT NULL,
 source_fingerprint TEXT NOT NULL CHECK(length(source_fingerprint)=64),
 reviewed_by TEXT NOT NULL,
 reviewed_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status='approved'),
 employee_pf_paise INTEGER NOT NULL DEFAULT 0 CHECK(employee_pf_paise>=0),
 employee_esi_paise INTEGER NOT NULL DEFAULT 0 CHECK(employee_esi_paise>=0),
 professional_tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(professional_tax_paise>=0),
 tds_paise INTEGER NOT NULL DEFAULT 0 CHECK(tds_paise>=0),
 employer_pf_paise INTEGER NOT NULL DEFAULT 0 CHECK(employer_pf_paise>=0),
 employer_esi_paise INTEGER NOT NULL DEFAULT 0 CHECK(employer_esi_paise>=0),
 PRIMARY KEY(organization_id,school_id,payroll_record_id)
);
CREATE TRIGGER IF NOT EXISTS neo_fin_payroll_review_no_update BEFORE UPDATE ON neo_fin_payroll_statutory_reviews BEGIN SELECT RAISE(ABORT,'Payroll review immutable'); END;
CREATE TRIGGER IF NOT EXISTS neo_fin_payroll_review_no_delete BEFORE DELETE ON neo_fin_payroll_statutory_reviews BEGIN SELECT RAISE(ABORT,'Payroll review immutable'); END;

# Neo School India — Finance & Payroll Hub Implementation Plan
Date: 2026-10-09
Status: planning / audit only. No financial production behavior changed.
Repository: umakanthgilla/neo-school-india-website
Backend inspected: worker/neo-lead-crm-api-worker-transport-phase1.js

## Non-negotiable continuity
- Reuse existing staff/Staff ID, HR salary setup, staff attendance, leave, salary advance and finance voucher infrastructure.
- Finance daily_accounts remains read-only.
- Money In originates from receipts, Money Out from verified voucher payments; no duplicate manual ledger posts.
- Preserve existing production operations, numbering and historical records.

## Code-confirmed baseline (static read of main)
- Kinds include staff, staff_attendance, payroll, staff_leave, salary_advances, salary_setup, hr_rules, daily_accounts, vouchers and ledger.
- Salary setup by effective date is consulted in payroll calculation.
- Payroll draft calculation refers to attendance and released/partially recovered advances.
- Head-office PATCH approval transitions payroll Draft -> Approved and Approved -> Paid, with attendance_complete requirement at approval.
- Advance release emits finance-linked voucher and notifications.
- daily_accounts writes are rejected, but another kind called ledger exists and has a manual verification flow. Review the distinction and risk of duplicate monetary effects.
These are code findings, NOT a live production verification.

## Agreed architecture
One integrated database and payroll service; separate Finance & Payroll navigation and role-aware dashboard. Support Head Office oversight with tenant/organization/branch-scoped permissions from the outset. Franchise-owner finance access is optional and must be explicitly permissioned. Staff self service reuses the employee HR desk.

## First implementation slice — safe audit and contracts
1. Enumerate and document employee, salary, attendance, advance, payroll, voucher and daily ledger schemas and permissions.
2. Map all finance posting sources and unique idempotency keys. Identify and close duplicates WITHOUT deleting historical records.
3. Define pay cycle and employee unique keys: (organization, branch, month, staff_id, run_version).
4. Draft statuses: Draft -> Reviewed -> Approved -> Payment Pending -> Partially Paid / Paid; Rejected / Voided through audited exception flows. Separate computed liabilities from cash-out postings.
5. Bank confirmation is required before representing funds as disbursed; support failed/pending transfers and reconciliation.
6. Keep bank details access controlled and audit every payroll-change, approval and disbursement action.

## Follow-up feature slices
- Attendance/leave exceptions and monthly payroll preview.
- Salary components, salary revision history, advances recovery and reimbursements.
- Payroll review/approval, bank export/import, payment status, automatic vouchers and no-duplicate daily ledger posting.
- Role-based dashboard, employee payslips, salary letters and notifications.
- Telangana/India employment statutory rules as versioned, configurable rules with accountant verification, rather than guessed static rates.
- Consolidated cost center, franchise owner scoping and school-wise forecasts.
- AI explanations only after deterministic payroll and compliance are proven.

## QA gates
- Existing HR, receipts, vouchers, ledger and student/school operations do not regress.
- No duplicate voucher or cash ledger posting for retry/reload.
- Draft or approval alone cannot show salary as bank paid.
- Unauthorized school/employee cannot read another staff or branch salary.
- Partial/failed transfers do not show as fully paid.
- Salary advance recovery bounded by unrecovered balance.
- Audit trail records actor, action, before/after, timestamp; payslip totals reconcile.
- Mobile screen layouts and export accessibility.

Next work should begin with read-only code-level mapping and tests on a separate branch before financial logic is touched in main.

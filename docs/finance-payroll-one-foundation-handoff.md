# Finance & Payroll ONE — Foundation Handoff

Status: development only; migration NOT deployed; production NOT changed.

## Business isolation
- HO is an independent business.
- Every center is an independent business, with the same available finance and payroll capabilities.
- A business owns its payroll, ledger, bank, expenses, staff, customer and vendor records.
- Relationships between HO and centers are commercial documents only (orders, invoices, balances, payments); no copying or automatic sharing of private ledgers.
- No HO access to center private finance solely by virtue of network administration.
- All finance queries and updates must authenticate and authorize organization membership SERVER-SIDE.

## Existing code findings
Source: worker/neo-lead-crm-api-worker-transport-phase1.js in main.
- Existing neo_portal_records uses PRIMARY KEY(school_id,kind,id).
- Existing kinds include payroll, salary_setup, staff_attendance, staff_leave, salary_advances, vouchers and daily_accounts.
- Draft -> Approved -> Paid payroll exists; inspected Paid transition does not require settlement verification.
- Daily accounts are designed read-only.
- Existing production system has not been migrated to tenant-level financial ownership.

## Added in this branch
migrations/finance_payroll_one_foundation.sql:
- Organizations with HO/center type.
- School ownership mapping.
- Account memberships and role model.
- Per-organization customers/vendors.
- Per-organization financial documents.
- Payment settlement references and unique voucher linkage.

## REQUIRED gates before running SQL in production
1. Verify D1 foreign key enforcement and test all statements on a copy/staging database.
2. Establish true owner/legal entity mapping for every existing school. Never infer it solely from school_id or HO admin status.
3. Document and test permissions for owner, finance_admin, payroll_admin, accountant, auditor and employee; API must reject cross-org access even with fabricated IDs.
4. Determine whether HO invoices and center purchases are independent reciprocal records, with explicit customer-side acknowledgement. Avoid blind mirroring.
5. Define verified bank statement matching/reversal workflow and idempotent posting to existing voucher + read-only ledger.
6. Confirm how historic payroll, advances and salary setup are allocated before any migration.
7. Evaluate compliance scope (entity-specific EPF, ESIC, PT, TDS, GST) and get a local accountant review.
8. No live payments, payroll mark-as-paid changes, or live feature enablement before comprehensive reconciliation tests.

## Next implementation sequence
1. Data ownership classification and authorization middleware, unit tests.
2. Organization-scoped chart of accounts, financial journal and read models (staging only).
3. Payroll period snapshot, earnings/deductions, drafts, approvals and audit logs.
4. Verified payouts, settlement reconciliation, payout/voucher idempotency.
5. Separate Finance/Payroll portal UI with identical feature availability for HO and each center.
6. Compliance, document management, forecasting and intelligent alerts.

## Acceptance tests
- Cross-organization record reads and writes rejected with 403.
- No organization ID trust from client requests.
- Same source event cannot create two financial documents or two voucher postings.
- Payroll Approved does not imply Paid.
- Bank failure/reversal must not show fully reconciled settlement.
- Report totals calculated only from logged-in business's data.
- Existing Neo School India school/teacher/parent workflows and prior curriculum unchanged.

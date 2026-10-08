# Neo School India — Finance & Payroll Hub (Phase 1 Audit / Implementation Lock)

Date: 2026-10-09
Status: Architecture + gap audit; NO payroll production behavior changed.

## Sources checked
- Existing Worker: worker/neo-lead-crm-api-worker-transport-phase1.js on main
- Existing frontend: index.html on main
- User-provided Zoho Payroll feature reference.
- Historical architecture: Staff IDs, HR Salary Setup, Attendance, Leave, Salary Advance, Voucher, read-only Daily Ledger.

## Verified backend capabilities
- Portal record kinds include staff, staff_attendance, salary_setup, hr_rules, payroll, staff_leave, salary_advances, vouchers, daily_accounts and ledger.
- Salary setup uses staff ID, monthly_salary_paise and effective_from.
- Payroll has draft creation/calculation and a Draft -> Approved -> Paid status sequence.
- Approval checks attendance_complete and admin role.
- Salary advance follows Pending -> Approved/Rejected -> Released, with outstanding/recovered fields.
- Daily Ledger rejects direct writes as read-only.
- Data resides under school_id keyed portal records.

## Verified gap / blocking risk
- Payroll 'Paid' transition checks Approved status and admin role but the inspected transition does not validate bank settlement proof/payment reference before marking Paid. Investigate other workflows before changing behavior.
- Full statutory payroll coverage (PF/ESI/PT/TDS), payroll bank reconciliation, payslip publication, per-employee payroll audit trails, independent maker/checker payment roles, and multi-tenant cost ownership are NOT established by this focused audit.
- Website index.html is the public-facing site; do not add confidential payroll details to public routes.

## Locked implementation rules
1. Reuse staff IDs, salary setup, attendance, leave, advance, vouchers and ledger. No duplicate employee masters.
2. Separate Finance and Payroll portal views, shared authenticated backend and school-scoped access.
3. Franchise school and HO financial ownership must be explicit and configurable.
4. Draft calculation != approval != disbursement != reconciliation.
5. Record salary liability separately; no Money Out on salary calculation or approval.
6. Confirmed paid amounts generate voucher-backed Money Out exactly once, using unique idempotency keys and verifiable bank/payment reference.
7. Partial payment/failed bank transactions must not be incorrectly marked fully Paid.
8. Salary edits and approvals must be separated by role; protect bank details, payroll amounts and logs.
9. Compliance calculations require versioned effective-date rules and accountant sign-off before release.
10. All changes backward-compatible and feature-flagged; preserve existing financial records and existing site UI.

## Implementation sequence
### Phase 1: audit and contract
- Enumerate portal routes and DB structure for payroll/attendance/advances/vouchers.
- Map relevant school IDs, HO/franchise ownership, roles, voucher posting behavior.
- Define payroll period and line-item entities, financial invariants, migrations and test fixtures.
- Add authorization/feature flags and audit logs without changing current payroll paths.

### Phase 2: safe computation
- Reusable attendance snapshot and attendance exceptions.
- Salary structure versioning, earnings/deductions/LOP/arrears and advance recovery.
- Dry-run parallel payroll and reconciliation against historical records.

### Phase 3: approval + bank settlement
- Maker/checker/releaser controls; approval snapshot locking.
- Bank file/export or provider integration; settlement import and verification.
- Per-employee payment state, unique voucher issuance only after confirmed settlement.
- Failed/partial/reversed payment handling.

### Phase 4: portal + statutory reporting
- Head Office Finance dashboard and Payroll dashboard.
- Branch-scoped access, employee self-service payslips, PDF reports.
- Statutory engine with expert-reviewed rules and effective dates.
- Forecasting, anomaly flags and optional AI reporting, without AI approving payouts.

## Minimum acceptance tests
- Unauthorized school/user cannot access other school payroll.
- Missing/invalid attendance blocks final approval according to policy.
- Re-running a payroll period cannot duplicate advances, payouts, vouchers or ledger entries.
- Approved payroll without verified payment remains unpaid and creates no Money Out.
- Partial/failure bank result leaves correct outstanding amounts.
- Backdated salary changes do not mutate locked paid periods.
- Monthly totals reconcile payroll -> verified disbursements -> vouchers -> ledger.
- Existing schools, employee HR desk, fee receipts and daily ledger remain unchanged.

Next safe action: detailed route/schema audit and feature-flagged implementation branch. Do not enable real payouts without review.

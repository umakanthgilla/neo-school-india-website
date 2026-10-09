# Finance ONE — Pre-release gate (updated 2026-10-09)

## Preserved contract
- One entry at the source; no separate manual cash ledger entries.
- Immutable read-only daily cash projection after verified source posting.
- Independent financial ownership per HO/center; no cross-center or HO access to a center's private books.
- Existing school UI, staff, vouchers, fee receipts, ledger and payroll remain unchanged unless migration/testing approved.

## Current implementation reality
Code modules exist in worker/finance-one for tenant memberships, cash event mapping, reconciliation, idempotent event writes, settlement verification.
They are NOT connected to production Worker, NOT an end-to-end finance portal, and no staging environment has been verified.
GitHub tests have been authored but passing CI or deployed D1 migrations are not established.

## Critical blockers before a usable testing link
1. Node tests must pass (organization-access, cash-projection, reconciliation, atomic-posting, settlement-source-verifier).
2. Execute both SQL migration files on disposable D1/SQLite staging; confirm foreign keys, unique indexes and immutable triggers.
3. Resolve ownership map of each school to its independent legal business without granting HO private data access.
4. Implement authenticated server-side API routes using the membership guard.
5. Implement a trusted receipt verifier and connect to existing fee receipt source (no client-provided verified flags).
6. Implement vendor/payroll/advance voucher source contracts and approved settlement states. Confirm per-employee partial/failure/reversal rules.
7. Verify no double posting, including concurrent duplicate deliveries, altered amount retries, network failures and rollback.
8. Integrate accounting documents/journals and source vouchers without duplicating existing ledger entries.
9. Ensure money in/out only on verified receipt/payment; liability/accrual separate from cash ledger.
10. Test UI with HO, Center A, Center B identities; every business can use the same full feature set with separate data.
11. Complete compliance and bank integrations with accountant-approved rules before real payment handling.
12. Performance, backup/recovery, audit, security and accountant signoff before production.

## Fixed in latest development
- A duplicate event identity with a changed amount/direction/reference now triggers a reconciliation error instead of silently returning 'not created'.

## Do not claim ready for testing
Until a real staging URL and test execution are verified, the work remains implementation-in-progress.

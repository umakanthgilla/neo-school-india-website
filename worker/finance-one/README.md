# Finance & Payroll ONE — Staging Accounting Foundation

**Status:** Functional development components, not production-deployed. No change to the live Neo School India Worker or Daily Ledger.

## Immutable business rules
1. HO and every independent Center have their own organization-scoped finance, payroll and bank records.
2. No organization or HO admin may read another organization's private financial data merely because of its franchise relationship.
3. Transactions enter only through their originating module. No manual Daily Cash Ledger entry.
4. Verified payment/receipt becomes one cash event; journal postings must not create a second cash event.
5. Invoices, vendor bills and payroll liabilities accrue in accounting without posting Cash Money In/Out.
6. Duplicate IDs with different amounts must error instead of silently overwriting. Posted journal lines are immutable.
7. Original Neo School India HR, receipt, voucher, ledger and curriculum modules remain intact.

## Added in this milestone
- `accounting-chart.mjs`: authorized per-business chart initialization, safe retry/conflict checks.
- `source-journal.mjs`: verified cash event -> balanced double-entry journal.
- `accrual-journal.mjs`: approved invoices, purchase bills, salary liabilities -> accounting journals without cash event.
- `sync-verified-payout.mjs`: approved and verified bank payout -> unique cash event -> balanced journal; safe idempotent retry.
- `finance-reports.mjs`: private business trial balance, Money In/Out, P&L.
- `journal-recovery.mjs`: find and repair unposted cash journals within one business, no cash duplication.

## Local verification
- Node v22.16 and node:sqlite fixtures: **27/27 tests passed** across six newly added suites (not all GitHub module tests).
- Workflow `.github/workflows/finance-one-tests.yml` discovers `worker/finance-one/*.test.mjs`.
- CI result on GitHub, full migration fixture compatibility, D1 deployment and real-bank settlement verification have **not** yet been established.

## Correctness and accounting-policy gates
- Current fee collection journal offsets Accounts Receivable (assumes an invoice journal has already recognized the income). This must be verified against the real invoicing workflow.
- Purchase bills currently map to a generic cost-of-goods account; expense/stock/asset and GST mapping will need configurable, CA-approved accounting policies.
- Bank/cash clearing currently uses a generic system account, not a live bank-specific account.
- The cash and journal inserts are separately idempotent, not one combined transaction; run an authenticated scheduled recovery job and reconcile before launch.
- Payroll Paid state in the existing production Worker is not a confirmed bank settlement. Do not connect real payroll payouts until transition rules are corrected.
- Complete India payroll compliance and statutory filing features, final portal UI and Cloudflare staging deployment are not represented by this milestone.

## Validation command
```bash
node --experimental-sqlite --test worker/finance-one/*.test.mjs
```

Do not merge this branch into main or apply migrations to production without full staging and security review.

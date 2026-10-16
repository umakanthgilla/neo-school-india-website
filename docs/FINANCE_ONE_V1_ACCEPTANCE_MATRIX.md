# Current acceptance status — 16 October 2026

**Client production: NO GO.** Implemented, synthetic-tested and cloud-tested are
different states. This table supersedes the historical baseline below.

| Area | Implemented / synthetic evidence | Actual cloud acceptance / remaining gate |
|---|---|---|
| Independent Center/HO books | Tenant permissions, immutable postings and source-only cash rules tested | Maker/checker own reads and cross-Center/HO denial passed; reader/HO full suites incomplete |
| Authentication | Dedicated Finance sessions, rate limits, logout revocation; optional explicitly linked Access identity login added and tested | Access login runtime fix deployed as 3f1692d2; 29 protected cloud smoke checks passed for QA Center A owner, including logout replay denial; independent maker/checker and remaining role journeys still pending |
| Schema | Migrations 1–13, fail-closed audit/correction/evidence guards tested | Migration 11/12 objects checked on staging and restore-check; migration 13 receipt evidence review is NOT remotely applied |
| Receipts / vouchers / ledger | Existing-source verifiers, settlement evidence prerequisites, no duplicate cash or school Ledger writes tested | Manual receipt evidence request/independent approval and source import are implemented/synthetic-tested; payout evidence intake and financial cloud journeys incomplete; operations remain OFF |
| School source integration | Separate read-only school binding supports invoices, receipts, payroll and all three payout types; two physical SQLite databases tested | New isolated source D1/binding and exact deployed code need verification; no live school binding authorized |
| Payroll | Explicit statutory review including nil deductions, accrual/settlement/advance recovery and journal recovery tested | Employer inputs, calculations/applicability/filing evidence and accountant acceptance missing |
| Corrections | Full invoice/bill accrual reversal with independent decision, atomic compensating journal and audit trail tested | Cloud maker/checker journey incomplete; cash refunds, payroll reversals, partial/source corrections remain incomplete |
| Reports / operations UI | Read-only summary, reconciliation, trial-balance CSV/print and snapshot-paged cash ledger CSV (up to 10,000 entries); stale-response/logout privacy tested | Actual client financial/mobile/print acceptance incomplete |
| Backup / restore | Populated disposable SQLite restore test; actual empty-financial-data D1 snapshot restored and matched | Populated financial Cloudflare D1 restore rehearsal still required |
| Bank reconciliation | Manual reconciliation procedure written; automatic matching deferred | Manual receipt evidence review implemented with retained-file fingerprint and independent checker; cloud/client evidence retention and period reconciliation acceptance still required |
| Build / handover | 391 local Node/SQLite tests passed for receipt evidence review candidate; exact-commit CI tracks browser/build/handover | CI is synthetic evidence; neither a deployment nor client acceptance |
| Production release | Current entrypoint intentionally rejects production; PR #26 stays draft | Review production configuration, accepted UAT/security/accounting checks, backup/rollback and exact final authorization required |

Latest cloud proof: [16 October protected staging evidence](FINANCE_ONE_V1_STAGING_EVIDENCE_2026-10-16.md). Ledger export passed three empty-book cloud exports on version 20fc9813; populated multi-page cloud acceptance remains pending. Receipt evidence migration 13 and its separate feature flag remain OFF/not deployed. No migration is required for this read-only export.

See [15 October remote evidence and blockers](FINANCE_ONE_STAGING_EVIDENCE_2026-10-15.md),
[optional Access login](FINANCE_ONE_V1_ACCESS_LOGIN.md), and
[separate school source setup and limits](FINANCE_ONE_V1_SEPARATE_SCHOOL_SOURCE.md).

## Historical baseline — retained for traceability

> Migration 12 added audited source-import operations; receipt reversal races and correction reconciliation are covered. The older counts and missing-feature statements below are historical and do not override the current table above.

> **13 October 2026 update:** This is a historical baseline. Staging now responds behind Cloudflare Access. Candidate migration 11 adds reviewed invoice/bill accrual corrections; all payrolls now require statutory review, including nil deductions. Production is still NO GO. See [current go-live review](FINANCE_ONE_V1_GO_LIVE_REVIEW_2026-10-13.md) for current evidence, limitations and gates.

# NEO FINANCE & PAYROLL ONE — V1 ENGINEERING ACCEPTANCE MATRIX
**Date:** 2026-10-09
**Status:** Engineering source handoff; **NOT cloud staging or production acceptance**.
**Owner's choice:** Bank-statement verification/import/matching explicitly V2.

**Result key:** CI = automated Node 22 / SQLite simulation passed. CLOUD = not executed in a real isolated Cloudflare staging environment. PROD = prohibited until separately accepted.

| # | Area / required test | Expected behaviour | Current evidence / remaining action |
|---|---|---|---|
| A01 | Branch/production separation | Existing Neo School India `main`, Worker, School/Teacher/Parent/HO, Daily Ledger, receipts/vouchers untouched | CI/source changes confined to feature branch; **CLOUD/PROD not deployed** |
| A02 | Independent legal tenants | Center A Finance credentials cannot read Center B or HO books; HO cannot see Center books | CI authorization/HTTP checks; **CLOUD retest** |
| A03 | Separate Finance login | Legacy School/HO session not accepted; signed Finance token required | CI; **CLOUD provisioning pending** |
| A04 | Staging-only Worker | Production environment and disabled feature flag return 404 | CI; **CLOUD retest** |
| A05 | Brute force resistance | Account lockout plus native 20/IP and 8/account per 60s; binding failure denies login | CI; **CLOUD WAF/Access/MFA/reset pending** |
| A06 | Individual session logout | One device's signed token immediately revoked server-side; other device unaffected | CI with migration 9; **CLOUD retest** |
| A07 | 10 SQL migrations | Exact ordering, new issued-document lock triggers; missing migration blocks preflight | CI Node/SQLite; **real staging D1 pending** |
| A08 | Approved documents | Source, owner, amount, currency, status and identity immutable; linked draft also locked | CI with migration 10; **CLOUD retest** |
| A09 | Original source idempotency | Reimport same validated invoice/payroll/payout does not duplicate Finance document or journal | CI; **real source adapters/UAT pending** |
| A10 | No fabricated money movements | Approved payroll/invoice, Paid voucher or Released advance alone does NOT create cash | CI; **real independently-verified settlement feed pending** |
| A11 | Verified receipt and payout | Verified actual source event posts one Cash Ledger event and balanced journal; retry idempotent | CI; **CLOUD real-source evidence pending** |
| A12 | Ledger integrity | No direct Cash Ledger edits; posted journals immutable; no duplicate event | CI/SQL triggers; **CLOUD retest** |
| A13 | Cash↔Bank journal reconciliation | Wrong Bank amount/direction, missing/draft/orphan/contra mapping rejects business readiness | CI; **CLOUD retest** |
| A14 | Invoice/payroll accrual audit | Missing/draft/orphan/wrong invoice journal and wrong payroll lines reject readiness | CI; **CLOUD retest** |
| A15 | Payroll statutory review | Reviewed PF/ESI/PT/TDS source fingerprint and approved amounts match salary/payable journal exactly | CI; **accountant approval pending** |
| A16 | Statutory remittance | Approved internal payable against full verified voucher; prevent overclear and double cash | CI; **not government filing evidence** |
| A17 | Reports & Portal | Authenticated read-only money in/out, summary, trial balance, documents and independent-business warnings | CI browser-like tests; **desktop/mobile CLOUD UAT pending** |
| A18 | Async portal privacy | Logout clears confidential rows; stale responses/401 cannot cross sessions | CI; **CLOUD retest** |
| A19 | Schema/business preflight | Prepare with flag OFF, active after flag ON; account and reconciliation blockers enforced | CI; **real staging operator flow pending** |
| A20 | Release packaging | Cloudflare Wrangler bundles Worker+portal assets with Worker-first asset routing, without deployment | CI dry-run; **not equivalent to public URL** |
| A21 | Correction/reversal | Original posted record stays immutable; reviewed compensating/credit note workflow required for corrections | **NOT IMPLEMENTED — release blocker** |
| A22 | Finance operator source approvals & audit identities | Authorized roles and approval lifecycle with audited reviewer identities | **INCOMPLETE — release blocker** |
| A23 | Statutory compliance | PF/ESI/PT/TDS calculations, government filings/challan confirmation, CA/legal sign-off | **INCOMPLETE — release blocker** |
| A24 | Bank statement auto matching | CSV/open banking imports, statement-to-transaction reconciliation | **DEFERRED TO VERSION 2 — NOT A V1 GATE** |
| A25 | Full Finance/Payroll user journey | Real user creates/approves original payroll and invoice, accrues, verifies money, reconciles, prints reports | **CLOUD UAT NOT STARTED; no staging URL** |
| A26 | Production merge/deploy | Written acceptance, backups, rollback, migrations/security/compliance review | **NO GO — do not merge/deploy** |

## Minimum receiver verification steps

1. In `umakanthgilla/neo-school-india-website`, fetch branch `feature/finance-payroll-one-foundation` and pin the SHA from the handover artifact's `MANIFEST.txt`.
2. Run `node --experimental-sqlite --test worker/finance-one/*.test.mjs` on Node 22: zero failures, compare exact SHA with green GitHub CI.
3. Inspect `wrangler.finance-one.staging.toml.example`: the Finance flag must default to `false`, Worker-first Assets required, two native rate limit bindings declared, D1 UUID **placeholder** only.
4. In the **separate operator-owned staging D1**, apply migrations 1–10. Run `financeOneStagingPreflight` prepare phase before enabling Finance routes.
5. Provision actual Finance user only through reviewed internal flow. Exercise two independent Centers and HO (denied cross-company access).
6. Check original-school ownership, immutable journals, real verified source evidence, ledger idempotency, stale session logout, cash and accrual audit warnings.
7. Request accountant review for payroll source deduction and India statutory liability/remittance handling. Test corrections as **not supported** until safe compensating workflows exist.
8. Only then run real mobile/desktop Cloudflare staging UAT; record unresolved issues and written user acceptance. Never interpret automated tests as completion of this step.

## Responsible handoff statement

**Engineering source code + technical test baseline are ready for handover.** There is **no deployed staging service**, no verified bank feed or statement reconciliation, no sign-off on India statutory rules, no complete user-accepted payroll product and **no permission to deploy production**.

Only the V2 bank-statement feature is explicitly deferred; other safety/UAT/compliance dependencies cannot be silently waived.

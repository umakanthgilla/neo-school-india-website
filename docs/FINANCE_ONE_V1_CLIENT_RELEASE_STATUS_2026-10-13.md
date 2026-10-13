# Finance & Payroll ONE — client release status, 13 October 2026

**Decision: NO GO for client production.** This continuation adds verified engineering functionality; it does not certify protected Cloudflare staging, statutory compliance or client acceptance. PR #26 remains draft. No production database, production deployment or merge was performed.

Repository: `umakanthgilla/neo-school-india-website`; branch: `feature/finance-payroll-one-foundation`. Original starting SHA: `85d6cf1eb8aa740cce6a61c3f04f08dab680ecee`. Rebased onto latest handover SHA `ccbbcb6066a3f3b3d94629465336799e0f11a1c6`, preserving its fail-closed correction schema/index check and regression test. Starting PR CI run `38390260395` was green; all 337 baseline Node/SQLite tests passed locally. Use the final commit and its CI run recorded below, not this starting SHA, for the new candidate.

## What changed

1. Added authenticated, staging-only source import API and operational form for existing fee invoices, verified receipts, payout documents, verified vendor/payroll/advance payouts and approved payroll accruals. Reuses existing adapters and original `neo_portal_records`; does not recreate source modules or write the legacy Daily Ledger. Inputs are original identifiers only, never amounts, actors, approved flags or evidence certification.
2. Added migration **12**, `finance_payroll_one_source_operations.sql`: immutable requests, attempts and outcomes, recording actual authenticated actor, source identifiers and timestamps. Request-ID content/actor conflicts are rejected. An audit attempt must be persisted before posting. Missing audit tables/triggers disable import writes. Incomplete outcome recording remains visible as unconfirmed; retries rerun original validation and idempotent posting. An import failure is not a promise that no cash mirror was written: journal recovery/reconciliation is required.
3. New flag `FINANCE_ONE_SOURCE_OPERATIONS_ENABLED=false` by default. Existing correction flag stays independent. Both remain staging-only behind the existing Finance authentication and organization membership controls. Payroll accrual requires both Finance write access and payroll write access (owner or appropriately combined memberships); general Finance administration alone cannot accrue payroll.
4. Closed reversal/receipt ordering gap: a reversed invoice cannot be reimported as a successful active accrual or receive a new verified receipt. The reversal check is repeated inside the cash INSERT, so a correction approved between validation and insertion prevents new cash posting. Original journals and documents remain unchanged.
5. Extended accrual reconciliation to detect missing, invalid, mismatched and orphan correction journals. Existing reports still include the original and compensating postings.
6. Added visible all-time trial balance with totals and CSV export in integer INR paise; text cells are protected from spreadsheet formula interpretation. Sign-out removes report/source-history data and disables export; stale responses cannot repopulate a different session. No partial 50-row ledger export is represented as a full report.
7. Extended synthetic signed-HTTP, SQL, recovery and browser checks. Updated the handover packaging gate from 11 to 12 migrations.

## Verified evidence and limits

| Check | Evidence | Limit |
|---|---|---|
| Existing baseline | 337 local tests passed; baseline PR CI green | Baseline only |
| Current Node/SQLite suite | See final validation record below | Synthetic fixtures, not remote D1 |
| Invoice → receipt → ledger → accounting → reports | Signed Worker API, real migrations and existing source adapters; idempotent retries passed | Source evidence seeded as explicitly synthetic test data |
| Payroll/vendor/advance payouts | Approved payroll accrual, payout document import, rejection without evidence, verified settlement and safe retry passed | Not real banking evidence, government filing or payroll rate certification |
| Permissions/security | Center B/HO/auditor denial, Origin rejection, production/off flags, forged actor/amount/evidence rejection, audit immutability and missing-schema denial passed | Cloudflare Access/MFA/WAF/reset/recovery not accepted |
| Corrections | Existing independent approval/rollback suite; new reversal/receipt race and reconciliation regression checks passed | Only full invoice/bill accrual reversal; no cash refund, payroll reversal or source cancellation |
| Local recovery | Disposable SQLite backup restored with equal row counts, balanced posted journals, foreign-key/integrity checks and immutable triggers | Not a D1 Time Travel or remote restore rehearsal |
| Packaging | Wrangler 4.129.1 `deploy --dry-run` passed with all flags OFF | No deployment |
| Browser/mobile | Local Chromium passed signed fixture flow, source import, audit identity, CSV totals, privacy and 390/768/1440px; mobile screenshot inspected | Local WebKit host libraries missing; use CI WebKit result below. Not protected staging UAT |
| Cloud staging | HTTP redirect and browser sign-in page confirmed Cloudflare Access protection | No authenticated access, deployed SHA/schema verification or cloud data mutations |

## Remaining essential blockers

| Blocker | Required closure |
|---|---|
| Actual isolated staging integration | Secure authorized Cloudflare Access/Finance sign-in; staging-only Worker/D1 deployment access and verified binding identity. Deploy exact tested candidate, apply migration 12 after 1–11, and repeat signed real-source workflows with two separate maker/checker identities and two Centers plus HO. Existing source/evidence fixtures do not establish the deployed contracts. |
| Evidence intake and Finance approval lifecycle | Current imports consume already approved/verified source rows. Independent bank/cash evidence intake, source-linked maker/checker verification, retained evidence, rejection and exception handling still need an approved source contract and implementation/UAT. A typed bank reference or `Paid` flag cannot satisfy this. Manual bank matching is acceptable only after this process works. |
| Corrections beyond accruals | Original-source invoice cancellation/credit note, partial corrections, receipt refunds/payment returns, payroll reversals and statutory-liability correction are not implemented end-to-end. Need approved business/accounting treatment, append-only source linkage and failure/retry acceptance before client release. |
| Payroll compliance | Qualified reviewer must approve each legal employer's current-period applicability, wage bases, rates, rounding, registrations, tax declarations, exemptions, employer costs and filing/challan workflow. Current code posts reviewed source values and refuses missing/nil review; it is not a statutory calculator or filing service. No rates were invented in this continuation. |
| Accounting/source coverage | Fee and legacy payout/payroll adapters exist. Purchase-bill/vendor-liability recognition and complete operational creation/approval/print/export journeys still require actual source mapping and accountant/client UAT. Balanced journals alone do not prove complete liabilities or correct revenue policy. |
| Operational recovery/security/production configuration | Actual isolated D1 export/bookmark and separate restore rehearsal; deployed migration/trigger checks; current membership/ownership and credential recovery/MFA review; accepted mobile/desktop staging UAT. Current entrypoint intentionally rejects production. A reviewed standalone production deployment configuration/entrypoint is still required; never change an environment label to bypass staging protections. |

Bank-statement automatic matching remains deferred and is not a V1 blocker by itself. None of the essential gaps above is waived by a green CI run.

## Migration 12 and recovery preparation

Use the previously documented staging backup/rollback runbook in `FINANCE_ONE_V1_GO_LIVE_REVIEW_2026-10-13.md`, with these updates:

- Confirm separate staging Worker, account and D1 UUID before any remote command. This continuation's local Wrangler config contains a deliberately inert UUID and must never be deployed.
- Keep the API and both operation flags OFF; export the actual staging DB, record checksum and Time Travel bookmark, and test restoration to a separate disposable D1 before migration.
- Inspect the actual schema first using the read-only `sqlite_master` query below; do not blindly rerun migrations. After backup, apply only verified missing migrations in their documented order through **11**, then `migrations/finance_payroll_one_source_operations.sql` as **12**. Reapplying migration 12 is safe (`IF NOT EXISTS`); do not drop audit records to reset tests.
- Run closed-service preflight with the intended operation flags so their schema checks execute. Check all 12 migrations and original source access; provision authorized independent test users outside the public repository. Activate only the isolated staging service for UAT.
- Audit requests/attempts/outcomes must survive rollback. Disable source operations first on failure; preserve any unconfirmed attempt and reconcile original source, cash event and journal before safe retry. Cash and journal creation remain recoverable separate writes, not one atomic transaction; the API explicitly reports that limitation.
- Do not roll the Worker back to a version that removes the reversal-insertion guard or nil statutory-review requirement while allowing writes. Prefer a compatible forward fix. A D1 restore requires explicit approval after identifying all activity since the bookmark; a Worker rollback alone does not restore the DB.
- No remote backup, migration, restore, deployment or real financial transaction was performed here.

## Current remote resume point

User-provided staging database: `neo-finance-one-staging`, ID `17c1d0d7-aab1-4e4a-9afe-6b36554b8f93`. The user-provided screenshot shows this D1 identity in the Cloudflare Console URL; the Worker-to-D1 binding has not yet been verified. The user is already signed into Cloudflare in Mac Chrome; that session is not shared with the agent browser. Do not repeat the user's local login or infer migrations from the reported 16-table count.

The user has executed this read-only query in that database's D1 Console:

```sql
SELECT type, name
FROM sqlite_master
WHERE name LIKE 'neo_fin_%'
ORDER BY type, name;
```

A partial screenshot of the result was received: receipt-verification, payroll-review, session-revocation and statutory-remittance triggers plus the two ledger/journal views are visible. The tables, correction triggers and unique reversal index are above the captured portion; their presence and migration completeness remain unverified. Inspect the full inventory before selecting any remote migration. Follow with read-only schema definitions/version checks as needed; object names alone are not proof of correct definitions. There is no authorization to use a production binding.

## Exact access and final authorization

**Needed now:** secure staging access and independent Finance test identities, staging-only Worker/D1 tooling, employer-approved payroll policy, and the permitted source evidence/cancellation/refund contracts. Do not put passwords, API tokens, OTPs or session cookies into chat or this public repository.

**No production authorization is requested while the blockers remain open.** After implementation and staging acceptance, the final approval must identify:

> I approve merging PR #26 at [exact tested SHA] and deploying [exact artifact/version] to [named production Worker] using [exact production D1 identity] and [reviewed migration list]. I approve this release against backup [verified export/bookmark], rollback plan [reference], and recorded client UAT, security and accountant sign-offs. Bank-statement automatic matching remains deferred.

## Final validation record

Published implementation commit: **`d48a1a46fded0d1c47c4272432ab38a3d794ed35`**, built on `ccbbcb6066a3f3b3d94629465336799e0f11a1c6`. The published Git tree exactly matched the locally tested tree (`eb7d9f73954cb6c7afcf164d8fa28466c36ff572`). All **350/350** local Node/SQLite tests passed after integrating the newer handover.

CI: https://github.com/umakanthgilla/neo-school-india-website/actions/runs/38436520967 . Authorization tests, Wrangler packaging, Chromium/WebKit browser QA and the exact-source handover test/package/upload steps passed. Chromium and WebKit logs both explicitly report PASS for login, independent corrections, source import, authenticated audit identity, CSV totals, logout privacy, zero unintended cash and 390/768/1440px layouts. The CSV check also confirms text formula neutralization. The handover contains 12 migrations.

This documentation update records the screenshot and validation evidence; it changes no runtime code or tests. Check the final PR head's CI before selecting a deployment artifact. PR #26 remains draft/unmerged. No remote staging deployment, D1 migration, production mutation or government filing was performed. Actual cloud acceptance remains blocked as listed above.

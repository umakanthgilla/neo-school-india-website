# Finance & Payroll ONE — client go-live review, 13 October 2026

**Decision: NO GO for client production. Development fixes are not production acceptance.**

Repository: `umakanthgilla/neo-school-india-website` · branch: `feature/finance-payroll-one-foundation` · draft PR: #26. Baseline inspected: `4c9bd15517057e2b860ab48f4fd0a0e0225e2883`. No merge, production deployment, remote migration, real payment, or production data change was performed.

This dated review supersedes older statements that staging does not exist. The staging URL `https://neo-finance-one-staging.umakanthgilla.workers.dev/portal.html` returned HTTP 302 to Cloudflare Access on 13 October. That establishes an access-controlled endpoint, not a successful Finance login, deployed source SHA, complete D1 schema or accepted user journey. No access-control bypass was attempted.

## Implemented and checked in this candidate

- Existing baseline: 319 automated tests passed locally; baseline GitHub Actions run `38386276602` succeeded. Dedicated Finance authentication, tenant boundaries, immutable documents/journals, source validation, receipts/payouts/payroll accrual, internal reconciliations and reports already existed; they were not rebuilt.
- Added migration **11**: `finance_payroll_one_corrections.sql`. Append-only correction requests and decisions identify the actual authenticated requester/reviewer, reasons and timestamps. Only a different owner/finance administrator may decide. Accountants can request; auditors can inspect; Center/HO boundaries remain mandatory.
- Approval atomically writes the decision and an exact compensating journal. Failure rolls back both. Original journal/document remains immutable. Duplicate retries cannot post twice; a second approved reversal of the same original is prevented by a unique database index. SQL guards also reject forged correction journals.
- Added staging operational forms for eligible invoice/bill journal selection, correction request, independent approval/rejection and audit history. Browser tokens remain memory-only; sign-out clears the correction queue and delayed responses cannot restore it.
- Correction scope is deliberately **full INR sales-invoice or purchase-bill accrual reversal only**. It is an accounting adjustment, not a cash refund, statutory credit-note certificate, original-school invoice cancellation, partial correction, payroll reversal or payment cancellation. Those require their own validated source workflows.
- Added `FINANCE_ONE_OPERATIONS_ENABLED=false` by default. Enabling requires migration 11; preflight checks its tables/security triggers. Existing ten-migration read-only staging remains usable with operations OFF.
- Closed a payroll safety gap: zero/omitted statutory deductions no longer imply exemption. Every payroll requires an explicit approved applicability/amount review matching the original-source fingerprint, including nil amounts. Both accrual and payroll settlement enforce this. Older unreviewed payroll snapshots now fail reconciliation and require controlled remediation; no silent rewriting of historical postings.
- CI now reacts to package/lock changes; packaging includes migration 11. Added Chromium/WebKit tests against a disposable local Worker/SQLite fixture at mobile, tablet and desktop sizes. This is not real Cloudflare D1 or a cloud UAT substitute.

## Evidence and remaining gates

| Area | Evidence / status | What remains before client use |
|---|---|---|
| Automated Node/SQLite tests | 337/337 local tests passed, Node 24; CI uses Node 22 | Exact candidate CI evidence recorded below |
| Worker packaging | Wrangler 4.129.1 `deploy --dry-run` passed; no deployment | Package/deployed version identity on isolated staging |
| Receipts, vouchers, ledger, payroll, permissions, accounting, reports | Existing synthetic-source tests passed; signed HTTP correction flow added | Real isolated staging source journeys and user acceptance |
| Correction approvals | Implemented/tested for full invoice/bill accrual reversals | Cloud D1 trigger validation, real separate reviewer identities; source cancellation/refund/payroll correction integration |
| Finance operational UI | Existing read-only dashboard plus correction queue | Original source creation/approval, evidence verification, payroll operations, exports/print UAT; not a completed operational suite |
| Independent ownership | A/B/HO automated access-denial tests passed | Confirm actual school→legal-business ownership, independent users and current memberships in staging |
| Payroll compliance | Exact reviewed values, balanced liability postings, nil-review gate | Accountant-approved applicability, wage bases, rules, rounding, statutory identifiers, tax declarations, filings/challans and current period sign-off |
| Manual reconciliation | Procedure below prepared; internal automated consistency checks exist | Named maker/checker, bank/cash evidence intake and source-linked verification demonstrated end-to-end |
| Staging access/security | Cloudflare Access redirect observed | Authorized Access session, working Finance login; WAF/MFA/reset and recovery review; no credential values required in chat |
| Backup/rollback | Isolated-staging procedure prepared; SQL rollback fault test passed | Actual staging export, bookmark and restore rehearsal; production plan after separate authorization |
| Mobile/browser QA | See candidate validation record below | Actual protected staging mobile/desktop acceptance and print/export testing |
| Production deployment architecture | Existing Worker intentionally rejects production environment | Separately reviewed standalone production configuration/entrypoint and staged rollout; do not relabel the staging flag to bypass this gate |
| Bank-statement automatic matching | Deferred by owner | Not a V1 blocker if the verified manual process is accepted |

## Candidate validation record

The feature branch and its GitHub Actions run are the authoritative candidate identity. Record the SHA and run URL with the reviewer sign-off. Browser fixture results, if successful, prove only synthetic local behavior; cloud acceptance remains pending.

## Safe manual reconciliation process (no duplicate ledger entry)

1. Work within one independent legal business and one bank/cash account/period. Retain opening balance and a read-only source statement or signed cashbook under controlled access; record the statement identifier, period and reviewer.
2. Maker matches each original receipt/voucher to external evidence using amount, direction, date and unique transaction reference. Check duplicates, failed/pending payments and refunds. A `Paid`, `Released` or `Approved` source status alone is insufficient.
3. A different authorized checker verifies the original evidence and original source record. Only the approved source-evidence integration may create the verified event. Do not insert manual Daily Ledger rows or treat an operator-entered reference as independently verified proof.
4. Record unmatched statement rows and unmatched source documents as exceptions. Keep disputed items unverified. Do not manufacture balancing entries.
5. Compare statement opening + verified inflows − verified outflows to closing balance, explain timing differences, and also require cash↔journal and accrual audits to pass. Keep reviewer identity/time and retained evidence reference.
6. For a wrong posted cash movement, stop that source and open a correction case. Use a separately verified refund/payment-return workflow once implemented and accepted; never edit or delete the original event. The new accrual reversal button is not a money reversal.

**This written process does not close the missing operational evidence intake/approval integration.** It must be exercised on isolated staging with the actual source contracts before acceptance.

## Staging backup, migration and rollback runbook

Only an authenticated operator with the correct separate staging D1 binding should run these commands. Inspect the private config's account, Worker name and D1 UUID first; never substitute the production binding. Do not put passwords, tokens, exports or real personal records in this public repository.

1. Disable staging operations and Finance API, record current Worker version and D1 identity. Preserve the previous configuration and deployed artifact.
2. Export the entire isolated staging database to a protected local location:

```sh
npx --yes wrangler@4.129.1 d1 export neo-finance-one-staging --remote --config wrangler.finance-one.staging.toml --output /secure-backups/finance-one-before-migration-11.sql
npx --yes wrangler@4.129.1 d1 time-travel info neo-finance-one-staging --config wrangler.finance-one.staging.toml
```

3. Record export SHA-256, size, timestamp and Time Travel bookmark; restrict file access and confirm the export can be read. Restore into a **separate disposable database**, compare table counts, foreign-key integrity, posted balances and immutable triggers. An export without a restore rehearsal is not accepted backup evidence.
4. Confirm migrations 1–10 from the master handoff. Apply migration 11 only to isolated staging; run closed-service preflight, schema checks and the correction failure/duplicate/tenant tests against D1.
5. Deploy the exact reviewed feature-branch candidate only to the named isolated staging Worker. Provision two separate Finance identities; verify Finance login and individual logout. Run active preflight before authorized staging UAT. Enable operations only after the new migration and review controls pass.
6. On failure: disable operations immediately; disable the staging Finance API if integrity/authentication is in doubt. Preserve logs, failing request IDs and evidence. Do **not** drop the new tables or delete compensating journals. Prefer an additive forward fix. If a restore is necessary, first export current state, identify all post-bookmark approved activity, and obtain explicit restore authorization to prevent losing those records.
7. Any Worker rollback must retain compatibility with migration 11 and the statutory-review gate. Rolling back to the baseline would remove the nil-review safety check and hide correction history. Keep access disabled until a compatible fixed candidate passes. A Worker version rollback alone does not roll back D1.

Commands were checked against Wrangler 4.129.1 CLI help. No remote export, restore or migration has been executed in this review.

## Payroll review inputs still needed

For each independent legal employer, a qualified reviewer must establish applicable registrations and exemptions; PF/EPS/EDLI wage bases and membership; ESI coverage and contribution-period rules; work-state PT and exemptions; current-year salary TDS regime/declarations and prior employment; employer costs, rounding, due dates and filing/challan evidence. Nil values require documented non-applicability. Reviewed numeric amounts are not government filing confirmation.

Authoritative reference entry points checked during review (not a substitute for employer-specific current-period approval):
- EPFO contribution/rate and membership exceptions: https://www.epfindia.gov.in/site_docs/PDFs/MiscPDFs/ContributionRate.pdf
- ESIC contribution and coverage guidance: https://esic.gov.in/attachments/esistatedirectoratefile/ef84365f31f15306ddb397902d675858.pdf
- Telangana profession-tax schedule: https://ptax.tgct.gov.in/tgportal/AllActs/APPT/APPTSchedule.aspx

## Exact next access and final approval

**Needed to continue cloud verification:** authorized Cloudflare Access/Finance test sign-in and staging-only deployment/D1 access, plus two independent maker/checker test identities. Use secure connected access; do not paste passwords, API tokens or session secrets into chat. Also provide the accountant-approved payroll applicability/rule profile and the permitted original-source cancellation/refund/evidence contracts. These determine safe behavior that cannot be invented from a screenshot or a `Paid` flag.

**No production approval is requested now.** Once all release blockers and real UAT are closed, the final approval must explicitly identify:

> I approve merging PR #26 at [exact tested SHA] and deploying [exact artifact/version] to [named production Worker] with [exact production D1 identity] and [reviewed migration list], using backup [verified export/bookmark] and rollback plan [reference]. I accept the recorded UAT/accountant/security sign-offs and remaining non-blocking risks. Bank-statement automatic matching remains deferred.

Approval does not waive unimplemented essential workflows or substitute for staged evidence. Keep the PR draft and production unchanged until then.

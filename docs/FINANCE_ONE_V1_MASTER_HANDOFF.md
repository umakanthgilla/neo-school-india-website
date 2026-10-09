# NEO SCHOOL INDIA — FINANCE & PAYROLL ONE
# V1 ENGINEERING HANDOVER · 2026-10-09

**Handover status: DEVELOPMENT CODE HANDOFF READY · CLOUD STAGING / USER ACCEPTANCE PENDING**

**This is NOT a production release, bank reconciliation certification, statutory filing system, or a statement that Finance ONE has been deployed.**

## 1. Source of truth / do not restart
- Repository: https://github.com/umakanthgilla/neo-school-india-website
- Exact branch: `feature/finance-payroll-one-foundation` (never switch work to production `main`).
- Draft PR: https://github.com/umakanthgilla/neo-school-india-website/pull/26
- Verified engineering CI before handover: https://github.com/umakanthgilla/neo-school-india-website/actions/runs/37925323490 — 319/319 Node/SQLite tests passed; Wrangler packaging dry-run passed.
- **Pin the exact commit SHA from the final handover CI artifact's `MANIFEST.txt`**; that artifact is the portable source snapshot. Do not assume a floating branch HEAD is frozen forever.
- Complete live School/Teacher/Parent/HR/Payroll/Finance workflows and Worker are **unchanged** in production. Finance ONE is an additive isolated candidate.

## 2. Locked V1 product decisions
1. Head Office and every independently owned Center are separate legal Finance tenants. An HO login must never obtain another Center's private books.
2. Existing Neo School India Staff IDs, HR salary setup, attendance, leave, salary advances, vouchers, receipts, Daily Accounts, Daily Ledger and legacy numbering must remain intact.
3. **Single source entry:** import independently verified, authorized original school/finance workflow facts into new Finance journals. Never re-enter the same payment into an editable ledger.
4. **Cash Ledger only reflects verified settlement evidence**. Legacy `Paid`, `Released`, `Approved`, accrued payroll or a generated voucher are NOT by themselves cash movement.
5. Posted double-entry journals, approved Finance documents and Finance cash events are immutable. Do not silently amend/delete; corrections need new approved compensation/reversal logic (not yet implemented).
6. Separate Finance sign-in; School or HO admin token is **not** a Finance credential.
7. **Bank-statement import, auto matching and reconciliation explicitly deferred to V2** by project owner. No bank-provider integration should be silently added to V1. Internal Cash↔Journal reconciliation remains in V1.
8. Zoho Books/Payroll feature parity, government filing or statutory rates **not delivered** and must not be claimed.

## 3. Current code included in the handoff
- `worker/finance-one/`: dedicated Worker entrypoint, Finance auth/password/JWT/session revocation, organization membership, source adapters/verifiers, journal posting & safe retry/recovery, statutory payroll review and remittance model, locked cash projection, read-only Finance APIs, cash/contra account and invoice/payroll accrual audits, preflight and Node/SQLite tests.
- `finance-one/portal.html`: responsive single-Worker staging Finance login and read-only financial dashboard with explicit cash, accrual and trial-balance warnings. This is NOT a complete payroll operations UI.
- `migrations/finance_payroll_one_*.sql`: **10 additive SQL migrations** (below).
- `wrangler.finance-one.staging.toml.example`: **illustrative only** separate Worker/D1 config, feature OFF by default; portal Assets gated by Worker; two native Cloudflare login rate-limit bindings. Never apply its fake D1 UUID/placeholder origin to live Cloudflare.
- `.github/workflows/finance-one-tests.yml`: Node tests, Wrangler **--dry-run**, and source handover artifact. No deploy operation.
- `docs/finance-one-staging-operations.md`: historical engineering operations log; its initial older sections can be stale. **This master handover and the latest validated test manifest override older progress notes.**
- `docs/FINANCE_ONE_V1_ACCEPTANCE_MATRIX.md`: explicit pass/fail release handover and pilot checks.
- `docs/FINANCE_ONE_V1_NEXT_CHAT_PROMPT.txt`: paste into a new chat/developer handover as-is.

## 4. Ten additive migrations — exact order / staging D1 ONLY
1. `migrations/finance_payroll_one_foundation.sql` — organizations, ownership, memberships, source documents, settlements.
2. `migrations/finance_payroll_one_cash_projection.sql` — immutable verified cash events, read-only Cash Ledger.
3. `migrations/finance_payroll_one_accounting_journals.sql` — independent Chart of Accounts, balanced posted double-entry journals.
4. `migrations/finance_payroll_one_auth_accounts.sql` — dedicated Finance credentials.
5. `migrations/finance_payroll_one_receipt_evidence.sql` — immutable fee receipt evidence review.
6. `migrations/finance_payroll_one_legacy_payout_integrity.sql` — full legacy payout evidence constraints.
7. `migrations/finance_payroll_one_statutory_review.sql` — independently reviewed PF/ESI/PT/TDS payroll amounts, not statutory rate computation.
8. `migrations/finance_payroll_one_statutory_remittance.sql` — remittance approval and exact verified voucher posting, no government filing.
9. `migrations/finance_payroll_one_session_revocations.sql` — per-device server-side Finance logout.
10. `migrations/finance_payroll_one_issued_document_immutability.sql` — freeze approved and referenced Finance documents; linked drafts also protected.

Do not apply to live/production D1. Do not blindly backfill legacy data or merge to `main`.

## 5. Run and verify the code (local or GitHub)
From repository root with **Node.js 22**:
```bash
node --experimental-sqlite --test worker/finance-one/*.test.mjs
```
Require **zero failures**. Github Actions runs this suite and separately runs
`npx --yes wrangler@4.129.1 deploy --dry-run --config wrangler.finance-one.staging.toml --outdir /tmp/finance-one-staging-bundle` with a deliberately inert, disabled synthetic staging configuration. A successful `--dry-run` is **NOT deployment**.

Baseline verified before package preparation: **319/319 passing, zero failures** and Wrangler packaging passed. Re-run for the **exact handover commit** and record its SHA/run in the artifact.

## 6. Actual Cloudflare staging deployment — NOT YET DONE
**Only an explicitly authorized Cloudflare operator** should:
1. Obtain a separate Cloudflare staging account/environment, create **independent backup-able D1** and **new named staging Worker**. Never bind to the existing live Worker/D1.
2. Replace Wrangler example D1 UUID, expected HTTPS origin and rate-limit namespace IDs privately; configure Cloudflare Access/WAF, login security/audit logs and controls before permitting public testing.
3. Keep `FINANCE_ONE_READ_API_ENABLED=false`, set `FINANCE_ONE_ENVIRONMENT=staging`, provision a unique 32+ character Finance HMAC session secret as a **Cloudflare secret**, never in `[vars]`/GitHub.
4. Back up staging D1, apply migrations **1–10 in order**, run `financeOneStagingPreflight({db:env.DB,env,phase:'prepare'})` from a trusted internal operator environment with Finance routes **OFF**.
5. Provision independent Finance identities and complete active Chart of Accounts using an authorized audited internal flow. Run `financeOneBusinessPreflight` **separately for HO and each independent legal Center**.
6. Review original school ownership, approved payroll reviews, verified settlement source adapters, source immutability and internal reconciliation. **No fake bank proof and no money posting from mere Paid flags.**
7. Only after all safeguards, enable the isolated staging Finance flag deliberately; recheck `phase:'active'`, then execute every acceptance scenario in `FINANCE_ONE_V1_ACCEPTANCE_MATRIX.md`.
8. Give owner a real private `https://<staging-worker-host>/portal.html` link **only after a successful authorized deployment**. That URL does not exist now.
9. Failed check: flip isolated staging flag OFF, stop access, preserve evidence/logs, diagnose and remediate. **Do not deploy/merge production.**

## 7. Known blockers — explicitly unresolved
| Area | Handover status | Next owner |
| --- | --- | --- |
| GitHub code and automated SQL/HTTP/security coverage | Engineering verified (see pinned CI) | Developer |
| Separate staging Worker/D1/HTTPS URL, backups and real login | **NOT DEPLOYED** | Cloudflare operator |
| Finance login onboarding, identity audit trail, MFA/reset, perimeter WAF/Access | **UNFINISHED** | Security/operator |
| Source adapters wired to actual school workflows in Cloudflare staging | **NOT VERIFIED END TO END** | Developer/QA |
| Real independent verified payment evidence flow | **NOT INTEGRATED WITH REAL PROVIDER**; do not infer from Paid | Finance owner/developer |
| Corrective credit notes, reversals, approved source supersession | **NOT IMPLEMENTED**; issued docs stay locked | Developer/CA |
| India's PF/ESI/PT/TDS rates, payroll compliance, government filings, challans | **NOT IMPLEMENTED/CERTIFIED** | Accountant/legal reviewer |
| Complete Finance/Payroll operational forms and mobile UAT | **NOT ACCEPTED**; UI is read-only preview | Product owner/QA |
| Bank statements/import/automated matching | **DEFERRED TO V2 BY OWNER** | V2 team |
| Production deployment/PR merge | **PROHIBITED pending written acceptance** | Project owner |

## 8. Handover acceptance / signatures
**Engineering handover can be accepted now as an auditable DEVELOPMENT source package.**
Do **not** sign it off as a finished live Finance & Payroll application.

Receivers should record: final handover commit SHA, passing GitHub CI URL, confirmation that no prod changes were made, any Cloudflare access provisioned, and separate written UAT/production acceptance once outstanding items are finished.

**Development-owner closing statement:** V1 engineering baseline is transferred for isolated staging deployment and acceptance; bank statement automation is V2; no live deployment, production DB mutation or statutory compliance certification is implied.

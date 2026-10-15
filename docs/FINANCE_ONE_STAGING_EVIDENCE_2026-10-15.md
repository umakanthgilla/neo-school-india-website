# Finance ONE staging evidence — 15 October 2026

Production readiness: **NO GO**. PR #26 must remain draft and unmerged. No
production deployment or production database writes are authorized.

## Verified remote evidence

- Backup export restored to a separate D1 database; source/restored schema and
  empty financial data checks matched before migrations. This proves restoration
  of that snapshot, not populated financial recovery.
- Migrations 11 and 12 applied and checked on restore-check and staging;
  quick_check passed with no foreign-key violations reported.
- Dedicated synthetic QA fixtures imported first into restore-check, then staging.
  Centers A/B and HO each have 16 chart accounts; five QA memberships created.
  This does not prove five independent human reviewers. Existing NEO_JAGTIAL setup
  was not completed by the seed.
- Exposed QA passwords were rotated for all five staging identities, incrementing
  credential versions. Never record secrets in source or reports.
- Operator was guided to add only the second requested email to the Access Allow
  policy, preserving a 30-minute duration. Subsequent CLI success confirms token
  return to the initiating Mac. Final policy attachment/scope still needs review.
- Actual cloud QA passed portal availability, no-store, frame protection,
  anonymous financial read denial and all maker/checker own reads,
  cross-Center/HO denial, foreign-origin denial, disabled operation GET gates,
  server logout and logged-out token replay denial.
- Center B owner single login returned 200 and logout 204. Its full permission
  suite remains unverified. Reader login failed with HTTP 503, HTML response
  classified as Worker resource limit; CF-Ray a4ac09652e8fe1d9-MRS. Reader and HO
  full access suites remain incomplete.
- Last reported deployed Worker remains
  `6c2bb91f-6d1e-4bc6-b419-73367e0d3090`. Later source commits are not proven
  deployed. Source/correction operations remain intended OFF; no cloud source
  imports or financial postings have been verified.

## Login runtime fix — source only

The observed 503 is a platform resource failure, not evidence of a wrong password.
Existing PBKDF2-SHA256 uses 210000 iterations in the pinned JavaScript
implementation. A local measurement is not cloud CPU evidence. Platform logs must
confirm the exact exceeded resource. The user requires a free solution; no billing
change has been authorized or performed.

Optional Access login now verifies the signed application assertion and links an
explicit stable subject to one independently authorized Finance identity. Finance
membership, active credential version, session revocation and tenant checks remain
required. Password work factors are unchanged. It is OFF by default and needs the
full independently checked application AUD and reviewed subject/account links.
One person must not be linked to both maker and checker. See
[Access configuration and tests](FINANCE_ONE_V1_ACCESS_LOGIN.md).

Commit `3aa1df100d1ba7c43c367cf0656810a8f8be29f1` passed 360 local tests and
[CI including Chromium/WebKit, Worker bundle and handover](https://github.com/umakanthgilla/neo-school-india-website/actions/runs/38685375109).
This does not prove login reliability within the real staging Worker budget.

## Source integration — source only

Actual school records reside in the separate neo-lead-crm D1. The adapters now
support an explicit read-only `SCHOOL_SOURCE_DB` binding, retaining all Finance
authorization/evidence/posting writes in Finance `DB`. Missing/mislabeled source
bindings and bindings containing Finance books fail closed. No school source
write capability is exposed through the import boundary. Original ownership,
source/voucher/ledger linkage, verified settlement and statutory review still apply.

Do not bind the live school database. A new isolated source staging D1 containing
only synthetic rows must be prepared and checked first. A source-only offline
fixture generator is provided; it creates no new credentials or verification.
No migration is needed. See [source setup, rollback and cross-database limits](FINANCE_ONE_V1_SEPARATE_SCHOOL_SOURCE.md).

Candidate `44ca7dfb8c159226aace6acd4c45f91aea125362` passed 368 local Node/SQLite
tests. Two physical SQLite databases exercise invoice/receipt, payroll accrual,
payroll/vendor/advance payout, unchanged original rows, idempotent retries,
source changes, tenant boundaries and interrupted payroll journal recovery.
[Exact candidate CI](https://github.com/umakanthgilla/neo-school-india-website/actions/runs/38686387548)
records the browser/build/handover outcome separately. The browser fixture now
uses a query-only separate school database. These are synthetic tests, not actual
Cloudflare D1 or source approval acceptance.

Trial balance CSV and print are implemented and synthetic-tested. Client cloud
printing/export acceptance is not recorded.

## Remaining release gates and exact approval

Verify final Access scope, free-plan login reliability, effective bindings and
exact deployed source. Complete isolated cloud financial E2E for receipts,
vouchers, journals, maker/checker corrections, payroll, reports and negative
permissions. Complete original-source approvals/evidence intake and required
cash/refund/payroll correction journeys. Obtain employer statutory inputs and
accountant acceptance. Rehearse populated financial D1 backup/restore. Review
production configuration; the current entrypoint rejects production.

Final production authorization must explicitly identify the exact passing
commit/artifact, production Worker and D1, reviewed migrations, verified
backup/rollback, accepted security/UAT/accounting sign-offs and the permitted
merge/deployment actions. No merge or production action has been taken.

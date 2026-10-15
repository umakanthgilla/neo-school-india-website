# Finance ONE staging evidence — 15 October 2026

Production readiness: **NO GO**. PR #26 must remain draft and unmerged. No production deployment or production database writes are authorized.

## Verified remote evidence
- Backup export restored to a separate D1 database; source/restored schema and empty financial data checks matched before migrations. This proves restoration of that empty-financial-data snapshot, not populated financial recovery.
- Migrations 11 and 12 applied and checked on restore-check and staging; quick_check passed with no foreign-key violations reported.
- Dedicated synthetic QA fixtures imported first into restore-check, then staging. Centers A/B and HO each have 16 chart accounts; five independent QA memberships created. Existing NEO_JAGTIAL setup was not completed by this seed.
- QA passwords exposed by operator in chat were rotated for all five staging identities, incrementing credential versions. Never record secrets in source or reports.
- Staging Access policy was observed allowing only the original operator email. Operator was guided to add only the second explicitly requested email, preserving email-based Allow and 30-minute policy duration. A subsequent CLI Success page confirms token return to the initiating Mac. Full final policy attachment/scope still requires verification.
- Actual cloud access QA passed portal availability, no-store, frame protection, anonymous financial read denial and all maker/checker own reads, cross-Center/HO denial, foreign-origin denial, disabled operation GET gates, server logout and logged-out token replay denial.
- Center B owner single login returned 200 and logout 204. Its full permission suite remains unverified.
- Reader single-account run failed before authentication completion with HTTP 503, HTML response classified as Worker resource limit; CF-Ray a4ac09652e8fe1d9-MRS. Reader and HO full access suites remain incomplete.
- Operations and source operations are intended to remain OFF; no cloud source imports or financial postings have been verified.

## Current blocking investigation
The intermittent login failure is a real Worker resource-limit failure, not evidence of a wrong password. Existing PBKDF2-SHA256 uses 210000 iterations through the pinned JavaScript implementation. One local measurement consumed approximately 273 ms CPU; this is not cloud timing. CPU budget is a leading hypothesis; platform logs must distinguish exceeded CPU from memory, and the actual account plan and Worker limits must be inspected before configuration changes. Do not reduce credential work factors or disable Access to make a test pass. No billing change has been authorized.

## Source integration finding
Real school source records reside in neo-lead-crm; Finance staging uses a separate D1 database. Current adapters expect source and Finance tables through the same DB handle. Synthetic staging records do not establish a live school integration. Do not repoint Finance staging at the school production database or treat copied production data as isolated QA.

## Source validation
352 local Node/SQLite tests passed after the missing-source-table guard and offline QA seed were added. CI passed on 39c6083f1fbd28f319821b43802a6c827b348786 and 69f2623bd6eafb583ee24f6138fde28c3e683458. Later cloud diagnostic script changes require their own exact-commit CI verification. Latest source code is not yet proven deployed to staging; last reported deployed Worker version remains 6c2bb91f-6d1e-4bc6-b419-73367e0d3090.

## Remaining release gates
Resolve runtime login reliability; verify final Access scope and exact deployed source; complete isolated financial cloud E2E including receipts, vouchers, journals, correction maker/checker, payroll, reports and negative permissions; complete source approvals/evidence intake and required cash/refund/payroll correction journeys; obtain employer statutory inputs and accountant acceptance; rehearse populated financial backup/restore; review production configuration (current entrypoint rejects production). Synthetic tests and written runbooks cannot substitute for these gates.

Final production authorization must identify the exact passing commit/artifact, production Worker and D1, reviewed migrations, verified backup/rollback, and accepted security/UAT/accounting sign-offs. No merge or production action has been taken.

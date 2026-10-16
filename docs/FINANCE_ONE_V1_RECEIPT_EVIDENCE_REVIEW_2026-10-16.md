# Manual receipt evidence review — 16 October 2026

Status: implemented and synthetic-tested; NOT remotely migrated or deployed. Client production remains NO GO. PR #26 remains draft/unmerged.

## Behavior

A Finance accountant/owner/admin submits identifiers for an existing original school receipt, settlement time, bank transaction or signed cash-count reference, controlled archive reference and SHA-256 of retained evidence. Server reads receipt number, amount and payment method from the owned original receipt and requires exactly one matching original school Daily Ledger entry. It fingerprints original payment and ledger contents. The client cannot supply amount, maker identity, evidence type or a verified flag.

A different active owner/Finance admin retrieves the archived file independently, reviews actual bank/cash evidence against the receipt and records a matching file hash and review note. SQL validates distinct authenticated account identities, active memberships/organizations/accounts and ownership. Approval atomically appends an immutable decision and one immutable receipt verification. Duplicate settlement/reference constraints roll back the whole decision. Rejection creates no verification. Neither action creates cash, accounting journals or another school ledger entry.

The existing receipt import remains a separate explicit action. It requires invoice accrual, ownership, exact source linkage and verification. New manual verifications additionally require the approved request, actual reviewer identity and unchanged original source fingerprint on every import. Changed original sources fail closed even after evidence was approved. Existing external evidence verification paths are preserved.

## Evidence retention is an operational obligation

This is a manual reconciliation control, not bank API confirmation or an evidence upload/store. The browser hashes files up to 5 MB locally; no file contents are sent. Operators must first retain the original statement/signed count sheet in a controlled archive available to the independent checker and authorized accountant. A local filename or guessed reference alone does not demonstrate retention, authenticity or a reviewed bank transaction. Hash equality proves the two selected files match, not that a statement is authentic or that a person actually reviewed it. The reviewer is responsible for matching receipt, amount, settlement date and transaction/count reference against original evidence.

Use genuinely different humans for maker and checker. Two accounts controlled by one person do not satisfy independent approval. The current cloud Access mapping has only one actual mapped person; do not use it to claim maker/checker cloud acceptance.

This release covers existing fee receipt evidence only. Payout/vendor/payroll settlement intake, period-close statement reconciliation, cash refunds, partial/source corrections and statutory sign-off remain separate blockers. There is no approval to modify the live school source database.

## Migration and staging controls

Migration 13 is migrations/finance_payroll_one_receipt_evidence_review.sql. It is additive, with two append-only tables, request/decision validation and atomic verification creation. Required tables, triggers and receipt index are checked before evidence endpoints run; preflight also checks them when the feature is enabled.

FINANCE_ONE_EVIDENCE_OPERATIONS_ENABLED defaults OFF. Source import and corrections flags remain independent. API routes remain authenticated and staging-only. Old staging schema remains usable with evidence OFF. Migration 13 has NOT been run remotely. Do not rerun migrations 1–12.

Before applying migration 13: verify the dedicated staging UUID and actual current schema, take a fresh private export/bookmark, restore into the disposable D1 and compare integrity, objects, existing financial counts and balances. Rehearse migration 13 there first. Keep all posting flags OFF. Apply only migration 13 after the backup/restore evidence passes. Deploy the exact reviewed source, preflight and test genuinely independent maker/checker journeys on synthetic source data before enabling source imports. Do not connect the live school database.

Rollback: turn the evidence flag OFF; preserve all requests, decisions and verifications. Do not delete approved evidence or compensate it with manual ledger writes. Review any source mutation or incorrect evidence through the separately approved correction process. A Worker rollback does not restore D1.

## Validation

391 local Node/SQLite tests passed. New signed Worker integration uses two physical SQLite databases with the school source query-only. Tests cover receipt intake, reviewer separation including owner self-approval, approved evidence, invoice/receipt import, idempotency, one cash event, balanced reports, source immutability, post-approval source changes, malformed/forged input, other Center/HO denial, auditor denial, foreign Origin, wrong file hash, finalized decisions, direct SQL protection, duplicate verification atomic rollback and missing trigger fail-closed behavior. Portal tests cover delayed evidence history after logout. Chromium/WebKit QA includes actual file selection, local hashing, separate maker/checker review and cleared file/history on sign-out. Exact-source CI must complete before staging rollout.

The previous staging login/empty-ledger export acceptance remains version 20fc9813-dfb4-432e-a80c-d680368519f0. It does not validate this new workflow.

## Asset backup packaging correction

finance-one/.assetsignore excludes *.before-*, *.bak and backups/. Handover packaging includes it. Operator helpers must keep backups in a private sibling folder outside assets. A future staging deployment must include this file and remove the previously uploaded portal backup from its asset manifest; verify that backup URL remains 404. This candidate has not changed remote assets yet.

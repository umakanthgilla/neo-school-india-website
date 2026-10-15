# Separate school source integration — staging candidate

Implemented in source; not deployed or cloud accepted. No migration, production
database change, school workflow replacement or direct Ledger posting is required.

## What changed

Finance imports can now read original school records from a separate
`SCHOOL_SOURCE_DB` D1 binding. Finance authorization, ownership, receipt evidence,
settlements, statutory reviews, audit history and immutable journals remain in
`DB`. The existing single-database fixture path remains supported by default.
Source reads expose only SELECT/first/all; source writes, batch and exec are not
exposed through the operations boundary. Invoice, receipt, payroll accrual,
vendor/payroll/advance payout and interrupted payroll journal recovery all use the
selected source. The same original-school linkage and evidence checks still apply.

HTTP callers cannot select the database, amount, approval identity or verifier.
Missing, failed or incorrectly marked bindings deny imports. A source binding
containing `neo_fin_organizations` is rejected, including another binding object
pointing to the Finance database. There is no automatic fallback to Finance when
the separately configured source is unavailable. Staging preflight checks the
source binding and schema when the separate-source flag is enabled.

## Isolated cloud setup still required

1. Keep correction/source operation flags OFF. Preserve the existing Finance D1
   UUID, session secret, rate limits, Worker-first asset routing and Access policy.
2. Create a **new isolated school-source staging D1**. Do not bind the live
   `neo-lead-crm` database or the restore-check Finance database. Review the actual
   database UUID in Cloudflare before using it. The environment label is an
   operator declaration; it does not independently attest a database's identity.
3. Generate a source-only synthetic SQL file offline, without new passwords:

   ```js
   import {writeFileSync} from 'node:fs';
   import {generateSyntheticSchoolSourceSql} from './worker/finance-one/staging-qa-seed.mjs';
   writeFileSync('synthetic-school-source.sql',generateSyntheticSchoolSourceSql(),{mode:0o600,flag:'wx'});
   ```

   Import that file only into the new isolated source D1. It contains fifteen
   synthetic school rows for the existing QA organizations; no credentials,
   Finance tables, bank verification or statutory certification is created.
   Do not rerun the existing Finance seed against already provisioned identities.
4. In the private staging Worker configuration, add that new D1 as
   `SCHOOL_SOURCE_DB`, set `FINANCE_ONE_SEPARATE_SOURCE_ENABLED="true"` and
   `FINANCE_ONE_SOURCE_ENVIRONMENT="staging"`. Keep the operations flag OFF until
   source schema inspection, ownership review and preflight pass. The example
   configuration contains placeholders only.
5. Deploy the exact CI-passing candidate to staging, verify effective bindings,
   authenticate independently authorized users, then run isolated source journeys.
   Confirm the source D1 contains no Finance tables and compare its records before
   and after the journeys. Record denied cross-Center/HO and auditor-write checks.
   Verify missing evidence never creates a cash event. Evidence intake is still a
   separate release blocker; a source's Paid/Posted label is not settlement proof.

## Recovery and limits

For internal payroll journal recovery, supply the same read-only source:
`recoverMissingCashJournals({db,sourceDb:readOnlySchoolSource(sourceBinding),organizationId})`.
Recovery never makes another cash event. The scheduled job is not publicly wired.

D1 does not provide a transaction spanning the two databases. Source validation
and Finance posting are separate operations. Retries re-read the original source
and reject conflicting posted amounts/breakdowns; immutable Finance evidence and
postings are not edited. This implementation does not make legacy school records
immutable or introduce missing original approval/evidence workflows. Those require
their own verified source contract and acceptance before production use.

Rollback: first disable source operations, then disable separate-source selection
or restore the previous staging Worker version. Do not delete journals, cash events
or audit history. No source database mutation is needed to roll back this adapter.

## Evidence

Local HTTP/SQLite tests use two physical in-memory databases and a query-only
school connection. They cover verified receipts, all three payout kinds, nil
statutory review, retries, reports, failed payroll journal recovery, original-source
changes, missing/mislabeled/aliased bindings and independent tenant permissions.
Both browser engines now use a separate query-only school fixture and compare all
source rows after the UI journeys. These are synthetic tests, not Cloudflare D1 or
employer compliance acceptance. Client production remains **NO GO**.

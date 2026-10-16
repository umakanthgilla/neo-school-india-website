# Finance ONE protected staging evidence — 16 October 2026

Production decision: NO GO. This is a passed Access/read-only cloud smoke, not financial transaction UAT.

## Confirmed deployment

Operator-provided Wrangler output records Worker neo-finance-one-staging, D1 neo-finance-one-staging, version 3f1692d2-2695-49f8-abc7-7a446d2bc370. Patch source: 629d732d4f888cdfa3bb58500d51facdbe3118f0. Existing release baseline is bda278e7e5272bacd37ef53b7e92d60cef581c5a with checksum-verified Access diagnostic files from 54d4e89c505ad2acf4b09b566cf1a1286ef0f30b and access-identity.mjs from the patch source. This is a documented layered staging release, not proof that the complete source tree of 629d732 was uploaded. Prior staging version: 4201f389-d99b-4e01-bf76-594606dd16d0.

Flags in operator deployment output: environment staging; READ_API true; ACCESS_LOGIN true; OPERATIONS false; SOURCE_OPERATIONS false; SEPARATE_SOURCE false. No migration or financial posting was executed by the login fix/smoke. Successful login/logout writes session revocations.

## Passed cloud smoke

Operator output: PASS STAGING ACCESS: 29 checks.

The checksum-verified stagingAccessSmoke implementation checks:
- Protected portal HTTP 200, no-store and visible Access sign-in.
- Anonymous Finance documents denied with 401.
- Three successive Access-to-Finance login sessions for the mapped QA Center A owner.
- Own summary HTTP 200, organization matches, balanced chart with 16 accounts.
- Center B and HO documents denied with 403 in each session.
- Foreign Origin denied with 403.
- Source operations and corrections remain closed with 404.
- Logout 204 and replay of the revoked Finance session denied with 401.

This does not prove three independent users. It exercises one explicitly mapped identity three times. It does not establish maker/checker independence, reader/B/HO successful own-organization login, document creation, source integration, payroll, correction posting, reconciliation, reports with financial rows, protected mobile browser behavior or production readiness.

## Root cause and engineering validation

ACCESS_KEYS_FETCH was narrowed to an unsupported redirect option. Real workerd 2026-10-16 at compatibility date 2026-10-09 rejects redirect: error before network I/O. Changed to manual; non-success responses, including redirects, remain rejected without following. Signature, issuer, audience, time, subject mapping and active Finance membership checks remain enforced. 378 local Node/SQLite tests passed; exact-source CI run 38847585056 was still running when this evidence was recorded. Check its final result separately.

## Next gates

Continue source workflow implementation and isolated cloud financial UAT. Preserve original school Finance, independent Center/HO ownership and immutable postings. Obtain genuinely independent test identities before maker/checker acceptance; do not map one human to both. Separate synthetic source binding and operations require preflight and scoped staging configuration; do not bind the live school database for QA. Evidence intake/approvals, refunds/payroll corrections, accountant compliance inputs and populated restore rehearsal remain release blockers. PR #26 stays draft/unmerged; no production authorization is requested.

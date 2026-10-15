# Optional Finance login using Cloudflare Access

Status: implemented and locally tested; not deployed or cloud verified. This is a
staging-only alternative to password verification, intended to address the observed
Free Worker resource-limit failures without reducing password hashing strength.
Actual CPU consumption and reliability must be measured on the Free staging Worker.
No paid plan or new database migration is required by this implementation.

The existing password login remains available. Access login is OFF by default and
the portal button stays hidden until its configuration is complete. A successful
Access login still requires a separately provisioned active Finance auth account,
an active allowed-role membership in the selected organization and an active
organization. School portal login or Cloudflare account membership grants nothing.

## Configuration and identity review

Set these only on the isolated staging Worker, retaining the current D1 binding,
session secret, rate limits and correction/source operations OFF:

- `FINANCE_ONE_ACCESS_LOGIN_ENABLED`: `true` after the following review.
- `FINANCE_ONE_ACCESS_ISSUER`: exact HTTPS team origin, no trailing slash.
- `FINANCE_ONE_ACCESS_AUDIENCE`: full application AUD from Access application
  settings. Never guess from a truncated screenshot or accept an audience sent by
  the caller. Confirm this application covers the staging Worker and API paths.
- `FINANCE_ONE_ACCESS_IDENTITIES`: JSON array of `{subject, accountId}`. Obtain the
  authenticated person's stable Access JWT `sub` through a private, verified login;
  review that person's identity before linking it to a Finance account. Never paste
  JWTs, cookies, passwords or private login logs into chat or version control.

Each subject and each Finance account may occur only once in this mapping. A single
person must never be configured as both maker and checker. Use independently
authenticated people for approval separation. Do not link an administrator to all
five synthetic QA identities to make their tests pass. Existing QA password tests
remain separate evidence; they do not prove Access integration.

The new `POST /api/finance-one/v1/session/access` accepts only the selected
`organizationId`; any supplied account selection is ignored. It verifies the
RS256 assertion signature using keys from the configured team's pinned certs URL,
checks issuer, application audience, application token type and time claims, then
finds the explicitly linked subject. Email headers, caller key URLs and service
tokens cannot establish a Finance identity. Key requests time out after five
seconds, refuse redirects, cap response size and cache keys for five minutes.
An unknown rotated key is denied until cache refresh; retry after five minutes.

Sessions use the existing Finance signing key, current credential version,
per-session revocation and organization authorization. Lifetime is at most fifteen
minutes and never exceeds the Access assertion expiry. Finance sign-out clears
the dashboard and revokes that Finance session; it does not sign out of Cloudflare.
To revoke an identity immediately, disable its Finance account or increment its
credential version using the existing credential rotation procedure. Removing its
mapping alone blocks new Access sessions; previously issued sessions can last until
expiry. Disabling the optional flag restores password-only login.

## Required cloud acceptance before use

With a real explicitly linked test person, verify portal button visibility, login,
own-organization reads, other Center/HO denial, role restrictions, sign-out replay
denial and credential revocation. Repeat on mobile and desktop. Record deployment
version, full configuration review excluding secrets, platform CPU/resource
evidence and results. Test two actual independent people before approval journeys.
Confirm denied/missing assertions do not create Finance sessions. Verify the outer
Access policy still permits only approved people and covers every staging path.

The broader release remains **NO GO** until source integration, financial journeys,
corrections, statutory review and populated restore acceptance are complete.
This login alternative does not authorize production deployment or merge PR #26.

## Fixed-target operator rollout helper

`worker/finance-one/staging-access-rollout.mjs --execute-staging AUD SUBJECT EMAIL`
is an operator-only Mac helper, not a Worker route. It downloads the runtime from
passing candidate `bda278e7e5272bacd37ef53b7e92d60cef581c5a`, verifies its CI status
and each source Git blob hash, revalidates the reviewed signed Access identity,
checks the existing QA Center A checker account and signing-secret presence, records
current staging deployments, bundles and deploys only `neo-finance-one-staging`.
Its account, Worker, D1, rate-limit namespaces and QA owner mapping are fixed;
callers cannot select a production target or a different Finance identity.

It creates a new private release directory in the operator's home and records
source SHA, deployment version and smoke evidence there. It never imports a SQL
file or changes migrations. Corrections, source operations and separate-source
selection remain OFF. Existing signing secrets are retained. The deployment
replaces runtime variables with the reviewed helper configuration; review it if
staging configuration changes after the 15 October evidence.

After deployment it runs three actual Access-to-Finance login/logout sessions,
own-summary, Center B/HO denial, foreign-Origin denial, disabled operation gates
and revoked-token replay checks. Only Finance session revocations are written by
those checks; there are no financial postings. It does not prove actual bank,
payroll, separate-source or independent-human maker/checker acceptance. A smoke
failure after deployment leaves operations OFF and reports acceptance incomplete.
Network/download/preflight failures stop before deployment; ambiguous deploy
failures require checking staging deployments rather than blindly retrying.

Never paste the Access token or private logs. Share only the final deployment
version and PASS/STOPPED diagnostic. No API token, password or paid plan change is
requested by the helper.

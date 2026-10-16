# Staging Access login runtime correction — 2026-10-16

Status: NO GO. PR #26 remains draft. No production deployment, migration or financial posting.

User cloud evidence: staging version 4201f389-d99b-4e01-bf76-594606dd16d0 returned HTTP 503, ACCESS_KEYS_FETCH. The same public certificates endpoint returned HTTP 200 with a valid key list on the user's Mac in 762 ms and 81 ms.

Root cause reproduced with real workerd 2026-10-16 using the deployed compatibility date 2026-10-09: fetch with redirect: error throws TypeError before network I/O. Runtime message: Invalid redirect value, must be one of follow or manual. Previous Node tests accepted this option and did not represent this runtime restriction.

Correction: use redirect: manual; existing non-success response checks reject redirect responses without following them. Issuer pinning, bounded response size, five-second timeout, RS256 signature, issuer/audience/time checks, explicit identity mapping and Finance membership checks remain mandatory.

Validation: 378 Node/SQLite tests passed; added a regression asserting manual mode and exactly one request when the certificates endpoint redirects. The corrected real workerd probe passed request-option validation but outbound DNS is unavailable in the agent sandbox, so it does not prove cloud certificate retrieval. Remote staging deployment and Access smoke must still pass. No paid plan or password reduction is part of this fix.

Rollout: replace only worker/finance-one/access-identity.mjs in the existing private staging release after checksum verification, dry-run and deploy the existing guarded staging configuration. Preserve operations OFF. Retain prior file and deployment version for rollback. Run the existing protected stagingAccessSmoke with a private Access token and report only its safe diagnostic output. Do not rerun the older full baseline rollout helper, which pins an older source.

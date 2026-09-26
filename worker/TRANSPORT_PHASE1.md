# Transport phase 1

Branch: `transport-phase1`

## Scope
- School: vehicles, routes with ordered stops, active Staff Master driver, child assignment with capacity check, today's Pickup and Drop trips.
- Driver: assigned routes and trips only, status transitions and child events.
- Parent: own child's assignment and today's trip/events only.
- No GPS or CCTV dependency.

## Deployment dependency
The frontend can be merged after the API Worker is deployed. The full Worker file was reconciled against the current Cloudflare editor copy supplied by the user on 2026-09-26; existing application logic was preserved, with transport routes and a school_id field in employee /me added. The current public Worker does not yet serve `/api/transport`; merging the frontend first would show an unavailable state.

Deploy the complete `worker/neo-lead-crm-api-worker-transport-phase1.js` script, or apply `worker/transport-phase1.patch` to the exact `neo-lead-crm-api-worker-head-office-ledger-v10.js` source from the v10 Worker package, then deploy the patched Worker with the existing Cloudflare D1 binding and environment variables. The patch does not add a D1 migration file: it creates its three partial unique indexes on first transport request, and uses the existing `neo_portal_records` and `neo_portal_audit` tables.

After deployment, test with nonproduction school data:
1. School creates a vehicle, Staff driver route and child assignment.
2. School starts today's Pickup; driver records Start, Approaching, Ready, Picked up, Dropped at school, then Complete. Parent sees only that child's events.
3. School starts Drop; driver records Boarded at school and Dropped at stop, then Complete.
4. Verify another driver, school, and parent cannot read/update these records.
5. Verify repeat trip and child assignment are rejected, vehicle capacity is enforced, and trip cannot complete with an unaccounted child.

Do not use production student data during testing. Existing test records can be cleaned before client handover.

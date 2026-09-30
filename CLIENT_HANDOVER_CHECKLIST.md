# Neo School India — Client Handover Checklist

Last updated: 30 September 2026

## Source checkpoint

- Repository: `umakanthgilla/neo-school-india-website`
- Branch: `main`
- School portal: `schools.html`
- Parent portal: `parents.html`
- Public gate page: `gate-checkin.html`
- Current Worker source: `worker/neo-lead-crm-api-worker-transport-phase1.js`
- Visitor / Facilities / Gate QR / parent-confirmed pickup backend is merged into the current Worker source.
- No new D1 database is required; these workflows reuse existing Neo School records and audit storage.

## Handover status

### Ready in source

- School login and school workspace
- Student Master and classroom assignment
- Bulk Student import (CSV / Excel upload support)
- Staff Master and bulk Staff / Teaching Staff import
- Teacher login linking to existing Staff ID
- Teacher-to-classroom assignment
- Parent login linking to existing Student ID
- School Setup / Linking Readiness summary
- Student 360
- Student Lifecycle: Promotion, Section Change, Withdrawal and Transfer Certificate
- Academic calendar and classroom academic-year compatibility
- Staff Attendance
- Leave and Salary Advance workflow
- Salary Setup and Payroll
- Fee Structures and automatic student fee assignment
- Fee collection and sequential receipts
- Payment Vouchers
- Read-only Daily Ledger / reports
- Inventory / stores and procurement flows already connected in the existing project
- Transport Setup, child assignment, driver / attendant access, trip monitor, reports and documents
- Visitor & Gate workflow
- Permanent school Gate QR self check-in
- Time-limited digital visitor pass after school approval
- Parent-confirmed Child Pickup flow
- School final approval before child pickup pass generation
- 15-minute one-time child pickup pass
- Optional browser phone alerts for signed-in parents who enable notifications
- Facilities & Housekeeping workflow
- Housekeeping verification / rework workflow
- Material shortage and maintenance request workflow

## Locked data rules

- One Student ID per child. Parent access, fees, attendance, transport, kits and lifecycle reuse that Student ID.
- One Staff ID per employee. Teacher access links to an existing Teaching Staff record; it does not create a second teacher identity.
- Classroom Master stays teacher-neutral; teacher assignment is a separate relationship.
- Ledger is report-only.
- Money In is created from receipts.
- Money Out is created from vouchers / approved system payments.
- No duplicate manual ledger postings.
- Visitor and housekeeping records are stored server-side only; no browser-only operational records are used.
- Public Gate QR does not expose the school student directory or parent contact details.
- Parent approval alone cannot release a child; school approval is also required.

## Visitor & Gate acceptance test

1. Sign in to the School Portal and open **Visitor & Gate**.
2. Confirm the permanent school QR / self check-in link is visible.
3. Scan the QR or open `gate-checkin.html?school_id=<school id>` on a second phone.
4. Submit a Visitor Check-in from that public page.
5. Confirm the visitor phone shows **Waiting approval** and does not show a usable pass yet.
6. Approve the visitor in the School Portal.
7. Confirm the visitor phone automatically shows the digital `VIS-...` pass and its validity time.
8. Check the visitor out and confirm the pass status closes.
9. Submit a Child Pickup request from the public gate page using an existing Student ID that has active Parent Access.
10. Confirm the pickup person sees **Parent confirmation: Pending**.
11. Sign in to the linked Parent Portal and approve the pickup person.
12. Confirm the School Portal changes the request to **Parent confirmed**.
13. Click **Approve gate pass** in the School Portal.
14. Confirm the pickup person's phone shows a `PUP-...` pass with a 15-minute validity.
15. Click **Release child** at the gate and confirm the public phone status becomes **Released**.
16. Confirm an expired pickup pass cannot be used to release the child.
17. Confirm the same closed pickup request cannot be released a second time.

Phone alert note: a parent who has enabled browser **Phone alerts** can receive the existing Neo School push notification when a pickup confirmation requires attention. Parent Portal polling also surfaces the approval card while the portal is open. This is not an SMS or WhatsApp integration.

Privacy check: do not store a full Aadhaar number in the visitor workflow. The public QR flow never displays student or parent lists.

## Facilities & Housekeeping acceptance test

1. Open **Facilities & Housekeeping**.
2. Create an area, for example `Ground Floor Washrooms`.
3. Add checklist items and cleaning frequency.
4. Assign a Housekeeping Attendant and a different Verifier / In-charge.
5. Add the shift and daily schedule times.
6. Record one scheduled cleaning as **Completed**.
7. From the verifier view, test **Rework required**.
8. Complete / review again and test **Verify**.
9. Confirm the same assignment + date + slot cannot be recorded twice.
10. Raise a **Material shortage** request, for example phenyl / handwash / garbage bags.
11. Move the request to **In progress** and then **Resolved**.
12. Raise a **Maintenance repair** request, for example leaking tap / damaged flush / light / fan.
13. Confirm the Inventory shortcut is available for material-shortage follow-up.

## Regression smoke test before client sign-off

### Identity and access

- School login
- Teacher login
- Employee login
- Parent login
- Password reset / replacement flows
- Disabled account cannot access the portal

### Student flow

- Create / import student
- Classroom link matches Programme and Academic Year
- Parent access links to the same Student ID
- Student 360 opens without creating any duplicate record
- Promotion keeps the same Student ID
- Withdrawal + Transfer Certificate works

### Teacher / HR flow

- Teaching Staff is created once in Staff Master
- Teacher Access links existing Staff ID
- Teacher Assignment links classroom to existing teacher
- Leave request → HR decision
- Salary Advance → HR approval → Finance release
- Payroll calculation → approval → payment

### Finance integrity

- Fee Structure creates student invoices only once
- Fee receipt posts one Money In ledger entry
- Voucher posts one Money Out ledger entry
- Salary Advance / Payroll payment creates system voucher and ledger posting
- No direct editable ledger posting is available
- Sequential Receipt and Voucher numbers continue correctly

### Transport

- Vehicle and route setup
- Driver / attendant access
- Child route assignment
- Pickup / Drop trip flow
- School trip monitor
- Vehicle documents / renewal dates
- Reports and CSV export

## Deployment requirement before final client sign-off

The GitHub `main` branch contains the current backend inside:

`worker/neo-lead-crm-api-worker-transport-phase1.js`

The production API used by the School Portal is:

`https://neo-lead-crm-api.umakanthgilla.workers.dev`

Before final handover, deploy the current Worker source to the existing `neo-lead-crm-api` Cloudflare Worker and run the Gate QR / Parent Pickup / Facilities acceptance tests above against the live School Portal.

Do not create a new Worker, new D1 database or parallel finance database for this deployment.

## Sign-off gate

Client handover can be marked complete after all of the following are true:

- Current `main` frontend is live.
- Current Worker source is deployed to the existing Worker.
- School login smoke test passes.
- QR visitor self check-in → school approval → digital pass → checkout passes.
- Child pickup request → parent approval → school approval → one-time pass → release passes.
- Housekeeping assignment / completion / verification passes.
- Material shortage / maintenance request passes.
- Fee receipt → ledger Money In passes.
- Voucher → ledger Money Out passes.
- Transport smoke test passes.
- Final client credentials are shared privately, not placed in the repository or handover document.

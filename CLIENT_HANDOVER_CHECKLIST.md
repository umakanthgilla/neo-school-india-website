# Neo School India — Client Handover Checklist

Last updated: 30 September 2026

## Source checkpoint

- Repository: `umakanthgilla/neo-school-india-website`
- Branch: `main`
- School portal: `schools.html`
- Current Worker source: `worker/neo-lead-crm-api-worker-transport-phase1.js`
- Visitor / Facilities backend source has been merged into the current Worker source.
- No new D1 tables are required for Visitor & Gate or Facilities & Housekeeping; both reuse `neo_portal_records` and `neo_portal_audit`.

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
- Child Pickup / Gate Release workflow
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

## Visitor & Gate acceptance test

1. Sign in to the School Portal.
2. Open **Visitor & Gate**.
3. Create a visitor entry with name, mobile, purpose and whom they are meeting.
4. Confirm a gate pass number is generated.
5. Approve the visitor and confirm the status becomes **Inside**.
6. Check the visitor out and confirm the status becomes **Exited**.
7. Create another visitor and confirm **Reject** closes the request without marking the person Inside.
8. Create a Child Pickup request against an existing Student ID.
9. Verify the pickup person / authorisation method and release the child.
10. Confirm the same closed pickup request cannot be released a second time.

Privacy check: only optional ID type and last four digits are stored by this workflow; do not enter or store a full Aadhaar number in the visitor form.

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

The GitHub `main` branch contains the updated Visitor & Gate and Facilities & Housekeeping backend inside:

`worker/neo-lead-crm-api-worker-transport-phase1.js`

The production API used by the School Portal is:

`https://neo-lead-crm-api.umakanthgilla.workers.dev`

Before final handover, deploy the current Worker source to the existing `neo-lead-crm-api` Cloudflare Worker and run the Visitor / Facilities acceptance tests above against the live School Portal.

Do not create a new Worker, new D1 database or parallel finance database for this deployment.

## Sign-off gate

Client handover can be marked complete after all of the following are true:

- Current `main` frontend is live.
- Current Worker source is deployed to the existing Worker.
- School login smoke test passes.
- Visitor check-in / approval / checkout passes.
- Child pickup authorisation / release passes.
- Housekeeping assignment / completion / verification passes.
- Material shortage / maintenance request passes.
- Fee receipt → ledger Money In passes.
- Voucher → ledger Money Out passes.
- Transport smoke test passes.
- Final client credentials are shared privately, not placed in the repository or handover document.

# Neo School India — Client Handover Checklist

Last updated: 1 October 2026

## Source checkpoint

- Repository: `umakanthgilla/neo-school-india-website`
- Branch: `main`
- School portal: `schools.html`
- Parent portal: `parents.html`
- Public gate page: `gate-checkin.html`
- Public enquiry page: `admission-enquiry.html`
- Secure parent admission page: `admission-form.html`
- Current Worker source: `worker/neo-lead-crm-api-worker-transport-phase1.js`
- Visitor / Facilities / Gate QR / parent-confirmed pickup / Admission workflow backend is merged into the current Worker source.
- No new D1 database is required; these workflows reuse existing Neo School records and audit storage.

## Handover status

### Ready in source

- School login and school workspace
- Student Master and classroom assignment
- Permanent shareable Student Admission No, for example `NEO26J0001`; internal UUID remains the database identity
- Admission No remains permanent through promotion and section changes
- Bulk Student import (CSV / Excel upload support)
- Student bulk template does not accept a manual Student ID or editable Admission No; both are system-generated
- Initial bulk import is class-wise ordered for neat first-time serial allocation; existing Admission Nos are never renumbered
- Staff Master and bulk Staff / Teaching Staff import
- Teacher login linking to existing Staff ID
- Teacher-to-classroom assignment
- Parent login linking to the existing student record
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
- Optional visitor / pickup-person photo capture for visual verification; no face recognition
- Gate photos are private and not exposed in the normal visitor register payload
- Parent-confirmed Child Pickup flow
- Child Pickup accepts the permanent Admission No or a legacy internal Student ID
- School final approval before child pickup pass generation
- 15-minute one-time child pickup pass
- Optional browser phone alerts for signed-in parents who enable notifications
- Closed visitor records can be removed individually or in bulk; pickup records are preserved
- Closed visitor auto-cleanup runs with a 7-day retention when Visitor & Gate opens
- Gate photo blobs older than 30 days are purged when a successful new gate photo is saved; no cron job is required
- Facilities & Housekeeping workflow
- Maintenance vertical submenu: Area / Zone Setup, Assign Attendant & Verifier, Cleaning Verification, Shortage / Repair Request
- Housekeeping verification / rework workflow
- Material shortage and maintenance request workflow
- Library layout with fixed Learning / Stories & Activities / Teacher & Spare rack groups; quantities remain in Inventory & Stores
- Basic Parent Enquiry form for Parent Name, Mobile, Child Name, DOB and Class of Interest
- Walk-in school Enquiry QR, Copy Link, Open Form and Print Enquiry QR
- School-side **Proceed / Manage Admission** action
- Secure parent Admission link with enquiry details carried forward
- Class-based previous-education rules: Playgroup none; Nursery Playgroup status; LKG Nursery details mandatory; UKG Nursery + LKG details mandatory; Daycare none
- Parent document upload for Birth Certificate, Aadhaar when supplied, and previous-class certificate where applicable
- Parent review + confirmation before final admission submission
- Admission status **Verification Pending** after parent submission
- School **Correction Required** and **Approve Admission** actions
- Student Master + permanent Admission No are created only on school approval; duplicate conversion is blocked
- Teacher is not used for admission data entry
- Students / Staff tab stability fix for the earlier repeated MutationObserver refresh loop
- Shared parent/public visual system: white/light background, colourful semantic icons, restrained Neo colour accents and consistent branding
- Parent Enquiry uses the same Neo `neo-wave.webm` character animation used on the public website hero
- Branded print outputs for Gate QR and Parent Enquiry QR
- Branded Transfer Certificate print with Neo logo, colour accents, student summary, optional Admission No, watermark and signature area
- Common Neo print shell applied to Student ID Cards, Hall Tickets, Report Cards and Salary Payslips

## Locked data rules

- The internal student UUID remains the canonical database key across fees, attendance, transport, kits, lifecycle and parent linkage.
- The Admission No is the permanent user-facing student identifier and is not regenerated on promotion or section change.
- New student import does not allow a user-entered internal Student ID or editable Admission No.
- Child Pickup accepts Admission No or a legacy internal Student ID so old records remain compatible.
- One Staff ID per employee. Teacher access links to an existing Teaching Staff record; it does not create a second teacher identity.
- Classroom Master stays teacher-neutral; teacher assignment is a separate relationship.
- Admission history and documents are entered by the parent through the secure Admission link; teachers do not retype admission data.
- Ledger is report-only.
- Money In is created from receipts.
- Money Out is created from vouchers / approved system payments.
- No duplicate manual ledger postings.
- Visitor and housekeeping records are stored server-side only; no browser-only operational records are used.
- Public Gate QR does not expose the school student directory or parent contact details.
- Parent approval alone cannot release a child; school approval is also required.
- Gate photos are for visual verification only, remain private, and are not used for face recognition.
- Visitor record cleanup and photo cleanup are separate: closed visitor records use the configured visitor retention flow, while photo blobs use the 30-day age cleanup on successful photo upload.

## Admission workflow acceptance test

1. Open the School Portal and the Admission / Enquiry area.
2. Confirm **Copy enquiry link**, **Open form** and **Print Enquiry QR** are visible.
3. Open the public enquiry form on a second device and submit Parent Name, Mobile, Child Name, DOB and Class of Interest.
4. Confirm the school sees the new enquiry without previous-school details or document fields at the enquiry stage.
5. Click **Proceed / Manage Admission** and confirm a unique secure parent admission link is available.
6. Open the secure parent link and confirm enquiry details are carried forward.
7. Verify previous-education rules by class:
   - Playgroup: no previous academic details.
   - Nursery: Playgroup status can be Completed / Not attended / First school.
   - LKG: Nursery school, city and completion year are required.
   - UKG: Nursery and LKG school, city and completion year are required.
   - Daycare: no previous academic details.
8. Upload the Birth Certificate and applicable previous-class certificate; test Aadhaar only when the parent chooses to supply it.
9. Confirm the parent sees a Review & Confirm step and must confirm the entered details before final submission.
10. Confirm the submitted application becomes **Verification Pending** and no Student Master record is created yet.
11. Test **Correction Required**, reopen the secure link, correct the data and resubmit.
12. Select the correct classroom and click **Approve Admission**.
13. Confirm exactly one Student Master record is created with an internal UUID and a permanent Admission No such as `NEO26J0001`.
14. Re-open / retry the same application and confirm it cannot create a duplicate student.

## Visitor & Gate acceptance test

1. Sign in to the School Portal and open **Visitor & Gate**.
2. Confirm the permanent school QR / self check-in link is visible.
3. Scan the QR or open `gate-checkin.html?school_id=<school id>` on a second phone.
4. Submit a Visitor Check-in from that public page.
5. When testing photo capture, confirm the visitor photo is optional, compressed client-side and used only for visual verification.
6. Confirm the visitor phone shows **Waiting approval** and does not show a usable pass yet.
7. Approve the visitor in the School Portal.
8. Confirm the visitor phone automatically shows the digital `VIS-...` pass, photo when supplied, and its validity time.
9. Check the visitor out and confirm the pass status closes.
10. Submit a Child Pickup request using an existing Admission No such as `NEO26J...` that has active Parent Access. A legacy internal Student ID should also continue to work.
11. Add the pickup-person photo / parent-card photo when testing the enhanced visual-verification flow.
12. Confirm the pickup person sees **Parent confirmation: Pending**.
13. Sign in to the linked Parent Portal and approve the pickup person.
14. Confirm the School Portal changes the request to **Parent confirmed**.
15. Click **Approve gate pass** in the School Portal.
16. Confirm the pickup person's phone shows a `PUP-...` pass with the photo when supplied and a 15-minute validity.
17. Click **Release child** at the gate and confirm the public phone status becomes **Released**.
18. Confirm an expired pickup pass cannot be used to release the child.
19. Confirm the same closed pickup request cannot be released a second time.
20. Confirm closed Visitor records can be deleted / bulk-cleared while active Waiting / Inside visitors are protected.
21. Confirm Pickup records are not removed by Visitor cleanup.

Phone alert note: a parent who has enabled browser **Phone alerts** can receive the existing Neo School push notification when a pickup confirmation requires attention. Parent Portal polling also surfaces the approval card while the portal is open. This is not an SMS or WhatsApp integration.

Photo-retention note: gate photo blobs older than 30 days are deleted during a successful new photo save. This is an upload-triggered global age cleanup, not a scheduled cron process.

Privacy check: do not store a full Aadhaar number in the visitor workflow. The public QR flow never displays student or parent lists. Gate photos are private and no face recognition is performed.

## Facilities & Housekeeping acceptance test

1. Open **Facilities & Housekeeping** / Maintenance.
2. Confirm the left-side Maintenance submenu shows: **Area / Zone Setup**, **Assign Attendant & Verifier**, **Cleaning Verification**, **Shortage / Repair Request**.
3. Create an area, for example `Ground Floor Washrooms`.
4. Add checklist items and cleaning frequency.
5. Assign a Housekeeping Attendant and a different Verifier / In-charge.
6. Add the shift and daily schedule times.
7. Record one scheduled cleaning as **Completed**.
8. From the verifier view, test **Rework required**.
9. Complete / review again and test **Verify**.
10. Confirm the same assignment + date + slot cannot be recorded twice.
11. Raise a **Material shortage** request, for example phenyl / handwash / garbage bags.
12. Move the request to **In progress** and then **Resolved**.
13. Raise a **Maintenance repair** request, for example leaking tap / damaged flush / light / fan.
14. Confirm the Inventory shortcut is available for material-shortage follow-up.

## Public visual & print acceptance test

1. Open the Parent Enquiry form and confirm the Neo logo, restrained colourful accents, semantic icons and the website-matched `neo-wave.webm` character render cleanly without crop or pasted-box appearance.
2. Open the Parent Admission form and confirm Child & Parent, Previous Education, Documents and Review sections use the same visual family.
3. Open the public Gate page and confirm Visitor / Child Pickup tabs and form fields use consistent colourful icons on a clean white/light background.
4. Print the Gate QR and confirm a white, colour-accented Neo A4 layout with readable QR and school details.
5. Print the Parent Enquiry QR and confirm the same print family.
6. Generate a Transfer Certificate and confirm Neo logo, colour strip, student summary, fee-status badge, signature area and watermark are visible; Admission No appears when available.
7. Open **Documents & downloads** and print / save a Student ID Card, Hall Ticket and Report Card. Confirm they use the common Neo print shell and remain readable in print/PDF.
8. Print a paid Salary Payslip and confirm it uses the same branded print shell.

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
- System generates internal UUID + Admission No; neither is manually entered in the new bulk template
- Classroom link matches Programme and Academic Year
- Parent access links to the same student record
- Student 360 opens without creating any duplicate record
- Promotion keeps the same internal UUID and Admission No
- Withdrawal + Transfer Certificate works
- Parent Enquiry → secure Admission → school approval creates the student exactly once

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

The Admission workflow / Admission No / Gate photo Worker changes have already been deployed during this implementation cycle. Before final handover, run the acceptance tests above against the live School Portal and the existing production Worker.

Do not create a new Worker, new D1 database or parallel finance database for this deployment.

## Sign-off gate

Client handover can be marked complete after all of the following are true:

- Current `main` frontend is live.
- Current Worker source is deployed to the existing Worker.
- School login smoke test passes.
- Parent Enquiry → Proceed → secure Admission → parent submit → school approval → permanent Admission No passes.
- QR visitor self check-in → school approval → digital pass → checkout passes.
- Admission No Child Pickup → parent approval → school approval → one-time pass → release passes.
- Gate visual-verification photo flow passes and private photo behavior is confirmed.
- Visitor closed-record cleanup preserves Pickup history.
- Housekeeping assignment / completion / verification passes.
- Material shortage / maintenance request passes.
- Fee receipt → ledger Money In passes.
- Voucher → ledger Money Out passes.
- Transport smoke test passes.
- Gate QR, Enquiry QR, Transfer Certificate and Documents / Payslip print smoke test passes.
- Final client credentials are shared privately, not placed in the repository or handover document.

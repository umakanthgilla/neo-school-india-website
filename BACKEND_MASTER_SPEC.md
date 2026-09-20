# Neo School Backend Master Specification

Status: architecture contract for Worker/API implementation
Principle: ONE SOURCE → MULTIPLE PERMISSION-CONTROLLED VIEWS.

## Non-negotiable identity rules
- A person is created once in Staff Master. Teaching/non-teaching/driver/admin/accounts/HR/store/support are roles/responsibilities on the same Staff ID.
- Login/account is not a second person record. Access records reference staff_id.
- A student is created once. Fees, attendance, transport, kits, credentials, observations and promotion reference student_id.
- Class/section is created once per academic year and referenced by classroom_id.
- Money and stock events are recorded once at source and projected to Finance/Inventory; no duplicate manual posting.
- Sensitive changes require actor, timestamp and audit event.

## Existing frontend/API surface to preserve
Portal route pattern:
GET/POST/PATCH /api/portal/:school_id/:resource[/id]

Observed resources currently consumed by the frontend include:
students, classrooms, fee_structures, homework, announcements, parent_access,
teacher_access, teacher_tasks, staff, staff_attendance, payroll, exams, assessments,
enquiries, attendance, invoices, payments, orders, ledger, support, stock_items, stock_moves.
Do not break these while normalising relationships.

## Canonical masters
### schools
id, name, code, city, status, timezone, created_at, updated_at.

### academic_years
id, school_id, code (example 2026-27), status, created_at.
Unique: school_id + code.

### classrooms
id, school_id, academic_year_id, program, name/section, capacity, teacher_staff_id nullable, status.
Class teacher MUST reference staff.id; temporary compatibility may read legacy teacher_id.

### students
id, school_id, admission_no, name, dob, gender, parent/contact fields, current_classroom_id, status, admission_date.
Unique: school_id + admission_no.
Historical class movement belongs in student_enrolments, not overwritten history.

### staff
id, school_id, staff_code, name, department, role/designation, mobile, email, dob, gender,
joining_date, salary_paise, emergency_mobile, status, created_at, updated_at.
Unique: school_id + staff_code; mobile duplicate validation within school where practical.

### user_accounts / access
id, school_id, staff_id nullable, student/parent linkage where applicable, login identifier,
role, active, credential metadata. Never store or return plaintext password.
Teacher access MUST reference staff_id rather than create a second teacher person.

## HR
### staff_attendance
id, school_id, staff_id, date, status (Present/Absent/Leave/Half day), late_minutes,
notes, created_by, updated_by.
Unique: staff_id + date.

### leave_types
id, school_id, name, paid/unpaid, annual_limit, active.

### staff_leave
id, school_id, staff_id, leave_type_id, from_date, to_date, days, reason,
status (Draft/Pending/Approved/Rejected/Cancelled), approved_by, approved_at.
Approved leave feeds attendance/payroll.

### salary_advances
id, school_id, staff_id, amount_paise, request_date, reason,
status (Pending/Approved/Rejected/Paid/Recovered), approved_by,
payment_transaction_id, recovery_payroll_id.
Advance payment creates one finance transaction; payroll recovery references it.

### payroll
id, school_id, staff_id, month, gross_paise, deductions_paise, advance_recovery_paise,
other_adjustments_paise, net_paise, status (Draft/Approved/Paid), approved_by,
payment_transaction_id, created_at.
Unique: staff_id + month.
Payroll uses Staff Master salary as input, attendance/approved leave and advances as linked inputs.

## Student lifecycle
### student_enrolments
id, student_id, academic_year_id, classroom_id, start_date, end_date, status.
### student_movements
id, student_id, type (Promotion/SectionChange/TC/Withdrawal/Alumni), from_enrolment_id,
to_enrolment_id nullable, effective_date, reason, document_id, approved_by.
Never destroy previous academic-year history.

## Fees and finance
### fee_structures / fee_assignments / invoices
Fee head/template → class assignment → optional student adjustment → invoice/due.
### payments
One collection transaction with payment mode Cash/UPI/Bank Transfer/Cheque and receipt number.
Payment automatically creates/links a finance transaction; no re-entry.
Cheque lifecycle: Received → Deposited → Cleared/Bounced.
### finance_transactions
id, school_id, date, direction (IN/OUT), category, amount_paise, payment_mode,
source_type, source_id, reference_no, status, notes, created_by.
Unique source link prevents duplicate posting.
### cash_bank_closings
opening cash, collections, expenses, cash in hand, digital/bank, pending cheque, closing.

## Inventory / procurement
### stock_items
Canonical item master with category Fixed Asset / Student Material / Consumable.
### stock_moves
item_id, direction IN/OUT/ADJUST, quantity, source_type/source_id, recipient_staff_id/student_id.
Student kit issue references student_id and reduces stock once.
### vendors, purchase_requests, purchase_orders, goods_receipts, vendor_bills
Shortage → request → approval → vendor → PO → GRN → stock → bill → finance payment.
Goods receipt is the source for stock increase; vendor payment is the source for cash outflow.

## Academics / child growth
Keep existing Calendar/Curriculum/Timetable APIs.
Add canonical period execution/evidence:
period_executions, child_observations, activity_evidence, weekly_reviews, adoption_calls,
followup_actions, ptm_records, journal_entries.
Observation outcomes: Not observed / Participated / With support / Independent / Needs follow-up.
Tests/exams are additional evidence, not the central child-assessment model.

## Transport
routes, stops, vehicles, trips, driver_assignments, student_transport_assignments, trip_events.
Driver assignment references staff_id. Student allocation references student_id.
Trip events: Start → Pickup → School Arrival → Return → Drop → Complete.
GPS provider data is an integration behind the Neo workflow.

## Safety / operations
visitor_entries, child_release_events, health_incidents, authorised_pickups,
maintenance_tickets, asset_service_events, housekeeping_schedules, housekeeping_checks.

## Horizontal engines
### approvals
id, school_id, request_type, source_id, requested_by, assigned_to,
status, decision_note, decided_at.
Used for leave, advances, purchases, expenses, concessions/refunds, stock adjustments and exceptional release.

### notifications
event_type, source_id, recipient_type/id, channel, delivery_status, read_at, acknowledged_at.

### audit_events
school_id, actor_account_id, actor_staff_id, action, entity_type, entity_id,
before_json, after_json, request_id, created_at.
Append-only. Required for fee/payment, finance, payroll, stock, access and student lifecycle changes.

### documents
owner_type, owner_id, document_type, storage_key, version, status, uploaded_by.

## Permission baseline
Head Office: network standards + authorised multi-school visibility.
Principal/School Master: full school oversight + approvals.
Admin/Front Office: admissions/student/parent/fees/notices/visitor operations.
Accounts: finance, reconciliation, vendor payments.
HR: staff, attendance, leave, advances, payroll.
Inventory: stock/procurement issue/receive.
Teacher: assigned classroom academic execution only.
Transport In-charge: routes/vehicles/trips/allocations.
Driver: assigned vehicle/trip events only.
Parent: own child only.
Every API must enforce school_id scope server-side; UI hiding is not security.

## API work required next
Priority A — identity integrity:
1. Staff canonical master + PATCH support.
2. Teacher access: select existing staff_id, enable login, assign classrooms; migrate legacy account_id/name records safely.
3. Classroom class-teacher FK to staff_id.
4. Student enrolment/history model.

Priority B — HR end-to-end:
5. leave_types + staff_leave endpoints.
6. salary_advances endpoints.
7. approval integration for leave/advance.
8. payroll calculation inputs + approve/pay endpoints.
9. finance transaction generated from salary/advance payment.

Priority C — money integrity:
10. finance_transactions + receipts/vouchers + daily closing.
11. source_type/source_id idempotency for fees/payroll/procurement.

Priority D — inventory/procurement:
12. recipient-linked stock moves and child kit issue.
13. procurement/GRN/vendor bill chain.

Priority E — operational modules:
14. student lifecycle.
15. transport.
16. visitor/health/maintenance/housekeeping.
17. notification + audit + documents.

## Cross-check / acceptance tests
- Creating a teacher never creates a second Staff person.
- Changing a staff name is reflected wherever Staff ID is displayed.
- Same staff/date attendance cannot duplicate.
- Same staff/month payroll cannot duplicate.
- Approved leave affects attendance/payroll from linked data, not re-entry.
- Salary advance payment posts once to Finance and recovery references the same advance.
- Fee receipt posts once to Finance.
- Kit issue reduces stock once and appears on Student 360.
- Promotion creates next enrolment and preserves old enrolment.
- Driver is selected from Staff Master and receives only assigned trips.
- Parent APIs cannot read another child.
- School A token cannot access School B records.
- Every sensitive mutation has an audit event.
- POST endpoints accept request_id/idempotency key to prevent double-submit duplicates.

## Backend boundary
The Worker source is not present in this repository. This specification does NOT claim these missing tables/routes are deployed. Frontend modules marked Backend pending must remain non-fake until Worker persistence and permission checks are implemented.

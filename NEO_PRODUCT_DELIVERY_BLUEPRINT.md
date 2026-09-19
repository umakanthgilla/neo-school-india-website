# Neo School India — Product Delivery Blueprint
Updated: 2026-09-20

## Product rule
Neo School is organised micro-to-macro: users enter their role/department first and see only work relevant to them. School Master retains full school control. Existing verified curriculum, teacher execution, parent curriculum view and student attendance flows are not to be rebuilt.

## School Master
Department navigation:
1. Overview / Needs Attention
2. Academics
3. Students & Parents
4. Teachers
5. Front Office & Admissions
6. HR & Payroll
7. Fees & Accounts
8. Inventory & Stores
9. Communication
10. Exams & Performance
11. Transport & Safety
12. Documents & Reports
13. Operations & Support
14. Settings & Access

School Master can view/control all departments subject to audit logging.

## Teacher
Scope: assigned classrooms/students only.
- Today / classes / timetable / curriculum
- Student attendance
- Class work and homework
- Student observation, performance, teacher comments and journal/diary
- Classroom activities and celebration photos
- Relevant school announcements
- Classroom/student reports and permitted downloads
Do not expose fee collection, school accounts, HR or payroll merely because the data exists.

## HR
Scope: employees only.
- Staff master/profile
- Attendance, late marks and attendance corrections
- Leave types configurable by school (paid, sick, other)
- Leave application -> principal/authorised approval -> sanction/reject
- Salary structure
- Staff advances/recovery
- Monthly payroll processing/approval/payment
- Payslips and payroll register
- HR documents/reports
Payroll is not complete unless attendance/leave/salary/advance -> payroll -> approval/payment -> payslip/report is connected.

## School Admin / Front Office
- Enquiries and admission operations
- Student/parent operational records
- Absentee follow-up/calls
- Fee dues/reminders
- Class/student-wise fee collection and receipts
- Announcements, circulars, emergency/sudden holidays
- Parent communication/support
- Inventory & stores operations
- Daily accounts: income, expenses, vouchers, cash/bank and closing

## Fees & Accounts
Avoid duplicate financial entry.
- Fee structure -> assignment -> dues -> collection -> receipt -> reports
- Income automatically receives fee/other collections
- Expense voucher: number, date, category, amount, payment mode, paid-to, purpose, attachment/reference, approver
- Expense categories configurable: stationery, refreshments, printing/paper, celebrations/events, maintenance, utilities, transport, petty cash, other
- HR salary payment and staff advance feed Accounts; inventory purchases can feed expenses
- Opening cash, cash income, cash expenses, bank deposit/withdrawal, counter closing cash, bank/UPI/card movements
- Daily Closing / Day Book with income, expenditure, counter cash and bank movement
- Actual accounting Balance Sheet remains a separate financial statement, not a label for daily cash closing.

## Inventory & Stores
- Item/category master
- Opening stock / stock in / purchase
- Issue to student, staff, classroom or school use
- Return
- Damage/loss
- Adjustment with reason
- Current balance
- Issue register: who received what, quantity and date
- Low-stock visibility
- Stock movement/history and downloadable reports
- Books, uniforms, stationery, classroom/cleaning/other supplies

## Parent
Own child only.
- Today/daily work and homework
- Attendance
- Teacher observations/comments
- Performance, diary/journal
- Activities/photos
- School announcements/circulars
- Fees, receipts and fee structure
- Complaint/support ticket
- Own child's hall ticket, report card, journal and other authorised documents/downloads
Never expose another child's information.

## Documents & Reports
Use one permission-aware reporting engine rather than scattered duplicate download implementations.
- View -> Filter -> Generate -> Print/PDF -> Excel where appropriate
- Parent: own-child documents/reports
- Teacher: assigned-class/student reports and personal permitted staff documents
- Admin: fees, collection, dues, daily accounts, vouchers, inventory, admissions, attendance follow-up
- HR: staff register, attendance, late marks, leave, advances, payroll, payslips
- School Master: all authorised school reports by department

## Student 360
Single student identity connecting profile, class, attendance, classwork, homework, observations, performance, assessments, report cards, fees, activities/photos, journal, documents and parent communication. Roles see permission-filtered views of the same record.

## Staff 360
Single staff identity connecting profile, role, attendance, late marks, leave, salary structure, advances, payroll, payslips and staff documents.

## Transport & Safety — planned integration
Reserve architecture now; third-party integrations later.
Trip lifecycle:
Driver Start Route -> parent sees started -> approaching pickup -> Ready -> Picked Up -> En Route -> Arrived School -> Dropped at School.
Return route reverses the flow through school departure, approaching stop, parent alert, child dropped, acknowledgement and route completion.
Phase 1 can use authorised driver-phone GPS during active trip. Phase 2 can replace location source with GPS vendor API/webhooks. Phase 3 may add ETA/geofencing/delay automation. Parents see only their child's assigned transport context.

## CCTV — planned integration
CCTV is a third-party integration layer, not a camera system built by Neo School. Reserve camera zones, vendor integration and authorised monitoring. Parent live CCTV access is not a default requirement because privacy/security controls must be designed first.

## Additional product areas to reserve
- Visitor / Gate management
- Vendor / Supplier management
- Purchase/expense approvals
- School assets & maintenance
- Certificates and school documents
- Notifications
- Audit trail for sensitive changes and financial/HR actions
- Backups/data export
- Role and permission management

## UX rule
No flat 50–100 item navigation. Dashboard first shows Needs Attention; department cards then expose relevant submodules. Show information where action happens. Avoid unnecessary cross-role duplication.

Examples:
School Master: absent students/staff, leave approvals, fee overdue, parent concerns, transport alerts, missing classroom attendance.
HR: attendance pending, late marks, leave approvals, advances, payroll pending.
Admin: absentee calls, follow-ups, fee dues/collections, admissions, parent requests.
Teacher: today's classes, attendance, curriculum, classwork/homework, observations/messages.
Parent: today, homework, attendance, teacher note, activities, announcements, fees, downloads, support.

## Delivery status rule
A screen/form is not a completed module. Mark complete only when its required workflow, persistence, permissions, validation and outputs are connected and tested. If backend support/source is unavailable, mark the module Backend-blocked rather than simulating persistence.

## Current constraints
The frontend repository is available. The Cloudflare Worker source for new Staff/Payroll/Exam/Assessment persistence is not present in this repository and no direct Worker deployment connector is currently available. Do not fake backend completion. Frontend may expose truthful backend-pending states until Worker access/source is available.

## Delivery order
1. Preserve verified existing flows.
2. Role/department information architecture.
3. Student 360 and Staff 360 data/view model.
4. Core gaps: HR/payroll, admin/accounts, inventory, admissions/front office, exams/documents.
5. Permission-aware reports/downloads and notifications.
6. Transport workflow.
7. GPS vendor integration.
8. CCTV/vendor integrations.

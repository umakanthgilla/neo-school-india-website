# Neo School India — Final V1 Architecture & Online Test Flow

Status: Final architecture lock for client handover

## Architecture lock

| Area | Previous grouping | Final grouping |
|---|---|---|
| School overview | Operational dashboard | Same; continues as executive snapshot |
| School setup | Setup/readiness | Same |
| Academics | Calendar, curriculum, timetable, learning report, classrooms, homework, subjects, exams, assessments | Academics & Learning: Calendar → Curriculum → Subjects → Classrooms → Timetable → Teaching Progress → Homework → Learning Report → Question Bank → Online Tests → Exams → Assessments → Test Analytics |
| Students & parents | Student master, attendance, adoption/PTM, lifecycle, health, parent access, concerns | Same logical grouping |
| Teachers | Teacher access, teacher tasks | Same administration grouping; teacher daily academic work remains in Teacher Portal |
| Front office | Enquiries, notices, visitor/gate | Same logical grouping |
| HR & payroll | Staff, attendance, HR rules, payroll | Same logical grouping |
| Finance | Ledger, vouchers, funds, credit purchases, fees, collections | Fees → Assigned Fees → Collections → Vouchers → Ledger/Reports → Management Funds |
| Inventory | Inventory, purchase/vendors/assets | Procurement & Stores: Purchase/Vendors/Assets → Orders → Credit Purchases → Inventory |
| Head Office Ledger | Balance/deposits, HO payments | Same |
| Transport | Setup, monitoring, reports, documents | Same |
| Governance | Approvals, notifications, audit | Same |
| Documents | IDs, documents, reports | Same |

## Online Test closed-loop

Curriculum
→ Teacher confirms completed lesson/topic
→ Teaching Progress
→ Question Bank draft generation
→ Basic / Medium / Hard tagging
→ Teacher/School review and approval
→ Online Test creation
→ Publish to selected classroom
→ Child attempts from Parent/Student learning portal
→ MCQ / True-False / Fill-in-the-Blank auto evaluation
→ Short Answer teacher review
→ Final result
→ Test analytics / child progress

## Question Bank rules

Every question stores:
- Classroom / programme / academic year
- Subject
- Chapter
- Topic
- Difficulty: Basic / Medium / Hard
- Question type: MCQ / True-False / Fill-in-the-Blank / Short Answer
- Marks
- Correct answer where auto-evaluation is supported
- Draft / Approved status
- Source: manual or completed curriculum

Generated curriculum questions are always created as Draft and must be reviewed before they can be used in a published test.

## Mixed difficulty default

Target mix:
- 40% Basic
- 40% Medium
- 20% Hard

If the approved bank does not contain enough items at one level, the test builder fills the remaining count from the other approved questions in the selected chapters.

## Role separation

### School Portal
Setup → Assign → Approve → Publish → Monitor

### Teacher Portal
Teach → Confirm completion → Review tests → Evaluate short answers → Follow-up / PTM

### Parent / Student Learning Portal
Learn → Homework → Online Test → Submit → Result / Progress

## Handover rule

Do not redesign completed finance, HR, student, transport, procurement, certificate or document workflows for V1. New client requirements after this lock should be treated as V1.1 / Phase 2 unless they are corrections to an agreed V1 function.

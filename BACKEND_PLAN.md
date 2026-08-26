# AZM.AIO — Educational & Scholarship Management System Backend Plan

This document is the single source of truth for building the backend. Give this
file to Antigravity (or any coding agent) at the start of every session so it
has full context without you re-explaining the project each time.

---

## 1. What This System Does

A unified examination, student registration, and scholarship platform for AZM.AIO
and its network of partner schools. Core modules:

- Student registration → auto-generated Roll Number + unique QR code
- QR-based attendance (examiner/teacher scans QR, system marks present)
- Fee challans + fee collection tracking
- Teacher & Staff management
- Payroll
- Transactions ledger (money in/out, tied to fees + payroll)
- Role-based admin dashboard (Super Admin, Admin, Teacher, Accountant roles)

---

## 2. Tech Stack (recommended, adjust if you already have a preference)

| Layer | Choice | Why |
|---|---|---|
| Backend framework | Node.js + Express (or Fastify) with TypeScript | Matches your existing stack (DomainCraft, POS apps), fast to scaffold |
| Database | PostgreSQL | Relational data (students↔fees↔attendance), needs real joins and constraints |
| ORM | Prisma | Type-safe, generates migrations, easy for an agent to reason about schema changes |
| Auth | JWT (access + refresh tokens) + bcrypt for passwords | Simple, stateless, works for both web dashboard and future mobile scanning app |
| QR generation | `qrcode` npm package (server-side, generates PNG/SVG data) | Each QR encodes a signed token, not raw roll number (security) |
| QR scanning (examiner side) | `html5-qrcode` or device camera via browser, hits an API endpoint | No native app needed initially — works in browser on any phone |
| File storage | Local disk in dev → S3-compatible bucket in production (student photos, QR images) | Keep it swappable, don't hardcode local paths deep in business logic |
| Validation | Zod | Shared validation schemas between frontend forms and backend routes |

---

## 3. Clean Folder Structure

This is the structure to hand to Antigravity. Ask it to scaffold exactly this —
a clean, modular layout is what makes a backend "look professional" to another
human reading it later.

```
/backend
  /src
    /modules
      /auth
        auth.routes.ts
        auth.controller.ts
        auth.service.ts
        auth.schema.ts        (zod validation)
      /students
        students.routes.ts
        students.controller.ts
        students.service.ts
        students.schema.ts
      /attendance
        attendance.routes.ts
        attendance.controller.ts
        attendance.service.ts
        qr.service.ts          (QR generation + verification logic lives here)
      /fees
        fees.routes.ts
        fees.controller.ts
        fees.service.ts
      /payroll
        ...same pattern
      /staff
        ...same pattern
      /transactions
        ...same pattern
      /dashboard
        dashboard.controller.ts   (aggregation queries for the overview cards)
    /middleware
      auth.middleware.ts       (JWT verification, attaches req.user)
      role.middleware.ts       (checks req.user.role against allowed roles)
      error.middleware.ts      (single place all errors get formatted)
      validate.middleware.ts   (runs zod schemas against req.body)
    /lib
      prisma.ts                (single Prisma client instance)
      jwt.ts
      hash.ts
      logger.ts
    /config
      env.ts                   (validates .env on startup, fails fast if missing vars)
    app.ts                     (express app setup, mounts all module routers)
    server.ts                  (just calls app.listen)
  /prisma
    schema.prisma
    /migrations
  .env.example
  package.json
  tsconfig.json
```

**Why this matters:** every module is self-contained (routes → controller →
service → schema, all in one folder). A human opening this repo for the first
time can find "everything about fees" in one place instead of hunting across
scattered files. This is the #1 thing that makes a backend feel clean vs messy.

---

## 4. Database Schema (core tables)

Give this to the agent as the starting `schema.prisma` shape — it can refine
field types but the relationships should stay intact.

```prisma
model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  passwordHash  String
  role          Role
  createdAt     DateTime @default(now())
}

enum Role {
  SUPER_ADMIN
  ADMIN
  TEACHER
  ACCOUNTANT
}

model Student {
  id            String   @id @default(cuid())
  rollNumber    String   @unique          // e.g. "JPS-2026-0453"
  fullName      String
  fatherName    String
  cnicOrBForm   String   @unique
  dateOfBirth   DateTime
  gender        String
  classLevel    String                     // "Class 6th", "SSC-II" etc
  photoUrl      String?
  qrToken       String   @unique           // signed unique token encoded in the QR
  qrImageUrl    String?                    // generated QR image (S3/local path)
  status        StudentStatus @default(ACTIVE)
  createdAt     DateTime @default(now())

  attendance    Attendance[]
  feeRecords    FeeRecord[]
}

enum StudentStatus {
  ACTIVE
  INACTIVE
  GRADUATED
}

model Attendance {
  id            String   @id @default(cuid())
  studentId     String
  student       Student  @relation(fields: [studentId], references: [id])
  date          DateTime @default(now())
  status        AttendanceStatus
  markedByUserId String              // which teacher/examiner scanned
  method        AttendanceMethod    // QR_SCAN or MANUAL
  createdAt     DateTime @default(now())

  @@unique([studentId, date])        // prevents double-marking same day
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
}

enum AttendanceMethod {
  QR_SCAN
  MANUAL
}

model FeeRecord {
  id            String   @id @default(cuid())
  studentId     String
  student       Student  @relation(fields: [studentId], references: [id])
  month         String                     // "2026-08"
  amountDue     Decimal
  amountPaid    Decimal  @default(0)
  status        FeeStatus @default(UNPAID)
  challanNumber String   @unique
  dueDate       DateTime
  paidAt        DateTime?
  createdAt     DateTime @default(now())
}

enum FeeStatus {
  UNPAID
  PARTIAL
  PAID
  OVERDUE
}

model Staff {
  id            String   @id @default(cuid())
  fullName      String
  role          String                     // "Teacher", "Accountant", "Peon" etc
  cnic          String   @unique
  phone         String
  joinDate      DateTime
  salary        Decimal
  status        StaffStatus @default(ACTIVE)
  payroll       PayrollRecord[]
}

enum StaffStatus {
  ACTIVE
  INACTIVE
}

model PayrollRecord {
  id            String   @id @default(cuid())
  staffId       String
  staff         Staff    @relation(fields: [staffId], references: [id])
  month         String
  amount        Decimal
  status        PayrollStatus @default(PENDING)
  paidAt        DateTime?
}

enum PayrollStatus {
  PENDING
  PAID
}

model Transaction {
  id            String   @id @default(cuid())
  type          TransactionType
  amount        Decimal
  description   String
  relatedFeeId    String?
  relatedPayrollId String?
  createdAt     DateTime @default(now())
}

enum TransactionType {
  FEE_INCOME
  SALARY_EXPENSE
  OTHER_INCOME
  OTHER_EXPENSE
}
```

---

## 5. QR Attendance Flow — Step by Step

This is the piece you specifically asked about. Here's exactly how it should work:

### Registration time
1. Student is registered through the admin dashboard → gets `rollNumber`
   (e.g. `JPS-2026-0453`) and a `qrToken` — a **signed random string**, not
   the roll number itself. (Never put the raw roll number in the QR — if a
   student's QR is lost or photographed, a signed token can be revoked/rotated
   without anyone being able to forge another student's attendance.)
2. Backend generates a QR image encoding a URL like:
   `https://yourapp.com/attend?token=<signed_qr_token>`
3. QR image is stored (S3/local) and linked to the student's profile —
   printable on an ID card.

### Attendance marking time (examiner side)
1. Teacher/examiner opens a simple web page (`/scan`) on their phone —
   no native app needed, just camera access in browser.
2. Camera scans the QR → extracts the token → sends `POST /api/attendance/scan`
   with `{ qrToken, markedByUserId }`.
3. Backend:
   - Looks up student by `qrToken`
   - Checks student status is `ACTIVE`
   - Checks no attendance record exists for that student+today (the
     `@@unique([studentId, date])` constraint on the Attendance model
     enforces this at the DB level too, as a safety net)
   - Creates `Attendance` record with `method: QR_SCAN`
   - Returns student name + photo so the examiner gets instant visual
     confirmation ("Ali Hassan — marked present ✓")
4. If a student forgot their QR/card, examiner can also search by roll
   number and mark manually (`method: MANUAL`) — same endpoint, different
   input, same audit trail (`markedByUserId` always recorded).

### Why this design is clean
- One endpoint (`POST /api/attendance/scan`) handles both QR and manual
  fallback — no duplicated logic.
- The unique constraint at the database level prevents double-marking even
  if two examiners scan the same student by accident.
- Signed tokens mean you can invalidate/reissue a QR (lost card) without
  touching the roll number or any historical records.

---

## 6. Authentication & Roles

- Login: `POST /api/auth/login` → returns `{ accessToken, refreshToken, user }`
- All protected routes go through `auth.middleware.ts` (verifies JWT) then
  `role.middleware.ts` (checks role is allowed for that route)
- Suggested role permissions:
  - `SUPER_ADMIN` — everything, including creating other admin accounts
  - `ADMIN` — students, attendance, fees, staff, dashboard (no user management)
  - `TEACHER` — attendance scanning only, view own class students
  - `ACCOUNTANT` — fees, payroll, transactions, dashboard financial widgets only

---

## 7. Core API Endpoints (v1 scope)

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

GET    /api/students
POST   /api/students                    (creates student + roll number + QR)
GET    /api/students/:id
PATCH  /api/students/:id
DELETE /api/students/:id
GET    /api/students/:id/qr             (returns QR image)

POST   /api/attendance/scan             (QR or manual marking — see section 5)
GET    /api/attendance/today
GET    /api/attendance/student/:id      (history for one student)

GET    /api/fees
POST   /api/fees/generate-challan
POST   /api/fees/:id/mark-paid
GET    /api/fees/overview               (collection %, overdue count)

GET    /api/staff
POST   /api/staff
GET    /api/payroll
POST   /api/payroll/run                 (generates month's payroll records)
POST   /api/payroll/:id/mark-paid

GET    /api/transactions

GET    /api/dashboard/overview          (all the cards on your screenshot:
                                          total students, today's attendance %,
                                          fee collection %, active staff count,
                                          financial flow, demographics)
```

---

## 8. The "Loop-Based Prompt System" — How To Set This Up

What you've heard about is essentially an **iterative build loop**: instead of
one giant prompt asking the agent to build everything, you run the agent
through the same small cycle repeatedly, once per module. This is more
reliable than a single mega-prompt because the agent verifies its own work
before moving on, instead of compounding mistakes across a huge codebase.

**The loop, repeated for every module (auth → students → attendance → fees → payroll → dashboard):**

```
1. PLAN   — Agent reads this BACKEND_PLAN.md + the specific module section,
            and writes a short implementation plan for just that module 
            (files it will create/edit, in 3-6 bullet points).
2. BUILD  — Agent implements exactly that plan. Nothing outside scope.
3. TEST   — Agent writes/runs a quick test or manual check (e.g. curl the 
            endpoint, or a simple test file) to confirm it works.
4. VERIFY — Agent re-reads its own output against the plan from step 1 and 
            flags any mismatch.
5. COMMIT — You review, then move to the next module. Don't let the agent 
            start module N+1 until module N is confirmed working.
```

You don't need special tooling for this — it's a discipline you enforce in
how you prompt. Each session, you literally say "Do steps 1-4 for the
[module name] module only. Stop after step 4 and wait for me."

This keeps the codebase clean because the agent never has 10 half-finished
modules open at once — one thing fully works before the next starts.

---

## 9. Step-Wise Build Order (give these to Antigravity one at a time)

### Phase 0 — Scaffold
```
Set up the backend project using the structure and stack in BACKEND_PLAN.md 
section 2 and 3. Create the folder structure exactly as specified, initialize 
Prisma with the schema from section 4, set up .env.example, and get the 
Express app running with a health-check route (GET /api/health). Do not 
build any feature modules yet. Confirm the server starts and connects to 
Postgres before stopping.
```

### Phase 1 — Auth
```
Build the auth module (login, JWT issue/refresh, auth middleware, role 
middleware) per BACKEND_PLAN.md section 6. Seed one SUPER_ADMIN user via a 
Prisma seed script. Test login with curl/Postman and confirm a protected 
test route rejects requests without a valid token. Stop after this is 
verified working.
```

### Phase 2 — Students + QR
```
Build the students module: CRUD endpoints, roll number auto-generation 
(format JPS-YYYY-XXXX), and the QR generation flow per BACKEND_PLAN.md 
section 5 (registration time part only — signed qrToken + QR image 
generation). Test by creating a student via API and confirming a valid QR 
image is returned/stored. Stop here.
```

### Phase 3 — Attendance (QR scanning)
```
Build the attendance module per BACKEND_PLAN.md section 5 (scan endpoint 
part). Implement both QR_SCAN and MANUAL marking through the single 
POST /api/attendance/scan endpoint. Enforce the one-record-per-student-per-day 
constraint. Test: scan the same student's QR token twice in one day and 
confirm the second attempt is rejected with a clear error. Stop here.
```

### Phase 4 — Fees
```
Build the fees module: challan generation, mark-paid endpoint, and the 
fee collection overview aggregation. Test generating a challan and marking 
it paid, and confirm it creates a corresponding Transaction record 
(type FEE_INCOME). Stop here.
```

### Phase 5 — Staff + Payroll
```
Build staff and payroll modules. Running payroll for a month should create 
PayrollRecord entries for all active staff. Marking payroll as paid should 
create a Transaction record (type SALARY_EXPENSE). Test the full cycle. 
Stop here.
```

### Phase 6 — Dashboard aggregation
```
Build GET /api/dashboard/overview that returns everything the admin 
dashboard screenshot needs: total students, today's attendance %, fee 
collection %, active staff count, financial flow (fee income vs salary 
expenses this month), and student demographics breakdown (by class level 
and gender). This should be read-only aggregation queries, no new tables. 
Test against seeded data and confirm numbers are accurate. Stop here.
```

### Phase 7 — Wire up frontend
```
Only after phases 0-6 are confirmed working, connect the existing dashboard 
UI (Jadoon PS admin panel) to these live endpoints, replacing all the 0/mock 
values shown in the current screenshot with real data from the API.
```

---

## 10. Registration Form Data Model + PDF Export (matches official printed form)

The online registration form must capture the exact same fields as the
printed "AZM Scholarship Program — Session V (2026)" form (Parts A–L,
2 pages), and admin must be able to download a filled PDF that looks
like the original template — not a generic data dump.

### 10.1 Extended Prisma schema

Expand the `Student` model and add supporting tables so every field on the
printed form has a home. Replace/extend the `Student` model from section 4
with this:

```prisma
model Student {
  id                String   @id @default(cuid())
  applicationNo     String   @unique          // "Application No." on form
  studentId         String?  @unique          // assigned after shortlisting
  registrationCentre String?
  rollNumber        String?  @unique          // exam roll no, assigned separately from studentId
  qrToken           String   @unique
  qrImageUrl        String?
  photoUrl          String?
  status            StudentStatus @default(ACTIVE)
  createdAt         DateTime @default(now())

  // --- Part A: Personal Information ---
  fullName          String
  fatherName        String
  gender            Gender
  dateOfBirth       DateTime
  age               Int?
  cnicOrBForm       String   @unique
  nationality        String   @default("Pakistani")
  religion          String?

  // --- Part B: Contact Information ---
  address           String
  district          String
  province          String
  studentMobile     String?
  parentMobile      String
  whatsapp          String?
  email             String?

  // --- Part C: Educational Information ---
  currentClass      String                     // "Class 6".."SSC-II" etc, from checkbox set
  hsscGroup         String?                    // Pre-Medical / Pre-Engineering / ICS / Humanities / Commerce / Other
  bsDepartment      String?
  bsSemester        String?
  schoolName        String
  boardOrUniversity String
  currentRollNo     String?

  // --- Part D: Scholarship Category ---
  scholarshipCategory ScholarshipCategory

  // --- Part E: Emergency & Family Information ---
  guardianOccupation String?
  guardianMonthlyIncome Decimal?
  emergencyContact  String
  emergencyRelation String

  // --- Part F: Declaration ---
  applicantSignedAt DateTime?
  parentSignedAt    DateTime?

  academicRecords   AcademicRecord[]           // Part G
  documents         DocumentChecklist?         // Part H
  referralSource    String?                    // Part I
  officeUse         OfficeUseRecord?           // Part L

  attendance        Attendance[]
  feeRecords        FeeRecord[]
}

enum Gender {
  MALE
  FEMALE
}

enum ScholarshipCategory {
  GENERAL_MERIT
  FINANCIALLY_NEEDY
  ORPHAN
  PERSON_WITH_DISABILITY
}

// --- Part G: Academic Record (repeatable rows) ---
model AcademicRecord {
  id            String   @id @default(cuid())
  studentId     String
  student       Student  @relation(fields: [studentId], references: [id])
  examLevel     String                     // "Last Qualification", "SSC", "HSSC", "BS"
  boardOrUni    String?
  yearOfPassing String?
  totalMarks    Int?
  obtainedMarks Int?
  percentage    Decimal?
}

// --- Part H: Document Checklist ---
model DocumentChecklist {
  id                  String  @id @default(cuid())
  studentId           String  @unique
  student             Student @relation(fields: [studentId], references: [id])
  bformCnicCopy       Boolean @default(false)
  fatherCnicCopy      Boolean @default(false)
  passportPhotos      Boolean @default(false)
  previousResultCard  Boolean @default(false)
  domicileCertificate Boolean @default(false)
  incomeCertificate   Boolean @default(false)
  otherDocuments      String?
}

// --- Part L: Office Use Only ---
model OfficeUseRecord {
  id                String   @id @default(cuid())
  studentId         String   @unique
  student           Student  @relation(fields: [studentId], references: [id])
  documentVerifiedBy String?
  documentVerifiedAt DateTime?
  eligibility       EligibilityStatus?
  eligibilityRemarks String?
  testRollNo        String?
  testCentre        String?
  testReportingTime String?
  testDate          DateTime?
  interviewDate     DateTime?
  interviewTime     String?
  panelNo           String?
  finalStatus       FinalStatus?
  officeRemarks     String?
  authorizedBy      String?
}

enum EligibilityStatus {
  ELIGIBLE
  NOT_ELIGIBLE
}

enum FinalStatus {
  SHORTLISTED
  NOT_SHORTLISTED
  REJECTED
}

// --- Partner Institution Registration Form (separate form, image 2) ---
model PartnerInstitution {
  id                  String   @id @default(cuid())
  partnerCode         String?  @unique          // office-assigned
  applicationDate     DateTime @default(now())
  institutionName     String
  institutionType     InstitutionType
  campus              String?
  address             String
  district            String
  province            String
  contactName         String
  contactDesignation  String
  contactMobile       String
  contactWhatsapp     String?
  contactEmail        String?
  website             String?
  classesOffered      String[]                  // ["Class 6-8", "SSC", "HSSC", "BS", "Other"]
  studentStrength     Int?
  expectedApplicants  Int?
  agreedToTerms       Boolean  @default(false)
  signedAt            DateTime?
  status              PartnerStatus @default(PENDING)
  createdAt           DateTime @default(now())
}

enum InstitutionType {
  SCHOOL
  COLLEGE
  ACADEMY
  UNIVERSITY
}

enum PartnerStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### 10.2 How PDF generation should work

**Do not** try to overlay data onto the original PDF file with fixed x/y
coordinates — it's fragile and painful to maintain (any tiny design tweak
breaks alignment). Instead:

1. Build the form as an **HTML + CSS template** that visually replicates
   the printed form exactly (same header, same colored Part A–L bars, same
   grid boxes for CNIC digits, same layout) — treat it as recreating the
   design in code, using the uploaded form images as the visual reference.
2. On download request, backend fills this HTML template with the
   student's actual data (name, all Part A–L fields, checkboxes rendered
   as ✓ where applicable) using a template engine (e.g. Handlebars or JSX
   via `@react-pdf/renderer`).
3. Render that filled HTML to PDF server-side using **Puppeteer**
   (headless Chrome — most reliable for pixel-accurate reproduction of a
   CSS layout) or `@react-pdf/renderer` if the team prefers a React-based
   approach.
4. Endpoint: `GET /api/students/:id/registration-pdf` → streams the
   generated PDF, filename `AZM-Registration-{applicationNo}.pdf`.
5. Same pattern for `GET /api/partners/:id/registration-pdf` using the
   Partner Institution form template.

This keeps the PDF generation logic in one module (`/modules/documents/`)
separate from business logic, and means updating the form design later is
just a CSS change — not a coordinate remapping exercise.

### 10.3 New API endpoints for this module

```
POST   /api/students/register            (public — student self-registration, 
                                           creates Student + auto-generates 
                                           applicationNo + qrToken)
POST   /api/students/admin-register       (admin-only — same as above but 
                                           admin fills it on the student's 
                                           behalf, e.g. walk-in registration)
GET    /api/students/:id/registration-pdf (downloads filled PDF matching 
                                           the printed form)

POST   /api/partners/register             (public — partner institution form)
GET    /api/partners/:id/registration-pdf

PATCH  /api/students/:id/office-use        (admin fills Part L: eligibility, 
                                           test info, interview info, final 
                                           status)
```

### 10.4 Phase 2.5 — Registration Form (insert between Phase 2 and Phase 3 in section 9)

```
Extend the students module to capture every field from Parts A-I of the 
printed registration form (BACKEND_PLAN.md section 10.1), plus the 
AcademicRecord, DocumentChecklist, and OfficeUseRecord related tables for 
Parts G, H, and L. Make sure Part I (referral source: how did you hear 
about the program) is included in the schema and the create endpoint — 
don't drop it.

Build the PDF export endpoint per section 10.2 using Puppeteer, with an 
HTML template that visually matches the uploaded printed form images, 
including both page 1 (Parts A-F) and page 2 (Parts G-L). Render Parts J 
and K as their own distinct declaration blocks on page 2 with separate 
Applicant and Parent/Guardian statements and signature lines — matching 
the original two-page layout, not merged into the single Part F 
declaration on page 1.

Also build the PartnerInstitution model and its matching registration + 
PDF export endpoints, matching the second uploaded form image. 

Add PATCH /api/students/:id/office-use for admin to fill Part L.

Test: register a student with full data, download the PDF, and confirm 
it visually matches the printed form layout across both pages with all 
fields correctly populated. Do the same for a partner institution 
registration. Stop here before continuing to Phase 3.
```

---

## 11. Guardrails To Repeat In Every Session

Paste these three lines into every Antigravity session along with the phase
prompt above — they're what keeps a multi-session build from turning messy:

```
- Follow the folder structure and module pattern in BACKEND_PLAN.md exactly. 
  Do not create files outside this structure.
- Only build what this phase's prompt asks for. Do not get ahead and start 
  the next module.
- Before finishing, list every file you created or changed, and confirm the 
  test/verification step passed.
```

---

## 12. Full Run Sheet — Paste One Block At A Time

Start every fresh session with this kickoff block first:

```
I'm giving you BACKEND_PLAN.md as the source of truth for this project. 
Read it fully before doing anything. We will work in phases — I'll give 
you one phase prompt at a time. Rules for every phase:

- Follow the folder structure and module pattern in BACKEND_PLAN.md exactly. 
  Do not create files outside this structure.
- Only build what the current phase's prompt asks for. Do not start the 
  next module early.
- Before finishing, list every file you created or changed, and confirm 
  the test/verification step for this phase passed.
- Stop and wait for me after each phase. Do not continue automatically.

Confirm you've read the plan and are ready for Phase 0.
```

Then paste phases one at a time, in order, waiting for confirmed completion
of each before moving to the next:

**Phase 0 — Scaffold**
```
Set up the backend project using the structure and stack in BACKEND_PLAN.md 
section 2 and 3. Create the folder structure exactly as specified, initialize 
Prisma, set up .env.example, and get the Express app running with a 
health-check route (GET /api/health). Do not build any feature modules yet. 
Confirm the server starts and connects to Postgres before stopping. Show me 
the folder tree and confirm the health check responds.
```

**Phase 1 — Auth & RBAC**
```
Build the auth module (login, JWT issue/refresh, auth middleware, role 
middleware) per BACKEND_PLAN.md section 6. Seed one SUPER_ADMIN user via a 
Prisma seed script. Test login with curl/Postman and confirm a protected 
test route rejects requests without a valid token, and accepts requests 
with one. Show me the curl commands and their responses. Stop here.
```

**Phase 2 — Core Students & Signed QR Tokens**
```
Build the base students module: CRUD endpoints, applicationNo/rollNumber 
generation, and the QR generation flow (signed qrToken + QR image 
generation, per section 5). Test by creating a student via API and 
confirming a valid QR image is returned/stored. Stop here.
```

**Phase 2.5 — Full Registration Form (Parts A–L) + Partner Registration + PDF Export**

Use the prompt in section 10.4 above.

**Phase 3 — QR Attendance & Scanning Engine**
```
Build the attendance module per BACKEND_PLAN.md section 5. Implement both 
QR_SCAN and MANUAL marking through the single POST /api/attendance/scan 
endpoint. Enforce the one-record-per-student-per-day constraint at the 
database level. Test: scan the same student's QR token twice in one day 
and confirm the second attempt is rejected with a clear error message. 
Stop here.
```

**Phase 4 — Fee Challans & Income Transactions**
```
Build the fees module: challan generation, mark-paid endpoint, and the 
fee collection overview aggregation. Test generating a challan and marking 
it paid, and confirm it creates a corresponding Transaction record 
(type FEE_INCOME). Stop here.
```

**Phase 5 — Staff, Payroll & Expense Transactions**
```
Build staff and payroll modules. Running payroll for a month should create 
PayrollRecord entries for all active staff. Marking payroll as paid should 
create a Transaction record (type SALARY_EXPENSE). Test the full cycle 
end to end. Stop here.
```

**Phase 6 — Dashboard Overview Aggregations**
```
Build GET /api/dashboard/overview returning: total students, today's 
attendance %, fee collection %, active staff count, financial flow (fee 
income vs salary expenses this month), and student demographics (by class 
level and gender). Read-only aggregation queries, no new tables. Test 
against seeded data and confirm the numbers are accurate. Stop here.
```

**Phase 7 — Frontend Live Data Integration**
```
Only start this after Phases 0-6 are confirmed working. Connect the 
existing Jadoon PS admin dashboard UI, the public student registration 
form, the admin walk-in registration flow, and the partner registration 
page to these live endpoints — replacing all mock/0 values with real API 
data. Wire up the "Scan QR" flow to POST /api/attendance/scan and the 
PDF download buttons to the registration-pdf endpoints.
```

If the agent ever tries to build multiple phases in one go, or skips ahead
before showing proof the current phase works, stop it and say: "go back to
just [phase name], show me it working first."

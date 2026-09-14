# Project Overview

- **Project Name:** AZM.AIO Educational & Scholarship Management Portal (AZM.AIO Session V 2026)
- **What the Application Does:** AZM.AIO is an all-in-one educational scholarship administration, student registration, partner school affiliation, examination scheduling, attendance verification, and institutional finance platform. It streamlines the full student lifecycle: online multi-stage scholarship application, automated/scheduled roll number allocation, tamper-proof biometric QR code generation, regional examination center and exam hall seating assignments, live mobile/web QR attendance scanning for invigilators, fee challan collection, staff directory with monthly payroll processing, comprehensive double-entry financial ledger accounting, and public roll number slip/merit list lookup.
- **Main Users & Use Cases:**
  - **Candidates / Students / Parents (Public):** Register online through an 8-stage application wizard, search and download official PDF Roll Number Slips with verified QR codes, query examination results and merit cards, access examination syllabus/sample question banks, calculate scholarship stipend tiers, and submit support grievances.
  - **Partner Schools / Colleges (Public & Admin):** Submit institutional affiliation requests, track application status history, download signed partnership certificates, and coordinate student candidate batches.
  - **Super Admin (Chief Administrator):** Full system governance, user account management (CRUD system operators), emergency data purges, global audit oversight, roll number release scheduling, and system configuration.
  - **Examinations & Admissions Controller (Admin):** Verify student dossiers, approve walk-in candidate registrations, assign regional test centers and exam hall seatings, execute batch roll number issuances, review and approve/reject partner institutions, and export roster PDFs.
  - **Teachers / Chief Invigilators (Teacher):** Access attendance hub, scan candidate QR codes via browser camera during examinations to mark presence in real time, view assigned exam halls, and manage seating rosters.
  - **Finance & Accounts Officer (Accountant):** Generate monthly fee challans, record student fee payments, run monthly staff payroll, and monitor cash flow across fee incomes and salary expenditures in the transactions ledger.
- **Current Maturity & State:** Production-ready dual-tier application. The backend is a fully modular TypeScript Express application with Prisma ORM connecting to PostgreSQL on Supabase (with fallback in-memory proxy for local offline testing). The frontend is a React 19 SPA powered by Vite, Tailwind CSS v4, and Lucide React. Production deployment is active on Render (backend API) and GitHub Actions / Hostinger (frontend static SPA).

---

# Technology Stack

### Programming Languages
- **TypeScript (`~5.8.2` frontend / `^5.5.4` backend):** Used across both client and server codebases for end-to-end type safety, shared interfaces, and strict compiler enforcement.
- **JavaScript (Node.js runtime `>=18` / Target `esnext`):** Runtime environment for backend Express server, migration scripts, and build tooling.
- **HTML5 & CSS3:** Modern responsive layout primitives, canvas elements for biometric QR scanning, and PDF rendering templates.

### Frontend Framework & Core Libraries
- **React (`^19.0.1`):** Primary UI library utilizing functional components, hooks (`useState`, `useEffect`, `useCallback`, `useRef`, `lazy`, `Suspense`), and React 19 client features.
- **React DOM (`^19.0.1`):** Web rendering target for React tree.
- **Vite (`^6.2.3`):** Ultra-fast frontend build tool and development server with Hot Module Replacement (HMR), code splitting, and rollup optimizations.
- **Motion (`^12.23.24`, Framer Motion):** Declarative animations, smooth layout transitions, modal popups, and tab switching visuals.
- **Lucide React (`^0.546.0`):** Icon library across all public pages, dashboard navigation, and status badges.
- **Canvas Confetti (`^1.9.4`):** Celebration animations upon successful student registration and scholarship application submission.
- **Cobe (`^2.0.1`):** Interactive WebGL 3D globe visualization in the hero/partnership components.
- **jsQR (`^1.4.0`):** Client-side real-time video stream QR decoding for teacher exam hall scanning.
- **jsPDF (`^4.2.1`) & jsPDF-AutoTable (`^5.0.8`):** Client-side PDF generation fallback for exportable student tables, roll slips, and fee vouchers.

### Backend Framework & Runtime
- **Node.js (`>=18`):** JavaScript server runtime.
- **Express (`^4.21.2`):** Fast, unopinionated HTTP web framework for REST API routing, middleware chaining, JSON parsing, and CORS control.
- **TSX (`^4.19.0`):** TypeScript execution engine for rapid development (`tsx watch src/server.ts`) and migration/seed scripts execution.

### Database & ORM
- **PostgreSQL (Supabase Hosted):** Primary relational database enforcing strict foreign keys, unique constraints, and ACID transactions.
- **Prisma ORM (`^5.22.0`):** Type-safe query builder, declarative schema management (`schema.prisma`), database migrations (`prisma migrate deploy`), and auto-generated TypeScript database client (`@prisma/client`).
- **`@prisma/adapter-pg` (`^5.22.0`) & `pg` (`^8.23.0`):** Direct PostgreSQL client driver supporting Supavisor transaction pooler connections.
- **In-Memory Fallback Engine (`backend/src/lib/prisma.ts`):** Custom Proxy-wrapped in-memory database simulation that automatically activates in local offline development if PostgreSQL is unavailable, preventing developer blockage. In production (`NODE_ENV=production`), it enforces strict PostgreSQL connectivity and throws immediate fatal alerts on connection loss.

### Authentication & Security
- **JSON Web Tokens (`jsonwebtoken` `^9.0.2`):** Stateless JWT authentication using dual token architecture (short-lived Access Tokens in `Authorization: Bearer` headers + long-lived Refresh Tokens).
- **Password Hashing (`bcryptjs` `^2.4.3`):** One-way salted hashing for operator and administrative passwords.
- **Cryptographic Signatures (`crypto` Node.js built-in):** Generates and verifies HMAC-SHA256 signed QR tokens (`qr_<uuid>_<timestamp>.<hmac>`) to prevent forged student exam passes.
- **Cookie-Free Architecture:** Frontend explicitly clears and blocks browser cookies (`wipeAllCookies()`), storing bearer tokens in `localStorage` to avoid CSRF and cross-domain third-party cookie restrictions.
- **Role-Based Access Control (RBAC):** Middleware-level authorization enforcing roles: `SUPER_ADMIN`, `ADMIN`, `TEACHER`, `ACCOUNTANT`.

### Validation & Serialization
- **Zod (`^3.23.8` backend / custom regex in frontend):** Schema declaration and runtime validation for all API request bodies (`validateBody`) and query parameters (`validateQuery`), returning standardized 400 validation envelopes.

### File & Object Storage
- **Supabase Storage (`@supabase/supabase-js` `^2.112.3`):** S3-compatible cloud object storage across four dedicated buckets:
  - `student-photos` (Private candidate profile images)
  - `student-documents` (Private B-Form, CNIC, DMC, and income certificates)
  - `qr-codes` (Candidate QR image assets)
  - `registration-pdfs` (Archived registration receipts)
- **Sharp (`0.34.5`):** High-performance image processing engine on backend for auto-resizing uploaded photos to micro-thumbnails (max 150px) to prevent database egress inflation.

### Server-Side Document & PDF Generation
- **Puppeteer (`^25.8.0`) / Puppeteer-Core (`^25.8.0`) & `@sparticuz/chromium` (`^149.0.0`):** Headless Chromium browser rendering high-resolution, print-ready, vectorized official PDF documents (Student Dossiers, Roll Number Slips, Partner Affiliation Certificates, Filtered Roster Reports).
- **Single-Concurrency Mutex (`PdfGenerationQueue` in `backend/src/modules/documents/pdf.service.ts`):** Prevents concurrent Chromium spawning, bounding memory usage under 128 MB to guarantee zero Out-Of-Memory (OOM) crashes on Render Free Tier.

### Styling System
- **Tailwind CSS v4 (`^4.1.14` via `@tailwindcss/vite`):** Modern utility-first CSS engine with automated CSS code splitting, customized slate/emerald/amber/blue color palettes, and glassmorphism styling.

### AI / LLM Integrations
- **`@google/genai` (`^2.4.0`):** Declared in root `package.json` with environment variable `GEMINI_API_KEY` configured in `.env.example` and `metadata.json` (reflecting initial scaffolding from Google AI Studio). Currently reserved for future automated applicant essay grading / syllabus AI assistant features.

### Rate Limiting & Traffic Protection
- **`express-rate-limit` (`^8.6.2`):** Granular rate limiters on public candidate upload sessions (`uploadSessionRateLimiter`) and document uploads (`documentUploadRateLimiter`). General login/registration rate limiters are intentionally configured as pass-throughs to prevent accidental lockouts during high-volume campus registration drives.

### Build Tools & Package Managers
- **npm & bun:** Supported package managers (project root contains `package.json`, `package-lock.json`, and `bun.lock`).
- **esbuild (`^0.25.0`):** Underlying high-speed minifier for Vite production builds.

### CI/CD & Deployment Hosting
- **Backend API:** Hosted on Render (`render.yaml`), Node.js environment in Singapore region (`https://azmnew.onrender.com`).
- **Frontend SPA:** Built via GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to `main` branch and published to orphan branch `deploy` for Hostinger static web hosting.

---

# Repository Structure

```
c:/Projects/Azm
├── .agents/                                # Agent skill definitions & guides
├── .github/
│   └── workflows/
│       └── deploy.yml                      # GitHub Actions: build & push dist to deploy branch
├── backend/                                # Node.js + Express + Prisma REST API
│   ├── .cache/puppeteer/                   # Local/Render Puppeteer Chrome cache
│   ├── dist/                               # Compiled backend JavaScript output
│   ├── prisma/
│   │   ├── migrations/                     # SQL migration history
│   │   │   ├── 0_init/                     # Initial database schema
│   │   │   ├── 20260825_add_centers_halls/ # Test centers, exam halls, grievances
│   │   │   ├── 20260825_add_system_setting/# System dynamic key-value settings
│   │   │   └── 20260830053018_add_student_document_metadata/ # StudentDocument table
│   │   ├── schema.prisma                   # Canonical Prisma data model
│   │   └── seed.ts                         # Database seeder (SuperAdmin, Admin, Teacher, Accountant, Test Centers, Exam Halls)
│   ├── scripts/                            # Operational & data migration scripts
│   │   ├── backfill-student-documents.ts   # Migrates embedded base64 docs to Supabase Storage
│   │   └── backfill-student-thumbnails.ts  # Generates lightweight thumbnails for student photos
│   ├── src/
│   │   ├── app.ts                          # Express app configuration, CORS, routes mount, error handler
│   │   ├── server.ts                       # Server bootstrap, graceful shutdown, account check
│   │   ├── config/
│   │   │   └── env.ts                      # Zod-validated environment config with production security assertions
│   │   ├── lib/
│   │   │   ├── bootstrapAccounts.ts        # Startup credential integrity & legacy account purge
│   │   │   ├── hash.ts                     # Bcrypt password hashing & verification
│   │   │   ├── jwt.ts                      # Access/Refresh token signing & decoding
│   │   │   ├── logger.ts                   # Structured console logger
│   │   │   ├── prisma.ts                   # Resilient Prisma client with in-memory dev fallback
│   │   │   └── supabaseStorage.ts          # Supabase cloud storage service wrapper
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts          # JWT bearer token verification & req.user attachment
│   │   │   ├── error.middleware.ts         # Centralized error formatter (Prisma, Zod, HTTP codes)
│   │   │   ├── rateLimit.middleware.ts     # Endpoint-specific rate limiting
│   │   │   ├── role.middleware.ts          # RBAC role guards (authorizeRoles)
│   │   │   └── validate.middleware.ts      # Zod body & query validator
│   │   └── modules/                        # Modular domain features (Routes, Controllers, Services, Schemas)
│   │       ├── attendance/                 # QR scan & manual attendance tracking
│   │       ├── auth/                       # Login, token refresh, current user profile
│   │       ├── dashboard/                  # Aggregate analytics, student counters, financial overview
│   │       ├── documents/                  # Puppeteer PDF generator service
│   │       ├── exam-halls/                 # Exam room setup, capacity, seating batch allocation
│   │       ├── fees/                       # Challan generation, fee status tracking, income records
│   │       ├── grievances/                 # Public support tickets & resolution desk
│   │       ├── partners/                   # School affiliation workflow & approval audits
│   │       ├── payroll/                    # Staff monthly payroll runs & salary expense records
│   │       ├── results/                    # Examination marks, merit lists, result card search
│   │       ├── staff/                      # Employee directory & salary configuration
│   │       ├── students/                   # 8-stage candidate registration, roster queries, roll issuance
│   │       ├── test-centers/               # Examination test centers management
│   │       ├── transactions/               # Unified financial ledger (fees, salaries, other)
│   │       └── users/                      # SuperAdmin user account management
│   ├── tests/                              # Integration, security, and egress regression test suites
│   ├── package.json                        # Backend package dependencies & scripts
│   ├── render.yaml                         # Render deployment specification
│   └── tsconfig.json                       # Backend TypeScript compiler configuration
├── public/                                 # Static web assets (logos, favicon, sample documents)
├── src/                                    # Frontend React SPA
│   ├── components/
│   │   ├── about/                          # Mission, vision, and leadership views
│   │   ├── admin/                          # Authenticated Admin Portal components
│   │   │   ├── attendance/                 # Attendance hub, QR camera scanner, manual roster
│   │   │   ├── dashboard/                  # Admin KPI stat cards, charts, activity feed
│   │   │   ├── fees/                       # Fee records list, challan generator, mark paid modal
│   │   │   ├── halls/                      # Exam hall seating builder, batch student allocator
│   │   │   ├── layout/                     # Admin layout wrapper, top header, dynamic sidebar
│   │   │   ├── partners/                   # Partner affiliation requests, approval modal, audit history
│   │   │   ├── payroll/                    # Payroll list, monthly run modal, payment approval
│   │   │   ├── settings/                   # Operator user manager, roll schedule, test centers
│   │   │   ├── shared/                     # Reusable DataTable, StatCard, StatusBadge, ConfirmModal
│   │   │   ├── staff/                      # Staff directory list, add/edit staff modal
│   │   │   ├── storage/                    # Document Vault file inspector & thumbnail viewer
│   │   │   ├── students/                   # Student master list, detailed dossier, walk-in modal
│   │   │   └── transactions/               # Finance ledger table, cashflow summary
│   │   ├── apply/                          # Application portal container & closed notices
│   │   ├── common/                         # Header, Footer, Logo, Captcha modal, WhatsApp widget
│   │   ├── contact/                        # Contact details, map, inquiry form
│   │   ├── gallery/                        # Event photo galleries & past session archives
│   │   ├── home/                           # Hero section, Bento grid, fee calculator, FAQs, testimonials
│   │   ├── partners/                       # Public partner school directory
│   │   ├── practice/                       # Interactive mock exam & question bank modal
│   │   ├── public/                         # Public entry pages
│   │   │   ├── auth/LoginPage.tsx          # Operator login form
│   │   │   ├── partner/                    # Public partner institution affiliation form
│   │   │   └── register/                   # 8-stage public candidate registration wizard
│   │   ├── results/                        # Results desk, candidate result card, merit list viewer
│   │   ├── rollnumber/                     # Public Roll Number Slip search and PDF print
│   │   ├── scholarship/                    # Scholarship criteria, stipend brackets, policy details
│   │   └── ui/                             # UI components (e.g. 3D Globe)
│   ├── data/
│   │   └── scholarshipData.ts              # Static data constants, FAQ items, syllabus topics
│   ├── lib/
│   │   ├── apiClient.ts                    # HTTP client, token refresh, PDF downloader, health ping
│   │   ├── auth.ts                         # Token storage helpers, cookie wiper, cache purger
│   │   ├── authContext.tsx                 # React Context providing user, role, login, logout
│   │   ├── mockApi.ts                      # High-level typed client service layer mapping to backend
│   │   └── useAdminQuery.ts                # React hook for data fetching with auth hydration
│   ├── services/
│   │   └── api.ts                          # Public API callers for roll slips, results, grievances
│   ├── types/
│   │   └── index.ts                        # Shared TypeScript type definitions
│   ├── utils/
│   │   ├── formValidation.ts               # Client validation rules, CNIC/Phone formatters, error mappers
│   │   ├── pdfExport.ts                    # Client-side jsPDF document generators
│   │   └── whatsapp.ts                     # WhatsApp message formatting & direct link builders
│   ├── App.tsx                             # Top-level application shell, hash router, lazy view loader
│   ├── index.css                           # Global Tailwind CSS directives & custom utility classes
│   └── main.tsx                            # React DOM root entry point
├── BACKEND_PLAN.md                         # Architectural backend implementation specification
├── SUPABASE_EGRESS_REMEDIATION_PLAN.md     # Egress optimization & storage separation specification
├── index.html                              # HTML entry template with meta tags & web fonts
├── metadata.json                           # AI Studio application metadata
├── package.json                            # Frontend package dependencies & scripts
├── render.yaml                             # Cloud deployment configuration for Render
├── tsconfig.json                           # Frontend TypeScript compiler configuration
└── vite.config.ts                          # Vite build & bundle split configuration
```

---

# Application Architecture

```
                                 ┌───────────────────────────────────────────────────────────┐
                                 │                   Client Browser (React 19)               │
                                 │  Public Wizard / Admin Portal / Results / QR Attendance   │
                                 └─────────────────────────────┬─────────────────────────────┘
                                                               │
                                         HTTPS / JSON          │  Authorization: Bearer <JWT>
                                         REST API Calls        │  Multipart Binary Uploads
                                                               ▼
                                 ┌───────────────────────────────────────────────────────────┐
                                 │              Node.js / Express Backend (Port 5000)        │
                                 │  Middleware: CORS, Auth (JWT), RBAC, Zod Validate, Errors │
                                 └───────────────┬───────────────────────────┬───────────────┘
                                                 │                           │
                                Prisma ORM / SQL │                           │ Supabase SDK / REST
                                Connection Pool  │                           │
                                                 ▼                           ▼
                        ┌─────────────────────────────────┐ ┌─────────────────────────────────┐
                        │    PostgreSQL on Supabase       │ │     Supabase Cloud Storage      │
                        │ - Student & Academic Records    │ │ - student-photos (Private)      │
                        │ - Partner Institutions & Audits │ │ - student-documents (Private)   │
                        │ - Exam Halls & Test Centers     │ │ - qr-codes (Public)             │
                        │ - Attendance & Fee Records      │ │ - registration-pdfs (Private)   │
                        │ - Staff, Payroll & Transactions │ └─────────────────────────────────┘
                        │ - System Settings & Users       │
                        └─────────────────────────────────┘
```

### 1. Frontend → Backend Communication
- Communication occurs via standard RESTful JSON requests handled by [`src/lib/apiClient.ts`](file:///c:/Projects/Azm/src/lib/apiClient.ts) and [`src/lib/mockApi.ts`](file:///c:/Projects/Azm/src/lib/mockApi.ts).
- All requests target `https://azmnew.onrender.com` in production (or `http://localhost:5000` in development).
- Client automatically attaches `Authorization: Bearer <accessToken>` when a token exists.
- In case of HTTP `401 Unauthorized`, `apiClient.ts` transparently issues a refresh token exchange to `/api/auth/refresh`, updates the in-memory token, and replays the failed request without disrupting the user.
- A non-blocking background heartbeat (`wakeUpBackend()`) pings `/api/health` on initial page load and when candidates enter application form stages to warm sleeping Render free-tier containers.

### 2. Backend → Database Communication
- Database interactions use **Prisma ORM** ([`backend/prisma/schema.prisma`](file:///c:/Projects/Azm/backend/prisma/schema.prisma)).
- Queries run through PostgreSQL connection pooling (`DATABASE_URL` with transaction pooler / PgBouncer mode), while direct connections (`DIRECT_URL`) are reserved for schema migrations.
- In development/offline mode, a Proxy wrapper in [`backend/src/lib/prisma.ts`](file:///c:/Projects/Azm/backend/src/lib/prisma.ts) falls back to an in-memory repository (`MemoryStore`) if the database cannot be contacted. In production, this fallback is disabled to guarantee data persistence.

### 3. Authentication & Authorization Flow
- Operators submit credentials to `POST /api/auth/login`.
- Server validates email/password against bcrypt hashes in the `User` table.
- Server returns a 15-minute Access Token and a 7-day Refresh Token containing `{ userId, email, role, name }`.
- Client stores tokens in `localStorage` (strictly zero cookies) and hydrates `AuthContext`.
- Protected routes run `authenticate` (verifies JWT) followed by `authorizeRoles('SUPER_ADMIN', ...)` to restrict access by role.

### 4. External Services & Storage Architecture
- **Supabase Storage:** Uploaded candidate documents (B-Form, CNIC, DMC, Photos) are uploaded directly to private storage buckets.
- **Egress Remediation Architecture:** List queries (such as student rosters) return *only* lightweight metadata (`hasPhoto`, `photoThumbnailPath`, `byteSize`) rather than heavy base64 strings. Full-resolution originals and thumbnails are fetched on demand via authorized streaming endpoints (`/api/students/:id/document/:docType` and `/api/students/:id/photo-thumbnail`).

---

# Entry Points

### Frontend Application Entry Points
- **HTML Container:** [`index.html`](file:///c:/Projects/Azm/index.html) — Sets viewport meta tags, preconnects Google Fonts, and defines `#root`.
- **React DOM Mount:** [`src/main.tsx`](file:///c:/Projects/Azm/src/main.tsx) — Mounts `<App />` inside React `<StrictMode>`.
- **Root Shell & Hash Router:** [`src/App.tsx`](file:///c:/Projects/Azm/src/App.tsx) — Manages global state, wraps the tree with `<AuthProvider>`, parses URL hash fragments (`#dashboard`, `#register`, `#scan`, etc.), and lazy-loads tab components via React `Suspense`.

### Backend Server Entry Points
- **Process Bootstrap:** [`backend/src/server.ts`](file:///c:/Projects/Azm/backend/src/server.ts) — Validates environment, executes `bootstrapAccounts()` to purge legacy users, starts Express HTTP listener on `PORT` (default `5000`), and handles `SIGTERM`/`SIGINT` graceful shutdown.
- **Express App Setup:** [`backend/src/app.ts`](file:///c:/Projects/Azm/backend/src/app.ts) — Configures CORS origins, JSON body parser (8 MB limit), health endpoint (`/api/health`), mounts all 14 module routers under `/api/*`, and attaches the global `errorHandler`.
- **Database CLI / Migrations:** [`backend/prisma/schema.prisma`](file:///c:/Projects/Azm/backend/prisma/schema.prisma) — Governs Prisma CLI commands (`prisma generate`, `prisma migrate deploy`, `prisma db seed`).

---

# Core Domains / Features

### 1. Student Registration & Lifecycle
- **Purpose:** Manages candidate intake, multi-stage validation, document uploads, application dossier review, payment approval, and roll number assignment.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/students/`](file:///c:/Projects/Azm/backend/src/modules/students/) (`students.routes.ts`, `students.controller.ts`, `students.service.ts`, `students.schema.ts`)
  - Frontend: [`src/components/public/register/PublicCandidateRegistrationWizard.tsx`](file:///c:/Projects/Azm/src/components/public/register/PublicCandidateRegistrationWizard.tsx), [`src/components/admin/students/StudentsListView.tsx`](file:///c:/Projects/Azm/src/components/admin/students/StudentsListView.tsx), [`src/components/admin/students/StudentDetailView.tsx`](file:///c:/Projects/Azm/src/components/admin/students/StudentDetailView.tsx)
- **Key Entities:** `Student`, `StudentDocument`, `AcademicRecord`, `DocumentChecklist`, `OfficeUseRecord`.
- **Interactions:** Creating a student creates an unverified `Student` record, stores files in Supabase Storage via `StudentDocument`, creates an initial fee record, and attaches an HMAC-signed `qrToken`. Approving payment issues the official `rollNumber`.

### 2. Partner Institution Affiliation
- **Purpose:** Facilitates schools, colleges, and academies registering as official AZM testing partners and scholarship registration hubs.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/partners/`](file:///c:/Projects/Azm/backend/src/modules/partners/) (`partners.routes.ts`, `partners.controller.ts`, `partners.service.ts`, `partners.schema.ts`)
  - Frontend: [`src/components/public/partner/PublicPartnerRegistrationPage.tsx`](file:///c:/Projects/Azm/src/components/public/partner/PublicPartnerRegistrationPage.tsx), [`src/components/admin/partners/AdminPartnersListView.tsx`](file:///c:/Projects/Azm/src/components/admin/partners/AdminPartnersListView.tsx)
- **Key Entities:** `PartnerInstitution`, `PartnerCodeSequence`, `PartnerStatusAudit`.
- **Interactions:** Public registration generates sequential partner codes (`AZM-2026-001`). Administrators review dossiers, approving or rejecting with recorded reasons stored in `PartnerStatusAudit`. Approved partners receive downloadable affiliation PDFs.

### 3. Examination Centers, Halls & Seating Allocation
- **Purpose:** Organizes geographic test centers, individual examination rooms/halls, invigilator assignments, and automated seat number allocation for registered students.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/test-centers/`](file:///c:/Projects/Azm/backend/src/modules/test-centers/), [`backend/src/modules/exam-halls/`](file:///c:/Projects/Azm/backend/src/modules/exam-halls/)
  - Frontend: [`src/components/admin/halls/ExamHallsView.tsx`](file:///c:/Projects/Azm/src/components/admin/halls/ExamHallsView.tsx), [`src/components/admin/settings/TestCentersTab.tsx`](file:///c:/Projects/Azm/src/components/admin/settings/TestCentersTab.tsx)
- **Key Entities:** `TestCenter`, `ExamHall`, `Student` (`assignedHallId`, `assignedRoom`, `seatNo`).
- **Interactions:** Admins configure test center capacities. The batch allocation engine distributes unallocated students matching target classes across exam halls, automatically calculating hall fill percentages and assigning sequential seat numbers.

### 4. Biometric QR Attendance
- **Purpose:** On-site examination verification allowing invigilators and staff to scan student QR codes on printed roll number slips using a smartphone camera.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/attendance/`](file:///c:/Projects/Azm/backend/src/modules/attendance/) (`attendance.routes.ts`, `attendance.service.ts`, `qr.service.ts`)
  - Frontend: [`src/components/admin/attendance/AttendanceHubView.tsx`](file:///c:/Projects/Azm/src/components/admin/attendance/AttendanceHubView.tsx), [`src/components/admin/attendance/TeacherScanView.tsx`](file:///c:/Projects/Azm/src/components/admin/attendance/TeacherScanView.tsx), [`src/components/admin/attendance/QrScannerTab.tsx`](file:///c:/Projects/Azm/src/components/admin/attendance/QrScannerTab.tsx)
- **Key Entities:** `Attendance`, `Student`.
- **Interactions:** The scanner reads the signed QR token, calls `POST /api/attendance/scan`, verifies the HMAC signature with `QR_SECRET`, verifies candidate status, and creates an `Attendance` record (`PRESENT`, `QR_SCAN`, timestamp, invigilator ID), preventing duplicate daily scans.

### 5. Fees & Challan Management
- **Purpose:** Generates unique fee challans (`CHL-YYYY-XXXX`), tracks payment status, and links received payments to the general ledger.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/fees/`](file:///c:/Projects/Azm/backend/src/modules/fees/)
  - Frontend: [`src/components/admin/fees/FeesListView.tsx`](file:///c:/Projects/Azm/src/components/admin/fees/FeesListView.tsx), [`src/components/admin/fees/GenerateChallanModal.tsx`](file:///c:/Projects/Azm/src/components/admin/fees/GenerateChallanModal.tsx), [`src/components/admin/fees/MarkFeePaidModal.tsx`](file:///c:/Projects/Azm/src/components/admin/fees/MarkFeePaidModal.tsx)
- **Key Entities:** `FeeRecord`, `Student`, `Transaction`.
- **Interactions:** When a fee challan is marked as `PAID`, the backend marks the `FeeRecord` and automatically records a `FEE_INCOME` transaction in the `Transaction` ledger.

### 6. Staff & Monthly Payroll
- **Purpose:** Maintains teacher, examiner, and administrative employee profiles, monthly salary rates, and executes batch payroll.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/staff/`](file:///c:/Projects/Azm/backend/src/modules/staff/), [`backend/src/modules/payroll/`](file:///c:/Projects/Azm/backend/src/modules/payroll/)
  - Frontend: [`src/components/admin/staff/StaffListView.tsx`](file:///c:/Projects/Azm/src/components/admin/staff/StaffListView.tsx), [`src/components/admin/payroll/PayrollListView.tsx`](file:///c:/Projects/Azm/src/components/admin/payroll/PayrollListView.tsx), [`src/components/admin/payroll/RunPayrollModal.tsx`](file:///c:/Projects/Azm/src/components/admin/payroll/RunPayrollModal.tsx)
- **Key Entities:** `Staff`, `PayrollRecord`, `Transaction`.
- **Interactions:** Running payroll generates `PENDING` `PayrollRecord` rows for all active staff for the selected month. When marked `PAID`, a corresponding `SALARY_EXPENSE` transaction is automatically posted to the `Transaction` table.

### 7. Financial Ledger & Cash Flow
- **Purpose:** Aggregates all monetary inflows and outflows across fee collections, salary payments, and miscellaneous operational expenses.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/transactions/`](file:///c:/Projects/Azm/backend/src/modules/transactions/)
  - Frontend: [`src/components/admin/transactions/TransactionsListView.tsx`](file:///c:/Projects/Azm/src/components/admin/transactions/TransactionsListView.tsx)
- **Key Entities:** `Transaction` (`type`: `FEE_INCOME`, `SALARY_EXPENSE`, `OTHER_INCOME`, `OTHER_EXPENSE`).

### 8. Grievance Redressal Desk
- **Purpose:** Allows students and parents to lodge inquiries regarding roll slips, name corrections, fee verifications, or result discrepancies.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/grievances/`](file:///c:/Projects/Azm/backend/src/modules/grievances/)
  - Frontend: [`src/components/contact/ContactView.tsx`](file:///c:/Projects/Azm/src/components/contact/ContactView.tsx)
- **Key Entities:** `GrievanceTicket`.

### 9. Results & Merit Lists
- **Purpose:** Public lookup for examination scores, subject-wise accuracy, merit rankings, and interview eligibility.
- **Key Modules & Files:**
  - Backend: [`backend/src/modules/results/`](file:///c:/Projects/Azm/backend/src/modules/results/)
  - Frontend: [`src/components/results/ResultsDeskView.tsx`](file:///c:/Projects/Azm/src/components/results/ResultsDeskView.tsx)

---

# Database / Data Model

- **Database Engine:** PostgreSQL (Supabase managed instance).
- **Schema Location:** [`backend/prisma/schema.prisma`](file:///c:/Projects/Azm/backend/prisma/schema.prisma).
- **Migrations Directory:** [`backend/prisma/migrations/`](file:///c:/Projects/Azm/backend/prisma/migrations/).

### Conceptual Model & Core Entities

```
   ┌──────────────┐
   │     User     │
   │ (Operators)  │
   └──────┬───────┘
          │ marks
          ▼
   ┌──────────────┐ 1      * ┌──────────────────┐
   │   Student    ├──────────┤ StudentDocument  │ (Storage metadata)
   │              ├──────────┤ AcademicRecord   │ (Past grades)
   │              ├───1───1──┤ DocumentChecklist│ (Verification ticks)
   │              ├───1───1──┤ OfficeUseRecord  │ (Exam clearance)
   │              ├───────*──┤ Attendance       │ (Daily QR scans)
   │              ├───────*──┤ FeeRecord        │ (Challans & payments)
   └──────┬───────┘          └────────┬─────────┘
          │ allocated                 │
          ▼                           │ produces
   ┌──────────────┐                   ▼
   │   ExamHall   │          ┌──────────────────┐
   └──────┬───────┘          │   Transaction    │ (Cash flow ledger)
          │ located in       └────────▲─────────┘
          ▼                           │
   ┌──────────────┐                   │ produces
   │  TestCenter  │          ┌────────┴─────────┐
   └──────────────┘          │  PayrollRecord   │
                             └────────▲─────────┘
                                      │ paid to
                             ┌────────┴─────────┐
                             │      Staff       │
                             └──────────────────┘
```

- **`User`:** System accounts (`SUPER_ADMIN`, `ADMIN`, `TEACHER`, `ACCOUNTANT`).
- **`Student`:** Core application record holding personal info, contact info, class/curriculum, scholarship category, B-Form/CNIC, signed QR token, seat allocation, and review status.
- **`StudentDocument`:** Normalized cloud storage pointer linking files in Supabase Storage (`bucket`, `objectPath`, `mimeType`, `byteSize`, `checksumSha256`) to a student.
- **`PartnerInstitution`:** School/college affiliation records with type (`SCHOOL`, `COLLEGE`, `ACADEMY`, `UNIVERSITY`), status (`PENDING`, `APPROVED`, `REJECTED`), capacity, and contact information.
- **`PartnerStatusAudit`:** Immutable history recording who changed a partner's approval status, the old/new status, timestamp, and review remarks.
- **`TestCenter` & `ExamHall`:** Physical testing venues with student capacity, invigilator details, and class target filters.
- **`Attendance`:** Daily attendance records with unique constraint on `[studentId, date]` and method (`QR_SCAN`, `MANUAL`).
- **`FeeRecord`:** Challan entries with `amountDue`, `amountPaid`, `status` (`UNPAID`, `PAID`, `PARTIAL`, `OVERDUE`), and `challanNumber`.
- **`Staff` & `PayrollRecord`:** Staff employee profiles with monthly salary entries.
- **`Transaction`:** Financial ledger recording `type`, `amount`, `relatedFeeId`, and `relatedPayrollId`.
- **`GrievanceTicket`:** Support inquiries categorized by issue type.
- **`SystemSetting`:** Dynamic key-value store for system-wide flags (e.g., roll number release schedule).

### Seed Data
Defined in [`backend/prisma/seed.ts`](file:///c:/Projects/Azm/backend/prisma/seed.ts), containing initial default operator accounts (`chief.admin@azmaio.com`, `exam.controller@azmaio.com`, `finance.officer@azmaio.com`, `invigilator.lead@azmaio.com`), 4 regional test centers (Mansehra, Abbottabad, Haripur, Battagram), and 6 default exam halls.

---

# Authentication & Authorization

- **Mechanism:** Stateless JSON Web Token (JWT) over standard HTTP `Authorization: Bearer <token>` headers.
- **Token Specifications:**
  - **Access Token:** Signed with `JWT_ACCESS_SECRET`, expiry default 15m (production configurable).
  - **Refresh Token:** Signed with `JWT_REFRESH_SECRET`, expiry default 7d to 90d.
- **Token Refresh Flow:**
  1. Client sends request with access token.
  2. If backend returns 401, [`src/lib/apiClient.ts`](file:///c:/Projects/Azm/src/lib/apiClient.ts) intercepts the response.
  3. Client posts `refreshToken` to `POST /api/auth/refresh`.
  4. Server verifies refresh token and issues a fresh access token.
  5. Client updates `localStorage` and retries the original request.
- **User Roles & Hierarchy:**
  - `SUPER_ADMIN`: Unrestricted global system access, operator user CRUD, emergency purge, system settings.
  - `ADMIN`: Student management, partner approvals, exam hall and test center allocations, roll number batch generation, roster PDF exports.
  - `TEACHER`: Attendance scanning, live exam hall roster viewing.
  - `ACCOUNTANT`: Fee challan generation, fee payment marking, payroll processing, transaction ledger audits.
- **Guards & Middleware:**
  - `authenticate` ([`backend/src/middleware/auth.middleware.ts`](file:///c:/Projects/Azm/backend/src/middleware/auth.middleware.ts)): Extracts token, validates signature, attaches `req.user`.
  - `authorizeRoles(...roles)` ([`backend/src/middleware/role.middleware.ts`](file:///c:/Projects/Azm/backend/src/middleware/role.middleware.ts)): Asserts `req.user.role` is in permitted list, returning 403 Forbidden otherwise.

---

# APIs

All endpoints return a standardized JSON envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional status message"
}
```
Error format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": { ... }
  }
}
```

### Route Groups Summary

| Base Path | Main Responsibilities | Auth Requirements |
|---|---|---|
| `/api/health` | Service uptime, DB connectivity status & latency | Public |
| `/api/auth` | Login, token refresh, logout, `/me` profile | Public (`/login`, `/refresh`), Authenticated (`/me`) |
| `/api/students` | Candidate register, search roll slip, list roster, approve payment, batch roll issuance, streaming documents & thumbnails | Public (registration & slip lookup), Authenticated Admin/Accountant (roster, actions) |
| `/api/partners` | School affiliation submission, admin approval, status audit history, PDF certificate | Public (registration), Authenticated Admin (review) |
| `/api/attendance` | Biometric QR scanning, daily attendance lists, student attendance history | Authenticated Admin / Teacher / Super Admin |
| `/api/fees` | Fee overview metrics, generate challans, mark paid | Authenticated Admin / Accountant / Super Admin |
| `/api/staff` | Staff directory CRUD | Authenticated Admin / Accountant / Super Admin |
| `/api/payroll` | Monthly payroll generation, mark paid | Authenticated Admin / Accountant / Super Admin |
| `/api/transactions` | Financial ledger queries and summaries | Authenticated Admin / Accountant / Super Admin |
| `/api/dashboard` | KPI analytics, attendance rates, cash flow summaries | Authenticated Admin / Accountant / Super Admin |
| `/api/users` | Operator user account management | Authenticated `SUPER_ADMIN` only |
| `/api/test-centers` | Examination test center CRUD | Public GET, Authenticated Admin POST/PATCH/DELETE |
| `/api/exam-halls` | Hall setup, student seating batch assignment, seat allocation | Public GET, Authenticated Admin POST/PATCH/DELETE |
| `/api/grievances` | Public grievance ticketing, admin resolution | Public POST, Authenticated Admin GET/PATCH |
| `/api/results` | Public candidate result lookup & merit lists | Public |

---

# Frontend Architecture

- **Routing Strategy:** Single Page Application (SPA) driven by browser URL Hash fragments (`window.location.hash`).
  - Public Routes: `#home`, `#about`, `#scholarship`, `#apply`, `#roll-number`, `#results`, `#partners`, `#gallery`, `#contact`, `#register`, `#partner-registration`, `#login`.
  - Admin Routes: `#dashboard`, `#students`, `#partners`, `#halls`, `#storage`, `#attendance`, `#fees`, `#staff`, `#payroll`, `#transactions`, `#settings`, `#scan`.
- **Layout Architecture:**
  - Public Pages: Dynamic top [`src/components/common/Header.tsx`](file:///c:/Projects/Azm/src/components/common/Header.tsx), page-specific Hero/Content views, and lazy-loaded [`src/components/common/Footer.tsx`](file:///c:/Projects/Azm/src/components/common/Footer.tsx).
  - Admin Portal: [`src/components/admin/layout/AdminLayout.tsx`](file:///c:/Projects/Azm/src/components/admin/layout/AdminLayout.tsx) enclosing collapsible [`src/components/admin/layout/AdminSidebar.tsx`](file:///c:/Projects/Azm/src/components/admin/layout/AdminSidebar.tsx) and [`src/components/admin/layout/AdminHeader.tsx`](file:///c:/Projects/Azm/src/components/admin/layout/AdminHeader.tsx).
- **Code Splitting & Performance:**
  - All admin modules and below-the-fold public sections are lazily loaded with `React.lazy()` and `Suspense`.
  - `vite.config.ts` configures dedicated vendor chunks for `vendor-react`, `vendor-motion`, `vendor-icons`, and `vendor-globe`.
- **State Management & Data Fetching:**
  - `AuthContext`: Provides user identity, role, and login/logout state globally.
  - [`src/lib/useAdminQuery.ts`](file:///c:/Projects/Azm/src/lib/useAdminQuery.ts): Custom React hook that coordinates loading states, error boundaries, auth hydration, and optional window-focus refetching.
  - [`src/lib/mockApi.ts`](file:///c:/Projects/Azm/src/lib/mockApi.ts): Acts as the typed client SDK wrapping REST endpoints with full TypeScript models.
- **Forms & Validation:**
  - Client-side validation in [`src/utils/formValidation.ts`](file:///c:/Projects/Azm/src/utils/formValidation.ts) provides real-time masking (e.g. `13101-XXXXXXX-X` for Pakistani CNIC, `03XX-XXXXXXX` for Pakistani mobile), error mapping, and pre-submit Captcha protection.

---

# Backend Architecture

- **Design Pattern:** Modular Layered Architecture (Folder-by-Feature).
  - Each module in `backend/src/modules/<feature>/` contains:
    - `<feature>.routes.ts`: Express router defining endpoints and attaching middleware.
    - `<feature>.controller.ts`: Handles HTTP request/response parsing, status codes, and delegates to service.
    - `<feature>.service.ts`: Pure business logic, database transactions, calculation routines, and external API calls.
    - `<feature>.schema.ts`: Zod schema definitions for request validation.
- **Central Error Handling:**
  - `errorHandler` ([`backend/src/middleware/error.middleware.ts`](file:///c:/Projects/Azm/backend/src/middleware/error.middleware.ts)) catches all thrown exceptions.
  - Automatically translates Prisma error codes (e.g., `P2002` unique constraint violations on CNIC or Roll Number into user-friendly messages, `P2025` not found into 404, Zod validation errors into formatted field error details).
- **PDF Generation Subsystem:**
  - `pdf.service.ts` ([`backend/src/modules/documents/pdf.service.ts`](file:///c:/Projects/Azm/backend/src/modules/documents/pdf.service.ts)) manages a headless Chromium instance.
  - An async mutex queue (`PdfGenerationQueue`) serializes PDF generation tasks, ensuring that only one Chromium job runs at any time to preserve memory on cloud hosts.

---

# External Services & Integrations

1. **Supabase PostgreSQL Database**
   - **Purpose:** Primary relational database.
   - **Integration Code:** [`backend/src/lib/prisma.ts`](file:///c:/Projects/Azm/backend/src/lib/prisma.ts), [`backend/prisma/schema.prisma`](file:///c:/Projects/Azm/backend/prisma/schema.prisma).
   - **Environment Variables:** `DATABASE_URL`, `DIRECT_URL`.

2. **Supabase Storage**
   - **Purpose:** Object storage for candidate documents, photos, QR images, and PDF archives.
   - **Integration Code:** [`backend/src/lib/supabaseStorage.ts`](file:///c:/Projects/Azm/backend/src/lib/supabaseStorage.ts).
   - **Environment Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

3. **Render Cloud Platform**
   - **Purpose:** Production cloud hosting for backend Node.js web service.
   - **Integration Code:** [`render.yaml`](file:///c:/Projects/Azm/render.yaml).
   - **Environment Variables:** `PORT`, `NODE_ENV`, `PUPPETEER_CACHE_DIR`, `NODE_OPTIONS`.

4. **Hostinger / GitHub Pages**
   - **Purpose:** Production static file hosting for frontend React SPA.
   - **Integration Code:** [`.github/workflows/deploy.yml`](file:///c:/Projects/Azm/.github/workflows/deploy.yml).
   - **Environment Variables:** `VITE_API_URL`.

5. **Google AI Studio / Gemini API (Declared Capability)**
   - **Purpose:** Configured in starter metadata for future AI-powered capabilities.
   - **Integration Code:** Declared in [`package.json`](file:///c:/Projects/Azm/package.json) and [`metadata.json`](file:///c:/Projects/Azm/metadata.json).
   - **Environment Variables:** `GEMINI_API_KEY`.

---

# Environment & Configuration

### Backend Environment Variables (`backend/.env`)

```
# Server Configuration
PORT=5000
NODE_ENV=development # development | test | production
NODE_OPTIONS="--max-old-space-size=128"

# Database Connection (Supabase)
DATABASE_URL="postgresql://postgres.xxx:xxx@xxx.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10"
DIRECT_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres"

# JWT & Cryptographic Secrets
JWT_ACCESS_SECRET="<min-16-char-secret>"
JWT_REFRESH_SECRET="<min-16-char-secret>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
QR_SECRET="<min-16-char-secret>"

# CORS & Domain Whitelist
CORS_ORIGIN="http://localhost:5173"
FRONTEND_URL="https://azmaio.com"

# Supabase Storage Integration
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Puppeteer / Headless Chrome
PUPPETEER_CACHE_DIR="/opt/render/project/src/backend/.cache/puppeteer"
```

### Frontend Environment Variables (`.env.local` / Build Env)

```
VITE_API_URL="https://azmnew.onrender.com"
GEMINI_API_KEY="<optional-gemini-key>"
```

### Important Configuration Files
- [`backend/src/config/env.ts`](file:///c:/Projects/Azm/backend/src/config/env.ts): Zod schema validating backend environment variables on boot. Fails fast in production if development fallback secrets are detected.
- [`vite.config.ts`](file:///c:/Projects/Azm/vite.config.ts): Configures React plugin, Tailwind CSS v4, module aliases (`@` -> root), build target `esnext`, and manual chunking.
- [`render.yaml`](file:///c:/Projects/Azm/render.yaml): Render blueprint defining build commands, start commands, Node memory limits, and Puppeteer Chrome installations.

---

# Development Workflow

### 1. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### 2. Run in Development Mode
```bash
# Terminal 1: Run Backend API (starts on http://localhost:5000)
cd backend
npm run dev

# Terminal 2: Run Frontend SPA (starts on http://localhost:3000)
npm run dev
```

### 3. Database Operations & Seeding
```bash
cd backend

# Generate Prisma Client after schema changes
npm run prisma:generate

# Apply migrations to database
npm run prisma:migrate

# Seed default administrator accounts and test centers
npm run seed
```

### 4. Storage & Egress Remediation Scripts
```bash
cd backend

# Backfill legacy embedded base64 documents to Supabase Storage
npm run storage:backfill

# Backfill lightweight thumbnails for student photos
npm run storage:backfill-thumbnails
```

### 5. Running Tests & Linting
```bash
# Frontend Type Check
npm run lint

# Backend Test Suite
cd backend
npm run test:egress
npx tsx tests/integration.test.ts
npx tsx tests/protection.test.ts
```

### 6. Production Build
```bash
# Build Frontend
npm run build

# Build Backend
cd backend
npm run build
```

---

# Testing

- **Testing Frameworks & Runners:** Custom TypeScript test runners executed via `tsx` utilizing `node-fetch`, Node HTTP server fixtures, and assertion libraries.
- **Test Directory:** [`backend/tests/`](file:///c:/Projects/Azm/backend/tests/).
- **Major Test Suites:**
  - `egress-remediation.test.ts`: Verifies student roster payloads exclude heavy base64 files and document metadata pagination functions correctly.
  - `integration.test.ts`: End-to-end flow test (Health -> Login -> Dashboard Overview -> Candidate Registration -> QR Token Issuance -> QR Attendance Scan).
  - `protection.test.ts`: Validates rate limit configurations and security safeguards.
  - `roll-number-decoupling.test.ts`: Verifies independent lifecycle of registration application IDs and subsequent roll number generation.
  - `storage-pdf.test.ts`: Tests Puppeteer single-concurrency PDF rendering and storage uploading.

---

# Deployment & Infrastructure

- **Backend API:** Render Web Service (Singapore region, Node environment, Free tier with `NODE_OPTIONS="--max-old-space-size=128"`).
  - Build command installs Chrome for Puppeteer, runs Prisma migrations, and compiles TypeScript.
- **Frontend SPA:** Static bundle generated by Vite (`npm run build`), deployed via GitHub Actions workflow (`.github/workflows/deploy.yml`) to the `deploy` branch for Hostinger static hosting.
- **Database:** Supabase managed PostgreSQL using connection pooler mode on port `6543`.
- **CORS Whitelist:** Express CORS policy whitelists production domains (`azmaio.com`, `www.azmaio.com`, `azmnew.onrender.com`, `*.hostingersite.com`) and local development ports (`5173`, `3000`, `4173`, `5000`).

---

# Important Conventions

1. **Modular Backend Organization:** Each domain feature in `backend/src/modules/` is strictly organized into `routes -> controller -> service -> schema`. Do not scatter domain logic outside its feature directory.
2. **Stateless Bearer Authentication:** The backend does not use sessions or cookies. All authentication must rely on `Authorization: Bearer <token>`.
3. **No Embedded Base64 in Database Lists:** To prevent database and network egress exhaustion, never save large base64 data URLs into list-queried columns. All files must be stored in Supabase Storage, and database records should hold only metadata (`bucket`, `objectPath`, `mimeType`, `byteSize`).
4. **Zod Validation on All Endpoints:** All incoming request bodies and queries on the backend must be validated using Zod schemas via `validateBody()` and `validateQuery()`.
5. **Cryptographic QR Tokens:** QR codes must encode HMAC-SHA256 signed payloads (`qrService.generateSignedQrToken()`), never raw roll numbers or plaintext IDs.
6. **PDF Generation Concurrency Control:** All server-side Chromium/Puppeteer tasks must be enqueued through `pdfQueue.enqueue()` to preserve server memory.

---

# Important Files

1. [`backend/prisma/schema.prisma`](file:///c:/Projects/Azm/backend/prisma/schema.prisma)
   *Purpose: Canonical database schema defining all models, relations, enums, and indexes.*
2. [`backend/src/app.ts`](file:///c:/Projects/Azm/backend/src/app.ts)
   *Purpose: Core Express application configuring CORS, JSON parsing, API routes mounting, and global error handling.*
3. [`backend/src/server.ts`](file:///c:/Projects/Azm/backend/src/server.ts)
   *Purpose: Backend server entry point managing startup account bootstrap, port listening, and graceful termination.*
4. [`backend/src/config/env.ts`](file:///c:/Projects/Azm/backend/src/config/env.ts)
   *Purpose: Zod environment validator ensuring required secrets and database URLs are present.*
5. [`backend/src/lib/prisma.ts`](file:///c:/Projects/Azm/backend/src/lib/prisma.ts)
   *Purpose: Resilient Prisma client providing direct PostgreSQL connectivity with an in-memory development fallback.*
6. [`backend/src/lib/supabaseStorage.ts`](file:///c:/Projects/Azm/backend/src/lib/supabaseStorage.ts)
   *Purpose: Cloud object storage client for uploading, streaming, and generating signed URLs for private student documents.*
7. [`backend/src/modules/students/students.service.ts`](file:///c:/Projects/Azm/backend/src/modules/students/students.service.ts)
   *Purpose: Core business logic for student candidate registration, roster queries, document metadata formatting, and roll number allocation.*
8. [`backend/src/modules/attendance/qr.service.ts`](file:///c:/Projects/Azm/backend/src/modules/attendance/qr.service.ts)
   *Purpose: Generates and verifies HMAC-SHA256 signed biometric QR tokens for tamper-proof attendance slips.*
9. [`backend/src/modules/documents/pdf.service.ts`](file:///c:/Projects/Azm/backend/src/modules/documents/pdf.service.ts)
   *Purpose: Memory-optimized Puppeteer Chromium PDF rendering engine with single-task concurrency queue.*
10. [`src/App.tsx`](file:///c:/Projects/Azm/src/App.tsx)
    *Purpose: Frontend root shell containing hash-based routing, authentication context provider, and lazy view loader.*
11. [`src/lib/apiClient.ts`](file:///c:/Projects/Azm/src/lib/apiClient.ts)
    *Purpose: Frontend HTTP client handling JWT bearer headers, automatic 401 token refresh, PDF blob downloads, and cold-start wakeups.*
12. [`src/lib/mockApi.ts`](file:///c:/Projects/Azm/src/lib/mockApi.ts)
    *Purpose: Main frontend API client service layer defining typed methods for all backend endpoints.*
13. [`src/lib/authContext.tsx`](file:///c:/Projects/Azm/src/lib/authContext.tsx)
    *Purpose: React Context provider managing user session, login, logout, and role state across the application.*
14. [`src/components/public/register/PublicCandidateRegistrationWizard.tsx`](file:///c:/Projects/Azm/src/components/public/register/PublicCandidateRegistrationWizard.tsx)
    *Purpose: 8-stage public scholarship application wizard with client validation, document uploads, and pre-submit Captcha.*
15. [`src/components/admin/layout/AdminSidebar.tsx`](file:///c:/Projects/Azm/src/components/admin/layout/AdminSidebar.tsx)
    *Purpose: Role-based navigation sidebar for the Admin Portal filtering menu items by user permissions.*

---

# Current Constraints / Technical Debt

### Confirmed Constraints
- **Render Free Tier Memory Cap (512 MB):** Puppeteer Chromium PDF generation must run sequentially (enforced by `PdfGenerationQueue`) to prevent container OOM termination.
- **Minor Privacy Compliance:** Candidate CNIC copies, DMC result cards, and photos are stored in private Supabase Storage buckets and must only be served via authenticated endpoints or candidate verification secrets.
- **Stateless Bearer Tokens:** The client does not use HTTP-only cookies; token refresh relies on a valid refresh token saved in `localStorage`.

### Likely Technical Debt
- **Frontend API File Naming (`src/lib/mockApi.ts`):** Despite its historical name `mockApi.ts`, this file is now the primary live API client communicating with the backend. It could be renamed in future refactors to `adminApi.ts` or `portalApi.ts` to prevent naming confusion.
- **Dual PDF Generation Engines:** The application uses both server-side Puppeteer (`pdf.service.ts`) for high-fidelity official documents and client-side jsPDF (`pdfExport.ts`) for quick table exports. Keeping templates synchronized requires updating both if visual layouts change.

### Unknowns / Needs Verification
- **Future Gemini LLM Integration:** `@google/genai` is present in dependencies and configuration, but active runtime LLM calls have not yet been wired into application workflows.

---

# AI Planning Guidance

- **Preserve Modular Architecture:** When adding backend functionality, create a dedicated folder in `backend/src/modules/<feature>` containing `.routes.ts`, `.controller.ts`, `.service.ts`, and `.schema.ts`. Mount the new router in `backend/src/app.ts`.
- **Database Schema Changes:** Add new models or fields in `backend/prisma/schema.prisma`, then run `npx prisma migrate dev` (in dev) or `npx prisma migrate deploy` (in production). Always update the corresponding TypeScript types in `src/types/index.ts` and `src/lib/mockApi.ts`.
- **Frontend View Placement:**
  - Public features belong in `src/components/<feature>/` or `src/components/public/`.
  - Admin management views belong in `src/components/admin/<feature>/` and should be registered in `AdminSidebar.tsx` and `App.tsx`.
- **Prevent Database Egress Bloat:** Never store raw base64 data URLs in PostgreSQL columns. Upload files to Supabase Storage using `supabaseStorage.uploadFile()` and save only the object path in the database.
- **High Blast Radius Areas:**
  - `backend/prisma/schema.prisma` & migrations (affects entire data layer).
  - `backend/src/lib/prisma.ts` & `backend/src/middleware/auth.middleware.ts` (affects all protected routes).
  - `src/lib/apiClient.ts` & `src/lib/mockApi.ts` (affects all frontend network requests).
  - `backend/src/modules/documents/pdf.service.ts` (Chromium memory and CPU stability).

---

# Compact Context Summary

```markdown
AZM.AIO (Session V 2026) is a unified educational scholarship management and examination platform for AZM.AIO and its partner institutions. The system manages the end-to-end student and institutional lifecycle: an 8-stage public scholarship application wizard, partner school affiliation approvals with audit history, automated and batch roll number allocation, tamper-proof HMAC-signed biometric QR codes, regional examination center and exam hall seating distribution, camera-based QR attendance scanning for invigilators, fee challan generation and collection, staff directory with monthly payroll runs, a double-entry cash flow ledger, and public roll number slip/merit list lookup desks.

Architecture & Stack:
- Frontend: React 19 SPA powered by Vite, TypeScript, Tailwind CSS v4, Lucide React, and Framer Motion. Uses hash-based routing (#dashboard, #register, #scan, etc.) and lazy-loads views with React Suspense.
- Backend: Node.js (>=18) + Express 4 + TypeScript modular REST API structured by feature (routes -> controller -> service -> schema) with Zod validation and central error handling.
- Database: PostgreSQL on Supabase managed via Prisma ORM (prisma/schema.prisma). Uses connection pooling with an in-memory dev fallback in local offline environments.
- File Storage: Supabase Storage private/public buckets (student-photos, student-documents, qr-codes, registration-pdfs) optimized with Sharp thumbnail resizing and on-demand streaming to eliminate database egress.
- Documents: High-resolution server-side PDF generation using Puppeteer Headless Chromium with a single-task mutex queue to fit Render Free Tier 512MB RAM constraints, plus client-side jsPDF fallback.
- Auth & Roles: Stateless JWT Bearer tokens (access + refresh tokens) stored in localStorage with zero-cookie architecture. Roles: SUPER_ADMIN, ADMIN, TEACHER, ACCOUNTANT.
- Deployment: Backend on Render (https://azmnew.onrender.com), Frontend built via GitHub Actions and hosted on Hostinger.

Key Locations:
- Schema: backend/prisma/schema.prisma
- Backend Setup: backend/src/app.ts, backend/src/server.ts, backend/src/modules/
- Frontend App & Routing: src/App.tsx, src/lib/apiClient.ts, src/lib/mockApi.ts
- Auth Context: src/lib/authContext.tsx, backend/src/middleware/auth.middleware.ts
- PDF Generator: backend/src/modules/documents/pdf.service.ts
- Registration Wizard: src/components/public/register/PublicCandidateRegistrationWizard.tsx
- Admin Portal: src/components/admin/ (dashboard, students, partners, halls, storage, attendance, fees, staff, payroll, transactions, settings)
```

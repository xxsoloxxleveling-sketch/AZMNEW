# AZM.AIO Students & Candidates Specification — pages/students.md

> **Scope:** Page-specific design decisions for the Students Roster and Candidate Management workspace (`src/components/admin/students/StudentsListView.tsx`, `StudentDetailView.tsx`, `AdminWalkInModal.tsx`).
> **Parent Design System:** [`../MASTER.md`](file:///c:/Projects/Azm/design-system/azm-aio/MASTER.md)
> **Status:** APPROVED & FROZEN (Step 10.12)
> **Compliance Dials:** Variance = 3 / 10 | Motion = 2 / 10 | Density = 8 / 10
> **Strict Operational Rule:** Data management workspace, not an analytics dashboard. No synthetic data, no fake qualifications, no fake attendance percentages, no invented metrics.

---

## 1. Module Philosophy: Data-Management Workspace

The Students module is an operational administrative workspace designed for high-throughput registration, candidate verification, examination desk management, and profile correction.

Unlike the Executive Dashboard (which is an analytical flight deck), the Students workspace is a **pure data-management tool**. It does not feature decorative metric grids, large marketing banners, or synthetic graphs. Every pixel is dedicated to searchability, record density, data integrity, and fast administrative workflows.

---

## 2. Page Hierarchy & Surface Layout

The page structure follows AZM's restrained surface hierarchy:
`Page → Utility/Filter Toolbar → Tabular Data Surface → Contextual Action/Detail Panels`

```
Students Roster Page
  ├── Sticky Navigation Bar (AdminHeader.tsx)
  │     ├── Title: "Student Management & Registry"
  │     └── Dominant Primary Action: "+ Register Walk-In Student"
  │
  ├── Operational Filter & Search Toolbar (Unified Strip)
  │     ├── Left: High-contrast search input (Name, Roll #, CNIC, App #) with instant clear (×)
  │     ├── Middle: Restrained dropdown filters (Class, Fee Status, Gender, Verification)
  │     └── Right: Reset Filters + Export CSV/PDF secondary utilities
  │
  ├── Contextual Batch Selection Toolbar (Replaces normal header when rows selected)
  │     ├── Selection Counter: "{N} candidates selected"
  │     ├── Batch Actions: Approve Fees, Assign Hall, Print Slips, Export Selected
  │     └── Clear Selection button
  │
  ├── Authoritative Tabular Roster (52px Row Target Height)
  │     ├── Column 1: Multi-select Checkbox
  │     ├── Column 2: Candidate Identity (32-36px ID Thumbnail + Full Name + Secondary Meta)
  │     ├── Column 3: Identifiers (Roll Number / Application No — Non-wrapping)
  │     ├── Column 4: Academic Affiliation (Current Class + Institution)
  │     ├── Column 5: Fee & Verification Status (Semantic Badges only)
  │     ├── Column 6: Examination Logistics (Assigned Hall & Room / Unassigned)
  │     └── Column 7: Actions (Direct "View Profile" + Overflow Dropdown "···")
  │
  └── Pagination & Ledger Footnote
        ├── Active Record Window ("Showing 1 to 25 of 1,420 candidates")
        └── Compact Pagination Controls (Previous / Page Indicators / Next)
```

---

## 3. Search & Filter Toolbar

- **Input Density:** Compact 36px (`h-9`) inputs with 12px text size (`text-xs`).
- **Immediate Feedback:** Search queries filter on client while actively debouncing backend query requests.
- **Filter Hygiene:** Active non-default filters display subtle indicators. A "Clear Filters" button appears dynamically only when filters are applied.
- **Single Dominant Primary Action:** The screen maintains exactly one dominant primary button (`bg-[#185b9d] text-white`): *"Register Walk-In Student"*. All search and filter controls are styled in neutral secondary tones (`bg-white border-slate-300 text-slate-700`).

---

## 4. Student Identity Thumbnail & Identification Cells

### 4.1 Thumbnail Geometry & Specs
- **Desktop / Tablet:** 32px × 32px (up to 36px maximum).
- **Mobile Viewport:** 36px × 36px (up to 40px maximum).
- **Styling:** Small restrained ID-photo rounded rectangle (`rounded-md`, 6–8px radius) with subtle neutral border (`border border-slate-200/80`). Avoid large circular social-media avatars.
- **Object Fitting:** `object-fit: cover`.

### 4.2 Real Photo vs. Initials Fallback
- When an authentic candidate photograph exists in storage, it is served securely via the authenticated endpoint:
  `GET /api/students/:id/document/photoThumbnail`
- If no photo has been uploaded or verified, the cell immediately falls back to a clean, calm initials avatar with neutral slate styling (`bg-slate-100 text-slate-600 font-bold border border-slate-200`).
- **Zero Generated/Fake Avatars:** Never display Dicebear, RoboHash, or arbitrary decorative headshots.

### 4.3 Candidate Identity Cell Composition
The Identity cell integrates the thumbnail directly alongside the candidate’s name without creating a separate "Photo" table column:
```
[Thumbnail]  Muhammad Bilal Khan
(32x32)      CNIC: 13101-1234567-1 · Father: Tariq Mehmood
```

---

## 5. Row Target Height & Table Typography

- **Administrative Target Height:** 52px row height across desktop tables when identity thumbnails are rendered. This satisfies high information density while accommodating the 32px ID thumbnail, two lines of text, and touch target minimums.
- **Identifier Non-Wrapping:** Roll Numbers (`AZM-2026-0891`) and Application Numbers (`APP-2026-0001`) use fixed monospace typography (`font-mono text-xs whitespace-nowrap`) and must never wrap to multiple lines.
- **Table Density Dial:** Strict 8 / 10 density. Compact cell padding (`py-2 px-3 sm:py-2.5 sm:px-4`).

---

## 6. Status Badges & Semantic Meaning

Badges are reserved exclusively for values that represent true operational state, category, or workflow milestones:

- **Fee States:**
  - `PAID` / `VERIFIED`: `bg-emerald-50 text-emerald-700 border border-emerald-200`
  - `PENDING` / `UNPAID`: `bg-amber-50 text-amber-700 border border-amber-200`
  - `REJECTED`: `bg-rose-50 text-rose-700 border border-rose-200`
- **Honest "Unallocated" / Missing Data:**
  - When hall, seat, or room allocation has not been completed, render a muted semantic placeholder: `Unallocated` (`text-slate-400 italic text-xs`). Never invent fake hall names or placeholder room numbers.
- **True Status Only:** Do not turn static metadata (e.g., gender, district, religion) into colored pills.

---

## 7. Action Hierarchy & Contextual Overflow

1. **Direct Action (Visible in Cell):**
   - *"View Profile"* (or *"View Details"*): Neutral secondary link/button. Always visible on desktop row for immediate one-click inspection.
2. **Contextual Overflow Menu (`···`):**
   - Secondary and destructive actions reside inside the row overflow menu:
     - *Edit Student* (Gated by RBAC: `SUPER_ADMIN` and `ADMIN` only)
     - *Download Slip*
     - *Print Application Form*
     - *Verify Fee Payment* (Accountant & Admin only)
     - *Delete Candidate* (Destructive action, red text, Super Admin only, confirmation modal required)
3. **Contextual Batch Selection Toolbar:**
   - When one or more rows are checked via multi-select, a top selection strip **replaces** the standard filter toolbar rather than stacking vertically. This maintains vertical density and prevents page shifts.

---

## 8. Mobile Responsiveness: Flat Operational Lists

- **No Giant Mobile Cards:** On small screens (390px–768px), candidates are rendered as compact, flat operational list items separated by hairline dividers (`divide-y divide-slate-100`).
- **Touch Targets:** The row action overflow button (`···`) is touch-optimized (minimum 36px touch zone).
- **Horizontal Stability:** Zero horizontal body scroll. Identity, Application No, and primary status badge are visible on mobile; secondary administrative details are tucked inside `StudentDetailView`.

---

## 9. Authoritative Detail Workspace (`StudentDetailView`)

- **Role:** Deep administrative record inspection.
- **Header Actions:**
  - Secondary neutral button: *"Edit Student"* (with `Edit2` icon)
  - Secondary neutral button: *"Download Slip"*
  - Destructive secondary: *"Delete Candidate"* (Super Admin only)
- **High-Density Data Grid:**
  - Part A & B: Personal & Contact Information (DOB, Gender, Religion, Mobile, Emergency Contact, Address)
  - Part C: Academic Examination Record (genuine submitted records only; honest empty state when unprovided)
  - Part D & E: Scholarship Category & Household Details (Guardian occupation, monthly income, stream)
  - Part F: Examination Logistics (Test center, hall, room, reporting time, seat number)
  - Part G: Submitted Candidate Documents (Document vault with secure authenticated lightbox preview)
- **Data Integrity:** Never render synthetic attendance graphs or fabricated academic history. Missing qualifications display: *"No previous qualification records on file for this candidate."*

---

## 10. Registration & Edit Workflow (`AdminWalkInModal`)

### 10.1 Dual-Mode Operation (`mode="create" | "edit"`)
- **Create Mode:** Title *"Walk-In Candidate Registration"*, Submit *"Register Candidate"*.
- **Edit Mode:** Title *"Edit Student — {Candidate Name}"*, Submit *"Save Changes"*.

### 10.2 Authoritative Field Prefilling
- Form pre-fills authoritative data from backend record.
- Dates are converted reliably to `YYYY-MM-DD` for native HTML5 date picker compatibility.
- Academic class values dynamically accept non-standard historical values (`'Class 9th'`, `'Class 10th'`, `'1st Year'`, `'2nd Year'`).
- Secondary stream fields (`hsscGroup`, `bsDepartment`, `bsSemester`) are optional to avoid native browser validation blocking.

### 10.3 Immutable Operational Fields
The following fields are operational invariants and must **never** be editable via the profile edit form:
- Application Number (`applicationNo`)
- Roll Number (`rollNumber`)
- Fee Status & Payment History (`feeStatus`, `feeRecords`)
- Examination Hall, Room, and Seat Allocations

### 10.4 Unsaved Changes Protection (`isDirty`)
- Modal tracks dirty state by comparing current form state against the opening snapshot.
- If edits exist and user attempts to close via backdrop click, Close button, or Escape key, an unsaved changes confirmation dialog prompts before discarding:
  *"Discard unsaved changes? Any edits you made to this student will be lost."*

### 10.5 Document & Photo Preservation
- Updating candidate profile text fields **does not** touch existing photos or documents in storage.
- If a replacement file is explicitly selected by the user, only the selected document type is updated.
- Preserves all associated document IDs and relational pointers.

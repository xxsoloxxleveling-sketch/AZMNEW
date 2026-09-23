# AZM.AIO Executive Dashboard Specification — pages/dashboard.md

> **Scope:** Page-specific design decisions for the Executive Overview Dashboard (`src/components/admin/dashboard/DashboardView.tsx`)  
> **Parent Design System:** [`../MASTER.md`](file:///c:/Projects/Azm/design-system/azm-aio/MASTER.md)  
> **Status:** APPROVED & FROZEN (Step 7.6)  
> **Compliance Dials:** Variance = 3 / 10 | Motion = 2 / 10 | Density = 8 / 10  
> **Strict Operational Rule:** No fabricated or simulated information (no fake database badges, no fake "System Online", no fake last-sync timestamps, no synthetic targets, trend percentages, or mock activity strings).

---

## 1. Executive Dashboard Purpose & Philosophy

The Executive Overview Dashboard is the operational flight deck for AZM.AIO administrators. It is not an executive marketing summary or an investor pitch deck; it is a working administrative command center.

Every component on this screen answers at least one of four core operational questions:

```
+-----------------------------------------------------------------------------------------+
| OPERATIONAL QUESTION                   | DASHBOARD COMPONENT ANSWERING IT               |
+----------------------------------------+------------------------------------------------+
| 1. What is happening right now?        | Core KPI Summary Surface (Live enrollment,     |
|                                        | today's attendance rate, fee collection rate). |
+----------------------------------------+------------------------------------------------+
| 2. What requires immediate attention?  | Pending Fee Defaulters Queue & Pending         |
|                                        | Partner Accreditation count.                   |
+----------------------------------------+------------------------------------------------+
| 3. What changed recently?              | Chronological Audit Activity Stream            |
|                                        | (verifiable system activity records).          |
+----------------------------------------+------------------------------------------------+
| 4. What should I do next?              | Clear action hierarchy: Verify Defaulters,     |
|                                        | Review Partners, Launch Attendance Scanner.    |
+----------------------------------------+------------------------------------------------+
```

---

## 2. Information Priority & Visual Hierarchy

Information is prioritized strictly by administrative urgency:

1. **Top Priority: Critical Status & Core Summary Metrics (Instant Scan)**
   - Registered Students Count
   - Partner Institutions Count (with pending status if returned by API)
   - Today's Attendance Percentage (Live Marked)
   - Fee Collection Percentage & Total Collected
   - Active Faculty & Staff Count
2. **Second Priority: Action-Required Defaulters & Financial Cash Flow**
   - High-density Fee Defaulters mini-table (immediate outreach / follow-up).
   - Monthly Financial Ledger summary (Fee Income vs. Salary Disbursements vs. Net Balance).
3. **Third Priority: Weekly Attendance Matrix**
   - Compact 5-day Mon–Fri attendance matrix derived from calendar period date.
4. **Fourth Priority: Student Demographics & System Audit Trail**
   - Gender Split progress and Class enrollment breakdown.
   - Recent Activity Log (genuine audit records with honest empty state).

---

## 3. Page Header & Action Hierarchy

### Existing Conflict Resolved (Step 7.6):
The existing screen displayed duplicated *"Add Student"* and *"Mark Attendance"* buttons in both the top sticky header (`AdminHeader.tsx`) and a 76px bordered "Administrative Overview" command bar.

### Final Approved Behavior:
- **Header Title Area (`AdminHeader.tsx`):**
  - Title: *"Executive Overview Dashboard"* (`text-base sm:text-lg font-bold text-slate-900`)
  - Subtitle: *"Academic Session 2026-2027 Analytics"* (`text-xs text-slate-500 font-medium`)
- **Single Dominant Primary Action:**
  - In `AdminHeader`: *"Add Student"* remains the sole visually dominant primary button (`bg-[#185b9d] text-white`).
  - Secondary quick actions in header: *"Mark Attendance"* (`bg-white border border-slate-300 text-slate-700`) and *"Generate Challan"*.
- **Elimination of Command Bar:**
  - The intermediate "Administrative Overview" command bar has been **completely removed**.
  - Page content transitions immediately into the unified KPI summary surface, recovering vertical space and placing the entire primary desktop dashboard in **1.0x viewport height**.

---

## 4. Unified KPI Summary Surface

*Governance Note: In accordance with Step 6 and Step 7.6 instructions, `StatCard.tsx` was NOT modified globally. The unified KPI summary surface was implemented locally within `DashboardView.tsx`.*

### The Approved Architecture:
Rather than five separate floating cards with skittles-colored icon boxes, the dashboard uses a **single restrained summary surface**:

```
Unified Summary Surface (bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs)
  ├── Top Header / Utility Strip:
  │     ├── Left: "Administrative Overview | Key Performance Indicators"
  │     └── Right: [Sync Data] action button (with spin feedback)
  └── 5-Cell Grid (separated by hairline dividers: divide-slate-100)
        ├── Cell 1: Registered Students (Active Candidates / No active candidates)
        ├── Cell 2: Partner Institutions (Active Accredited / No partner institutions)
        ├── Cell 3: Today's Attendance (Marked Present / No Session Conducted)
        ├── Cell 4: Fee Collection Rate (Collected / No fees billed this cycle)
        └── Cell 5: Active Faculty & Staff (Invigilators & Officers / No active staff)
```

### Visual Specifications:
- **Container Treatment:** `bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden`.
- **Dividers:** Clean hairline borders (`border-slate-100` / `divide-slate-100`).
- **Icon Boxes Removed:** All decorative pastel icon containers have been removed. Hierarchy comes purely from label, value, and context text.
- **Metric Cell Information Hierarchy:**
  1. Label: `text-xs font-medium text-slate-500 block`
  2. Value: `text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1`
  3. Context text: `text-[11px] text-slate-500 truncate`
  4. Interactive cue: Explicit `View →` link indicator that turns brand `#185b9d` on hover.
- **Accessible Interaction:** Every cell is wrapped in an accessible `<button type="button">` with native keyboard focus, hover feedback (`hover:bg-slate-50/60`), and descriptive `aria-label`.

### Truthful Zero-State Semantics:
- **Partner Institutions:** When `totalPartners === 0`, displays `0` and `"No partner institutions"`. Never falsely claims *"All Accreditations Cleared"*.
- **Fee Collection Rate:** When `totalBilled === 0`, displays `—` and `"No fees billed this cycle"`. Never displays `0%` unless positive billable amount exists and zero was collected.
- **Registered Students:** When `totalStudents === 0`, displays `0` and `"No active candidates"`.
- **Today's Attendance:** When no session conducted, displays `—` and `"No Session Conducted"`.
- **Active Faculty & Staff:** When `activeStaffCount === 0`, displays `0` and `"No active staff recorded"`.

---

## 5. Operational Attention Areas: Fee Defaulters Presentation

### Structure & Density (Density: 8/10):
- **Structure:** Compact administrative mini-table with clear column hierarchy:
  ```
  [ Student & Roll No ] [ Class ] [ Due (PKR) ] [ Action ]
  ```
- **Styling:**
  - Header: `text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50 py-1.5 px-2 border-b border-slate-200`.
  - Row height: ~36px (`py-2 px-2 hover:bg-slate-50/80 transition-colors`).
  - Student Name: `font-semibold text-slate-900 text-xs block truncate max-w-[110px]`.
  - Roll No: `text-[10px] text-slate-500 font-mono block`.
  - Amount Due: `font-bold text-rose-700 tabular-nums text-xs text-right whitespace-nowrap`.
  - Action: Button `"Review Fees"` leading directly to `#fees`.
- **Truthful Empty State:**
  - When defaulters query returns 0 rows: A clean, concise message: `"No overdue fee accounts"` with small neutral icon.
  - The unverified subtext claim *"All issued fee challans are cleared"* has been **removed**.

---

## 6. Weekly Attendance Matrix

### Specification:
- **Schedule:** Truthful 5-day Monday–Friday work week derived from the calendar period date: `Mon 21`, `Tue 22`, `Wed 23`, `Thu 24`, `Fri 25`.
- **Eliminated Duplicate Bucket:** Removed the redundant 6th `"Today"` column. The current day is integrated directly into its weekday slot and highlighted with brand blue styling (`#185b9d`) and a bold `TODAY` indicator.
- **Data Binding:** Binds strictly to `attendanceTrends` from `mockApi`.
- **Distinguishing No Session from 0%:**
  - If a session occurred and rate > 0: renders solid bar with percentage label on top.
  - If no session occurred on that day: renders clean dashed neutral container with `"No Session"`. Never synthesizes fake 0% attendance.
- **Footer Summary:** Displays verified figures only:
  - *"Today's Marked Check-ins: {todayMarkedCount} students"*
  - *"Total Candidate Roll: {totalActiveStudents} students"*

---

## 7. Financial Cash Flow: Ledger Summary

### Specification:
- **Surface Hierarchy:** Single container (`bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs`).
- **Table / Ledger Alignment (No Nested Cards):**
  - Utilizes clean stacked ledger rows separated by hairline dividers:
    1. **Fee Income Collected:** Label, green indicator, and `PKR {feeIncome}` (`tabular-nums text-sm font-bold text-slate-900`).
    2. **Salary Disbursements:** Label, red expense indicator, and `PKR {salaryExpenses}` (`tabular-nums text-sm font-bold text-slate-900`).
    3. **Net Operating Balance:** Distinct summary row with subtle highlight border and bold `PKR {netCashFlow}` (`text-emerald-700` if positive, `text-rose-700` if negative).
- **Actions:** Primary button `"Issue Monthly Fee Challans"` and text action `"View General Ledger →"` navigating to `#transactions`.

---

## 8. Demographics & Recent Activity Feed

### Student Demographics:
- **Gender Split:** Clean 8px progress bar with tabular numbers beneath: `M: {male} ({pct}%) | F: {female} ({pct}%)`. If both are 0: `M: 0 (0%) | F: 0 (0%)`.
- **Class Breakdown:** Compact key-value list with `.tabular-nums` counts. Honest empty state: `"No class enrollment records yet."`

### Recent Activity Log:
- **Data Provenance:** Removed all synthetic status messages (`act_1`, `act_2`). Displays genuine audit events only.
- **Header Action:** Changed link from `"Live Audit"` to `"View Audit Log"` (navigating to `#transactions`).
- **Honest Empty State:** Renders clean empty state when no activity exists:
  - Icon: Neutral `FileText` (`w-5 h-5 text-slate-300 mx-auto`).
  - Title: `"No recent audit events"` (`text-xs font-medium text-slate-600`).
  - Subtitle: `"Administrative activity will appear here as operations occur."` (`text-[11px] text-slate-400`).

---

## 9. Viewport Structure & Acceptance Metrics

### Desktop Viewport (1440 x 900):
- **Scroll Height:** Exactly **1.0x viewport height** (900px clientHeight / 925px scrollHeight). Fits entirely above the fold.
- **Layout:**
  - Row 1: Unified 5-cell KPI summary surface.
  - Row 2 (2:1 Ratio): Weekly Attendance Matrix (2 cols) + Financial Ledger Summary (1 col).
  - Row 3 (1:1:1 Ratio): Fee Defaulters Table (1 col) + Student Demographics (1 col) + Recent Activity Log (1 col).

### Tablet Portrait (768 x 1024):
- **Scroll Height:** **1.79x viewport height**.
- **Layout:** KPI surface reflows to balanced 2-column grid with 5th metric spanning; all tables maintain readability without horizontal overflow.

### Mobile Standard (390 x 844):
- **Scroll Height:** **2.18x viewport height** (drastically reduced from >10 viewports).
- **Layout:** Option A 2-column KPI grid with 5th metric spanning; zero horizontal page overflow.

---

## 10. Permanent Implementation Cautions

### Caution A: Navigation Destination Truthfulness
Action labels and navigation cues must accurately describe the actual destination.
- *Rule:* Do not label a navigation link as *"View Audit Log"* if it navigates to a general financial transactions ledger, unless the target page genuinely implements a dedicated, filtered system audit log.
- *Requirement:* When new modules are connected, verify that the link text matches the actual scope of the target view.

### Caution B: Calendar Labeling vs. Business State Provenance
Calendar date labels (e.g. `Mon 21`, `Tue 22`) may be generated from the calendar period for presentation, but operational business states must originate exclusively from verified application data.
- *Rule:* Attendance session existence, payment clearance, or registration status must never be inferred or synthesized solely to complete a chart or visual widget.
- *Requirement:* If database records for a past date do not exist, the visual representation must honestly communicate `"No Session"` or `"No Record"`.

---

## 11. Verification Checklist

- [x] **Zero fake data:** Removed hardcoded attendance target comparisons, fake trend percentages, and simulated activity strings.
- [x] **StatusBadge.tsx untouched globally:** Preserved existing component imports and API.
- [x] **StatCard.tsx untouched globally:** Refactored locally on the Dashboard first.
- [x] **All routes preserved:** `#dashboard`, `#students`, `#partners`, `#attendance`, `#fees`, `#staff`, `#transactions` navigation calls intact.
- [x] **All backend contracts preserved:** Consumes exact fields from `mockApi.getDashboardOverview()`.

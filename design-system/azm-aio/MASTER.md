# AZM.AIO Product Design System — MASTER.md

> **Status:** Active & Authoritative  
> **Product:** AZM.AIO Educational Administration & Scholarship Management Platform  
> **Design Parameters:** Variance = 3 / 10 | Motion = 2 / 10 | Density = 8 / 10  
> **Authoritative Brand Color:** `#185b9d` (AZM Blue)  
> **Benchmark Reference:** Approved Executive Dashboard (`src/components/admin/dashboard/DashboardView.tsx`)

---

## 1. Product Personality & Brand Identity

AZM.AIO is a serious mission-critical educational administration, student registration, scholarship assessment, examination governance, and institutional finance platform.

### What AZM.AIO IS:
- **Operational:** Designed for daily administrative execution by registrars, controllers of examination, invigilators, and finance officers.
- **Reliable & Trustworthy:** Presents real, verifiable data without artificial marketing fluff, decorative distortions, or simulated metrics.
- **Calm & Restrained:** Minimizes visual noise, avoiding bright pastel rainbows, bouncing animations, and sensory overload.
- **Information-Dense (8/10):** Prioritizes data visibility above the fold, utilizing compact table heights, tight structural margins, and unified metric summaries.
- **Efficient:** Eliminates unnecessary clicks, nested menus, and redundant confirmation steps for routine tasks.
- **Human-Designed:** Feels crafted with care, precision, and architectural discipline for real institutional workflows.
- **Accessible (WCAG 2.1 AA):** Strict high-contrast typography, keyboard navigable controls, visible focus rings, and explicit semantic ARIA labelling.
- **Consistent (Variance 3/10):** Universal application of layout geometry, border widths, spacing scales, and typography tokens across all tabs and submodules.

### What AZM.AIO IS NOT:
- **NOT Marketing-Heavy:** No consumer hero banners, floating confetti, or promotional taglines in operational workspaces.
- **NOT Glassmorphic:** No backdrop blurs, frosted glass cards, or translucent overlapping surfaces.
- **NOT Gradient-Heavy:** No multi-stop decorative gradients or rainbow background washes.
- **NOT Bento-Everywhere:** No asymmetric jigsaw puzzle layouts for data that is inherently tabular or chronological.
- **NOT Pastel-Heavy:** No skittles-colored KPI icon boxes or soft rainbow cards.
- **NOT Over-Rounded:** Restrained 8–12px radii for cards/containers; no 20–32px bubble borders.
- **NOT Over-Animated:** Motion dial fixed at 2/10; zero floating, bouncing, or decorative transitions.
- **NOT Generic AI SaaS:** Strictly avoids template patterns that sacrifice operational clarity for aesthetic novelty.

---

## 2. Design Metrics & Dial Governance

```
+-----------------------------------------------------------------------------------------+
| DIAL            | LEVEL    | OPERATIONAL SPECIFICATION                                  |
+-----------------+----------+------------------------------------------------------------+
| Variance        | 3 / 10   | Strict consistency. Shared page layouts, identical rhythm, |
|                 |          | standardized containers, zero arbitrary visual variations. |
+-----------------+----------+------------------------------------------------------------+
| Motion          | 2 / 10   | Near-zero motion. Transitions strictly functional and      |
|                 |          | <= 150ms. Zero decorative or looped keyframe animations.   |
+-----------------+----------+------------------------------------------------------------+
| Density         | 8 / 10   | High information density. Compact table rows (36-40px),    |
|                 |          | tight padding (12-16px), minimal vertical scroll overhead. |
+-----------------+----------+------------------------------------------------------------+
```

---

## 3. Surface & Hierarchy System

### Fundamental Surface Rule:
```
Page (Canvas)
  └── Section (Structural Grouping / Unified Surface)
        └── Information (Data, Tabular Rows, Metric Cells)
```

**Anti-Pattern to Eliminate:**
`Page → Card → Nested Card → Component → Nested Card`

### Page Structure & Header Pattern:
- **Universal Top Header (`AdminHeader`):**
  - Page Title: `text-base sm:text-lg font-bold text-slate-900`.
  - Subtitle / Context: `text-xs text-slate-500 font-medium`.
  - Action Placement: Exactly **one visually dominant primary action** (`bg-[#185b9d] text-white`) placed in `AdminHeader` on desktop; secondary actions as clean white outline buttons (`bg-white border border-slate-300 text-slate-700`).
- **Direct Header-to-Content Relationship:**
  - Page content begins immediately beneath `AdminHeader`.
  - Intermediate "Administrative Overview" or duplicate command bars that repeat title text, academic session tags, or action buttons are **prohibited**.

### Surface Treatment & Container Rules:
- **Restrained White Surfaces:** Standard panels use `bg-white border border-slate-200/90 rounded-xl shadow-2xs`.
- **Neutral 1px Borders:** Outer boundaries use `border border-slate-200/90`; internal row and column dividers use hairline `border-slate-100` or `divide-slate-100`.
- **Minimal Elevation:** Default containers rely on flat borders with `shadow-2xs` (`0 1px 2px 0 rgba(0, 0, 0, 0.03)`). Shadows are prohibited from communicating visual style; elevation is reserved exclusively for modal dialogs and dropdown menus (`shadow-lg`).
- **Restrained Border Radii:** Containers use `rounded-lg` (8px) or `rounded-xl` (10px–12px max). Controls and inputs use `rounded-md` (6px) or `rounded-lg` (8px). Radii exceeding 12px are prohibited.
- **Section Separation:** Prefer `space-y-4` (16px) whitespace and hairline dividers over wrapping every section in an extra floating card.
- **Card-in-Card Prohibition:** Nested cards within containers are strictly prohibited. Information grouping must be achieved via tabular alignment, subtle background shifts (`bg-slate-50/70`), and dividers.

---

## 4. Spacing Scale & Administrative Density (Density: 8 / 10)

High information density requires compact, mathematically uniform spacing:

```
Token     | Size (px) | Tailwind Equivalent | Primary Administrative Usage
----------|-----------|---------------------|----------------------------------------------
space-1   | 4px       | p-1 / gap-1         | Micro gaps, icon-to-label offsets
space-1.5 | 6px       | p-1.5 / gap-1.5     | Compact badge padding, table cell vertical
space-2   | 8px       | p-2 / gap-2         | Button vertical padding, dense chip grouping
space-2.5 | 10px      | p-2.5 / gap-2.5     | Compact mobile card padding
space-3   | 12px      | p-3 / gap-3         | Standard card padding (dense), input padding
space-3.5 | 14px      | p-3.5 / gap-3.5     | Summary surface cell padding
space-4   | 16px      | p-4 / gap-4         | Section internal spacing, major grid gap
space-6   | 24px      | p-6 / gap-6         | Major section separation (maximum allowed)
space-8   | 32px      | p-8 / gap-8         | Page-level gutter on ultra-wide viewports
```

*Note: Spacing values exceeding 32px (`space-8`) are prohibited in administrative screens to eliminate wasted scroll overhead.*

### Administrative Density Principles:
- **Avoid Unnecessary Vertical Whitespace:** Optimize padding, line heights, and margins to keep actionable data prominent.
- **Prioritize Above-the-Fold Information:** Critical status, primary actions, and immediate queues should be visible without requiring immediate scrolling.
- **Eliminate Decorative Scroll Overhead:** Avoid excessive vertical scrolling caused by marketing cards, huge hero banners, or unneeded padding.
- **NO Universal Viewport-Height Cap:** While the Executive Overview Dashboard achieves a compact 1.0x desktop viewport fit, this is **not** a universal mandate for all AZM.AIO pages. Data-heavy operational pages (e.g., Students, Fees, Documents, Exams, Reports, Ledgers) legitimately require vertical scrolling. Never compress controls, tables, typography, or accessibility merely to hit an arbitrary viewport-height target.

---

## 5. Typography Scale & Hierarchy

- **UI & Body Font:** `Inter`, system-ui, -apple-system, sans-serif
- **Headings & Display:** `Montserrat`, `Plus Jakarta Sans`, sans-serif
- **Urdu Script Support:** `Noto Nastaliq Urdu`, serif (line-height: 2.2)
- **Financial & Data Figures:** `Inter` with CSS `font-variant-numeric: tabular-nums` (Tailwind `.tabular-nums`)

```
Role                  | Size (rem / px)             | Weight      | Line Height | Tailwind Class
----------------------|-----------------------------|-------------|-------------|------------------------------------------------
Page Title            | 1.125rem / 18px             | Bold (700)  | 1.25        | text-base sm:text-lg font-bold text-slate-900
Section Heading       | 0.875rem / 14px             | Bold (700)  | 1.3         | text-sm font-bold text-slate-900
Table Header / Meta   | 0.6875rem / 11px            | Bold (700)  | 1.2         | text-[11px] font-bold text-slate-500 uppercase tracking-wider
Operational Body      | 0.8125–0.875rem / 13–14px   | Regular(400)| 1.4         | text-[13px] sm:text-sm text-slate-700 leading-normal
Operational Medium    | 0.8125–0.875rem / 13–14px   | Medium (500)| 1.4         | text-[13px] sm:text-sm font-medium text-slate-800
Compact Body          | 0.75rem / 12px              | Regular(400)| 1.4         | text-xs text-slate-700
Low-Priority Meta     | 0.6875rem / 11px            | Regular(400)| 1.35        | text-[11px] text-slate-500
Muted Subtitle        | 0.75rem / 12px              | Regular(400)| 1.35        | text-xs text-slate-500
Metric Primary Value  | 1.5rem / 24px               | Bold (700)  | 1.1         | text-xl sm:text-2xl font-bold text-slate-900 tabular-nums
Financial Number      | 1.125rem / 18px             | Bold (700)  | 1.2         | text-lg font-bold text-slate-900 tabular-nums
```

### Small-Text (11px) Governance:
- **Strictly Limited Scope:** 11px text (`text-[11px]`) is restricted to low-priority metadata (timestamps, subtle column headers, secondary captions) where contrast and legibility remain sufficient.
- **Prohibited for Core Content:** `text-[11px]` is **prohibited** as the default for table body content, form labels, important status text, primary controls, or critical row actions.
- **Readability Priority:** For operational content, favor approximately 13–14px (`text-xs sm:text-[13px]` or `text-sm`) where appropriate. Compact administrative density must never come at the expense of readability, scan speed, or accessibility.

### Monospace & Tabular Figure Guidance:
- **Recommendation over Mandate:** Monospace styling (`font-mono`) is recommended rather than strictly required.
- **Recommended Usage:** Use tabular (`.tabular-nums`) or monospace treatment when it improves vertical scanning and column alignment, especially for:
  - Candidate numbers
  - Roll numbers
  - Transaction and challan references
  - Machine-generated tokens or identifiers
- **Prohibited Overuse:** Do not force monospace styling where it reduces legibility in student names, addresses, descriptions, or mixed-content columns.

### Contrast & Muted Text Rules:
- Primary text: `text-slate-900` (#0f172a) on white canvas (Contrast > 14:1).
- Secondary text: `text-slate-700` (#334155) on white canvas (Contrast > 9:1).
- Muted metadata: `text-slate-500` (#64748b) on white canvas (Contrast 4.6:1, strictly passes WCAG AA 4.5:1).
- *Strictly Prohibited:* `text-slate-300` or `text-slate-400` for informational text (fails contrast requirements).

---

## 6. Color Architecture & Semantic Discipline

### Primary Palette:
- **AZM Primary Blue:** `#185b9d` (`bg-[#185b9d]`, `text-[#185b9d]`)
- **AZM Primary Hover:** `#13497d` (`hover:bg-[#13497d]`)
- **AZM Dark Brand:** `#0f3863`
- **AZM Subtle Surface Accent:** `#f0f5fa` (`bg-[#f0f5fa]`, border `#d0e1f0`)

### Neutral Canvas & Surfaces:
- **Application Canvas:** `#f8fafc` (`bg-slate-50`)
- **Surface / Container Background:** `#ffffff` (`bg-white`)
- **Secondary Surface:** `#f1f5f9` (`bg-slate-100`)
- **Subtle Surface / Table Hover:** `#f8fafc` (`hover:bg-slate-50/80`)

### Semantic Color Discipline:
*Semantic colors are strictly reserved for actual state communication; never used decoratively.*
- **Positive / Approved / Paid / Present:**
  - Background: `#ecfdf5` (`bg-emerald-50`)
  - Border: `#a7f3d0` (`border-emerald-200`)
  - Text: `#065f46` (`text-emerald-800`)
  - Solid: `#059669` (`bg-emerald-600`)
- **Warning / Pending / Partial / Late:**
  - Background: `#fffbeb` (`bg-amber-50`)
  - Border: `#fde68a` (`border-amber-200`)
  - Text: `#92400e` (`text-amber-800`)
  - Solid: `#d97706` (`bg-amber-600`)
- **Destructive / Error / Overdue / Absent / Expelled:**
  - Background: `#fef2f2` (`bg-rose-50`)
  - Border: `#fecdd3` (`border-rose-200`)
  - Text: `#9f1239` (`text-rose-800`)
  - Solid: `#e11d48` (`bg-rose-600`)
- **Informational / Neutral State:**
  - Background: `#f1f5f9` (`bg-slate-100`)
  - Border: `#cbd5e1` (`border-slate-300`)
  - Text: `#334155` (`text-slate-700`)

---

## 7. Borders, Radii & Elevation

### Borders:
- Standard container boundary: `border border-slate-200/90` (1px solid).
- Hairline divider: `divide-y divide-slate-100`, `divide-x divide-slate-100`, or `border-b border-slate-100`.
- Active focus state: `focus-visible:ring-2 focus-visible:ring-[#185b9d]/30 focus-visible:outline-none`.

### Border Radii:
- **Containers / Panels / Surfaces:** `rounded-lg` (8px) or `rounded-xl` (10px–12px max).
- **Buttons & Form Inputs:** `rounded-md` (6px) or `rounded-lg` (8px).
- **Status Badges / Chips:** `rounded-md` (6px) or restrained pill `rounded-full` (only where specified).
- *Strictly Prohibited:* `rounded-2xl` (16px), `rounded-3xl` (24px), or circular card containers.

### Shadows & Elevation:
- Default state: Crisp flat borders (`border border-slate-200/90`) with `shadow-2xs` (`0 1px 2px 0 rgba(0, 0, 0, 0.03)`).
- Hover state on interactive cells: `hover:bg-slate-50/60 transition-colors` (avoiding floating jumps).
- Popover modals / Dropdowns: `shadow-lg border border-slate-200/90` (elevation communicates hierarchy).

---

## 8. Form Controls & Inputs

- **Height:** 36px (compact operational height, `h-9`).
- **Padding:** `px-3 py-1.5 text-xs sm:text-sm`.
- **Background:** White (`bg-white`).
- **Border:** `border border-slate-300 focus:border-[#185b9d]`.
- **Focus Ring:** Instant visible `focus:outline-none focus:ring-1 focus:ring-[#185b9d]`.
- **Labels:** Clear 12–13px bold or medium (`text-xs font-semibold text-slate-700 mb-1 block`). Avoid sub-12px text for required input labels.

---

## 9. Buttons & Action Hierarchy

Every screen or view must have **at most one visually dominant primary action**.

1. **Primary Action:**
   - Visual: Solid AZM Blue `bg-[#185b9d] hover:bg-[#13497d] text-white font-semibold text-xs sm:text-sm rounded-lg px-3.5 py-1.5 sm:py-2 shadow-2xs transition`.
   - Usage: Primary submission, save, or main task completion.
2. **Secondary Action:**
   - Visual: Crisp border `bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg px-3.5 py-1.5 sm:py-2 transition`.
   - Usage: Filtering, export, secondary navigation, cancel.
3. **Tertiary / Ghost Action:**
   - Visual: Text only `text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline transition` or `text-[#185b9d] hover:underline`.
   - Usage: Table row actions, inline links, dismissals.
4. **Destructive Action:**
   - Visual: Solid rose `bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm rounded-lg px-3.5 py-1.5 sm:py-2 transition`.
   - Usage: Account expulsion, fee voiding, record deletion.
5. **Compact Table Row Action Scope:**
   - Ultra-compact actions (`py-0.5 px-2 text-[11px]`) are **not** a universal action-button specification.
   - Use them only for truly compact tertiary table row actions where the click/touch target remains comfortably accessible and does not impede touch interaction.
6. **Accessible Focus Requirement:**
   - All interactive buttons must have visible keyboard focus: `focus-visible:ring-2 focus-visible:ring-[#185b9d]/30 focus-visible:outline-none`.

---

## 10. Summary Metrics Architecture (The Unified Summary Surface Pattern)

Summary metrics must never be rendered as separate, floating rainbow cards with multi-colored pastel icon containers.

### The Approved Architecture:
```
Unified Summary Surface (bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs)
  ├── [Optional] Restrained Header / Utility Strip (e.g., Session tag, Refresh action)
  └── Metric Cells Grid (separated by hairline dividers: divide-slate-100)
        ├── Metric Cell 1 (Label → Value → Truthful Context → [Optional] Action Cue)
        ├── Metric Cell 2
        ├── Metric Cell 3
        └── ...
```

### Metric Cell Information Hierarchy:
1. **Label:** `text-xs font-medium text-slate-500 block`
2. **Value:** `text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1`
3. **Truthful Context:** `text-[11px] text-slate-500 truncate`
4. **Optional Navigation Action:** When a cell is interactive, provide an accessible `<button>` wrapper with an explicit `View →` cue that transitions to brand `#185b9d` on hover. Decorative floating chevrons that imply navigation on non-interactive cells are prohibited.

### Scoped Mobile Summary Reflow:
- **When a page contains a multi-metric summary surface, prefer a compact 2-column mobile reflow when it preserves readability.**
- If an odd final metric exists, it may span both columns where appropriate.
- **Pages without summary metrics must not be forced into this structure.**

### Decorative Restraint:
- Small decorative icon containers in KPI cards are **prohibited** unless they provide unambiguous functional value.
- Summary metrics are **not mandatory** on every page; they are employed only when a domain module requires high-level aggregated operational status.

---

## 11. Tables & Operational Data Areas (First-Class UI)

Tables are the backbone of educational and financial administration. They must never be converted into floating card piles.

### Table Specifications (Density: 8 / 10):
- **Header Row:**
  - Height: ~36px (`py-2 px-3`).
  - Style: `bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider`.
  - Alignment: Text left-aligned; numerical/currency right-aligned (`tabular-nums`); status/actions center or right-aligned.
- **Body Rows:**
  - Height: 36px–44px (`py-2 px-3`).
  - Style: `border-b border-slate-100 hover:bg-slate-50/70 text-xs sm:text-[13px] text-slate-700 font-normal`.
  - Figures: `.tabular-nums` for numbers, fees, percentages, and dates. Monospace (`font-mono`) is recommended for machine identifiers and roll numbers where it enhances vertical scanning.
- **Pagination Footer:**
  - Height: ~40px (`px-4 py-2 bg-slate-50/40 border-t border-slate-200`).
  - Clear count: *"Showing 1 to 50 of 1,420 records"*.
  - Compact Previous / Next navigation controls with disabled state opacity.

---

## 12. State Communication, Feedback & Permanent Data Integrity Principles

### Permanent Data Integrity Principles:
Administrative users make high-stakes educational and financial decisions based on AZM.AIO. Data representation must be strictly truthful:

```
NO DATA != 0
NO DATA != SUCCESS
NO DATA != FAILURE
```

1. **The Denominator Principle:**
   - A percentage must **never** be displayed when its denominator is zero.
   - If billed fees = 0 and collected fees = 0, collection rate must be rendered as `—` (with context *"No fees billed this cycle"*), **never** `0%`.
2. **Attendance Session Integrity:**
   - Missing session data must never be presented as 0% attendance.
   - If no attendance session was conducted for a given date, display `"No Session"` with a dashed neutral indicator, never a red or zero-height bar.
3. **No Fabricated Explanatory Success Text:**
   - Never claim *"All accreditations cleared"* or *"All issued fee challans are cleared"* simply because a query returned 0 rows.
   - Empty states must state only what the underlying query/data genuinely proves (e.g., *"No overdue fee accounts"*, *"No partner institutions"*).
4. **Zero Simulated Activity:**
   - Never generate synthetic system-health or status messages merely to make an activity feed look populated. An empty feed is vastly preferable to simulated records.

### Approved Empty State Pattern:
- Centered container with small neutral Lucide outline icon (`w-5 h-5 text-slate-300 mx-auto`).
- Concise, truthful title (`text-xs font-medium text-slate-600`).
- Optional explanation only when verified by real business logic.
- Zero celebratory claims unless proven.
- Zero oversized marketing illustrations or animations.

### Loading & Error States:
- **Loading:** Compact inline spinner (`Loader2` with `animate-spin text-[#185b9d] w-4 h-4`) or hairline skeleton placeholder. Page shell must remain mounted during background refreshes.
- **Error:** High-visibility banner or centered alert with specific system message and prominent *"Retry Connection"* button.

---

## 13. Accessibility & Motion Rules (WCAG 2.1 AA)

### Accessibility:
- Every interactive icon-only button must possess an `aria-label` or `title` attribute.
- Color alone must never convey information; always pair color with text, icon, or badge indicator.
- Contrast ratio between text and background must meet or exceed 4.5:1.

### Motion (2 / 10):
- Fast, functional transitions strictly bounded to $\le 150\text{ms}$ (`duration-150 ease-out`).
- Allowed transitions: Opacity on modal mount, color change on button hover, border change on input focus.
- Strictly prohibited: Parallax scrolling, floating slow keyframes, decorative particle loops, spring physics.

---

## 14. Responsive Layout Architecture

- **Desktop Primary (`1440x900`):**
  - Dense multi-column administrative layout.
  - Prioritize meaningful operational information and primary actions above the fold.
  - **No Universal 1.0x Height Constraint:** While the Executive Overview Dashboard achieves a compact 1.0x desktop viewport fit, data-heavy operational pages (Students, Fees, Documents, Exams, Reports, Ledgers) legitimately require vertical scrolling. Never compress controls, tables, typography, or accessibility merely to hit an arbitrary viewport-height target.
- **Tablet Portrait (`768x1024`):**
  - Deliberate reflow into 2-column grids or clean stacked sections; no isolated orphan cards.
  - Table areas maintain readability without column crushing.
- **Mobile Standard (`375–390px`):**
  - Prioritize operational task order; reduce vertical spacing (`p-2.5` to `p-3.5`).
  - When a multi-metric summary surface exists, reflow into a compact 2-column grid (with odd final metric spanning both columns if appropriate).
  - Tables use bounded horizontal scroll wrappers (`overflow-x-auto`) to prevent viewport blowout.
  - **Never hide essential information behind horizontal scrolling simply to preserve a desktop layout.** Core metrics must be immediately discoverable without horizontal gestures.

---

## 15. Permanent Implementation Cautions

### Caution A: Navigation Destination Truthfulness
Action labels and navigation cues must accurately describe the actual destination.
- *Rule:* Do not label a navigation link as *"View Audit Log"* if it navigates to a general financial transactions ledger, unless the target page genuinely implements a dedicated, filtered system audit log.
- *Requirement:* When new modules are connected, verify that the link text matches the actual scope of the target view.

### Caution B: Calendar Labeling vs. Business State Provenance
Calendar date labels (e.g. `Mon 21`, `Tue 22`) may be generated from the calendar period for presentation, but operational business states must originate exclusively from verified application data.
- *Rule:* Attendance session existence, payment clearance, or registration status must never be inferred or synthesized solely to complete a chart or visual widget.
- *Requirement:* If database records for a past date do not exist, the visual representation must honestly communicate `"No Session"` or `"No Record"`.

---

## 16. Summary of Anti-AI UI Invariants

```
PROHIBITED PATTERN                       | MANDATED AZM.AIO PATTERN
-----------------------------------------|---------------------------------------------------------
Rounded cards everywhere (16-24px)       | Restrained 8-12px radii; structural divider lines
Card-inside-card nesting                 | Flat section hierarchy with tabular/grid alignment
Decorative multi-stop gradients          | Clean solid backgrounds (#ffffff, #f8fafc)
Rainbow pastel KPI icon boxes            | Unified summary surface with hairline dividers
Excessive pills and badges               | Badges reserved exclusively for actual scan-worthy state
Giant marketing headings                 | Compact operational typography (14-18px)
Fake metrics / simulated status          | Strict binding to real backend data contracts
NO DATA presented as 0% or cleared       | Honest no-data indicators ("—", "No Session", etc.)
Arbitrary 1.0x height compression        | Legitimate vertical scrolling for data-heavy pages
Sub-12px text on operational body/inputs | 13-14px operational body; 11px limited to meta
Floating cards replacing tables          | High-density, sortable, accessible data tables
Decorative animations & slow transitions | Instant-feeling functional transitions (<= 150ms)
```

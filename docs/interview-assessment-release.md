# Session V interview marks and private merit preview

## Final written marks

The existing Student-list marks labelled **Manually verified · Final** or verified
OMR are the final result of the conducted written examination. Interview
eligibility and assessment calculations reuse the same mark readers, current
correction values and verification seals as that list. This release does not
require those marks to be copied into `ExaminationResult`, published again or
approved through a new Gazette action.

A final mark of 60–100 qualifies for interview. A final mark below 60 remains a
final examination result but does not qualify. Missing or unverified sources
remain pending. A conflicting or withheld source is explicitly held for review;
an unverified primary source is not replaced by another register to bypass its
status. Legacy official-only campaign allocation retains its existing controls.

The source fingerprint includes correction and verification identity. Assessment
history captures the source it used. If that source changes after submission,
the private merit preview excludes the assessment until an authorized correction
records the reviewed source. This is an assessment-source reconciliation, not a
second verification requirement for an already-final written result.

## Staff workflow

Open **Interview management → Marks & assessments** for the Session V round.

1. Record three distinct assessor names for each existing panel.
2. Find a candidate by panel, batch, class, name or roll number.
3. Record interview attendance, each member's interview score out of 20 and
   discipline/confidence/personality score out of 5.
4. Record extracurricular activities out of 10 and previous academics out of 5,
   with a document or assessment-sheet reference and a review acknowledgement.
5. Save a draft, save and open the next candidate, or submit the complete record.
6. Use **Merit preview** to review overall or separate class ranks and incomplete
   or changed records.

Admin and Super Admin can enter initial assessments. Any correction after a
submission requires a Super Admin and a reason, including a later draft of that
correction. Every save is a new revision. Replacing a panel after submission also
requires a Super Admin; historical scores retain their original member names.
Current members must receive new scores before affected records can rank again.

The imported timetable supplies the roster and stable placement identity. Its
panel, batch, time, printed mark and sequence remain immutable. A `FINALIZED`
allocation round can accept assessments: allocation status and assessment
submission are separate stages.

## Calculation

For a candidate present with all required fields and a final qualifying written
result:

```text
Written contribution = final written mark × 0.60
Interview contribution = (member 1 + member 2 + member 3 interview marks) / 3
Personality contribution = (member 1 + member 2 + member 3 personality marks) / 3

Total /100 = written /60 + interview /20 + extracurricular /10
             + previous academics /5 + personality /5
```

Example: written 80; interview 16, 17, 18; activities 8; academics 4.25;
personality 4, 4.5, 5 gives **81.75 /100**.

The backend uses decimal arithmetic and a common-denominator value for ranking,
so displaying two decimal places does not create false ties. An explicit zero is
a score; a blank is missing. All three scorecards are required for a present
candidate. Absentees and drafts are unranked.

The preview supports one overall ranking across all classes and independent
rankings within each class. Both use the exact server-calculated scores. Exact
ties share competition ranks (1, 1, 3). This is a private provisional ordering,
not an approved final tie policy or an award allocation. PDF and CSV exports
carry the same provisional label.

## Merit grouping, PDFs and sort order

In **Merit preview**, choose **Merit grouping**:

- **All classes together** (the default) gives every ready candidate one overall
  rank across the entire round, irrespective of class. Sorting applies across
  the full filtered list.
- **Separate by class** groups candidates by class, displays the existing class
  ranks and applies sorting within each class.

**Class filter** controls which candidates are visible. It does not change the
ranking population: selecting one class in the overall view retains each
candidate's rank among all ready candidates in the round. Readiness and
name/roll filters likewise preserve the original ranks and any gaps.

Use **Sort by** and **Order** to arrange candidates in ascending or descending
order. Available fields are merit rank, total marks, final written marks,
student name and roll number. The default is **Total marks → Descending**.
Missing values stay at the bottom in both directions, within their class when
separate grouping is selected.

Sorting and filtering never renumber candidates. Total sorting compares numeric
totals and uses the selected server rank to preserve exact-score distinctions
when displayed totals round to the same two-decimal value. True ties retain
stable order. Class ranks are never used as substitutes for overall ranks.

**Download PDF** produces an AZM-branded landscape A4 merit report with the logo,
round/session, selected grouping, filters, sort order, generation time in
Pakistan, score components, readiness, selected overall or class ranks,
repeated table headings and page numbers. **Export CSV** uses the same filtered
order and includes the grouping and corresponding rank heading. Filenames
identify the grouping. Both include every matching candidate across all pages,
rather than only the 25 currently visible rows.

These are private, provisional combined merit review copies. Existing verified
written marks retain their final status; incomplete or changed assessments do
not acquire a total or merit rank through an export. Select **Ready** to download
only candidates with complete, current submitted assessments.

The current PDF typography supports Latin names, accents and common punctuation.
Unsupported scripts raise a clear export error before generating a document;
CSV preserves Unicode text. Candidate names are never silently dropped or
replaced to force a PDF export.

PDF generation and display sorting run in the browser; both ranking scopes are
calculated on the server using exact decimal values. Deploy the backend before
the frontend for the grouping update. It needs no new database migration,
permission changes or mark updates. If an older backend is active, the frontend
shows separate class ranks, disables the combined option and explains that
combined merit is unavailable. It never invents overall ranks from row order.

## Scope of this release

This release includes admin entry of named panel-member scores, evidence
references, attendance, draft/submitted revision history, concurrent-edit
protection, retry-safe saves, completeness checks and a private merit preview.
It updates the displayed five-component weights and interview panel-size text.

Public merit publication, approved final ranking pools/tie rules, scholarship
categories or benefits, financial-need decisions, finer scoring rubrics, evidence
file uploads and individual assessor logins are separate follow-up work. Scores
are entered as the approved component totals; no unsupported subrubric or GPA
conversion is invented.

## Backend integration

All new routes are under the existing authenticated Admin/Super Admin interview
router, with private/no-store responses:

| Method | Path under `/api/interviews/:roundId/assessment` | Purpose |
| --- | --- | --- |
| GET | `/roster` | Fixed placements, filters and page-based candidate results |
| GET | `/panels` | Current panel membership revisions |
| PUT | `/panels/:panel` | Append a three-member panel revision |
| GET | `/candidates/:placementId` | Current assessment and written source |
| POST | `/candidates/:placementId/save` | Append a draft revision |
| POST | `/candidates/:placementId/submit` | Validate and append a submission |
| GET | `/candidates/:placementId/history` | Most recent 100 immutable revisions |
| GET | `/merit` | Recalculate the private overall and class-based preview |

The merit response retains `rank` and
`rankMethod: SHARED_COMPETITION_WITHIN_CLASS` for existing clients. Each row also
includes `overallRank`, with
`overallRankMethod: SHARED_COMPETITION_ALL_CLASSES` and
`overallRankedCandidates` at the response level. Both ranks are null for
unready candidates. The server assigns both ranks across the complete round
before applying an optional class filter. `overallRankedCandidates` always
counts all ranked candidates in the round; `summary` counts the returned rows.

Both score mutations require `expectedRevision`, the current `panelRevision`,
and an `idempotencyKey`. Identical retries return the saved revision; key reuse
with different data and stale concurrent edits return 409. The frontend preserves
unsaved values after such conflicts and requires an explicit reload.

## Initial assessment migration and rollout order

These steps describe the initial assessment release. The later merit-grouping
update uses the existing schema and privileges; do not repeat migrations or
grant changes solely to add overall ranks.

The additive migration
`20261121160000_interview_assessment_revisions` creates
`InterviewPanelRevision` and `InterviewAssessmentRevision`. It validates member
identity, score ranges, placement relationships and submission completeness, and
blocks UPDATE, DELETE and TRUNCATE. It does not update existing exam or timetable
records.

Before starting the updated backend in a target environment:

1. Apply the additive Prisma migration through the existing migrator workflow.
2. Provision **SELECT and INSERT only** for the application role on both new
   tables, following the existing operator-controlled grants procedure. The
   updated `backend/ops/postgres/runtime-grants.sql` contains those permissions
   and verifies the immutable triggers. Do not give the runtime ownership or
   UPDATE, DELETE, TRUNCATE or TRIGGER privileges.
3. Deploy the generated Prisma client and backend. Startup deliberately rejects
   missing tables, incorrect permissions or missing immutable triggers.
4. Deploy the frontend and verify the existing final marks and locked timetable
   in the target environment before entering interview assessments.

No production migration, grants, deployment, result publication or candidate
assessment is performed by preparing this feature branch. If a code rollback is
needed after use, retain the additive tables and historical revisions.

## Validation

The dedicated `interview-assessment-validation.yml` workflow checks the Prisma
schema and backend types, interview and existing mark/DMC regressions, the
frontend production build and view-model tests. It also runs three integration
fixtures using synthetic data only:

- A disposable PostgreSQL 17 database exercises the real service, canonical
  verified-mark source, restricted runtime privileges, correction history and
  concurrent saves.
- A Puppeteer fixture mounts the production admin views, configures the panel,
  enters scores, verifies the 81.75 example, tests missing/zero scores and conflict
  handling, and captures desktop/mobile review screenshots.
- A merit-download fixture checks both grouping choices, exact server-rank
  preservation, ascending/descending display order, pagination reset, filtered
  PDF/CSV parity, all-page exports, legacy-server fallback and mobile controls
  with synthetic candidates. PDF text is checked using Poppler and the
  generated report is rendered for visual layout review before release.

The CI run reports execution results when run. The PostgreSQL 17 and browser
checks are required before rollout. Local tests use Node's `--import tsx` entry
point; no dependency or lockfile changes are needed.

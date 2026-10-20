# HSSC capture, correction and print verification

20 October 2026. Implementation base: `8eea79f82f27a1d0de3f0b08c6bcd84bd3381109`, tree `014a525fb9dd24ca035f9f6526de863f66b28ca2`.

## Confirmed diagnosis and read-only repair dry run

The real admin React form was submitted in an isolated browser. Before the fix, selecting `1st Year` and `Pre-Engineering` produced a serialized body with no `hsscGroup` property. After the fix, both `1st Year` / `Pre-Engineering` and `2nd Year` / `ICS` reach the real API, PostgreSQL row and reloaded detail response with the selected group.

Public retained forms had hidden/default or free-text groups. The server accepted unrestricted nullable strings. The frontend and PDF resolvers accepted only canonical group spellings. Existing list/detail/public-slip code already carries the stored `hsscGroup`; no API omission is claimed, and no academic-record group fallback was introduced.

Production inspection used existing trusted SSH and bounded `BEGIN READ ONLY` PostgreSQL SELECTs with a 5s statement timeout and 500ms lock timeout. The transaction was rolled back. No prepare-print, PDF, number-reservation or data-write endpoint was called against production.

| Application reference | Current raw class | Raw saved group | Live compiled renderer | Proposed resolution |
| --- | --- | --- | --- | --- |
| APP-2026-0015 | Class 12th (HSSC-II) | Science (Biology/Pre-Medical) | Not specified | Unverified default; staff evidence required |
| APP-2026-0016 | Class 12th (HSSC-II) | Science (Biology/Pre-Medical) | Not specified | Unverified default; staff evidence required |
| APP-2026-0044 | Class 12th (HSSC-II) | Science (computer science) | Not specified | Exact observed HSSC equivalent of ICS |

Population at the read-only snapshot: **332 HSSC students**. The shared resolver classifies 243 canonical values, 34 exact aliases, 22 missing values, 30 known unverified defaults, 3 unsupported values and 0 conflicting values. Thus 277 would be print-ready under this contract; **55 require explicit staff verification**. The unsupported values are `Biology`, `Fsc`, and ` (Biology/Pre-Medical)`. Generic science, BS departments and previous results are not evidence of a current group.

**Historical records updated automatically: 0.** The 34 aliases are a proposed read/display normalization; their stored raw values were not rewritten. No bulk repair was applied or scheduled. Any later repair requires an individually reviewed target, old value/version, canonical new choice, documentary/staff basis and concurrency guard. Never turn the 30 default-derived values into verified Pre-Medical automatically.

The live service was active at `/opt/azmaio/releases/cadcfce3/backend` as `azm-api`. Its artifact source is `cadcfce313d48dd136101a2548113db4664b49aa`, tree `014a525fb9dd24ca035f9f6526de863f66b28ca2`. The public frontend marker was `8eea79f82f27a1d0de3f0b08c6bcd84bd3381109`; public API health reported the database connected. The live compiled PDF resolver was evaluated against the three already-read class/group values without generating papers.

**Live authenticated detail-API comparison remains pending a normal existing staff session.** Approval review rejected a proposed probe that would mint a token from the service signing secret; that action did not execute and was not retried. Database-only reads and a credential-free pure renderer probe were used instead. Actual HTTP detail propagation is verified on the isolated synthetic backend, not claimed for those live requests.

## Resulting behavior

- One dependency-free HSSC contract is compiled inside the backend and re-exported to the frontend. It recognizes supported year aliases and case/space/dash variants; contradictory labels are rejected. Existing stored class values and placement/filter rules are retained.
- All three create routes and the service boundary require a valid HSSC group, normalize only exact reviewed equivalents, and return field errors. Both retained public forms start with an empty required selector. Public registration remains disabled.
- Unrelated PATCHes preserve groups and allow contact corrections on unresolved legacy records. A changed group requires an admin actor, the loaded version and a confirmation/source. A conditional, monotonically versioned update and append-only audit insert share one transaction; stale and concurrent corrections conflict.
- Details/editing expose the saved group and a role-restricted correction action. The review filter covers all matching records before pagination; its compact queue allows an explicit choice per student. Filtered roster export respects the review filter too.
- Single previews use read-only detail GETs. Final single/prepare/direct/bulk server paths reject unresolved HSSC records. Bulk preflight checks every exact selected ID before avoidable reservations. The ready subset requires explicit UI selection with visible exclusions; output order follows the selected IDs. Rendering rechecks the source records after portrait resolution.
- The OMR header displays the standard year and readable group in two compact lines. Invisible layout measurement preserves the prior table dimensions, so the optical grid does not move; measurement text is neither painted into the PDF nor exposed to assistive technology. Longest labels remain readable and do not overlap adjacent rows.

The additive `StudentStudyGroupCorrection` migration changes no Student values. It records actor, timestamp, old/new class and group, basis and prior version. A restrictive Student relation preserves evidence; a statement trigger rejects UPDATE, DELETE and TRUNCATE. PUBLIC has no table rights, RLS is enabled, and the existing `azm_app_dml` group receives SELECT/INSERT and its private policy when present. No attendance audit tables are used.

## Verification executed

Use existing dependencies. On Windows, set `PUPPETEER_EXECUTABLE_PATH` to the installed Chrome binary for browser tests. Database integration starts a unique disposable local PostgreSQL cluster via the existing test harness and stops it afterward; it never uses a configured production database.

| Check | Result |
| --- | --- |
| `backend/tests/hssc-capture.test.ts` | PASS: real browser serialization for both admin year choices; integrated into the database test |
| `backend/tests/hssc-flow.test.ts` | PASS: 9 integration groups covering browser/API/row/reload, all create adapters, public document verification, PATCH semantics, correction audit, concurrent/stale/unauthorized writes, exact-ID preflight, review pagination, actual PDFs and final database recheck |
| `backend/tests/hssc-group-printing.test.ts` | PASS: 150 year/group render combinations; aliases, hidden defaults, contradictory labels and non-HSSC controls |
| `backend/tests/hssc-group-preview.test.ts` | PASS: 18 public/roll/OMR desktop/mobile scenarios, saved/missing/non-HSSC states and no page overflow |
| `backend/tests/hssc-correction-ui.test.ts` | PASS: retained selectors start empty; registration stays closed; correction error retains selection, save/refetch/reload updates preview, unauthorized action absent, desktop/mobile ready-subset request contains exactly the chosen IDs |
| `backend/tests/hssc-pdf-geometry.test.ts` | PASS: six groups compared to base source; 100 question rows, 400 bubbles, timing/version marks and portrait/QR rectangles match within 0.1px, including longest labels |
| Existing roll-slip layout and admin-registration regressions | PASS: four desktop/mobile/long-details scenarios, eight one-page PDF checks; public document requirements and staff registration flexibility retained |
| Actual PDF extraction/rendering | PASS: A4, one page per single, two pages in explicit subset order, resolved group text, no unresolved/measurement text, visible header/photo fixture/QR and no overlap; both bulk QR codes decode to the exact manifest candidate/application pairing |
| Frontend `npm run build` | PASS |
| Backend `npm run build` | PASS, including existing browser provisioning and TypeScript build |
| Prisma validation | PASS with synthetic localhost connection variables; no production migration applied |
| `backend/tests/hssc-typecheck.cjs` | PASS: application sources have 71 baseline and 71 current diagnostics, zero added |
| Repository-wide `npm run lint` / `tsc --noEmit` | Existing failure: includes unrelated backend test errors and temporary historical snapshots; not represented as passing |
| `git diff --check` | PASS |

GitHub's initial restricted-login job passed backend typing and the session-control checks, then stopped because the older roll-slip layout fixture omitted its HSSC group while waiting for final printing to become enabled. The fixture now supplies explicit `Pre-Engineering`; unresolved-group behavior remains covered by the HSSC preview/readiness regressions.

Temporary logs, sanitized aggregate inventory, screenshots, PDF files and synthetic candidate manifests are under `tmp/hssc-flow-20261020/`; they are not production student exports and are not part of the application release.

## Release plan and limits

This change is **implemented and locally validated, not staged or deployed**. The migration is source-only at this point.

1. Review this branch and the exact alias table. Obtain ordinary authenticated live detail-API evidence for the three supplied references through a normal staff session.
2. Rehearse the additive migration and correction transaction against a disposable restored staging database, including the existing runtime role's SELECT/INSERT policy and denied audit mutation rights. No permission widening or attendance lifecycle work is part of this change.
3. Obtain separate release authorization. Stage the matching backend/frontend artifacts through the established release procedure, preserve existing service/runtime/storage settings, take the required recovery checkpoint, apply only the reviewed additive migration with the approved migrator identity, and verify grants before activating the backend. Publish the matching frontend afterward. Merging main triggers the existing frontend deployment workflow, so do not merge ahead of backend/schema readiness.
4. Verify served/running versions, ordinary authorized detail/readiness access, unauthorized denials and synthetic single/bulk PDFs. Keep public registration closed.
5. Staff review the 55 unresolved records using documentary evidence or explicit authorized confirmation. Do not run a guessed bulk rewrite. Recheck readiness after each saved correction.

No deployment, production migration, bulk correction, session reset, attendance change, placement move, score edit, document deletion, freeze-control change, auth architecture change or dependency/lockfile edit was performed.

## Exact changed files

- backend/prisma/schema.prisma
- backend/prisma/migrations/20261020120000_hssc_group_correction_audit/migration.sql
- backend/src/modules/documents/pdf.service.ts
- backend/src/modules/students/students.controller.ts
- backend/src/modules/students/students.routes.ts
- backend/src/modules/students/students.schema.ts
- backend/src/modules/students/students.service.ts
- backend/src/modules/students/hsscContract.ts
- backend/tests/hssc-group-preview.test.ts
- backend/tests/hssc-group-printing.test.ts
- backend/tests/roll-slip-print-layout.test.ts
- backend/tests/hssc-capture.test.ts
- backend/tests/hssc-flow.test.ts
- backend/tests/hssc-correction-ui.test.ts
- backend/tests/hssc-pdf-geometry.test.ts
- backend/tests/hssc-typecheck.cjs
- backend/tests/HSSC_STUDY_GROUP_QA.md
- src/components/admin/students/AdminWalkInModal.tsx
- src/components/admin/students/BulkPrintModal.tsx
- src/components/admin/students/RollSlipPreviewModal.tsx
- src/components/admin/students/StudentDetailView.tsx
- src/components/admin/students/StudentOmrModal.tsx
- src/components/admin/students/StudentsListView.tsx
- src/components/admin/students/StudyGroupCorrectionDialog.tsx
- src/components/apply/ApplicationPortal.tsx
- src/components/public/register/PublicCandidateRegistrationWizard.tsx
- src/components/rollnumber/RollNumberSlipView.tsx
- src/lib/mockApi.ts
- src/services/api.ts
- src/utils/hsscGroup.ts

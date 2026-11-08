# Smart OMR implementation ledger

Base: GitHub main 1e7f15181dd6cc6e2b2143b141824e5b12b700c7, fetched over HTTPS on 2026-11-06.
Branch: codex/smart-omr-evaluation-mobile. This branch must not be merged or deployed without separate authorization.

## Inspection

- Current application: React 19/Vite, Express, Prisma/PostgreSQL, staff JWT roles.
- The existing main push workflow publishes frontend artifacts to deploy. Feature development therefore stays off main.
- Current printable geometry comes from PdfService.generateOmrSheetHtml. The supplied private reference is a single A4 Template 2.0 page with 100 four-option rows, four corner squares, timing tracks, identity QR and four version circles.
- Student OMR QR uses AZM_OMR, session 2026-V, sheetVersion 2, identity fields and OFFICIAL/PROVISIONAL roll type. Legacy payloads are untrusted and must be reconciled against existing student/placement records.
- Existing results search exposes non-null testScore without a dedicated publication record; results service also synthesizes ranks, percentile, subjects and interview information. New results must use explicit publication records, real mappings and verified ranks. Historical scores must not be migrated by assumption.
- Attendance lifecycle, financial evidence, existing student documents, existing printed sheets and production runtime grants remain protected.

## Architecture

Recognition runs in a separate CPU-only Python/OpenCV process with bounded input, one processing slot, execution timeout, private temporary files and no database credentials. Express handles authentication, private upload storage, durable job claims and result transactions. The worker returns observations only; it cannot assign an official result or publish a score. Existing Node request handlers must not perform image processing.

Initial worker outputs carry SYNTHETIC_ONLY calibration and officialScoringAllowed=false. Future production enablement requires physical camera validation, approved answer keys and explicit release approval. Confidence measurements are not presented as calibrated probabilities.

Only numeric bubble geometry is extracted from the reference. Candidate information and the original reference PDF are not committed. Synthetic images use fabricated IDs and contain no real candidates.

## Ordered acceptance gates

1. Recognition: blank preprinted letters, A/B/C/D on every row, multiple and uncertain marks, rotation, perspective, blur/crop rejection. Record measured synthetic accuracy, review/rejection and performance; inspect private reference blank without exposing its QR or candidate data.
2. Additive Prisma entities, safe migration and grants; disposable PostgreSQL integrity/concurrency tests. No production migration.
3. Authenticated OMR APIs with server scoring, immutable approved keys, identity reconciliation, audit and bounded durable processing.
4. Compact web administration/review and genuine counts; publication transaction plus public result gate.
5. Capacitor Android/iOS-compatible scanning client; confidential keys never reach teacher clients. Offline capture disabled until OS-backed encryption is demonstrated.
6. Regression/build checks, release/rollback documentation, tested milestone commits and draft PR. Physical scan validation and iOS build claims require the actual equipment/tooling.

Current implementation work starts under workers/omr/** and docs/omr/**. Additional paths explicitly requested by the user are to be modified only when their milestone is reached. No production access is needed for this implementation.

## Checkpoint: scanner and database/scoring foundations

Implemented:
- workers/omr/: isolated OpenCV engine, bounded image decoding, solid-marker detection, perspective/rotation correction, printed-letter-aware annular measurements, conservative classification, version/QR detection, private annotation output, numeric-only calibration profile and synthetic tests/benchmark.
- backend/src/modules/omr/scoring.ts: deterministic fixed-point scoring with explicit approved revision, exam/group/version checks, ambiguity review and optional negative marking/floor.
- backend/prisma/schema.prisma and migrations/20261106170000_omr_evaluation/migration.sql: additive exams, assignments, keys, batches/items, scans, responses, results, correction/publication audit models; FK/unique/check constraints, RLS, evidence/key/policy triggers and restricted grants.
- backend/ops/postgres/runtime-grants.sql and backend/src/security/{dbRuntimeSafety,omrRuntimeSafety}.ts: new-table grants/policies and fail-closed startup checks.
- backend/tests/omr-{database,scoring}.test.ts: synthetic PostgreSQL permission/integrity and deterministic grading checks.

Validation actually run:
- Python recognition/classification: 23 tests passed.
- TypeScript database/grading: 13 tests passed (includes the database parent test and six child checks).
- Prisma schema validation and isolated client generation: passed.
- Backend TypeScript no-emit compilation: passed.
- Synthetic benchmark: docs/omr/synthetic-validation.json; 10 sheets, 1000 expected answers, 1000 matching classifications. No physical camera accuracy established.
- Supplied private digital blank: 100 blanks, QR decoded, registration 0.96 at high-resolution input. No identifying data included in this ledger.
- Existing hssc-runtime.test.ts --case=group-first: BLOCKED before database startup: ENOENT C:/Program Files/PostgreSQL/18/bin/initdb.exe. Native PostgreSQL baseline regression is not a pass. Embedded PostgreSQL checks cover only the new migration against synthetic identity tables, not the complete existing migration history.

The requested complete product is NOT implemented yet. Remaining: restricted PDF ingestion, glare/erasure validation, backend identity/roster matching and authenticated APIs, durable job runner/recovery, review/approval/publication transactions, public Results Desk gating and placeholder removal, compact web interfaces, Capacitor application and secure synchronization, complete native-PostgreSQL/concurrency/regression and mobile/browser validation, release/rollback runbook and draft PR.

Do not deploy this checkpoint. The native database regression prerequisite must be resolved and all remaining application work validated. No production service, database, marks, attendance, credentials or deployment was touched.

## Continuation: working synthetic web/mobile application (2026-11-08)

The prior checkpoint was retained on the same feature branch and independently rechecked before continuation. The implementation now includes authenticated examination/key/operator APIs; durable batch/page queue and leases; private uploads/evidence; server identity reconciliation and grading; audited review, verification, replacement, withdrawal and publication; explicit historical release review; a public Results Desk publication gate; ten web work areas; shared camera/upload/review components; and generated Capacitor Android/iOS projects with memory-only mobile sessions.

Source groups:
- `backend/src/modules/omr/`: access, validation, identity/signatures, service, private storage, bounded Python runner, durable queue, separate worker, activation gate and historical review.
- `backend/src/modules/results/results.service.ts`: dedicated published results/historical snapshots, exact identifiers, actual marks/maxima, no invented ranks, percentiles, subjects or interview invitations.
- `backend/prisma/`: additive worker-lease and historical-release migrations; feature migrations are explicitly transactional. Runtime grants/guards include the new append-only historical audit.
- `src/components/admin/omr/` and `src/features/omr/`: examination/key administration, uploads, queue/progress/report, 100-row evidence review, correction history, results and release controls, historical review, responsive shared capture.
- `apps/omr-mobile/`: staff login, examination selection, online camera/file capture, preview/retake, processing and review notifications/history, settings/logout; native Android/iOS sources. No persistent token or offline image cache.
- `tools/omr-dev/`: real API over a restricted, disposable PostgreSQL 18.6/WASM database, all 22 migrations, synthetic fixtures, full API/browser/recovery tests. This is not native PostgreSQL 17 concurrency proof.
- `.github/workflows/smart-omr.yml`: disposable PostgreSQL 17/full-history checks and a development Android APK job; no deploy step. Its remote results must be observed before being described as passed.

A real generated synthetic sheet exposed header wrapping displacement missed by the earlier minimal fixtures. Registration now validates physical timing tracks, locates printed column headers and refines grid/version offsets while retaining question numbering. Damaged outlines/glare-like loss become UNCERTAIN. The genuine private digital blank was rechecked without exposing its identity: 100/100 blank, registration 1.0. No physical-camera accuracy has been established.

Current local validation is recorded in `docs/omr/validation-report.md`, not inferred from the prior checkpoint. `docs/omr/release-runbook.md` defines release, historical review and rollback gates; `tools/omr-dev/README.md` documents the working synthetic environment. Do not treat browser fake-camera tests, synthetic accuracy or generated native sources as production/device approval.

Private application testing now uses the supplied photographs through the web Bulk Upload -> API -> durable queue -> recognition -> review history path. The measured result is 24 rejected scans, zero answers and zero results. Camera/layout compatibility remains a blocker. A local-only runner and confidential PDF-to-CSV helper retain evidence/keys under ignored `tmp/omr-reference/`; no private sample data enters GitHub/CI. Gray-corner detection preserves timing/grid validation, and rejected scans expose original evidence plus useful failure guidance. Hosted PostgreSQL 17 and Android builds passed at review commit `80103e1`; later changes require another hosted check.

The latest runtime milestone `d134a27` (identical review tree at `10c6be9`) passed hosted Smart OMR run `42469745679`, including the actual sandboxed two-page PDF path, 32 scanner/3 key-parser/43 feature tests, native PostgreSQL 17 checks, 5 API/recovery checks, 16 historical migration/recovery/restore checks and a fresh Android APK. See the validation report for verified artifact hashes. Official release remains locked because the supplied physical-photo set still fails alignment/layout validation; neither synthetic accuracy nor the APK build resolves that failure.

## Physical-layout milestone

The separate provisional `AZM_FRAMED_100_LEGACY_V1` profile now maps 100 positions on 17/24 original photographs through the actual application (12/18 calibration, 5/6 held-out after freezing). Seven remain rejected; every mapped sheet requires review. The original timing-track profile and its damaged-track rejection remain intact. No genuine student or official mark was changed. Exact root causes, contracts, dataset separation, uncertainty/QR limitations, private review workflow and before/after evidence are in `docs/omr/physical-validation.md` and its sanitized summary JSON. Independent human answer accuracy remains unknown.

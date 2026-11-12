# Smart OMR validation report — 2026-11-08

See [2026-11-10 reliability milestone](reliability-milestone.md) for the latest implementation, QR investigation, independent-label workflow, physical replay and current Android build evidence. The entries below retain historical checkpoint results.

Branch: `codex/smart-omr-evaluation-mobile`. Initial retained checkpoint: `a79e8449`. No production database, service, student/financial/attendance record or real marks were changed. This report separates observed results from unavailable release checks.

| Check actually run | Result |
|---|---|
| Python recognition/classification/PDF contracts | 37 passed (original 23 retained; five framed-layout tests add full background/frame, 24/26-row rejection, missing corner/column and damaged current timing-track contracts) |
| Private key parser / human-label helper tests | 5 passed (3 parser, 2 explicit human-confirmation tests); current local PDF validated as 44 unique keys × 100 answers. All 1892 cross-key pairings rejected; no official keys approved |
| Feature Node tests: database/grading, 27 authenticated routes, identity/signatures, storage, activation, public/historical release, migration recovery, mobile session/network and key import | 44 passed; includes crop/grid diagnostics, provisional layout refusal despite original-template activation, and new-profile hash tampering invalidation |
| Full real synthetic API + queue recovery | 5 passed, including parent/child recovery checks; 22 migrations applied under restricted role on PostgreSQL 18.6/WASM |
| Generated real printable sheet | 100 A responses, version A; manual identity review when printed-roll OCR is unavailable; internal score 100/100, verification separate |
| Synthetic benchmark | 10 sheets / 1000 answers, 1000 correct; 10/10 exact sheets, no rejection/review; latest local median 1.084 s, max 1.245 s; physical answer accuracy unmeasured |
| Private digital blank reference | 100 blanks; registration 1.0; identifying content excluded from committed artifacts |
| Real web/browser checks | Ten OMR screens loaded; responsive phone layout inspected; screenshots retained locally under ignored tmp/omr-dev/browser |
| Mobile browser workflow | Login, fake-camera open/close, preview, offline disabled, forced upload failure/retry, processing, all 100 review rows, history, memory-only storage and logout passed |
| Frontend production Vite build | Passed |
| Backend TypeScript production compilation | Passed |
| Mobile strict TypeScript + production Vite build | Passed |
| Prisma schema generation | Passed using isolated feature client; no production URL |
| New migration interrupted/retry rehearsal | All three transactional OMR migrations: injected final failure rolled back their DDL, then complete retry succeeded in disposable full-history WASM database |
| Existing admin registration regression | Passed |
| Existing HSSC group printing regression | Passed, including 150 class/group rendering combinations |
| Existing staff/accounts UI regression | Passed, 11 checks |
| Existing dashboard theme browser regression | Passed |
| Existing attendance cancellation UI regression | FAILED: source assertion expects obsolete direct Super Admin cancellation rendering; attendance source is unchanged from checkpoint |
| Existing attendance reset UI regression | FAILED: existing fixture times out waiting for #attendance-session after its earlier checks; attendance source/fixture are unchanged |
| Scoped OMR web TypeScript compilation | PASSED after preserving the existing getUser helper's generic type; five previously observed untyped-export diagnostics resolved without changing session behavior |
| Local native PostgreSQL regressions | BLOCKED: no PostgreSQL 17/18 server binaries or Docker discovered; hardcoded paths replaced with configurable tool discovery |
| Native PostgreSQL 17 | Hosted PostgreSQL 17.11: OMR full-history/RLS/grant/concurrent-claim/duplicate tests passed; all three HSSC provisioning scenarios passed; clean/repeat Prisma deploy passed. Historical attendance upgrade/recovery/backup-restore now passed all 16 checks after fixture repairs |
| Linux untrusted PDF execution/multi-page sandbox | PASSED hosted: actual two-page PDF via authenticated API, queue, bubblewrap/Poppler and worker; two distinct scans, each 100 A responses/version A and private annotation. Windows explicitly skips this positive test and retains its unsandboxed-PDF refusal |
| Android development APK | Earlier d134a27 APK exists and is verified (4,201,756 bytes). Current physical-layout runtime: mobile TS/Vite passed, but assembly FAILED/BLOCKED on three external Gradle download attempts (502, 60-second timeout, 502); no current APK artifact. Local Java/ADB/device testing unavailable |
| iOS | Sources generated; camera usage/privacy cover prepared. No Xcode build or physical device test |
| Supplied private photos through actual application | 24/24 uploaded through actual web/API/queue: 17 REVIEW_REQUIRED × 100 positions, 7 INVALID; no original attached to a student or assigned results. Calibration 12/18 mapped; frozen reserved evaluation 5/6 mapped. See physical-validation.md; independent human answer accuracy remains unknown |
| Real-photo web/mobile workflow | Passed raw S01 mobile selection/shared review; separately passed derived synthetic-header/QR copy, exact Class 8/B synthetic key, internal draft, correction/reversal/audits, crop guidance, duplicates, confidentiality and publication boundary. This is not original-photo identity validation or a device test |

The two attendance regression failures were retained and documented; assertions were not weakened and unrelated attendance functionality was not rewritten. They are release blockers pending investigation in the broader application. The scoped web type-check diagnostics were resolved and the check rerun successfully.

## Integrity and privacy evidence

Synthetic checks cover mismatched QR identity/session/group/version, inactive/unknown candidates, signature tampering, MIME/signature/size/traversal rejection, teacher key/mark confidentiality, duplicates, unique exam/student results, approved key/raw evidence/policy immutability, RLS/grants/startup checks, append-only correction/publication/historical audits, transaction rollback, synthetic publication refusal (including repeated attempts), historical visibility review with no Student score rewrites, mobile refresh races/network errors and queue stale-owner rejection. Published-result success with genuine approved physical evidence and native concurrent publication remains a release validation task; it was not activated using fabricated approval evidence.

PGlite serializes database access and cannot establish native multi-connection correctness. The PostgreSQL 17 CI test explicitly uses two native clients for SKIP LOCKED and concurrent duplicate submissions. Observe its actual result before accepting that evidence. Application rollback must preserve OMR audit tables and account for the old Results Desk's visibility behavior.

**Verdict: working isolated application with provisional physical-layout progress; not production-ready or authorized for real examination grading/publication.** Seventeen photographs now map; seven fail and all mapped sheets require review. Independent human answer transcriptions, original QR/identity validation, physical device checks and release approval remain required. Earlier hosted native database/PDF/Android checks passed; the new milestone's hosted results must be observed separately.

## Hosted review evidence

Draft PR: https://github.com/xxsoloxxleveling-sketch/AZMNEW/pull/28 (unmerged, no deploy).
Initial hosted run: https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42424513554.
APK SHA-256: `f7d5119e5c3b4c19645edb777274a9e513f62c1e648dcd4966509719dcf5415f`.
Artifact ZIP SHA-256: `03a2c20eb20c60b7de71ff889e6b41be1044de64d1b34bf27a3bf65b74f9ce1c` (matches GitHub's artifact digest).

The normal Git CLI has no authenticated account. The connected GitHub app published a review snapshot with a tree verified identical to the local milestone, retaining local commit history. Local and remote commit IDs differ; content equality is checked independently. Further fixture corrections are added as review commits with the same verification. No force push or local history reset is used.

Hosted checks exposed a blanket-grant legacy runtime fixture and an old migration rehearsal which incorrectly included later migrations in its pre-target baseline. Fixture updates apply the real OMR permission contract, copy only migrations preceding the historical target and generate an isolated client matching that historical database. Existing assertions remain intact. Complete rerun results must be observed before declaring these broader regressions passed.

The second hosted run passed the new native PostgreSQL 17 checks and HSSC scenarios again, and built the APK again. It then exposed an asynchronous Puppeteer path lookup in the new CI command and an old default PostgreSQL client on PATH in the broader workflow. The command now awaits the browser path; discovery skips incompatible PATH entries; the broader workflow selects the disposable PostgreSQL 17 clients explicitly. These are infrastructure corrections, not relaxed test assertions.

## Broader PostgreSQL 17 regression result

The complete runtime privilege isolation workflow passed on hosted PostgreSQL 17 after the fixture/tool corrections: https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42425612508.
It includes PRE_OPEN lifecycle and deletion/ownership checks, signed capability guard, Super Admin user deletion, frontend build, dashboard/session-control browser flows, HSSC restricted-role provisioning/capture/edits/PDF identity/preview geometry, student document collections, roll-slip printing and strict public/flexible staff registration. No production service or data was used.

The new OMR Linux application check reached its real browser launch and found Ubuntu AppArmor restrictions on the downloaded Chrome binary. CI now selects the runner-installed Chrome profile, retaining its sandbox. This does not disable PDF isolation or change application scoring. The application/legacy upgrade/backup-restore rerun remains to observe.

Final identity hardening: authorized printed review may supply a missing QR but cannot override a known conflicting student/session/examination QR or an invalid signed envelope. Such sheets require a correct official capture and do not post marks. Added explicit regression tests for these cases.

Eligibility is rechecked under a candidate row lock during grading/approval/publication, rather than trusting an earlier verification flag. A changed or inactive group blocks approval. Missing-QR reviews retain the checked printed roll/session/exam in immutable audit evidence. The real synthetic API test changes a fabricated candidate's group after grading and verifies that approval is rejected until eligibility is restored. Serializable raw-query conflicts/deadlocks have bounded retries with an explicit regression test.

The Linux fixture diagnosis was a cropped header-search window, not a weak answer classification. The search now includes the full printed header height while keeping the same permitted displacement, circle evidence and classification thresholds. Both downloaded fabricated Linux captures now yield 100 A responses, version A and registration 1.0 locally. The regression covers -40, -80 and +70 pixel header shifts without changing question numbering; all 31 Python tests passed again. The PostgreSQL 17 historical upgrade/recovery/backup-restore rehearsal passed 16 checks in hosted run 42426992722.

## Latest continuation and private application test

Both hosted workflows for review commit `80103e100b5cb32af2980692c8e51618339f2b56` completed successfully: Smart OMR run `42427662000` (including Android) and broader PostgreSQL 17 runtime isolation run `42427661976`. This supersedes earlier pending-run notes above. Subsequent source changes require their own hosted rerun.

Private examples were tested through the newly implemented application, not treated as fixtures that should automatically pass. The test uses a disposable database with fabricated accounts, actual web file selection/upload, the real API/queue/worker and the review history/evidence screens. Reports, originals, screenshots and converted answer keys are under ignored `tmp/omr-reference/` and are never CI artifacts. All 24 scans remain INVALID with zero detected responses and zero results; no student was attached. No scores or recognition-accuracy claims can be derived from these failures. The supplied key is grading data, not an independent transcription of photographed marks.

Printed layouts in this sample set appear to differ from the generated template's alignment marks. Local-contrast corner detection improves gray-marker handling without bypassing timing tracks or full grid validation. Failed evidence now opens the original automatically and gives actionable alignment/layout guidance. The permitted answer thresholds are unchanged. Whole-row header aliases are rejected with first/last row evidence. Retake clears the native file input, and the development worker waits for its active job on shutdown.

After these changes: 32 scanner tests, 3 private-key parser tests, 43 feature Node tests and 5 full API/recovery checks passed locally. Web/backend/mobile builds and the scoped web type-check passed. All ten web screens plus mobile camera lifecycle, same-file retake, offline refusal, upload failure/retry, 100-row review, history and logout passed in the browser. The new positive two-page PDF integration test is explicitly skipped on Windows; Linux bubblewrap/Poppler execution is queued for hosted validation, with no sandbox bypass.

Hosted run `42469040585` passed compilation, 32 scanner/3 parser/43 feature tests, native PostgreSQL checks, the five image/recovery integration checks and the 16 historical recovery checks. The new positive PDF test failed at file inspection, while Android hit HTTP 504 downloading Gradle after compiling the mobile code. Broad runtime regression run `42469040508` passed. CI now loads Ubuntu's packaged bubblewrap AppArmor profile when available and probes namespace creation explicitly before tests; global namespace restrictions and the inner PDF sandbox remain enabled. The next run must establish whether that resolves the PDF environment failure.

## Final hosted evidence for the runtime checkpoint

Smart OMR run [42469745679](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42469745679) completed SUCCESS for review commit `10c6be940fa1c4bba712cb010bcabd96dac66176`, whose tree matches local runtime milestone `d134a27b4165a3bc505768acbece7c2ae74eec2f`. Both the OMR and Android jobs passed. This includes 32 scanner tests, 3 fabricated key-parser tests, 43 feature tests, the native PostgreSQL 17 OMR check, all three HSSC scenarios, 5 image/recovery checks, the new positive sandboxed two-page PDF check and all 16 historical migration/recovery/backup-restore checks. The earlier PDF failure is resolved by the packaged namespace policy; the preflight includes the same dynamic-loader mount as the renderer. No scoring threshold or PDF sandbox was disabled.

The Gradle download issue was resolved using the smaller binary archive at the same 8.14.3 version, with its official SHA-256 pinned. New local APK: `tmp/omr-dev/release/azm-omr-development-d134a27.apk`; SHA-256 `a0e105762f3e8695c37aa59ed2585ecb76414656cd187b3d6edb143da13d975c`. Downloaded artifact ZIP SHA-256 `7fa69ecbfac7c0ad79e721d3c17f09d8e591a2a698d29f3f3e838ed06e3bf306` matches GitHub's artifact digest. AndroidManifest.xml and classes.dex entries were checked. This proves a development build, not a device test or production approval. This final report update changes documentation/benchmark evidence only; runtime validation refers to the exact checkpoint above.

The supplied 24 photographs remain unreadable by this scanner layout and are the primary recognition release blocker. A separate legacy-layout compatibility implementation and independent physical ground truth are still needed. No public score, real student association or production activation was performed.

The broader PostgreSQL 17 runtime regression also passed at the same runtime review commit: [42469745725](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42469745725). Both workflows are observed successes, rather than inferred from an earlier milestone.

## Physical compatibility continuation

The newer physical milestone supersedes the old 24-INVALID recognition result without erasing it: 17/24 original photographs now produce 100 ordered observations, all REVIEW_REQUIRED; seven remain rejected. The six reserved photos were excluded from compatibility tuning and first processed after freezing optical code hash `59a7779250d157059ca95aa63860fd81a860e426d1a23fcdbf51adcd62e3c08a` (5 mapped, 1 rejected). The actual bulk application reproduces all 24 outcomes. Independent physical accuracy is unknown: 996 uncertain responses and five multiple marks still need review, no original QR decoded, and three versions are uncertain.

See [physical-validation.md](physical-validation.md) and [sanitized metrics](physical-validation-summary.json) for causes, exact rejected samples, split/results, private comparison files and unblinded-versus-independent review rules. The original blank still produces 100 blanks under its original timing-track profile. Local current checks: 37 scanner, 5 Python helper, 44 feature Node and 5 real synthetic API/recovery passed; one positive PDF test is explicitly skipped on Windows. All ten web screens and the full fake-camera/retake/offline/retry/review browser workflow passed again. The private web/mobile flow passed with its derived-identity nature explicitly recorded; synthetic-key drafts/publication refusal are not official marks.

For runtime `81de362` (identical review tree at `e6be8ff`), the OMR job in hosted run `42477804341` passed all scanner/helper/feature/native PostgreSQL/API/recovery/PDF and 16 historical migration/recovery/restore checks. Broad runtime workflow `42477804343` passed. Overall Smart OMR run remains FAILED because Android's pinned Gradle download failed on three attempts; mobile source compilation passed, native assembly did not complete and there is no new APK artifact. This is an observed external download blocker, not a passed or skipped Android build. Subsequent report updates change documentation only.

# Smart OMR validation report — 2026-11-08

Branch: `codex/smart-omr-evaluation-mobile`. Initial retained checkpoint: `a79e8449`. No production database, service, student/financial/attendance record or real marks were changed. This report separates observed results from unavailable release checks.

| Check actually run | Result |
|---|---|
| Python recognition/classification/PDF contracts | 31 passed (original 23 retained; timing/header registration, erasure/glare-like outline loss, spoofed grid and PDF security contracts added) |
| Feature Node tests: database/grading, 27 authenticated routes, identity/signatures, storage, activation, public/historical release, migration recovery, mobile session/network and key import | 38 passed |
| Full real synthetic API + queue recovery | 5 passed, including parent/child recovery checks; 22 migrations applied under restricted role on PostgreSQL 18.6/WASM |
| Generated real printable sheet | 100 A responses, version A; manual identity review when printed-roll OCR is unavailable; internal score 100/100, verification separate |
| Synthetic benchmark | 10 sheets / 1000 answers, 1000 correct; 10/10 exact sheets, no rejection/review; median 1.271 s, max 1.557 s; physical accuracy unmeasured |
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
| Expanded web-only TypeScript invocation | FAILED in unchanged authContext.tsx/mockApi.ts because getUser's bound export is untyped (5 existing diagnostics); Vite build and mobile strict check separately passed |
| Local native PostgreSQL regressions | BLOCKED: no PostgreSQL 17/18 server binaries or Docker discovered; hardcoded paths replaced with configurable tool discovery |
| Native PostgreSQL 17 | Hosted PostgreSQL 17.11: new OMR full-history/RLS/grant/concurrent-claim/duplicate tests passed; all three HSSC provisioning scenarios passed; clean Prisma deploy and repeat deploy passed. The older attendance target-upgrade rehearsal failed and is being repaired without changing its assertions |
| Linux untrusted PDF execution/multi-page sandbox | BLOCKED locally: Windows runner deliberately refuses unsandboxed PDF. Parser bounds/refusal contracts passed; actual bubblewrap execution remains to validate |
| Android development APK | PASSED on hosted Java 21 / Android SDK 36. Downloaded and archive digest verified; local APK: tmp/omr-dev/release/azm-omr-development.apk (4,201,448 bytes). Local Gradle/device testing remains unavailable |
| iOS | Sources generated; camera usage/privacy cover prepared. No Xcode build or physical device test |
| Physical filled-sheet/camera accuracy | NOT RUN; official release remains locked |

The two attendance regression failures were retained and documented; assertions were not weakened and unrelated attendance functionality was not rewritten. They are release blockers pending investigation in the broader application. The scoped web type-check diagnostics are also reported rather than hidden behind the passing Vite build.

## Integrity and privacy evidence

Synthetic checks cover mismatched QR identity/session/group/version, inactive/unknown candidates, signature tampering, MIME/signature/size/traversal rejection, teacher key/mark confidentiality, duplicates, unique exam/student results, approved key/raw evidence/policy immutability, RLS/grants/startup checks, append-only correction/publication/historical audits, transaction rollback, synthetic publication refusal (including repeated attempts), historical visibility review with no Student score rewrites, mobile refresh races/network errors and queue stale-owner rejection. Published-result success with genuine approved physical evidence and native concurrent publication remains a release validation task; it was not activated using fabricated approval evidence.

PGlite serializes database access and cannot establish native multi-connection correctness. The PostgreSQL 17 CI test explicitly uses two native clients for SKIP LOCKED and concurrent duplicate submissions. Observe its actual result before accepting that evidence. Application rollback must preserve OMR audit tables and account for the old Results Desk's visibility behavior.

**Verdict: working isolated synthetic development flow; not production-ready or authorized for real examination grading/publication.** Complete native database/PDF/mobile builds, resolve existing regressions, review legitimate historical release evidence, validate physical sheets and obtain separate release authorization first.

## Hosted review evidence

Draft PR: https://github.com/xxsoloxxleveling-sketch/AZMNEW/pull/28 (unmerged, no deploy).
Initial hosted run: https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42424513554.
APK SHA-256: `f7d5119e5c3b4c19645edb777274a9e513f62c1e648dcd4966509719dcf5415f`.
Artifact ZIP SHA-256: `03a2c20eb20c60b7de71ff889e6b41be1044de64d1b34bf27a3bf65b74f9ce1c` (matches GitHub's artifact digest).

The normal Git CLI has no authenticated account. The connected GitHub app published a review snapshot with a tree verified identical to the local milestone, retaining local commit history. Local and remote commit IDs differ; content equality is checked independently. Further fixture corrections are added as review commits with the same verification. No force push or local history reset is used.

Hosted checks exposed a blanket-grant legacy runtime fixture and an old migration rehearsal which incorrectly included later migrations in its pre-target baseline. Fixture updates apply the real OMR permission contract, copy only migrations preceding the historical target and generate an isolated client matching that historical database. Existing assertions remain intact. Complete rerun results must be observed before declaring these broader regressions passed.

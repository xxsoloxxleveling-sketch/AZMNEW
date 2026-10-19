# Super Admin exam session control

This change gives Super Admin a persisted preparation state, actual scoped operational deletion, and explicit placement freezing. It is prepared for review; it is not a production deployment.

## Review update — 19 October 2026

The supplied three-commit patch ending at `438c849b577303c97531c2765d32892a4165be33` was applied to GitHub base `f76f93c5fb6d4a5b806776ccdc282cdbe8123913`. All 18 pre-existing changed files were matched against their exact Git blob hashes before application. Both accompanying HSSC printing fixes are included.

Follow-up review corrected material edge cases before publication:

- Full-lineage previews count all selected result owners, including owners outside current assignments or roster rows. The signed fingerprint binds the normalized scope and displayed impact.
- Supported abbreviated examination dates cannot bypass a freeze. Invalid nonempty Hall/center dates reject. Blank, unconfigured dates remain possible.
- Previous CLOSED evidence survives allocation to a later examination. Scores count as progress before removing live membership; assigned Student inserts also synchronize the OPEN roster and its revision. OPEN participation remains exclusive across examination dates.
- Historical Hall sessions keep their center scope: reparenting requires explicit deletion of existing operational sessions first. Reset/replacement cannot create an unreachable attempt after the Hall has been reconfigured to another date.
- Verified unchanged legacy results can be mapped to their actual historical roster through the signed mapping action. New-date results without selected historical membership do not block deleting unrelated old history.
- Allocation clearing preserves an independently changed OfficeUse placement tuple. Seat generation works above 99.
- Open requires the selected `sessionId` and `revision` as well as `examHallId`; it cannot open a reset replacement on behalf of a stale request.
- Receipt recovery uses READ COMMITTED after the shared writer lock. An absent receipt remains nonterminal. Only a verified expired review with no receipt after that lock is safely discardable.
- The UI preserves Prepare for Halls with history but no current attempt, locks draft options while reviewing, derives confirmation labels from the signed scope, and retains the same request/key through ambiguous failures.

The revised database suite contains **47 named integration checks**. Additional browser cases perform destructive reset/deletion, delayed-preview, same-key retry, and stale-Open checks. These additions require execution against the full source checkout and PostgreSQL 17. The original implementation's reported passes below apply to the supplied patch, not automatically to these follow-up changes. Local review syntax checks are separate from TypeScript compilation, application builds, and database/browser execution.

## Reviewed source

- GitHub main: `6d3f70ca679435ee5b92a29a78e62f2e7bbdded8`.
- PR #22 remains draft/unmerged at `f76f93c5fb6d4a5b806776ccdc282cdbe8123913` and was not modified.
- Feature base: PR #22 plus patch-equivalent HSSC fixes `53593bbf87fb5cc31164e8510e6221c1009a4b84` and `dd9b5520831cb630acb56035f64328ae062a1726`.
- `git cherry` showed the hotfix branch's document commits already patch-equivalent in PR #22. No older source replaced those changes.

## Actions

| Action | Before | After | Attendance / placement consequence |
| --- | --- | --- | --- |
| Prepare | No current attempt | New PRE_OPEN | No roster or marks; actual opening metadata remains null |
| Open | Exact selected PRE_OPEN ID and revision | Same attempt OPEN | Build membership from current ACTIVE allocations and valid seats; reject stale requests |
| Close | OPEN | Same attempt CLOSED | Retain marks; optionally record remaining candidates absent |
| Reopen and keep progress | Current CLOSED | Same attempt OPEN | Keep all marks, including closing-generated absences; check conflicting participation |
| Reset to pre-open | Current PRE_OPEN / OPEN / CLOSED | New ID and generation, PRE_OPEN | Delete selected operational attempt, marks, roster and owned results; keep allocations by default |
| Delete and create fresh | Explicit attempts / complete reviewed lineage | One PRE_OPEN replacement per eligible Hall | Delete only listed attempts; clearing current assignments is explicit |
| Historical-only delete | Explicit historical attempts | Retained current attempt unchanged | No replacement or current-allocation clearing permitted |
| Freeze / Unfreeze | Selected center/date | FROZEN / EDITABLE | Explicit, reasoned Super Admin action; independent of lifecycle |
| Reset affected sessions and move | Reviewed current attempts | Replacements PRE_OPEN and current placement changed atomically | Destination must be PRE_OPEN or included in the same-center reset; cross-center destination must first be prepared/reset and explicitly editable |
| Map legacy result ownership | Explicit unowned roster results plus evidence reference | Scores retained, ownership attached to the reviewed stored attempt | Separate signed impact review; actual historical roster evidence is permitted; no inference from today's Hall |

The current domain supports one examination sitting per center/business date and one exclusive current Student allocation. It does not represent multiple simultaneous sitting allocations for one student. An unmarked OPEN move synchronizes source/destination membership and revisions under the same lock. Marked moves require the reviewed reset workflow. Historical CLOSED snapshots remain unchanged unless explicitly selected for deletion.

## Ownership and retention

| Data | Treatment |
| --- | --- |
| Selected Attendance rows, including closure absences | Deleted |
| Selected AttendanceSessionCandidate rows | Deleted; PRE_OPEN replacements have no copied roster |
| Selected operational AttendanceSession rows | Deleted; IDs and generations are never reused |
| Student testScore / overallRank with resultSessionId in selected IDs | Cleared |
| Existing unowned legacy results | Block full deletion until verified mapping; no guessing or silent clearing |
| New result writes | Require explicit current-attempt roster ownership |
| Current Student allocation | Retained by default; clear only when the Hall's current configured exam date still matches the reviewed scope |
| OfficeUse placement mirrors | Clear the tuple only when center, date, and time still match the reviewed Hall-derived allocation; preserve independently changed tuples |
| Newer or different allocations/results | Retained |
| Session-null legacy attendance | Retained |
| Student registration, roll/application numbers, identity QR | Retained |
| Fees, transactions, documents/storage objects, accounts, Hall/center definitions | Retained |
| Existing reset/cancellation/reopening audits | Retained with original historical IDs; session foreign keys are deliberately detached |
| New operation receipts and lifecycle events | Append-only counts, actor, reason, scope, IDs and outcome; no new copy of deleted per-student marks |
| Previously printed/downloaded documents | Cannot be recalled; current future documents use current placements and allocation changes report reprint required |

Legacy scores without a verifiable roster association remain deliberately blocked. The UI names this limitation. It does not report a completed full reset while leaving those scores unexplained. A separately reviewed mapping outside the available evidence may be needed for such data.

## Database capability and concurrency

The application remains a restricted nonowner login. A dedicated, isolated NOLOGIN role owns only the signed control, membership, generation, probe and lifecycle functions. It does not own tables, hold schema CREATE rights, or grant membership to the runtime. Its SQL privileges are explicitly listed in `ops/postgres/exam-control-capability.sql`.

The private signing key is unreadable by the application DB role. The API holds the matching secret outside PostgreSQL and signs the exact action payload only after authenticated preview confirmation. The database verifies HMAC, active Super Admin, token version, reason, expiry, scope and replay identity. A fabricated actor ID or application GUC alone cannot activate deletion. This boundary protects against arbitrary SQL using the runtime DB credentials; compromise of the API process and its signing secret is outside that boundary.

Direct attendance/session/roster deletion, arbitrary control writes, audit mutation and signing-key reads remain denied. No runtime trigger disabling, owner credentials, environment bypass or blanket destructive grant is used.

All affected writers take the same transaction advisory lock before row locks. BEFORE STATEMENT triggers cover direct Student/OfficeUse, Hall, center, attendance, membership, lifecycle and freeze writers. Existing services acquire the lock before reads and use bounded Serializable retries. The first implementation intentionally serializes exam work globally; measure contention before replacing it with consistently ordered finer-grained locks.

Previews bind actor/token version, action/options, exact attempt identities, allocation/result state, displayed impact, center configuration and freeze revision. Changes produce a conflict and new impact review. Durable idempotency key/request hash and operation receipts support timeout/reload recovery. Open and Scan requests require the selected attempt ID and revision; no stale request is redirected to a replacement.

`POST /api/attendance/control/operations/:key/status` accepts the original signed `{ challenge }`. A committed receipt is returned first. Otherwise, `NOT_FOUND` is explicitly nonterminal: retain and retry the original request and key. A signature-verified review that is expired after acquiring the shared lock, with no committed receipt, returns terminal `EXPIRED`; only that response permits discarding the expired review. The existing GET status endpoint remains available but cannot establish safe expiry without the challenge.

New timestamp-without-time-zone columns explicitly store UTC. UI dates use the selected date-only scope and display times in Asia/Karachi. Existing historical timestamps are not rewritten.

## Validation

Run with a dedicated localhost PostgreSQL 17 instance and no production data:

```sh
cd backend
npx prisma validate
npx prisma generate
npx tsc --noEmit
cd ..
npm run build
REQUIRE_PG17=true ATTENDANCE_TEST_DATABASE_URL=postgresql://FIXTURE@127.0.0.1:5432/postgres node backend/node_modules/tsx/dist/cli.mjs backend/tests/exam-session-control.test.ts
```

Set `EXAM_CONTROL_BROWSER=true` and a runner Chrome path to include the authenticated browser suite. It uses real routes and the restricted synthetic runtime. It drops a committed confirmation response, reloads, and recovers the original receipt. Screenshots are generated in `verification/exam-control/` and uploaded by CI.

The original implementation author reported: full migration chain on PostgreSQL 17.11; 34 integration checks; 14 HTTP/browser checks; backend TypeScript; frontend build; 17 user-deletion safeguards; HSSC printing; public/admin registration; 29 roster escaping/portrait checks. Those results were not independently rerun during review and do not establish a pass for the revised code. The reported Windows run used an equivalent native-loaded Vite config because the normal config bundler could not enumerate a protected ancestor directory. CI uses the repository's normal `npm run build` command.

The inherited repository-wide `tsc --noEmit` command includes older backend tests and unrelated frontend declaration/type errors. It is not reported as passing. The backend compile and production Vite build are separate checks. Older preserve-only/reset-to-OPEN fixtures describe the superseded behavior; the main-target CI job now tests the replacement contract, including the corresponding restricted-role boundaries, while retaining document, printing, registration and account-deletion regressions.

## Coordinated release and rollback runbook

1. Keep this feature PR draft. Verify current main, PR #22, deployed backend/frontend and migration ledger independently. These source refs do not establish what is live. Do not merge or modify PR #22 merely to release this work.
2. Review the actual forward SQL, ownership map, legacy-score inventory, grants/RLS policy and synthetic CI evidence. Bound one confirmation to 50 attempts. Resolve ambiguous legacy result ownership before claiming a full reset of affected scope.
3. Obtain the required independent production restore/migration rehearsal evidence. PR #22 records a previous safety rejection of a production-snapshot restore rehearsal; do not repeat that blocked operation through a different tool or transport. Synthetic tests here do not replace restore evidence.
4. Prepare and verify backup, restoration procedure, maintenance window, disk headroom and rollback artifacts through the separately authorized release path. No real attendance mutation, account deletion, or data purge is an acceptance smoke test.
5. Stage the exact reviewed backend/frontend before publication. A main push triggers `.github/workflows/deploy.yml` and publishes frontend/Notes to `deploy`. Coordinate this automatic frontend publication with the database/backend cutover; do not allow a frontend requiring PRE_OPEN/revisions to reach an old backend.
6. Stop attendance/allocation writers and quiesce the old API. Apply forward migrations in order, committing PRE_OPEN enum migration before the subsequent migration. Migrations alone do not reset/delete existing examination rows or invent historical freeze actions.
7. As an authorized DBA, invoke `ops/postgres/exam-control-capability.sql` against the explicitly verified database. Independently provision a fresh 64+ character private signing key through a parameterized DBA write; put the identical value in the API's `EXAM_CONTROL_SIGNING_KEY` secret. Do not use the application role to read/provision the private table.
8. Run the existing explicit-preflight `runtime-grants.sql` with the intended dedicated login/group. New control tables and lifecycle audits are SELECT-only for the runtime; protected operational DELETE is revoked. The script adds a private-document RLS policy only for the verified backend group so switching away from table ownership does not break document access. PUBLIC/Data API roles receive no policy.
9. Start the matching backend under the restricted runtime. The updated pre-listen guard checks privileges, enabled triggers, eight serialization guards, key agreement and the isolated NOLOGIN function owner. A missing key/owner/grant fails closed. Verify health and authorized read-only session/center/document endpoints, then publish the matching frontend in the coordinated window.
10. Confirm current sessions, freeze state, provenance and document/QR compatibility using read-only evidence. The actual destructive feature was exercised only with synthetic data.
11. Before any confirmed deletion, rollback can keep the forward schema while reverting only to a specifically tested compatible backend/frontend pair. The old runtime guard and old reset-to-OPEN code are incompatible release assumptions: do not blindly restart an old binary on the new schema. The original guard's trigger-name checks alone do not prove compatibility.
12. After a real confirmed deletion, application rollback cannot restore deleted operational data. Recovery requires the approved backup/restore process with reconciliation of writes since the backup. Keep receipts and original backup artifacts; do not reverse migrations or cascade-delete audits to simulate recovery.

No production host access, migration, deployment, session deletion or user-data mutation was performed while implementing or validating this feature.

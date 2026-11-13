# Future OMR Results Integration (Inactive)

This document describes a proposed boundary only. The Results website does not accept OMR events today, and the scanner is not connected by this change.

## Proposed event

`src/components/results/FutureOmrContract.ts` defines the proposed recognition envelope. It carries an idempotency event ID, source scan ID, examination ID, an optional claimed internal student ID, paper version, answer-key revision, recognition timestamp, and a complete per-question response set. It deliberately contains no score field. The shape must be reconciled with the actual scanner contract before an endpoint is implemented.

`inspectFutureOmrEvent` checks message shape only. A `READY_FOR_SERVER_VERIFICATION` decision is not a trusted result: it only says the event is structurally complete enough for a future server to begin authorization and roster checks. The helper never matches a student, validates an exam or key, calculates marks, writes a result, or publishes one.

## Future server boundary

Proposed route name, not implemented: `POST /api/results/omr/events`.

The route must be private to a trusted scanner sender. It must not reuse public result search or trust a browser-submitted score. Before creating a result, the backend must:

1. Authenticate the scanner sender and validate the event signature/integrity.
2. Enforce unique `eventId` and `sourceScanId` handling so retries are idempotent. A repeated identical event returns the original receipt; the same ID with a different payload is a conflict.
3. Resolve `examId` to a real examination and verify the candidate belongs to its frozen/authorized roster using the immutable internal student ID. A QR claim is evidence to verify, not an automatic assignment.
4. Verify paper version and the exact approved answer-key revision for that examination.
5. Require exactly the expected 1-based question set, with no duplicates or omissions.
6. Treat `UNCERTAIN` as requiring review. Confident `MULTIPLE` and `BLANK` are zero-mark classifications under the standard policy and do not require review solely for being multiple/blank.
7. Calculate marks on the server from the approved key. Never accept a client-computed score as authoritative.
8. Keep recognition, identity, scoring, and publication states separate. Conflicts or missing identity/key/version remain unresolved and are not assigned to a guessed student.
9. Record source scan, key revision, scorer revision, actor/system, and result revision in an immutable audit history. Corrections create a new revision; they do not silently overwrite a published result.
10. Keep public lookup limited to results with a server-authorized `PUBLISHED` state and a separately verified student access session/code.

## Proposed state dimensions

| Dimension | States |
|---|---|
| Recognition | `CAPTURED`, `RECOGNIZED`, `UNCERTAIN`, `INVALID` |
| Identity | `UNVERIFIED`, `MATCHED`, `CONFLICT`, `VERIFIED` |
| Scoring | `NOT_SCORED`, `PROVISIONAL`, `VERIFIED` |
| Publication | `DRAFT`, `READY`, `PUBLISHED`, `WITHHELD` |

An event can be recognized while identity is still unverified. A verified score can remain unpublished. Publication is always a separate authorized action.

## Website refresh boundary

The connected admin Results view currently polls its read-only page every 30 seconds while visible and refreshes when the tab becomes visible. This is the simplest refresh method supported by the current API. A future ingestion service can invalidate/cache-notify through a shared query layer if the app adopts one; realtime infrastructure is not required for the present result volume.

## What is not implemented

- No OMR route, scanner credential, webhook, queue, or synchronization is active.
- No database schema or migration has been added.
- The current legacy aggregate score is not proof of OMR verification and stays labeled unverified.
- The current public result API does not provide sufficient identity/publication verification and is not used by the production Results page.

# PR #30 — Repository TypeScript baseline comparison

Date: 2026-11-14 (Asia/Karachi)

## Purpose

Distinguish TypeScript diagnostics inherited from the release base from errors
introduced by the official Results, examination history and legacy DMC review
changes. This is a **comparison**, not a claim that repository-wide lint passes.

## Compared revisions

- PR #30 base: `0b0511062f558dc00b9c590d33072ae5733363d0`
- PR #30 tested head: `e19f723f4c043160e353e32a0f8d3c138fd23209`

Both revisions were extracted using `git archive` into separate temporary
directories on an authorized development computer. Each used the **same installed**
root and backend `node_modules` directories through temporary local junctions.
This excluded untracked recovery notes, personal data and local test artifacts
from both compilations.

Each revision ran:

```sh
npx tsc --noEmit --pretty false
```

Compiler diagnostics were compared by relative source path, TypeScript error
code and the first diagnostic message (line/column numbers ignored).

## Findings

| Check | Base | PR #30 tested head |
| --- | ---: | ---: |
| Repository-wide TypeScript exit code | 2 | 2 |
| TypeScript error diagnostics | 124 | 123 |
| Diagnostics newly introduced by PR #30 | — | **0** |
| Existing diagnostics resolved by PR #30 | — | **1** |

The eliminated diagnostic was `TS2554` in
`backend/tests/runtime-role-isolation.test.ts` (expected three arguments,
received two). The remaining `TS2339` concerning `ImportMeta.env` in
`src/components/results/PublicResultLookup.tsx` is present in both revisions,
alongside unrelated pre-existing compiler errors. No diagnostic was reported
for the new `OfficialDmcReplacementReview.tsx`, its test, the updated
`ResultsApi.ts`, or `OfficialResultDetailPanel.tsx`.

A preliminary comparison against the *working tree* was intentionally
discarded: untracked `verification/` artifacts added an unrelated error.
The figures above come only from archived, tracked commit contents.

## Related validation of the UI milestone

- `npx tsx --test src/components/results/OfficialDmcReplacementReview.test.tsx`:
  3 tests passed
- `npm run build`: passed
- Headless Chrome synthetic browser smoke: the evidence/confirmation gate,
  protected PDF preview, and explicit replacement API request all passed
- The earlier backend replacement commit had passing synthetic migration,
  atomicity, concurrency, rollback, and restricted-runtime checks
- GitHub's PostgreSQL 17 restricted-runtime workflow for the UI commit:
  completed successfully

The browser smoke used fabricated fixtures and locally intercepted requests;
it did not access production or real student records. Temporary harness files
were removed after execution.

## Limits and outstanding release gates

These diagnostics were measured against shared development dependencies,
including the then-generated Prisma client; a separate clean-install CI gate
may yield different output. The unchanged repository-wide TypeScript
errors remain and `tsc` as a whole **does not pass**. The comparison supports
a finding of **no PR-introduced TypeScript diagnostics** under the controlled
setup, not unrestricted release approval.

Independent code/security review, production migration-role readiness, and
a reviewed real PostgreSQL recovery rehearsal remain required. This document
does not authorize PR merge, a production migration, or deployment.

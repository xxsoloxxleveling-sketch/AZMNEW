# Examination history preservation: review handoff

This draft changes a reset so the prior attempt, attendance and roster remain associated with the original session. It stores linked legacy scores in an append-only history table and clears the current legacy score fields. Reopening continues to preserve the same attempt and its marks. Deletion of examination history is explicitly unavailable in the API and UI.

Already-owned legacy scores on noncurrent attempts are moved to history by the migration. Unowned scores are left for explicit evidence review; an owned score referencing a missing attempt blocks the migration. Historical legacy scores are available only through a Super Admin, no-store endpoint and the examination history view. The result snapshot is linked to its original session and, for control operations, an immutable operation receipt.

Official Results/DMC records do not yet have an authoritative attendance-attempt association. Reset therefore fails closed if an affected candidate has any official result, including a result that may belong to another examination. This is a known operational limitation, not a completed mapping workflow.

The new migration replaces two existing owned functions and adds an RLS policy on an existing Results table. A restricted migrator needs an explicitly controlled owner handoff, column-level Student update, references, migration-ledger access and reconciliation of the capability-owner grants. A disposable PostgreSQL 17 test rehearses exact Prisma migration deployment with synthetic ownership transfer and restoration; production authorization, backup recovery and independent review remain required. During cutover, dependent operations must be quiesced while ownership changes.

Local synthetic validation includes the examination-control database and browser workflows, restricted-runtime privilege tests, migration-role rehearsal, Results/DMC lifecycle and focused Results tests. No production database, student record, result or service was changed. The draft must remain unmerged and undeployed until CI, independent review and the coordinated release gates pass.

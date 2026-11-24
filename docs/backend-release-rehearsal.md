# Backend release rehearsal (phase 2)

This is a preparation and synthetic CI feature, not a live deployment controller.
It does not install anything on Oracle, use SSH, receive production credentials,
invoke a production migration, alter student data, or publish the frontend.

## Release package

`scripts/release/backend_bundle.py package` creates a Git archive of the tracked
backend tree for an exact full commit SHA and records SHA-256 digests of the
archive, every file and the prior migration chain. It rejects nonregular Git
entries, untracked archive files, unsafe archive paths, likely credential paths,
historical migration changes/deletions, and out-of-order new migration files.
The expected base must be an ancestor of the candidate. Historical SQL is
compared as committed bytes, not the Windows working-copy line endings.

The offline `verify` command requires independently expected base/source SHAs
and a trusted manifest SHA-256. A digest produced by the same untrusted bundle is
only an integrity check; it does not authorize deployment. The PR job verifies
its own bundle as a consistency check. It never extracts an incoming archive.

## Rehearsal

The dedicated PR workflow compiles the exact candidate and uses a disposable
GitHub-hosted PostgreSQL 17 service to apply the actual base migrations.
It inserts two artificial marks into a separate fixture schema, takes and
lists a custom-format dump, restores a separate database, applies the candidate
migration chain, and verifies the fixture before and after. A synthetic
additive migration in a temporary copy also tests the pending-migration path.
The synthetic probe is not committed to the application's migration ledger.
The original fixture database is verified unchanged. Neither dump nor synthetic
database credentials are production data; only the backend source bundle and
its manifest are retained as CI artifacts.

## Boundaries and remaining work

PR #71 introduces a separately reviewed frontend approval gate. This rehearsal
does not replace it or authorize publication. The protected production
environment should remain restricted to main and require operator approval.
Do not add the personal SSH key, general sudo permissions, or production database
credentials to GitHub. Leave the new locked Oracle staging identity unprivileged.

A separately reviewed server-side controller still needs authenticated release
provenance, fixed permitted release operations, immutable state, version evidence,
production migration-ledger comparison, a protected backup and isolated restore
rehearsal, database privilege verification, and controlled backend activation.
Rollback must preserve data and stay compatible with the installed schema.
A real production backup is not an artifact to send to GitHub. A green fixture
rehearsal does not demonstrate live-server permissions, disk space or restore
capacity. Production activation and frontend publication require separate
operator approval and live verification; no automated production execution is
implemented here.

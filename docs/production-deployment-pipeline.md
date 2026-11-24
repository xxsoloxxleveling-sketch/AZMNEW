# Production deployment pipeline — phase 1

This change is an approval gate for the existing frontend publisher, **not** a
production backend deployment service. Do not treat a green public health endpoint
as proof that a particular backend commit or migration is installed.

## Existing environment

- GitHub environment: `production`; require an operator reviewer, no administrator
  bypass, deployment refs restricted to `main`.
- Oracle backend remains under `azm-api`. The separate locked `azm-deploy` account
  is reserved for future restricted staging/retrieval work; this change does not
  grant it SSH login, sudo, database access, or access to application credentials.
- The existing frontend timer continues to publish the `deploy` branch. No server
  unit, database role, backup policy or application record changes in this phase.

## Approval gate and rehearsal

A push to main builds the frontend artifact but does not publish it. A pull
request changing the workflow also exercises the build only; it does not access
the production environment or write to the deployment branch. The build includes
the current portal, notes, ExamScan PWA and pinned Android beta, and stores the
source SHA and a SHA-256 archive checksum.

Once this change has been reviewed and merged, release publication requires a
manual workflow dispatch on main with the full exact main SHA and an explicit
operator attestation that the matching backend and migrations are active.
The publication job then waits for production environment approval. It checks
the current main SHA again, checks API/database connectivity and checks the
artifact checksum and source identity. This is not independent proof of the
backend SHA; the operator must obtain that evidence before approving.

Do not dispatch or approve the pending scholarship release until its reviewed
migration, protected backup, backend activation and live verification have been
completed. If the workflow is merged first, re-evaluate the PR #70 base and run
its exact final release checks again. Do not automatically publish the pending
feature as part of this infrastructure change.

## Future backend automation (not implemented in phase 1)

Design and review a restricted, operator-approved pull-based service separately.
The unprivileged fetch/staging identity should only obtain artifacts tied to an
approved exact commit/run. A separately administered privileged release controller
must enforce a fixed release format, immutable provenance, reviewed migration
allowlists, serialized execution, backup verification, disposable restore
rehearsal, scoped grants, and health/version checks. A checksum by itself is
integrity evidence, not authorization. Never allow arbitrary remote command
execution, grant general sudo, expose a production database connection to GitHub
Actions, or reuse the operator's personal SSH key. Keep secrets on the server
and never print them into workflow output.

The migration identity remains separate from the application runtime identity.
Code rollback must be compatible with the installed schema, and must preserve
new award/assessment histories; automatic restoration over the live database
is not a safe generic rollback strategy. Frontend publication should eventually
require trusted backend version and migration evidence rather than the manual
attestation used during this first phase.

Test the controller in a disposable environment before enabling it on production.
Production deployment requires its own reviewed implementation and operator
authorization. Existing tool execution restrictions remain in force.

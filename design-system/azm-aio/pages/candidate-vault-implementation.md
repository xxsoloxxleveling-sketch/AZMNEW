# AZM.AIO — Candidate Document Vault Implementation Plan
Status: DEVELOPMENT ONLY. No database migration, deployment, production file action, or main-branch merge is authorized by this plan.

## Base and scope
- Repository: xxsoloxxleveling-sketch/AZMNEW
- Base main: `1d227444e3851c0a39d0d03b814997aeebfda83c`
- Isolated feature branch: `feat/candidate-document-vault-20261008`
- Existing source of truth: `StudentDocument` PostgreSQL metadata and private Cloudflare R2 bytes, not a second file store.
- Restricted access: SUPER_ADMIN and ADMIN only for vault listing, viewing, uploading, replacing, reviewing and history.

## Identified defects
1. The old UI filters only the current page; its counters are likewise page-local.
2. It renders PDFs with an image element.
3. `mockApi.updateDocumentStatus` returns success without writing per-file review state if no studentId is passed; the UI does exactly that.
4. It uses overall student eligibility for per-file review badges; this must never be interpreted as file verification.
5. Its approve-all action can falsely confirm success and must be removed.
6. Existing candidate upload/recovery contracts and files must be preserved.

## Phased implementation
1. **Additive schema and migration:** per-file review fields and optimistic revision on `StudentDocument`; append-only `StudentDocumentAudit` events. Existing rows default to PENDING_REVIEW without invented history. No changes to OfficeUse. Do not execute migration on production.
2. **Private API:** authenticated role-restricted server-side search, filters, accurate global counts, individual document metadata, private binary file retrieval, bounded history listing, new upload, immutable-object replacement and Verify/Reject/Reset review with mandatory rejection reason.
3. **Write safety:** validate MIME *and* magic bytes, enforce 5 MiB cap, upload only to unique private R2 keys; never overwrite/delete historical blobs. Reject stale revisions (409). Ensure DB metadata update + audit is atomic in one PostgreSQL transaction. If remote upload succeeds but metadata transaction fails, quarantine/report the new orphan key rather than deleting any existing object. Do not treat a local no-op storage fallback as success.
4. **Cross-module compatibility:** existing registration and student detail routes stay available. Newly uploaded/replaced vault records become authoritative for the existing student-document viewer; preserve all legacy disk/R2 recovery behavior for non-vault records. A replaced photo updates its derived thumbnail without deleting history.
5. **UI:** AZM design system; debounced backend search/filter/pagination, true summaries, student lookup for upload, authenticated on-demand image/PDF preview, download, replacement, per-file review with reason, audit timeline and appropriate loading/error states. Remove unsupported bulk-approve behavior.
6. **Tests:** validation, role policy, filtering, transaction/audit and stale-revision behavior, bad uploads and MIME spoofing, safe preview, no arbitrary URL fetching, original file retention, build/typecheck. Use only synthetic fixture data and disposable/local DBs where feasible.
7. **Delivery:** commit the source and tests to this feature branch and open a PR for review. Do not merge or deploy. A separate operator-approved production migration/release must include backup, restore test, backend first, service/API validation, frontend last and rollback instructions.

## Explicit non-goals
- No changes to scholarship eligibility, registration fee/payroll/ledger, roll-number issuance or Hall assignment.
- No bulk document approval, file deletion, storage-bucket listing, external file URLs or new public file access.
- No rewriting, migrating or deleting historical student files in production.

## Release acceptance criteria
- Per-file review is durable, independently audited and safe under concurrent changes.
- Upload and replace result in private retrievable files and immutable previous versions.
- All search and counts are database-wide, not only the current page.
- Admin/Super Admin allowed; teacher/accountant unauthorised; unauthenticated requests denied.
- Existing student legacy document retrieval and unrelated modules still work.
- Frontend/backend builds, Prisma validation and focused tests pass on safe development infrastructure.
- PR stays open and main/production unchanged until explicitly approved.

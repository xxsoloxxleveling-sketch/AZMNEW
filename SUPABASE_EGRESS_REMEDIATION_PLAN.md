# Supabase Egress Remediation Plan

## Outcome of the investigation

The most likely primary cause is **database/shared-pooler egress from embedded base64 photos**, multiplied by automatic frontend polling.

- The client compresses a passport photo to at most about 195 KB, but a base64 data URL is about one-third larger.
- The backend can persist that data URL in `Student.photoUrl` and `uploadedDocsJson`.
- The student-list query selects `photoUrl` for as many as 250 students.
- The admin roster refetches that list every 25 seconds and on window focus.
- At 100 near-limit photos, a response can contain roughly 26 MB of base64 photo text. Repeating it every 25 seconds can approach 90 GB/day from one continuously open tab.

This code path is sufficient to explain the 107.28 GB shown in the screenshot.

The screenshot is organization-wide (`All projects`), so the Supabase Usage page should still be filtered to this project before treating the attribution as final. Supabase's exported logs do not include response byte counts.

## Evidence

### Code evidence

1. `backend/src/modules/students/students.service.ts`
   - Around lines 1387-1403, `input.fileData` is deliberately retained as `dataUrl`, and a photo data URL can also be saved in `photoUrl`, even after the same file has been uploaded to Storage.
   - Around lines 861-890, the roster query returns `photoUrl` and defaults to a very large page.
2. `src/lib/mockApi.ts`
   - Around lines 546-555, the client asks for as many as 250 students per request.
3. `src/components/admin/students/StudentsListView.tsx`
   - Around lines 92-110, the whole roster is fetched on mount, focus, filter changes, and every 25 seconds.
4. `src/lib/useAdminQuery.ts`
   - Its default behavior polls every 15 seconds, creating the same risk in other admin screens.
5. `src/components/admin/students/StudentDetailView.tsx` and `src/components/admin/storage/DocumentVaultView.tsx`
   - Document images are rendered immediately as thumbnails, so opening a detail/vault screen downloads originals rather than small previews.
6. `backend/src/modules/students/students.routes.ts`
   - `/upload-document` and `/:id/document/:docType` are declared before authentication and have no upload-specific rate limiter. This is an avoidable abuse and hotlinking risk.

### Log evidence

The supplied CSV contains 1,000 events covering only 5 hours 18 minutes on 29 August 2026:

- 433 Supavisor events and 256 PgBouncer events, consistent with frequent backend database activity.
- 125 Storage events: 36 URL-sign operations, 23 upload requests, 16 signed object downloads, 16 bucket-list operations, and 5 object-list operations.
- The signed downloads are from ordinary desktop/mobile browsers and involve `student-photos` and `student-documents`.

The CSV proves that Storage originals are downloaded, but 16 downloads in this narrow sample do **not** demonstrate 107 GB of Storage egress. The large repeated roster payload is the stronger explanation unless the Supabase per-service chart shows otherwise.

## Implementation order

### Phase 0 — contain the leak immediately

1. Remove `photoUrl` from the roster/list query response. Return only lightweight metadata such as `hasPhoto` and `photoThumbnailPath`.
2. Disable automatic roster polling. Refresh on explicit user action or after a mutation. If temporary polling is operationally necessary, use at least 5 minutes, pause while the tab is hidden, deduplicate in-flight calls, and use an abort signal.
3. Change `useAdminQuery` so polling is opt-in (`pollIntervalMs: 0`) rather than a 15-second default.
4. Reduce the roster page size to 20-50 and expose real pagination in the UI. Keep a hard backend maximum well below 2,000.
5. Temporarily show a placeholder/avatar in list screens. Original photos must never be part of a roster JSON response.

These changes stop the largest egress path without waiting for a database migration.

### Phase 1 — correct the file model

1. Make Supabase Storage the only source of file bytes. Persist only:
   - bucket
   - object path
   - MIME type
   - byte size
   - original filename
   - document type
   - upload timestamp
2. Add a `StudentDocument` model/table rather than continuing to place unstructured file records in `uploadedDocsJson`. Use an additive migration first; do not drop the legacy columns yet.
3. After upload succeeds, discard `fileData`. Never write `data:` URLs into `photoUrl` or `uploadedDocsJson`.
4. Store object paths, not 30-day signed URLs. Generate access only when an authorized user requests a specific file.
5. Require a stable upload session/student identifier. Stop writing new objects under `TEMP_CANDIDATE`, and use stable object names for replaceable single documents to avoid timestamp-created duplicates.
6. Generate a small thumbnail during upload (for example, 96-160 px and at most 15-25 KB). Keep the private original for on-demand inspection.

### Phase 2 — change delivery behavior

1. Add an authenticated metadata endpoint for document lists; it must return no file bytes and no base64.
2. Add authorized, on-demand endpoints for thumbnail and original access.
3. Protect both upload and document delivery routes. Candidate uploads should use a short-lived, narrowly scoped upload-session token; admin reads should use the existing authentication and role checks.
4. Apply upload-specific rate limits, validate the allowed document types, and reduce the global 50 MB JSON body limit. Prefer multipart/binary upload instead of base64 JSON to eliminate the 33% encoding overhead.
5. In the student detail and document vault screens, render metadata/placeholders first. Fetch the original only after “Inspect” or “Download”. Paginate the vault and lazy-load thumbnails.
6. Keep minor/student documents private. Do not move them to a public CDN merely to reduce egress.

### Phase 3 — migrate existing data safely

1. Run a read-only aggregate audit in Supabase SQL Editor:

   ```sql
   select
     count(*) as students,
     count(*) filter (where "photoUrl" like 'data:%') as base64_photos,
     pg_size_pretty(coalesce(sum(octet_length("photoUrl")), 0)) as photo_url_size,
     count(*) filter (where "uploadedDocsJson" like '%base64,%') as rows_with_base64_documents,
     pg_size_pretty(coalesce(sum(octet_length("uploadedDocsJson")), 0)) as uploaded_documents_size
   from "Student";
   ```
2. Backfill each embedded file to Storage only when no verified object path already exists. Record a checksum and byte size.
3. Verify that every migrated object can be read and matches its checksum.
4. Rewrite legacy JSON to metadata-only records and replace base64 `photoUrl` values with null/path references in small batches.
5. Deploy readers that prefer the new table but can fall back to legacy metadata during rollout.
6. After a monitoring period and a backup, remove legacy blob content/columns in a separate migration.
7. Audit `TEMP_CANDIDATE` and duplicate timestamped objects. Produce a deletion list for review; do not bulk-delete them automatically.

### Phase 4 — connection and query hygiene

1. Confirm production `DATABASE_URL` uses Supavisor transaction pooling and reserve `DIRECT_URL` for migrations.
2. Configure a small Prisma connection limit suitable for the Render instance.
3. Use Supabase Query Performance / `pg_stat_statements` to compare call counts before and after the frontend changes.
4. Avoid fetching the student roster as a helper inside unrelated calls such as test-center calculations. Return those counts from a purpose-built aggregate endpoint.

## Verification gates

The remediation is complete only when all of these pass:

1. A 100-student roster response is below 250 KB and contains no `data:` or `base64,` strings.
2. Leaving each admin screen idle for 10 minutes produces no student-list request and no Storage object download.
3. Opening a student detail page loads metadata and, at most, a small photo thumbnail; document originals load only after a click.
4. Unauthenticated upload and document-read requests return 401/403, and rate-limit tests return 429 after the configured threshold.
5. The SQL audit reports zero base64 photos/documents after migration.
6. Supabase Usage, filtered to this project, shows near-zero idle Database/Shared Pooler egress and only intentional Storage egress for at least 48 hours.

## Billing/quota expectation

A code fix prevents further egress but cannot erase usage already served in the current billing cycle. Supabase states that egress resets at the start of a new billing cycle; use the restriction date shown in the dashboard as the operational deadline and verify the exact grace-period status in Billing/Support.

Official references:

- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/guides/monitoring-and-debugging
- https://supabase.com/docs/guides/storage/serving/downloads

# Isolated Smart OMR development

This tool starts a new **in-memory, synthetic-only** database, applies all 22 migrations, provisions a restricted role, and starts the real Express API and bounded worker on loopback. It ignores supplied database URLs, clears cloud/activation settings, disables memory fallback, and refuses production mode. Stopping it destroys the database. Private synthetic uploads and screenshots remain under ignored `tmp/omr-dev/`.

From the repository root (Node 24, Python 3.11):

```powershell
npm ci --ignore-scripts --legacy-peer-deps
npm ci --prefix backend --ignore-scripts --legacy-peer-deps
npm ci --prefix tools/omr-dev --ignore-scripts --legacy-peer-deps
npm ci --prefix apps/omr-mobile --ignore-scripts --legacy-peer-deps
python -m venv workers/omr/.venv
workers/omr/.venv/Scripts/python.exe -m pip install -r workers/omr/requirements.txt
node backend/node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma
node --import ./backend/node_modules/tsx/dist/loader.mjs tools/omr-dev/start.ts
```

On Linux use `.venv/bin/python`; the launcher discovers either venv. Use separate terminals for the interfaces:

```powershell
$env:VITE_API_URL='http://127.0.0.1:5055'
npm run dev -- --host 127.0.0.1 --port 5173
npm run dev --prefix apps/omr-mobile -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5173/#login`, then `#omr`, or the standalone mobile preview at `http://127.0.0.1:5174`.

Synthetic accounts: `super@omr.test`, `admin@omr.test`, `teacher@omr.test`. All use `Synthetic-Omr-Only-2026!`. These are disposable fixture accounts, never production credentials. Teacher has scanning access; admin has scan/review/manage access. Super Admin can configure examinations and grants. No answer key or mark is returned to the teacher API.

Set `OMR_CHROME_PATH` to an installed Chrome/Chromium binary, or install Puppeteer's browser in `backend`. Generate the fabricated 100-A sheet:

```powershell
node --import ./backend/node_modules/tsx/dist/loader.mjs tools/omr-dev/generate-sheet.ts
```

Upload `tmp/omr-dev/synthetic-clean.png`. If local printed-roll OCR is unavailable, use the authorized review form: lookup `SYNTHETIC-APP-0001`, printed roll `SYNTHETIC-OMR-0001`, check identity/examination confirmation, and enter a review reason. Saving creates an internal 100/100 draft; verification is separate. Publication stays locked.

## Checks

```powershell
workers/omr/.venv/Scripts/python.exe -m unittest discover -s workers/omr -v
node --import ./backend/node_modules/tsx/dist/loader.mjs --test backend/tests/omr-scoring.test.ts backend/tests/omr-database.test.ts backend/tests/omr-migration-recovery.test.ts backend/tests/omr-security.test.ts backend/tests/omr-api.test.ts backend/tests/omr-public-results.test.ts tools/omr-dev/mobile-session.test.ts tools/omr-dev/answer-key-import.test.ts
node --import ./backend/node_modules/tsx/dist/loader.mjs --test tools/omr-dev/integration.test.ts tools/omr-dev/queue-recovery.test.ts
node --import ./backend/node_modules/tsx/dist/loader.mjs tools/omr-dev/browser-check.ts
```

The ordinary test command needs synthetic `DATABASE_URL`, JWT access/refresh secrets (32+ characters); use a non-listening loopback URL, never a real database. Integration/recovery tests provision their own connections. Browser checks start their own disposable API on 5055 and need both Vite previews already running. Stop any previous dev API first. They use a fake camera, force one upload failure, retry it, inspect all 100 rows, and verify empty mobile browser storage. Browser output contains synthetic data only.

PGlite reports **PostgreSQL 18.6/WASM**. It serializes one database connection and does not establish native concurrency or PostgreSQL 17 compatibility. `AZM_TEST_POSTGRES_BIN` selects native 17/18 tools. `ATTENDANCE_TEST_DATABASE_URL` must identify a disposable loopback administrator service. `REQUIRE_PG17=true` enforces 17 in native tests. Feature CI uses an official disposable PostgreSQL 17 service; the client proxy is CI-only and only permits the rehearsal archive path. Never provide production connection strings.

Untrusted PDFs require Linux Poppler plus bubblewrap with user namespaces. The HTTP worker never forwards `OMR_TRUSTED_PDF_FIXTURE`; Windows PDF processing fails closed. Camera classification, OCR and PDF parser behavior still require the physical/native validation described in the release runbook.

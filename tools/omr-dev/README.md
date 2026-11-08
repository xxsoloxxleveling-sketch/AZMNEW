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

## Private examples through the application

Keep the web preview on port 5173 and stop any API on 5055. Set `OMR_PRIVATE_SAMPLE_DIR` to the local image folder and `OMR_CHROME_PATH` to Chrome, then run:

```powershell
node --import ./backend/node_modules/tsx/dist/loader.mjs tools/omr-dev/private-sample-check.ts
python tools/omr-dev/prepare_private_keys.py "C:\path\to\answer-keys.pdf"
```

The first command selects the actual images in the web Bulk Upload screen, runs the real API/queue/worker and opens review history. Its disposable database contains fabricated accounts only; it verifies zero results were created and no real identity was attached. External browser requests are blocked. Reports, original evidence and screenshots remain under ignored `tmp/omr-reference/application-check/`; the command refuses CI. Never upload that folder as a build artifact.

The PDF helper requires `pypdf`. It validates each exact class/group and A–D key independently, requires questions 1–100 exactly once and writes private `Question,Answer` CSVs plus a mapping manifest under ignored `tmp/omr-reference/private-keys/`. Select the matching exam/group and version in Answer Key Manager; preparing CSVs does not approve keys or activate official scoring. Never infer a key from the highest achieved score. A key is grading data, not human ground truth for what a photographed bubble contains.

The baseline was 24 INVALID scans. The separate provisional framed profile now maps 17 originals (all REVIEW_REQUIRED) and rejects 7, with no original identity/results attached. This is geometry/observation progress, not physical answer accuracy. See docs/omr/physical-validation.md. The samples, observations, comparison files and confidential key contents are excluded from source control and CI.

The private application checker defaults to the first 18 calibration photos. Freeze the optical algorithm/dataset before opening the reserved six:

```powershell
workers/omr/.venv/Scripts/python.exe tools/omr-dev/physical-benchmark.py "C:\path\to\photos" --split calibration --freeze
workers/omr/.venv/Scripts/python.exe tools/omr-dev/physical-benchmark.py "C:\path\to\photos" --split validation
$env:OMR_PRIVATE_SPLIT='all'
node --import ./backend/node_modules/tsx/dist/loader.mjs tools/omr-dev/private-sample-check.ts
```

The fixed experiment has 24 files sorted by filename: S01–S18 calibration, S19–S24 reserved. Freeze history and earlier evidence must be preserved. A changed code/dataset hash refuses validation; do not tune on those six and then call them unseen. Each application run writes a new private directory rather than overwriting baseline evidence.

`label-physical.py` provides a token-protected loopback screen with empty responses, no keys and no predictions. It requires all 100 marks plus explicit reviewer confirmation, preserves revisions and checks the source hash. If the local link is inaccessible, use private text/CSV comparison files and a blank transcription CSV. Feedback after viewing predictions is an unblinded comparison, not independent human ground truth.

Set `OMR_PRIVATE_KEY_MANIFEST` to the prepared manifest and run `private-key-check.ts` to verify all 44 exact CSVs, key mismatches and revision behavior without approving any official key. `private-photo-flow.ts` tests the raw S01 mobile upload plus a separately labeled **derived** identity copy: only the header is replaced with a fabricated QR/roll, answer/version pixels are preserved, a synthetic test key creates an internal draft, and uncertainty/publication protections remain. Its raw-photo, derived-copy, correction, duplicate and crop checks are reported separately under ignored tmp/omr-reference/photo-flow. Neither private runner may run in CI.

The Linux-only `pdf-integration.test.ts` sends a fabricated two-page printable PDF through authenticated upload and bubblewrap/Poppler, asserting two separate scans with all 100 responses. Windows skips this positive test explicitly and retains its sandbox refusal contract; a hosted result must be observed before calling it passed.

On Ubuntu with restricted user namespaces, the CI runner loads the distribution's `bwrap-userns-restrict` AppArmor profile and probes namespace creation. It does not disable AppArmor/global namespace restrictions or run Poppler without bubblewrap. See [Ubuntu's namespace policy](https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/) and the [upstream restricted-child profile](https://gitlab.com/apparmor/apparmor/-/blob/master/profiles/apparmor/profiles/extras/bwrap-userns-restrict). This is disposable CI configuration, not an instruction to change the Oracle VM.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

function findRepositoryRoot() {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..')];
  const root = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'src/components/rollnumber/RollNumberSlipView.tsx')),
  );
  if (!root) throw new Error('Run from the repository root or backend directory.');
  return root;
}

const root = findRepositoryRoot();
const previewSource = fs.readFileSync(
  path.join(root, 'src/components/admin/students/RollSlipPreviewModal.tsx'),
  'utf8',
);
if (/The reserved roll number will remain the same when officially released\./.test(previewSource)) {
  throw new Error('The preview must not claim an unreserved number is already reserved.');
}
if (!/\{hasReservation\s*\?[\s\S]*?existing reserved number[\s\S]*?:[\s\S]*?read-only provisional preview\. No roll number has been reserved by opening it\./.test(previewSource)) {
  throw new Error('Expected reservation wording to depend on the existing reservation state.');
}
const cssPath = fs.readdirSync(path.join(root, 'dist/assets'))
  .filter((name) => /^index-.*\.css$/.test(name))
  .map((name) => path.join(root, 'dist/assets', name))[0];
if (!cssPath) throw new Error('Build the application first; expected dist/assets/index-*.css.');

const previewStudent = {
  id: 'placement-preview-fixture',
  applicationNo: 'APP-PLACEMENT-FIXTURE',
  rollNumber: null,
  rollNumberStatus: 'PROVISIONAL',
  fullName: 'Synthetic Candidate',
  fatherName: 'Synthetic Guardian',
  cnicOrBForm: '11111-2222222-3',
  currentClass: 'Class 10th',
  status: 'ACTIVE',
  placementStatus: 'PLACEMENT_PENDING',
  assignedHallId: null,
  assignedHall: 'Stale Hall Text',
  assignedRoom: 'Stale Room Text',
  seatNo: 'STALE-SEAT-99',
  testCenterName: 'Stale Venue Text',
  testCenterAddress: 'Stale Address Text',
  testDate: 'Stale Date Text',
  reportingTime: 'Stale Time Text',
  examStartTime: 'Stale Start Text',
};

const moduleSource = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { RollSlipPreviewModal } from ${JSON.stringify(path.join(root, 'src/components/admin/students/RollSlipPreviewModal.tsx'))};
  import { RollNumberSlipView } from ${JSON.stringify(path.join(root, 'src/components/rollnumber/RollNumberSlipView.tsx'))};

  const rootNode = document.getElementById('root');
  if (location.pathname === '/admin') {
    createRoot(rootNode).render(React.createElement(RollSlipPreviewModal, {
      student: window.__PLACEMENT_FIXTURE_STUDENT__,
      isOpen: true,
      onClose: () => {},
    }));
  } else {
    createRoot(rootNode).render(React.createElement(RollNumberSlipView, { onSelectTab: () => {} }));
  }
`;

async function main() {
const bundle = await build({
  stdin: {
    contents: moduleSource,
    resolveDir: root,
    sourcefile: 'roll-slip-placement-ui-fixture.tsx',
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  define: {
    'import.meta.env.PROD': 'true',
    'import.meta.env.VITE_API_URL': 'window.location.origin',
  },
});
const bundleText = (bundle.outputFiles.find((file) => file.path.endsWith('.js')) || bundle.outputFiles[0])?.text;
if (!bundleText) throw new Error('esbuild did not emit the UI fixture bundle.');

const requestCounts = new Map<string, number>();
let pendingSlipResponseCount = 0;
let adminStudentResponseCount = 0;
let protectedPhotoNotFoundCount = 0;
let preparePrintCount = 0;
let officialPdfCount = 0;
let externalFetchAttemptCount = 0;
let writeRequestCount = 0;

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function record(req: IncomingMessage, pathname: string) {
  const key = `${req.method || 'GET'} ${pathname}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '') &&
    pathname !== '/api/students/search-slip' &&
    pathname !== '/qa-external-attempt'
  ) {
    writeRequestCount++;
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const pathname = url.pathname;
  record(req, pathname);

  if (req.method === 'GET' && pathname === '/qa-status') {
    return json(res, 200, {
      requests: Object.fromEntries([...requestCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
      pendingSlipResponses: pendingSlipResponseCount,
      adminStudentResponses: adminStudentResponseCount,
      protectedPhotoNotFoundResponses: protectedPhotoNotFoundCount,
      preparePrintRequests: preparePrintCount,
      officialPdfRequests: officialPdfCount,
      externalFetchAttempts: externalFetchAttemptCount,
      writes: writeRequestCount,
    });
  }

  if (req.method === 'POST' && pathname === '/qa-external-attempt') {
    externalFetchAttemptCount++;
    return json(res, 204, {});
  }

  if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/health/readiness')) {
    return json(res, 200, { success: true, data: { ready: true } });
  }

  if (req.method === 'GET' && pathname === '/api/students/placement-preview-fixture') {
    adminStudentResponseCount++;
    return json(res, 200, previewStudent);
  }

  if (req.method === 'GET' && /^\/api\/students\/placement-preview-fixture\/document\/photo(Thumbnail)?$/.test(pathname)) {
    protectedPhotoNotFoundCount++;
    return json(res, 404, { success: false, error: { message: 'Synthetic photo not available.' } });
  }

  if (req.method === 'POST' && pathname === '/api/students/search-slip') {
    pendingSlipResponseCount++;
    return json(res, 200, {
      success: false,
      code: 'PLACEMENT_PENDING',
      error: 'Your Roll Number is issued, but your examination Center/Hall assignment is not yet available. Please check again after seating is finalized.',
    });
  }

  if (/\/prepare-print$/.test(pathname)) {
    preparePrintCount++;
    return json(res, 409, { success: false, error: { message: 'PLACEMENT_PENDING' } });
  }
  if (/\/(roll-slip-pdf|bulk-roll-slips-pdf)$/.test(pathname)) {
    officialPdfCount++;
    return json(res, 409, { success: false, error: { message: 'PLACEMENT_PENDING' } });
  }

  if (req.method === 'GET' && pathname === '/') {
    return sendHtml(res, '/public');
  }
  if (req.method === 'GET' && (pathname === '/admin' || pathname === '/public')) {
    return sendHtml(res, pathname);
  }
  if (req.method === 'GET' && pathname === '/fixture.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(bundleText);
  }
  if (req.method === 'GET' && pathname === '/fixture.css') {
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(cssPath).pipe(res);
  }

  return json(res, 404, { success: false, error: { message: 'Not found in the local placement-safety fixture.' } });
});

function sendHtml(res: ServerResponse, page: '/admin' | '/public') {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; connect-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:" />
        <title>Local Roll Slip Placement QA</title>
        <link rel="stylesheet" href="/fixture.css" />
      </head>
      <body>
        <div id="root"></div>
        <script>window.__PLACEMENT_FIXTURE_STUDENT__ = ${JSON.stringify(previewStudent)};</script>
        <script>
          const fixtureFetch = window.fetch.bind(window);
          window.fetch = (input, init) => {
            const target = new URL(typeof input === 'string' ? input : input.url, window.location.href);
            if (target.origin !== window.location.origin) {
              void fixtureFetch('/qa-external-attempt', { method: 'POST' });
              return Promise.reject(new Error('External network is disabled in this local fixture.'));
            }
            return fixtureFetch(input, init);
          };
        </script>
        <script type="module" src="/fixture.js"></script>
      </body>
    </html>`);
}

const port = Number(process.env.PORT || 0);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});
{
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind a TCP port.');
  console.log(`Roll slip placement UI fixture ready at http://127.0.0.1:${address.port}/public`);
  console.log(`Admin preview: http://127.0.0.1:${address.port}/admin`);
  console.log(`QA status: http://127.0.0.1:${address.port}/qa-status`);
}

if (process.argv.includes('--serve')) {
  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  await new Promise<void>(() => {});
} else {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

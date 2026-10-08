import assert from 'node:assert/strict';

import fs from 'node:fs';

import path from 'node:path';

const root = path.resolve(__dirname, '../..');

const source = fs.readFileSync(path.join(root, 'src/components/admin/settings/RollNumberScheduleTab.tsx'), 'utf8');

let checks = 0;

function check(fn: () => void) { fn(); checks++; }

check(() => assert(source.includes('Pakistan Time — PKT')));

check(() => assert(source.includes('Asia/Karachi (UTC+05:00)')));

check(() => assert(!source.includes('(PST)')));

check(() => assert(!source.includes('Examination Schedule Printed on Candidate Slips')));

check(() => assert(!/value=\{config\.(examCenterName|examDate|femaleReportingTime|femaleTestStartTime|femaleTestEndTime|maleReportingTime|maleTestStartTime|maleTestEndTime)/.test(source)));

check(() => assert(source.includes('Examination Centers &amp; Halls')));

check(() => assert(source.includes('isReleaseConfigReleased(current)') && source.includes('isReleaseConfigReleased(updated)')));

check(() => assert(!source.includes('new Date(config.releaseDateTime)')));

check(() => assert(source.includes('releaseDateTimeToPakistanInput(config.releaseDateTime)')));

check(() => assert(source.includes('role="alert"') && source.includes('config.isScheduled &&') && source.includes('not been changed automatically')));

console.log(`PASS: ${checks} release schedule UI checks`);


// Optional local-only fixture for manual responsive QA. No production API or database.
async function serve() {
  const { build } = await import('esbuild');
  const { createServer } = await import('node:http');
  let config: any = { isScheduled: true, releaseDateTime: '2026-10-25T04:00:00.000Z',
    announcementTitle: 'Immediate Release Active', announcementMessage: 'Slips are live.', updatedAt: '2026-10-08T00:00:00Z' };
  let writes = 0;
  const built = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import {RollNumberScheduleTab} from './src/components/admin/settings/RollNumberScheduleTab';
    createRoot(document.getElementById('root')).render(React.createElement(RollNumberScheduleTab));`,
    loader: 'tsx', resolveDir: root }, bundle: true, write: false, platform: 'browser',
    define: { 'import.meta.env': JSON.stringify({ PROD: false, VITE_API_URL: 'http://127.0.0.1:4318' }) } });
  const css = fs.readdirSync(path.join(root, 'dist/assets')).find(name => /^index-.*\.css$/.test(name))!;
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(built.outputFiles[0].text); }
    if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(fs.readFileSync(path.join(root, 'dist/assets', css))); }
    if (req.url === '/api/students/release-config') {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') return res.end(JSON.stringify({ data: config }));
      if (req.method === 'POST') {
        let body = ''; req.on('data', data => body += data); req.on('end', () => {
          config = JSON.parse(body); writes++; res.end(JSON.stringify({ data: config }));
        }); return;
      }
    }
    if (req.url === '/qa-status') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ config, writes })); }
    if (req.url !== '/') { res.statusCode = 404; return res.end('Fixture endpoint unavailable'); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><main id="root" style="padding:16px"></main><script src="/fixture.js"></script>');
  });
  server.listen(4318, '127.0.0.1', () => console.log('Local schedule QA: http://127.0.0.1:4318'));
}
if (process.argv.includes('--serve')) serve().catch(error => { console.error(error); process.exitCode = 1; });

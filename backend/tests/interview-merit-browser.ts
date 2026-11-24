import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer, { ElementHandle, Page } from 'puppeteer';
import type { MeritPreview, MeritPreviewRow } from '../../src/components/admin/interviews/assessmentApi';

const awardOptions = [
  ['UMRAH_TICKET', 'Umrah Ticket'], ['LAPTOP', 'Laptop'], ['FULL_YEAR_SCHOLARSHIP', 'Full Year Scholarship'],
  ['PARTIAL_SCHOLARSHIP', 'Partial Scholarship'], ['EDUCATIONAL_VOUCHER', 'Educational Voucher'],
  ['CASH_PRIZE_3000', '3000-Cash Prize'], ['CASH_PRIZE_5000', '5000-Cash Prize'],
] as const;
type AwardCode = typeof awardOptions[number][0];
type SyntheticAward = { id: string | null; revision: number; awardCode: AwardCode | null; actorName: string | null; createdAt: string | null };
const unassignedAward = (): SyntheticAward => ({ id: null, revision: 0, awardCode: null, actorName: null, createdAt: null });

// Synthetic candidates only. Exercise the actual React controls and download
// bytes, including rows beyond the visible page, without a production database.
async function run() {
  const root = path.resolve(__dirname, '../..');
  const output = path.join(root, 'tmp/interview-merit-ui');
  fs.mkdirSync(output, { recursive: true });
  const downloads = fs.mkdtempSync(path.join(output, 'downloads-'));
  const css = fs.readdirSync(path.join(root, 'dist/assets')).filter(name => name.endsWith('.css'))
    .map(name => fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n');
  const user = { id: 'synthetic-merit-admin', name: 'Synthetic Administrator', email: 'fixture@test.invalid', role: 'SUPER_ADMIN' };
  const records: MeritPreviewRow[] = Array.from({ length: 30 }, (_, index) => candidate(index + 1));
  records.push(
    { ...candidate(31), studentName: 'Synthetic Pending Candidate', rank: null, overallRank: null, status: 'INCOMPLETE', assessmentStatus: 'NOT_STARTED',
      written: { marks: 99, maximumMarks: 100, isFinal: false, sourceType: null, reference: null, revision: null, status: 'PENDING_VERIFICATION' },
      totals: { written: null, interview: null, extracurricular: null, academic: null, personality: null, total: null }, issues: ['Written mark is not verified.'] },
    { ...candidate(32), studentName: 'Synthetic Source Changed Candidate', rank: null, overallRank: null, status: 'SOURCE_CHANGED',
      written: { ...candidate(32).written, marks: 90 },
      totals: { written: 48, interview: 17, extracurricular: 8, academic: 4, personality: 4, total: 93.87 }, issues: ['Written source changed after assessment.'] },
    { ...candidate(33), studentName: 'Synthetic Absent Candidate', rank: null, overallRank: null, status: 'ABSENT',
      totals: { written: 40.2, interview: null, extracurricular: null, academic: null, personality: null, total: 99.97 }, issues: ['Candidate was absent.'] },
    { ...candidate(34), className: 'Class 10th', studentName: 'Synthetic Other Class One', rank: 1, overallRank: 1,
      totals: { ...candidate(34).totals, total: 99.75 } },
    { ...candidate(35), className: 'Class 10th', studentName: 'Synthetic Other Class Two', rank: 2, overallRank: 16,
      scholarshipCategory: 'FINANCIALLY_NEEDY',
      totals: { ...candidate(35).totals, total: 82.5 } },
  );
  const originalRecords = JSON.stringify(records);
  const bundle = await build({
    stdin: { contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {AuthProvider} from './src/lib/authContext';
      import {setUser,setToken} from './src/lib/auth';
      import {AdminLayout} from './src/components/admin/layout/AdminLayout';
      import {InterviewMeritPreviewView} from './src/components/admin/interviews/InterviewMeritPreviewView';
      setToken('synthetic-merit-token'); setUser(${JSON.stringify(user)});
      localStorage.setItem('azmaio.dashboard.appearance.v1:synthetic-merit-admin','dark');
      createRoot(document.getElementById('root')).render(<AuthProvider><AdminLayout currentTab="interviews" onSelectTab={()=>{}} title="Interview management"><InterviewMeritPreviewView roundId="synthetic-merit-round" roundTitle="Synthetic Session V Merit Review" sessionRef="2026-V"/></AdminLayout></AuthProvider>);`,
      resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' },
  });
  const methods: string[] = [];
  const awards = new Map<string, SyntheticAward>();
  const awardRequests: Array<{ placementId: string; expectedRevision: number; idempotencyKey: string; awardCode: AwardCode | null }> = [];
  const awardReplays = new Map<string, { body: string; saved: SyntheticAward }>();
  let loseNextAwardResponse = false;
  let nextMeritReply: 'normal' | 'hold' | 'fail' = 'normal';
  let legacyBackend = false;
  let releaseHeldReply: (() => void) | undefined;
  let onReplyHeld: (() => void) | undefined;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const json = (data: unknown, status = 200) => {
      res.statusCode = status; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, message: data }));
    };
    methods.push(req.method ?? 'GET');
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return; }
    if (url.pathname === '/logo_cropped.png' || url.pathname === '/pictures/logo_cropped.png') {
      res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(path.join(root, 'public/logo_cropped.png'))); return;
    }
    if (url.pathname === '/api/auth/me') { json({ user }); return; }
    const awardPlacement = url.pathname.match(/^\/api\/interviews\/synthetic-merit-round\/assessment\/candidates\/([^/]+)\/merit-award$/)?.[1];
    if (awardPlacement && req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        const input = JSON.parse(body) as Omit<typeof awardRequests[number], 'placementId'>;
        awardRequests.push({ placementId: awardPlacement, ...input });
        const record = records.find(row => row.placementId === awardPlacement);
        if (!record) { json('Synthetic candidate not found.', 404); return; }
        if (input.awardCode !== null && !awardOptions.some(([code]) => code === input.awardCode)) { json('Invalid synthetic award.', 400); return; }
        if (user.role !== 'SUPER_ADMIN') { json('Only a Super Admin may assign or clear merit awards.', 403); return; }
        const replay = awardReplays.get(input.idempotencyKey);
        if (replay) { json(replay.body === body ? replay.saved : 'Synthetic idempotency conflict.', replay.body === body ? 200 : 409); return; }
        const current = awards.get(awardPlacement) ?? unassignedAward();
        if (input.expectedRevision !== current.revision) { json('Another administrator saved a newer award. Reload current awards before saving.', 409); return; }
        const saved: SyntheticAward = { id: awardPlacement + '-award-' + (current.revision + 1),
          revision: current.revision + 1, awardCode: input.awardCode, actorName: user.name, createdAt: new Date().toISOString() };
        awards.set(awardPlacement, saved);
        awardReplays.set(input.idempotencyKey, { body, saved });
        if (loseNextAwardResponse) {
          loseNextAwardResponse = false;
          json('Synthetic response lost after award saved. Retry saving.', 503); return;
        }
        json(saved);
      });
      return;
    }
    if (url.pathname === '/api/interviews/synthetic-merit-round/assessment/merit') {
      const rows = records.filter(row => !url.searchParams.get('className') || row.className === url.searchParams.get('className'))
        .map(row => ({ ...row, meritAward: awards.get(row.placementId) ?? unassignedAward() }));
      const data: MeritPreview = {
        provisional: true, publicationEnabled: false, policyVersion: 'SESSION_V_2026_60_20_10_5_5_V1',
        manualAwardsEnabled: true,
        rankMethod: 'SHARED_COMPETITION_WITHIN_CLASS', overallRankMethod: 'SHARED_COMPETITION_ALL_CLASSES',
        overallRankedCandidates: 32, classOptions: ['Class 9th', 'Class 10th'], rows,
        summary: { total: rows.length, ready: rows.filter(row => row.status === 'READY').length,
          incomplete: rows.filter(row => row.status === 'INCOMPLETE' || row.status === 'SOURCE_CHANGED').length,
          absent: rows.filter(row => row.status === 'ABSENT').length },
      };
      const response = legacyBackend ? { ...data, overallRankMethod: undefined, overallRankedCandidates: undefined, manualAwardsEnabled: undefined,
        rows: rows.map(({ overallRank: _overallRank, fatherName: _fatherName, institute: _institute,
          scholarshipCategory: _scholarshipCategory, meritAward: _meritAward, ...row }) => row) } : data;
      const behavior = nextMeritReply; nextMeritReply = 'normal';
      if (behavior === 'hold') { releaseHeldReply = () => { releaseHeldReply = undefined; json(response); }; onReplyHeld?.(); return; }
      if (behavior === 'fail') { json('Synthetic class fetch failed. Please retry.', 503); return; }
      json(response); return;
    }
    if (url.pathname.startsWith('/api/')) { json('Unexpected synthetic API route: ' + url.pathname, 404); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let reviewPage: Page | undefined;
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
    const page = await browser.newPage(); reviewPage = page;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error instanceof Error ? error.message : String(error)));
    const client = await page.createCDPSession();
    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await page.setViewport({ width: 1360, height: 1000 });
    await page.goto('http://127.0.0.1:' + address.port, { waitUntil: 'networkidle0' });
    await waitText(page, 'Synthetic Candidate 001');
    assert.equal(await (await field(page, 'Merit grouping')).evaluate(element => element.value), 'overall');
    await waitText(page, 'Class / overall rank');
    assert.equal(await (await field(page, 'Sort by')).evaluate(element => element.value), 'total');
    assert.equal(await (await field(page, 'Order')).evaluate(element => element.value), 'desc');
    const globalDescending = [34, ...Array.from({ length: 14 }, (_, index) => index + 1), 35,
      ...Array.from({ length: 16 }, (_, index) => index + 15), 31, 32, 33];
    let shown = await visibleRows(page);
    assert(shown[0][1].includes('Synthetic Other Class One') && shown[0][7] === '99.75', 'All classes starts with the highest total across the entire list');
    assert(shown[0][0].includes('Class 10th') && shown[0][0].includes('#1'));
    assert(shown[1][0].includes('Class 9th') && shown[1][0].endsWith('#2') && shown[2][0].endsWith('#2'), 'The server overall ranks preserve a shared tie across the combined list');
    await screenshot(page, path.join(output, 'desktop-merit-global-descending.png'));
    await clickButton(page, 'Next');
    await waitText(page, 'page 2 of 2');
    const descendingRows = [...shown, ...await visibleRows(page)];
    assert.deepEqual(rolls(descendingRows.map(row => row[1]).join('\n')), globalDescending, 'Descending total sorting applies globally before pagination, with unranked rows last');
    for (const row of descendingRows) {
      const source = records.find(record => record.rollNumber === 'SYN-M-' + rolls(row[1])[0]);
      assert(source);
      assert(row[0].includes(source.className) && row[0].endsWith(source.overallRank === null ? 'Unranked' : '#' + source.overallRank), 'Combined sorting preserves every server overall rank and shared tie');
    }
    const globalCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'all-classes-total-descending.csv'), /Overall/);
    const globalPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'all-classes-total-descending.pdf'), /Overall/);
    const globalCsvText = fs.readFileSync(globalCsv, 'utf8'), globalPdfText = pdfContents(globalPdf);
    assert.deepEqual(rolls(globalCsvText), globalDescending, 'All-class CSV follows global score order across all pages');
    assert.deepEqual(rolls(globalPdfText), globalDescending, 'All-class PDF follows the same global score order');
    assert.match(globalCsvText.split('\r\n')[0], /"Overall merit rank"/);
    assert.match(globalCsvText.split('\r\n')[0], /"Merit grouping"$/);
    assert.equal(csvRow(globalCsvText, 1)[2], '2');
    assert.equal(csvRow(globalCsvText, 35)[2], '16');
    assert.equal(csvRow(globalCsvText, 1).at(-1), 'All classes together');
    assert.match(globalPdfText, /Merit grouping:\s*All classes together/);
    const globalPdfRaw = pdfContents(globalPdf, 'raw');
    assertSevenColumnPdf(globalPdfRaw);
    assertPdfCandidate(globalPdfRaw, ['2', 'SYN-M-1', 'Synthetic Candidate 001', 'Synthetic Father 001', 'Synthetic Institute 001', '96.00%', '-']);
    assertPdfCandidate(globalPdfRaw, ['16', 'SYN-M-35', 'Synthetic Other Class Two', 'Synthetic Father 035', 'Synthetic Institute 035', '82.50%', '-']);
    await (await field(page, 'Order')).select('asc');
    await waitText(page, 'page 1 of 2');
    shown = await visibleRows(page);
    await clickButton(page, 'Next');
    await waitText(page, 'page 2 of 2');
    const globalAscending = [...descending(30).filter(value => value >= 15), 35,
      ...descending(14).filter(value => value > 2), 1, 2, 34, 31, 32, 33];
    assert.deepEqual(rolls([...shown, ...await visibleRows(page)].map(row => row[1]).join('\n')), globalAscending, 'Ascending total sorting reverses the global score order while retaining tied-row stability and nulls last');
    const ascendingCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'all-classes-total-ascending.csv'));
    const ascendingPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'all-classes-total-ascending.pdf'));
    assert.deepEqual(rolls(fs.readFileSync(ascendingCsv, 'utf8')), globalAscending);
    assert.deepEqual(rolls(pdfContents(ascendingPdf)), globalAscending);
    await (await field(page, 'Merit grouping')).select('class');
    await (await field(page, 'Order')).select('desc');
    await waitText(page, 'page 1 of 2');
    shown = await visibleRows(page);
    assert(shown[0][0].includes('Class 9th') && shown[0][0].endsWith('#1'), 'Separate-by-class restores the original class ranking');
    await clickButton(page, 'Next');
    const byClassRows = [...shown, ...await visibleRows(page)];
    const byClassOrder = Array.from({ length: 35 }, (_, index) => index + 1);
    assert.deepEqual(rolls(byClassRows.map(row => row[1]).join('\n')), byClassOrder, 'Separate-by-class keeps class groups intact and sorts inside each group');
    const classCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'by-class-total-descending.csv'), /By-Class/);
    const classPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'by-class-total-descending.pdf'), /By-Class/);
    const classCsvText = fs.readFileSync(classCsv, 'utf8'), classPdfText = pdfContents(classPdf);
    assert.deepEqual(rolls(classCsvText), byClassOrder);
    assert.deepEqual(rolls(classPdfText), byClassOrder);
    assert.match(classCsvText.split('\r\n')[0], /"Class merit rank"/);
    assert.equal(csvRow(classCsvText, 1)[2], '1');
    assert.equal(csvRow(classCsvText, 35)[2], '2');
    assert.equal(csvRow(classCsvText, 1).at(-1), 'Separate by class');
    assert.match(classPdfText, /Merit grouping:\s*Separate by class/);
    const classPdfRaw = pdfContents(classPdf, 'raw');
    assertSevenColumnPdf(classPdfRaw);
    assertPdfCandidate(classPdfRaw, ['1', 'SYN-M-1', 'Synthetic Candidate 001', 'Synthetic Father 001', 'Synthetic Institute 001', '96.00%', '-']);

    // A list size selects top ready candidates before presentation sorting or
    // grouping. It is a total count, not a count repeated for every class.
    await (await field(page, 'Merit grouping')).select('overall');
    assert.equal(await (await field(page, 'Students in merit list')).evaluate(element => element.value), 'all');
    assert.deepEqual(await (await field(page, 'Students in merit list')).evaluate(element =>
      Array.from(element.querySelectorAll('option')).map(option => option.value)), ['all', '20', '50', '100', '200', 'custom']);
    await (await field(page, 'Students in merit list')).select('20');
    await waitText(page, 'page 1 of 1');
    const top20 = globalDescending.slice(0, 20);
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), top20);
    await (await field(page, 'Order')).select('asc');
    const top20Ascending = globalAscending.filter(number => top20.includes(number));
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), top20Ascending, 'Ascending keeps the same top twenty candidates');
    await (await field(page, 'Merit grouping')).select('class');
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), [
      ...top20Ascending.filter(number => number !== 34 && number !== 35), 35, 34,
    ], 'Class grouping preserves total membership and applies display sorting inside each class');
    await (await field(page, 'Sort by')).select('studentName');
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')).sort((a, b) => a - b), [...top20].sort((a, b) => a - b), 'Name sorting cannot change a limited merit selection');
    await (await field(page, 'Merit grouping')).select('overall');
    await (await field(page, 'Sort by')).select('total');
    await (await field(page, 'Order')).select('desc');
    for (const preset of ['50', '100', '200']) {
      await (await field(page, 'Students in merit list')).select(preset);
      await waitText(page, 'page 1 of 2');
      const firstPage = await visibleRows(page);
      assert.equal(firstPage.length, 25);
      await clickButton(page, 'Next');
      const selected = [...firstPage, ...await visibleRows(page)];
      assert.deepEqual(rolls(selected.map(row => row[1]).join('\n')), globalDescending.slice(0, 32), 'A larger preset includes every ready candidate and excludes all unranked records');
    }
    const customTitle = 'Synthetic Merit: Session V / Scholarship Review - Verified Examination and Interview Candidates Across All Classes';
    await fill(page, 'PDF title', customTitle);
    const titledPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'custom-title-ready-list.pdf'), /^AZM-Synthetic-Merit-Session-V-.*\.pdf$/);
    const titledCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'limited-ready-list.csv'));
    assert.deepEqual(rolls(pdfContents(titledPdf)), globalDescending.slice(0, 32));
    assert.deepEqual(rolls(fs.readFileSync(titledCsv, 'utf8')), globalDescending.slice(0, 32), 'A finite selection exports every selected page');
    assertSevenColumnPdf(pdfContents(titledPdf, 'raw'));
    for (const pdfPage of pdfContents(titledPdf, 'raw').split('\f').filter(value => value.trim())) {
      assert(pdfPage.replace(/\s+/g, ' ').includes(customTitle), 'The custom title repeats on each exported page');
      assert.match(pdfPage, /PRIVATE PROVISIONAL REVIEW/);
    }
    assert.match(execFileSync('pdfinfo', [titledPdf], { encoding: 'utf8' }), /Title:\s+Synthetic Merit: Session V \/ Scholarship Review/, 'The PDF metadata uses the custom title');
    await fill(page, 'PDF title', '');
    await (await field(page, 'Students in merit list')).select('custom');
    await fill(page, 'Custom student limit', '26');
    await waitText(page, 'page 1 of 2');
    assert.equal((await visibleRows(page)).length, 25);
    await clickButton(page, 'Next');
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), [globalDescending[25]], 'A custom limit is applied before pagination');
    for (const invalid of ['0', '-1', '2.5', '']) {
      await fill(page, 'Custom student limit', invalid);
      assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'), 'Invalid custom counts cannot be exported');
    }
    await fill(page, 'Custom student limit', '2');
    await waitText(page, 'page 1 of 1');
    shown = await visibleRows(page);
    assert.deepEqual(rolls(shown.map(row => row[1]).join('\n')), [34, 1], 'Exact count does not silently add the tied candidate');
    assert(shown[1][0].endsWith('#2'), 'The retained member keeps its shared rank');
    await clickButton(page, 'Include all tied candidates');
    assert.equal(await (await field(page, 'Custom student limit')).evaluate(element => element.value), '3');
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), [34, 1, 2], 'Only an explicit action extends the list through the cutoff tie');
    await fill(page, 'Custom student limit', '1');
    await fill(page, 'Name or roll number', 'Candidate 003');
    shown = await visibleRows(page);
    assert.equal(shown.length, 1);
    assert(shown[0][1].includes('SYN-M-3') && shown[0][0].endsWith('#4'), 'Search filters define the pool before the limit without renumbering overall ranks');
    await fill(page, 'Name or roll number', '');
    assert(await (await field(page, 'Readiness')).evaluate(element => element.disabled && element.value === 'READY'), 'Finite lists explicitly select and lock ready candidates');
    await (await field(page, 'Students in merit list')).select('all');
    await (await field(page, 'Readiness')).select('INCOMPLETE');
    assert((await visibleRows(page))[0][1].includes('Synthetic Pending Candidate'));
    await (await field(page, 'Students in merit list')).select('20');
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), top20, 'Finite selection never fills places with a previous incomplete filter');
    await (await field(page, 'Students in merit list')).select('all');
    await (await field(page, 'Readiness')).select('');
    assert.equal(awardRequests.length, 0, 'Filtering, limiting, sorting and downloads never assign awards');

    await (await field(page, 'Merit grouping')).select('overall');
    await (await field(page, 'Class filter')).select('Class 9th');
    await waitText(page, '33 candidates');
    shown = await visibleRows(page);
    assert(shown[0][0].endsWith('#2') && shown[1][0].endsWith('#2') && shown[2][0].endsWith('#4'), 'A class filter does not renumber overall merit');
    await fill(page, 'Name or roll number', 'Candidate 003');
    await waitText(page, '1 candidates');
    assert((await visibleRows(page))[0][0].endsWith('#4'), 'A search filter preserves the server overall rank');
    const searchedCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'overall-filtered-rank.csv'), /Overall/);
    const searchedPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'overall-filtered-rank.pdf'), /Overall/);
    assert.equal(csvRow(fs.readFileSync(searchedCsv, 'utf8'), 3)[2], '4');
    assertPdfCandidate(pdfContents(searchedPdf, 'raw'), ['4', 'SYN-M-3', 'Synthetic Candidate 003', 'Synthetic Father 003', 'Synthetic Institute 003', '94.00%', '-']);
    await fill(page, 'Name or roll number', '');
    await (await field(page, 'Merit grouping')).select('class');
    await (await field(page, 'Sort by')).select('rank');
    await (await field(page, 'Order')).select('asc');
    await (await field(page, 'Readiness')).select('READY');
    await waitText(page, '30 candidates');
    assert.equal((await visibleRows(page)).length, 25);
    shown = await visibleRows(page);
    assert(shown[0][0].includes('#1') && shown[1][0].includes('#1') && shown[2][0].includes('#3'), 'Shared server ranks remain 1, 1, 3');
    await clickButton(page, 'Next');
    await waitText(page, 'page 2 of 2');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 026'));

    await (await field(page, 'Order')).select('desc');
    await waitText(page, 'page 1 of 2');
    shown = await visibleRows(page);
    assert(shown[0][1].includes('Synthetic Candidate 030') && shown[0][0].includes('#30'), 'Direction changes display order without assigning new ranks');
    const csv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'all-ready-descending.csv'));
    const csvText = fs.readFileSync(csv, 'utf8');
    const meritDescending = [...descending(30).filter(value => value > 2), 1, 2];
    assert.deepEqual(rolls(csvText), meritDescending, 'CSV includes all 30 filtered rows in selected order, not only the current 25');
    assert.match(csvText, /PROVISIONAL - NOT PUBLISHED/);
    assert(!csvText.includes('Synthetic Pending Candidate') && !csvText.includes('Synthetic Other Class'));
    const pdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'all-ready-descending.pdf'));
    const pdfText = pdfContents(pdf);
    assert.deepEqual(rolls(pdfText), meritDescending, 'PDF matches the all-row CSV order and filters');
    assert.match(pdfText, /AZM\.AIO/);
    assert.match(pdfText, /PROVISIONAL/i);
    assert.match(pdfText, /Synthetic Session V Merit Review/);
    assert.match(pdfText, /2026-V/);
    assert.match(pdfText, /67\.00%/, 'The PDF prints combined total as a percentage instead of individual component scores');
    assert.equal(csvRow(csvText, 30)[10], '0', 'CSV retains the full score breakdown, including an explicit zero activity score');
    assert(!pdfText.includes('Synthetic Pending Candidate') && !pdfText.includes('Synthetic Other Class'));
    const pages = pdfText.split('\f').filter(value => value.trim());
    assert(pages.length >= 2, 'The complete list spans multiple PDF pages');
    for (const text of pages) {
      assert.match(text, /AZM\.AIO/);
      assert.match(text, /PROVISIONAL/i);
      assert.match(text, /Page\s+\d+\s+of\s+\d+/i, 'Each page has a page counter');
    }
    await screenshot(page, path.join(output, 'desktop-merit-sorted.png'));

    await (await field(page, 'Sort by')).select('written');
    await (await field(page, 'Order')).select('asc');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 030'), 'Written marks use numeric ascending order');
    await (await field(page, 'Order')).select('desc');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 001'), 'Written marks use numeric descending order');
    await (await field(page, 'Sort by')).select('total');
    await (await field(page, 'Order')).select('asc');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 030'));
    await (await field(page, 'Order')).select('desc');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 001'));
    await (await field(page, 'Sort by')).select('studentName');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 030'));
    await (await field(page, 'Order')).select('asc');
    assert((await visibleRows(page))[0][1].includes('Synthetic Candidate 001'));
    await (await field(page, 'Sort by')).select('rollNumber');
    shown = await visibleRows(page);
    assert(shown[1][1].includes('SYN-M-2') && shown[9][1].includes('SYN-M-10'), 'Roll numbers use natural numeric ordering');

    await fill(page, 'Name or roll number', 'Candidate 00');
    await waitText(page, '9 candidates');
    await (await field(page, 'Order')).select('desc');
    const filteredCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'filtered-ready-descending.csv'));
    const filteredPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'filtered-ready-descending.pdf'));
    assert.deepEqual(rolls(fs.readFileSync(filteredCsv, 'utf8')), descending(9));
    assert.deepEqual(rolls(pdfContents(filteredPdf)), descending(9), 'Search, class and readiness filters apply equally to PDF and CSV');
    await fill(page, 'Name or roll number', 'No candidate matches this synthetic search');
    await waitText(page, 'No candidates match these filters.');
    assert(await buttonDisabled(page, 'Download PDF'));
    assert(await buttonDisabled(page, 'Export CSV'));

    await fill(page, 'Name or roll number', '');
    await (await field(page, 'Readiness')).select('');
    await (await field(page, 'Sort by')).select('rank');
    await waitText(page, '33 candidates');
    await clickButton(page, 'Next');
    await waitText(page, 'page 2 of 2');
    shown = await visibleRows(page);
    for (const row of shown.slice(-3)) {
      assert(row[0].includes('Unranked'));
      assert.equal(row[7], '—', 'Non-ready totals stay hidden even when an old total exists');
    }
    assert.equal(shown.find(row => row[1].includes('Synthetic Source Changed Candidate'))?.[2], '—', 'An old written contribution cannot be shown beside a changed final mark');
    const reviewPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'all-readiness-descending.pdf'));
    const reviewText = pdfContents(reviewPdf);
    assert.deepEqual(rolls(reviewText), [...meritDescending, 31, 32, 33]);
    assert(!reviewText.includes('93.87') && !reviewText.includes('99.97'), 'Old source-changed and absent totals cannot appear as merit scores');
    const reviewRaw = pdfContents(reviewPdf, 'raw');
    assertSevenColumnPdf(reviewRaw);
    assertPdfCandidate(reviewRaw, ['-', 'SYN-M-31', 'Synthetic Pending Candidate', 'Synthetic Father 031', 'Synthetic Institute 031', '-', '-']);
    assertPdfCandidate(reviewRaw, ['-', 'SYN-M-32', 'Synthetic Source Changed Candidate', 'Synthetic Father 032', 'Synthetic Institute 032', '-', '-']);
    assertPdfCandidate(reviewRaw, ['-', 'SYN-M-33', 'Synthetic Absent Candidate', 'Synthetic Father 033', 'Synthetic Institute 033', '-', '-']);
    const reviewCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'all-readiness-descending.csv'));
    const reviewCsvText = fs.readFileSync(reviewCsv, 'utf8');
    assert.equal(csvRow(reviewCsvText, 31)[7], '', 'An unverified raw mark is omitted from the CSV final-written column');
    assert.equal(csvRow(reviewCsvText, 32)[7], '90');
    assert.equal(csvRow(reviewCsvText, 32)[8], '', 'The CSV cannot export a stale weighted written contribution');
    await (await field(page, 'Sort by')).select('written');
    for (const direction of ['asc', 'desc']) {
      await (await field(page, 'Order')).select(direction);
      await clickButton(page, 'Next');
      assert((await visibleRows(page)).at(-1)?.[1].includes('Synthetic Pending Candidate'), 'Unverified raw marks remain last in both written sort directions');
    }
    await (await field(page, 'Sort by')).select('rank');

    await page.setViewport({ width: 390, height: 844 });
    await (await field(page, 'Order')).select('asc');
    await waitText(page, 'page 1 of 2');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile merit controls and table remain inside the page');
    for (const label of ['Merit grouping', 'Class filter', 'Sort by', 'Order', 'Students in merit list', 'PDF title']) {
      const bounds = await (await field(page, label)).boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390, label + ' remains visible on a narrow screen');
    }
    await screenshot(page, path.join(output, 'mobile-merit-sorted.png'));

    // A delayed response for an obsolete filter cannot replace the new class,
    // and neither in-flight nor failed requests allow stale data to be exported.
    const replyHeld = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Expected class request was not received')), 5000);
      onReplyHeld = () => { clearTimeout(timeout); resolve(); };
    });
    nextMeritReply = 'hold';
    await (await field(page, 'Class filter')).select('Class 10th');
    await replyHeld;
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'));
    assert(!(await visibleRows(page)).some(row => row[1]?.includes('Synthetic Candidate')), 'A pending class filter hides the previous class rows');
    await (await field(page, 'Class filter')).select('Class 9th');
    await waitExportsEnabled(page);
    const obsoleteResponse = page.waitForResponse(response => response.url().includes('className=Class+10th') && response.status() === 200);
    assert(releaseHeldReply); releaseHeldReply();
    await (await obsoleteResponse).text();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    assert((await visibleRows(page)).every(row => row[0]?.includes('Class 9th')), 'A late response cannot overwrite the currently selected class');
    nextMeritReply = 'fail';
    await (await field(page, 'Class filter')).select('Class 10th');
    await waitText(page, 'Synthetic class fetch failed. Please retry.');
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'));
    assert(!(await visibleRows(page)).some(row => row[1]?.includes('Synthetic Candidate')), 'A failed class fetch hides stale candidate rows');
    await clickButton(page, 'Retry');
    await waitExportsEnabled(page);
    assert((await visibleRows(page)).every(row => row[0]?.includes('Class 10th')));
    const recoveredCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'class-fetch-recovered.csv'));
    assert.deepEqual(rolls(fs.readFileSync(recoveredCsv, 'utf8')), [34, 35], 'Retry exports only the newly selected class');

    await (await field(page, 'Merit grouping')).select('overall');
    shown = await visibleRows(page);
    assert(shown[0][0].endsWith('#1') && shown[1][0].endsWith('#16'), 'Filtered classes retain their positions in the overall merit list');
    legacyBackend = true;
    await clickButton(page, 'Recalculate preview');
    await waitText(page, 'Combined merit is currently unavailable.');
    const groupingField = await field(page, 'Merit grouping');
    assert.equal(await groupingField.evaluate(element => element.value), 'class');
    assert(await groupingField.evaluate(element => element.querySelector<HTMLOptionElement>('option[value="overall"]')?.disabled), 'An older backend cannot enable fabricated overall ranks');
    shown = await visibleRows(page);
    assert(shown[0][0].endsWith('#1') && shown[1][0].endsWith('#2'), 'Legacy responses fall back to real class ranks');
    const legacyCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'legacy-class-ranks.csv'), /By-Class/);
    const legacyCsvText = fs.readFileSync(legacyCsv, 'utf8');
    assert.match(legacyCsvText.split('\r\n')[0], /"Class merit rank"/);
    assert.equal(csvRow(legacyCsvText, 35)[2], '2');
    assert.equal(csvRow(legacyCsvText, 35).at(-1), 'Separate by class');
    const legacyPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'legacy-missing-identity-fields.pdf'), /By-Class/);
    const legacyPdfRaw = pdfContents(legacyPdf, 'raw');
    assertSevenColumnPdf(legacyPdfRaw);
    assertPdfCandidate(legacyPdfRaw, ['1', 'SYN-M-34', 'Synthetic Other Class One', '-', '-', '99.75%', '-']);
    assertPdfCandidate(legacyPdfRaw, ['2', 'SYN-M-35', 'Synthetic Other Class Two', '-', '-', '82.50%', '-']);
    await (await field(page, 'Students in merit list')).select('custom');
    await fill(page, 'Custom student limit', '1');
    assert.deepEqual(rolls((await visibleRows(page)).map(row => row[1]).join('\n')), [34], 'A legacy backend can limit an explicitly selected class using its real class ranks');
    await (await field(page, 'Class filter')).select('');
    await waitText(page, 'Combined merit is currently unavailable.');
    await page.waitForFunction(() => !document.body.textContent?.includes('Calculating current merit preview'));
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'), 'A legacy all-class response cannot invent a global limited selection');
    assert(await (await field(page, 'Students in merit list')).evaluate(element =>
      Array.from(element.querySelectorAll('option')).filter(option => option.value !== 'all').every(option => option.disabled)));
    await (await field(page, 'Students in merit list')).select('all');
    await (await field(page, 'Class filter')).select('Class 10th');
    await waitExportsEnabled(page);
    legacyBackend = false;
    await clickButton(page, 'Recalculate preview');
    await waitExportsEnabled(page);
    assert(!await (await field(page, 'Merit grouping')).evaluate(element => element.querySelector<HTMLOptionElement>('option[value="overall"]')?.disabled));
    await (await field(page, 'Merit grouping')).select('overall');
    assert((await visibleRows(page))[1][0].endsWith('#16'), 'Overall ranking becomes available again when the server supports it');
    assert.equal(awardRequests.length, 0, 'The complete read, filter, sort, limit and export flow has made no award writes');

    // Explicit manual saves are the only mutations. An ambiguous response is
    // retried with the same key, while a genuine 409 requires a fresh decision.
    await page.setViewport({ width: 1760, height: 1000 });
    const awardLabel = 'Award for Synthetic Other Class One';
    const saveAwardLabel = 'Save award for Synthetic Other Class One';
    assert.deepEqual(await (await field(page, awardLabel)).evaluate(element =>
      Array.from(element.querySelectorAll('option')).filter(option => option.value).map(option => [option.value, option.textContent?.trim()])), awardOptions);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), '');
    assert.equal(await (await field(page, 'Award for Synthetic Other Class Two')).evaluate(element => element.value), '',
      'Non-General-Merit candidates have all seven award options and no preselected award');
    assert.deepEqual(await (await field(page, 'Award for Synthetic Other Class Two')).evaluate(element =>
      Array.from(element.querySelectorAll('option')).filter(option => option.value).map(option => [option.value, option.textContent?.trim()])), awardOptions);
    const scoresBeforeAward = (await visibleRows(page)).map(row => row.slice(0, 9));
    await (await field(page, awardLabel)).select('LAPTOP');
    assert.equal(awardRequests.length, 0, 'Choosing an award does not save it');
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'), 'Unsaved award choices cannot appear in a download');
    for (const label of ['Merit grouping', 'Class filter', 'Readiness', 'Name or roll number', 'Sort by', 'Order', 'Students in merit list']) {
      assert(await (await field(page, label)).evaluate(element => element.disabled), 'Unsaved awards lock ' + label);
    }
    await clickButton(page, 'Discard unsaved awards');
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), '');
    assert.equal(awardRequests.length, 0, 'Discarding a choice is also read-only');
    await (await field(page, awardLabel)).select('LAPTOP');
    loseNextAwardResponse = true;
    await clickButton(page, saveAwardLabel);
    await waitText(page, 'Synthetic response lost after award saved. Retry saving.');
    assert.equal(awardRequests.length, 1, 'A failed response does not cause an automatic write retry');
    assert.equal(awards.get('synthetic-merit-placement-34')?.revision, 1);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), 'LAPTOP');
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'));
    await (await field(page, awardLabel)).select('');
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'), 'Reverting to the old dropdown value cannot export a stale award after an unconfirmed save');
    assert(await (await field(page, 'Class filter')).evaluate(element => element.disabled), 'An unconfirmed save keeps view controls locked even after its draft is reverted');
    assert(!await buttonDisabled(page, 'Reload current awards'), 'Reload remains available after the draft no longer differs from the old saved value');
    await clickButton(page, 'Reload current awards');
    await waitExportsEnabled(page);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), 'LAPTOP', 'Explicit reload recovers the server-committed award after a reverted draft');
    assert.equal(awardRequests.length, 1);

    await (await field(page, awardLabel)).select('PARTIAL_SCHOLARSHIP');
    loseNextAwardResponse = true;
    await clickButton(page, saveAwardLabel);
    await waitText(page, 'Synthetic response lost after award saved. Retry saving.');
    assert.equal(awardRequests.length, 2);
    assert.equal(awards.get('synthetic-merit-placement-34')?.revision, 2);
    const discardReplyHeld = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Discard did not refetch the unconfirmed award')), 5000);
      onReplyHeld = () => { clearTimeout(timeout); resolve(); };
    });
    nextMeritReply = 'hold';
    const discardReload = page.waitForResponse(response => response.url().includes('/assessment/merit?') && response.status() === 200);
    await clickButton(page, 'Discard unsaved awards');
    await discardReplyHeld;
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'), 'Discard cannot unlock stale exports while its corrective refetch is pending');
    assert(releaseHeldReply); releaseHeldReply();
    await (await discardReload).text();
    await waitExportsEnabled(page);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), 'PARTIAL_SCHOLARSHIP', 'Discard after an unconfirmed save refetches the committed award instead of exposing the stale previous value');
    assert.equal(awardRequests.length, 2, 'Discard resolves uncertainty through a read, not another save');

    await (await field(page, awardLabel)).select('LAPTOP');
    loseNextAwardResponse = true;
    await clickButton(page, saveAwardLabel);
    await waitText(page, 'Synthetic response lost after award saved. Retry saving.');
    assert.equal(awardRequests.length, 3);
    await clickButton(page, saveAwardLabel);
    await waitExportsEnabled(page);
    assert.equal(awardRequests.length, 4);
    assert.equal(awardRequests[3].idempotencyKey, awardRequests[2].idempotencyKey, 'An explicit retry reuses the idempotency key after an ambiguous response');
    assert.equal(awardRequests[3].expectedRevision, 2);
    assert.equal(awards.get('synthetic-merit-placement-34')?.revision, 3, 'A retry cannot create a duplicate award revision');
    assert.deepEqual((await visibleRows(page)).map(row => row.slice(0, 9)), scoresBeforeAward, 'Saving an award leaves visible ranks, scores and row order unchanged');
    await page.reload({ waitUntil: 'networkidle0' });
    await waitExportsEnabled(page);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), 'LAPTOP', 'A saved award survives a full page reload');
    await fill(page, 'Name or roll number', 'Other Class');
    const awardedPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'saved-manual-awards.pdf'));
    const awardedCsv = await download(page, 'Export CSV', '.csv', downloads, path.join(output, 'saved-manual-awards.csv'));
    const awardedRaw = pdfContents(awardedPdf, 'raw');
    assertSevenColumnPdf(awardedRaw);
    assertPdfCandidate(awardedRaw, ['1', 'SYN-M-34', 'Synthetic Other Class One', 'Synthetic Father 034', 'Synthetic Institute 034', '99.75%', 'Laptop']);
    assertPdfCandidate(awardedRaw, ['16', 'SYN-M-35', 'Synthetic Other Class Two', 'Synthetic Father 035', 'Synthetic Institute 035', '82.50%', '-']);
    assert.equal(csvRow(fs.readFileSync(awardedCsv, 'utf8'), 34).at(-2), 'Laptop');
    assert.equal(csvRow(fs.readFileSync(awardedCsv, 'utf8'), 35).at(-2), '');
    assert.equal(awardRequests.length, 4, 'Reloading, searching and exporting a saved decision make no additional writes');
    await screenshot(page, path.join(output, 'desktop-saved-manual-award.png'));
    const saved = awards.get('synthetic-merit-placement-34')!;
    awards.set('synthetic-merit-placement-34', { ...saved, id: 'synthetic-external-award-4', revision: 4,
      awardCode: 'CASH_PRIZE_5000', actorName: 'Synthetic Concurrent Administrator' });
    await (await field(page, awardLabel)).select('PARTIAL_SCHOLARSHIP');
    await clickButton(page, saveAwardLabel);
    await waitText(page, 'Another administrator saved a newer award. Reload current awards before saving.');
    assert.equal(awardRequests.length, 5);
    assert.equal(awardRequests[4].expectedRevision, 3);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), 'PARTIAL_SCHOLARSHIP', 'A 409 keeps the unsaved choice available for review');
    assert.equal(awards.get('synthetic-merit-placement-34')?.awardCode, 'CASH_PRIZE_5000', 'A stale save never overwrites the other administrator');
    assert(await buttonDisabled(page, 'Download PDF') && await buttonDisabled(page, 'Export CSV'));
    await clickButton(page, 'Reload current awards');
    await waitExportsEnabled(page);
    assert.equal(await (await field(page, awardLabel)).evaluate(element => element.value), 'CASH_PRIZE_5000');
    assert.equal(awardRequests.length, 5, 'Reloading current awards discards the draft without a write');
    assert((await visibleRows(page))[0][0].endsWith('#1') && (await visibleRows(page))[0][7] === '99.75');
    await (await field(page, awardLabel)).select('');
    await clickButton(page, saveAwardLabel);
    await waitExportsEnabled(page);
    assert.equal(awardRequests.length, 6);
    assert.equal(awardRequests[5].expectedRevision, 4);
    assert.equal(awardRequests[5].awardCode, null);
    assert.equal(awards.get('synthetic-merit-placement-34')?.revision, 5);
    const clearedPdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'cleared-manual-award.pdf'));
    assertPdfCandidate(pdfContents(clearedPdf, 'raw'), ['1', 'SYN-M-34', 'Synthetic Other Class One', 'Synthetic Father 034', 'Synthetic Institute 034', '99.75%', '-']);
    await (await field(page, 'Award for Synthetic Other Class Two')).select('EDUCATIONAL_VOUCHER');
    await clickButton(page, 'Save award for Synthetic Other Class Two');
    await waitExportsEnabled(page);
    assert.equal(awards.get('synthetic-merit-placement-35')?.awardCode, 'EDUCATIONAL_VOUCHER');
    const assistancePdf = await download(page, 'Download PDF', '.pdf', downloads, path.join(output, 'manual-award-any-category.pdf'));
    assertPdfCandidate(pdfContents(assistancePdf, 'raw'), ['16', 'SYN-M-35', 'Synthetic Other Class Two', 'Synthetic Father 035', 'Synthetic Institute 035', '82.50%', 'Educational Voucher']);
    user.role = 'ADMIN';
    await page.reload({ waitUntil: 'networkidle0' });
    await waitText(page, 'Only a Super Admin may assign or clear awards.');
    assert(await page.evaluate(() => !Array.from(document.querySelectorAll('select,button')).some(element => {
      const label = element.getAttribute('aria-label') ?? '';
      return label.startsWith('Award for ') || label.startsWith('Save award for ');
    })), 'Ordinary admins cannot edit awards');
    assert.equal(awardRequests.length, 7);
    assert.deepEqual(errors, []);
    assert.equal(JSON.stringify(records), originalRecords, 'Read-only sorting and downloads do not mutate source marks or ranks');
    assert(methods.every(method => method === 'GET' || method === 'PUT') && methods.filter(method => method === 'PUT').length === awardRequests.length, 'Only explicit award saves issue mutation requests');
    console.log('INTERVIEW_MERIT_BROWSER_PASS: server overall and separate-class ranks, shared ties, grouping switches, class/search rank preservation, grouped/global sorts across pagination and PDF/CSV, exact seven-column PDF with identity and combined percentage, custom repeated title and filename, finite top-ranked membership before sorting, custom/preset counts and explicit cutoff-tie inclusion, full-score CSV, legacy fallback, all-row downloads, manual award save/retry/reload/409/discard/clear, unconfirmed-save revert/discard refetch safeguards, no automatic awards or score changes, desktop/mobile, delayed/failed/retried class requests');
  } catch (error) {
    if (reviewPage && !reviewPage.isClosed()) {
      await screenshot(reviewPage, path.join(output, 'failure-state.png')).catch(() => undefined);
      console.error('SYNTHETIC_MERIT_FAILURE_STATE:', (await reviewPage.evaluate(() => document.body.innerText).catch(() => 'No browser page available.')).slice(0, 10000));
    }
    throw error;
  } finally {
    releaseHeldReply?.();
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(downloads, { recursive: true, force: true });
  }
}

function candidate(number: number): MeritPreviewRow {
  return {
    placementId: 'synthetic-merit-placement-' + number, studentId: 'synthetic-merit-student-' + number,
    rollNumber: 'SYN-M-' + number, studentName: 'Synthetic Candidate ' + String(number).padStart(3, '0'),
    fatherName: 'Synthetic Father ' + String(number).padStart(3, '0'),
    institute: 'Synthetic Institute ' + String(number).padStart(3, '0'), scholarshipCategory: 'GENERAL_MERIT',
    className: 'Class 9th', panel: 1, batch: 1, rank: number <= 2 ? 1 : number,
    overallRank: number <= 2 ? 2 : number <= 14 ? number + 1 : number + 2,
    status: 'READY', assessmentStatus: 'SUBMITTED', issues: [],
    written: { marks: 100 - number, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL',
      reference: 'synthetic-final-' + number, revision: 'synthetic-final-revision', status: 'QUALIFIED' },
    totals: { written: (100 - number) * .6, interview: 17, extracurricular: number === 30 ? 0 : 8,
      academic: 4, personality: 4, total: number <= 2 ? 96 : 97 - number },
  };
}
const descending = (count: number) => Array.from({ length: count }, (_, index) => count - index);
const rolls = (text: string) => [...text.matchAll(/SYN-M-(\d+)\b/g)].map(match => Number(match[1]));
function csvRow(text: string, roll: number) {
  const line = text.split('\r\n').find(value => value.includes('"SYN-M-' + roll + '"'));
  assert(line, 'CSV row is present');
  return [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match => match[1].replaceAll('""', '"'));
}
function assertSevenColumnPdf(raw: string) {
  const text = raw.replace(/\s+/g, ' ');
  assert.match(text, /Merit Rank Roll No Name Father Name Institute Percentage Obtained Scholarship Category (?:#?\d+|Unranked|-) SYN-M-\d+\b/, 'Exactly seven table headings are followed by the first candidate row');
  assert.doesNotMatch(text, /Final written|Written\s*\/60|Interview\s*\/20|Activities\s*\/10|Academics\s*\/5|Personality\s*\/5|Total\s*\/100|Class\s*\/\s*(?:overall\s*)?rank/i, 'No additional score, readiness or class column appears');
  assert.doesNotMatch(text, /Readiness|Scoring:|written exam 60\s*\+|P\d+\s*\/\s*B\d+|P = panel|B = batch/i, 'The compact PDF omits readiness, component formulas and panel/batch metadata');
}
function assertPdfCandidate(raw: string, fields: [string, string, string, string, string, string, string]) {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rank = fields[0] === '-' ? '(?:Unranked|-)' : '#?' + escape(fields[0]);
  const expected = new RegExp('(?:^|\\s)' + rank + '\\s+' + fields.slice(1).map(escape).join('\\s+') + '(?:\\s|$)');
  assert.match(raw.replace(/\s+/g, ' ').trim(), expected, 'PDF row contains exactly the requested rank, identity, percentage and scholarship values');
}
function pdfContents(filename: string, mode: 'layout' | 'raw' = 'layout') {
  assert.equal(fs.readFileSync(filename).subarray(0, 5).toString('ascii'), '%PDF-');
  return execFileSync('pdftotext', ['-' + mode, filename, '-'], { encoding: 'utf8' });
}
async function field(page: Page, label: string): Promise<ElementHandle<HTMLInputElement & HTMLSelectElement>> {
  const handle = await page.evaluateHandle(name => Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select'))
    .find(el => el.getAttribute('aria-label') === name || Array.from(el.labels ?? []).some(item =>
      item.querySelector('span')?.textContent?.trim() === name || item.textContent?.trim() === name)), label);
  const element = handle.asElement(); assert(element, 'Field missing: ' + label);
  return element as ElementHandle<HTMLInputElement & HTMLSelectElement>;
}
async function fill(page: Page, label: string, value: string) {
  const element = await field(page, label);
  await element.click(); await page.keyboard.down('Control');
  try { await page.keyboard.press('a'); } finally { await page.keyboard.up('Control'); }
  await element.press('Backspace'); if (value) await element.type(value);
}
async function clickButton(page: Page, label: string) {
  await page.evaluate(text => {
    const button = Array.from(document.querySelectorAll('button')).find(el => el.getAttribute('aria-label') === text || el.textContent?.trim() === text);
    if (!button || button.disabled) throw new Error('Button unavailable: ' + text);
    button.click();
  }, label);
}
async function buttonDisabled(page: Page, label: string) {
  return page.evaluate(text => {
    const button = Array.from(document.querySelectorAll('button')).find(el => el.getAttribute('aria-label') === text || el.textContent?.trim() === text);
    if (!button) throw new Error('Button missing: ' + text);
    return button.disabled;
  }, label);
}
async function visibleRows(page: Page) {
  return page.$$eval('section[aria-label="Private provisional merit preview"] tbody tr', rows => rows.map(row =>
    Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '')));
}
async function waitText(page: Page, value: string) {
  await page.waitForFunction(text => document.body.textContent?.includes(text), {}, value);
}
async function waitExportsEnabled(page: Page) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Export CSV' && !button.disabled));
}
async function screenshot(page: Page, filename: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    const animations = document.getAnimations().filter(animation => animation.playState === 'running' &&
      Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
    await Promise.allSettled(animations.map(animation => animation.finished));
  });
  await page.screenshot({ path: filename, fullPage: true });
}
async function download(page: Page, button: string, extension: string, directory: string, target: string, expectedFilename?: RegExp) {
  await clickButton(page, button);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const filename = fs.readdirSync(directory).find(value => value.endsWith(extension));
    if (filename) {
      if (expectedFilename) assert.match(filename, expectedFilename, 'The download filename identifies its merit grouping');
      const source = path.join(directory, filename);
      if (fs.statSync(source).size > 0) {
        fs.renameSync(source, target);
        if (extension === '.pdf') await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(item =>
          item.textContent?.trim() === 'Download PDF' && !item.disabled && item.getAttribute('aria-busy') !== 'true'));
        return target;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(button + ' did not produce a ' + extension + ' download');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

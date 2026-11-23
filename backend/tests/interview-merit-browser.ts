import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer, { ElementHandle, Page } from 'puppeteer';
import type { MeritPreview, MeritPreviewRow } from '../../src/components/admin/interviews/assessmentApi';

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
    if (url.pathname === '/api/interviews/synthetic-merit-round/assessment/merit') {
      const rows = records.filter(row => !url.searchParams.get('className') || row.className === url.searchParams.get('className'));
      const data: MeritPreview = {
        provisional: true, publicationEnabled: false, policyVersion: 'SESSION_V_2026_60_20_10_5_5_V1',
        rankMethod: 'SHARED_COMPETITION_WITHIN_CLASS', overallRankMethod: 'SHARED_COMPETITION_ALL_CLASSES',
        overallRankedCandidates: 32, classOptions: ['Class 9th', 'Class 10th'], rows,
        summary: { total: rows.length, ready: rows.filter(row => row.status === 'READY').length,
          incomplete: rows.filter(row => row.status === 'INCOMPLETE' || row.status === 'SOURCE_CHANGED').length,
          absent: rows.filter(row => row.status === 'ABSENT').length },
      };
      const response = legacyBackend ? { ...data, overallRankMethod: undefined, overallRankedCandidates: undefined,
        rows: rows.map(({ overallRank: _overallRank, ...row }) => row) } : data;
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
    assert.match(pdfRow(globalPdfText, 'Synthetic Candidate 001', 'Synthetic Candidate 002'), /#2\b/);
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
    assert.match(pdfRow(classPdfText, 'Synthetic Candidate 001', 'Synthetic Candidate 002'), /#1\b/);

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
    assert.match(pdfContents(searchedPdf), /#4\b/);
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
    assert.match(pdfText, /0\.00/, 'An explicit zero score is printed');
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
    assert.match(reviewText, /Unranked/i);
    const changedPdfRow = pdfRow(reviewText, 'Synthetic Source Changed Candidate', 'Synthetic Absent Candidate');
    assert.match(changedPdfRow, /90\.00/, 'The current final written mark remains visible');
    assert(!changedPdfRow.includes('48.00'), 'The obsolete weighted written contribution is omitted');
    assert(!pdfRow(reviewText, 'Synthetic Pending Candidate', 'Synthetic Source Changed Candidate').includes('99.00'), 'An unverified raw mark is omitted from the PDF final-written column');
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
    for (const label of ['Merit grouping', 'Class filter', 'Sort by', 'Order']) {
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
    legacyBackend = false;
    await clickButton(page, 'Recalculate preview');
    await waitExportsEnabled(page);
    assert(!await (await field(page, 'Merit grouping')).evaluate(element => element.querySelector<HTMLOptionElement>('option[value="overall"]')?.disabled));
    await (await field(page, 'Merit grouping')).select('overall');
    assert((await visibleRows(page))[1][0].endsWith('#16'), 'Overall ranking becomes available again when the server supports it');
    assert.deepEqual(errors, []);
    assert.equal(JSON.stringify(records), originalRecords, 'Read-only sorting and downloads do not mutate source marks or ranks');
    assert(methods.every(method => method === 'GET'), 'Merit review and export use read-only requests');
    console.log('INTERVIEW_MERIT_BROWSER_PASS: server overall and separate-class ranks, shared ties, grouping switches, class/search rank preservation, grouped and global ascending/descending order across pagination and PDF/CSV, grouping filenames/headers, legacy-backend fallback/recovery, numeric/natural sorts, all-row downloads, PDF branding/page counters, missing/zero separation, hidden unverified/stale scores, desktop/mobile, delayed/failed/retried class requests');
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
function pdfRow(text: string, name: string, nextName: string) {
  const start = text.indexOf(name), end = text.indexOf(nextName, start + name.length);
  assert(start >= 0 && end > start, 'PDF review rows can be located');
  return text.slice(start, end);
}
function pdfContents(filename: string) {
  assert.equal(fs.readFileSync(filename).subarray(0, 5).toString('ascii'), '%PDF-');
  return execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
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
    const button = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.trim() === text);
    if (!button || button.disabled) throw new Error('Button unavailable: ' + text);
    button.click();
  }, label);
}
async function buttonDisabled(page: Page, label: string) {
  return page.evaluate(text => {
    const button = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.trim() === text);
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
        return target;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(button + ' did not produce a ' + extension + ' download');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

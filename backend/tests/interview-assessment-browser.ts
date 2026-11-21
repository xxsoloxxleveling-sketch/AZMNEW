import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer, { ElementHandle, Page } from 'puppeteer';
import { calculateAssessmentTotals } from '../src/modules/interviews/assessment.calculation';
import type { AssessmentInput } from '../src/modules/interviews/assessment.schema';
import type {
  AssessmentPanel, AssessmentRosterRow, CandidateAssessment, SaveAssessmentInput,
} from '../../src/components/admin/interviews/assessmentApi';

// Synthetic HTTP fixtures exercise the production React views. Persistence and
// privilege enforcement are covered separately against PostgreSQL 17.
async function run() {
  const root = path.resolve(__dirname, '../..');
  const output = path.join(root, 'tmp/interview-assessment-ui');
  fs.mkdirSync(output, { recursive: true });
  const css = fs.readdirSync(path.join(root, 'dist/assets')).filter(name => name.endsWith('.css'))
    .map(name => fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n');
  const user = { id: 'synthetic-assessment-admin', name: 'Synthetic Administrator', email: 'fixture@test.invalid', role: 'SUPER_ADMIN' };
  const policyVersion = 'SESSION_V_2026_60_20_10_5_5_V1';
  const round = { id: 'synthetic-round', sessionRef: '2026-V', title: 'Synthetic Session V', eligibilityThreshold: 60,
    maximumMarks: 100, status: 'FINALIZED', revision: 1, createdAt: '2026-11-21T10:00:00.000Z', _count: { halls: 0, assignments: 0 } };
  const rows: AssessmentRosterRow[] = ['Synthetic Candidate One', 'Synthetic Candidate Two', 'Synthetic Pending Candidate'].map((studentName, index) => ({
    placementId: 'placement-' + index, studentId: 'candidate-' + index, rollNumber: 'SYNTHETIC-' + (index + 1),
    studentName, className: 'Class 9th', panel: 1, batch: 1, sequence: index + 1, slotTime: '09:' + String(index * 5).padStart(2, '0'), printedMarks: 80,
    written: { marks: index === 2 ? null : 80, maximumMarks: 100, isFinal: index !== 2,
      sourceType: index === 2 ? null : 'VERIFIED_MANUAL', reference: index === 2 ? null : 'SYNTHETIC-FINAL-' + index,
      revision: index === 2 ? null : 'synthetic-revision-1', status: index === 2 ? 'PENDING_VERIFICATION' : 'QUALIFIED' }, assessment: null,
  }));
  const panels: AssessmentPanel[] = [];
  const saved = new Map<string, CandidateAssessment>();
  const mutations: Array<{ path: string; body: SaveAssessmentInput & { idempotencyKey: string } }> = [];
  let rejectNextSave = false;
  const rosterRows = () => rows.map(row => ({ ...row, assessment: saved.get(row.placementId) ?? null }));
  const bundle = await build({
    stdin: { contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {AuthProvider} from './src/lib/authContext';
      import {setUser,setToken} from './src/lib/auth';
      import {AdminLayout} from './src/components/admin/layout/AdminLayout';
      import {InterviewManagementView} from './src/components/admin/interviews/InterviewManagementView';
      setToken('synthetic-assessment-token'); setUser(${JSON.stringify(user)});
      localStorage.setItem('azmaio.dashboard.appearance.v1:synthetic-assessment-admin','dark');
      createRoot(document.getElementById('root')).render(<AuthProvider><AdminLayout currentTab="interviews" onSelectTab={()=>{}} title="Interview management"><InterviewManagementView/></AdminLayout></AuthProvider>);`,
      resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' },
  });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const json = (data: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, message: data })); };
    try {
      if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return; }
      if (url.pathname === '/api/auth/me') { json({ user }); return; }
      if (url.pathname === '/api/interviews/rounds') { json([round]); return; }
      if (url.pathname.endsWith('/overview')) {
        json({ round, totalQualifiedCandidates: 2, allocatedCandidates: 3, fixedScheduleImported: true, fixedScheduledCandidates: 3,
          unassignedCandidates: 0, pendingVerificationCandidates: 1, lockedCandidates: 3, activeHallCount: 0, totalCapacity: 0,
          remainingSeats: 0, completionPercent: 100, eligibilitySourceStatus: 'PENDING_VERIFICATION', campaignCandidateCount: 3,
          notQualifiedCandidates: 0, reviewRequiredAssignments: 1, sourceMessage: 'Synthetic final results with one missing source.',
          campaignDataComplete: false, resultApprovalCurrent: false, resultApproval: null }); return;
      }
      if (url.pathname.endsWith('/halls')) { json([]); return; }
      if (url.pathname.endsWith('/fixed-schedule')) { json({ imported: true, total: 3, placements: [] }); return; }
      const apiRoot = '/api/interviews/' + round.id + '/assessment';
      if (url.pathname === '/api/interviews/' + round.id + '/candidates') {
        json({ sessionRef: '2026-V', verificationStatus: 'PENDING_VERIFICATION', eligibilitySourceStatus: 'PENDING_VERIFICATION',
          results: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }); return;
      }
      if (url.pathname === apiRoot + '/roster') {
        json({ roundId: round.id, policyVersion, panels, panelOptions: [1], batchOptions: [1], classOptions: ['Class 9th'],
          rows: rosterRows(), pagination: { page: 1, limit: 25, total: 3, totalPages: 1 } }); return;
      }
      if (url.pathname === apiRoot + '/panels') { json(panels); return; }
      if (url.pathname === apiRoot + '/merit') {
        const records = rosterRows().map(row => {
          const assessment = row.assessment;
          const ready = assessment?.status === 'SUBMITTED' && assessment.attendance === 'PRESENT';
          return { ...row, rank: ready ? 1 : null, status: ready ? 'READY' : 'INCOMPLETE',
            assessmentStatus: assessment?.status ?? 'NOT_STARTED', issues: ready ? [] : ['Assessment has not been submitted.'],
            totals: assessment?.totals ?? { written: row.written.isFinal ? 48 : null, interview: null, extracurricular: null, academic: null, personality: null, total: null } };
        });
        json({ provisional: true, publicationEnabled: false, policyVersion, rankMethod: 'SHARED_COMPETITION_WITHIN_CLASS', classOptions: ['Class 9th'],
          rows: records, summary: { total: 3, ready: records.filter(row => row.status === 'READY').length, incomplete: records.filter(row => row.status !== 'READY').length, absent: 0 } }); return;
      }
      if (req.method === 'PUT' && url.pathname === apiRoot + '/panels/1') {
        let raw = ''; for await (const part of req) raw += part;
        const body = JSON.parse(raw);
        panels.splice(0, panels.length, { id: 'synthetic-panel', panel: 1, revision: body.expectedRevision + 1,
          members: body.members.map((member: { name: string }, index: number) => ({ id: 'member-' + index, name: member.name, position: index + 1 })) });
        json(panels[0]); return;
      }
      const match = url.pathname.match(/\/assessment\/candidates\/(placement-\d)(?:\/(save|submit))?$/);
      if (match) {
        const row = rows.find(value => value.placementId === match[1]);
        assert(row);
        if (req.method === 'GET') {
          json({ ...row, panelConfiguration: panels[0] ?? null, assessment: saved.get(row.placementId) ?? null,
            hasSubmittedAssessment: saved.get(row.placementId)?.status === 'SUBMITTED' }); return;
        }
        let raw = ''; for await (const part of req) raw += part;
        const body = JSON.parse(raw);
        mutations.push({ path: url.pathname, body });
        if (rejectNextSave) { rejectNextSave = false; json('Another administrator saved a newer assessment. Reload before saving.', 409); return; }
        const record: CandidateAssessment = { id: 'synthetic-assessment-' + mutations.length, revision: body.expectedRevision + 1,
          status: match[2] === 'submit' ? 'SUBMITTED' : 'DRAFT', panelRevision: body.panelRevision, members: panels[0].members,
          attendance: body.attendance, scores: body.scores, extracurricular: body.extracurricular,
          extracurricularEvidence: body.extracurricularEvidence, extracurricularReviewed: body.extracurricularReviewed,
          academic: body.academic, academicEvidence: body.academicEvidence, academicReviewed: body.academicReviewed,
          notes: body.notes, reason: body.reason, actorName: user.name, createdAt: '2026-11-21T10:00:00.000Z',
          written: row.written, totals: calculateAssessmentTotals(body as AssessmentInput, row.written), issues: [] };
        saved.set(row.placementId, record); json(record); return;
      }
      if (url.pathname.startsWith('/api/')) { json('Unexpected synthetic API route: ' + url.pathname, 404); return; }
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
    } catch (error) { json(error instanceof Error ? error.message : 'Synthetic fixture failure', 500); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let reviewPage: Page | undefined;
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
    const page = await browser.newPage();
    reviewPage = page;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error.message)));
    page.on('dialog', dialog => void dialog.accept());
    await page.setViewport({ width: 1360, height: 1000 });
    await page.goto('http://127.0.0.1:' + address.port, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-dashboard-theme="dark"]');
    await clickButton(page, 'Marks & assessments');
    await page.waitForSelector('section[aria-label="Interview marks and assessments"]');
    await page.waitForSelector('[aria-label="Open assessment for Synthetic Candidate One"]');
    // A finalized timetable and an unrelated pending result do not disable scoring.
    await page.click('section[aria-label="Interview marks and assessments"] details summary');
    await (await field(page, 'Panel')).select('1');
    for (const [index, name] of ['Assessor Alpha', 'Assessor Beta', 'Assessor Gamma'].entries()) await fill(page, 'Member ' + (index + 1) + ' name', name);
    await fill(page, 'Setup / change reason', 'Synthetic appointed panel');
    await clickButton(page, 'Save panel members');
    await waitText(page, 'Panel 1 members saved.');
    assert.equal(panels[0].members.length, 3);
    await page.click('section[aria-label="Interview marks and assessments"] details summary');
    await page.click('[aria-label="Open assessment for Synthetic Candidate One"]');
    await page.waitForSelector('form[aria-label="Assessment for Synthetic Candidate One"]');
    assert(await page.$eval('form[aria-label="Assessment for Synthetic Candidate One"]', el => el.textContent?.includes('Manually verified · Final')));
    await clickButton(page, 'Save draft');
    await waitText(page, 'Draft saved for Synthetic Candidate One');
    assert.equal(saved.get('placement-0')?.scores[0].interview, null);
    assert.equal(saved.get('placement-0')?.totals.total, null);
    await (await field(page, 'Interview attendance')).select('PRESENT');
    for (const [index, name] of ['Assessor Alpha', 'Assessor Beta'].entries()) {
      await fill(page, name + ' interview marks out of 20', String(16 + index));
      await fill(page, name + ' personality marks out of 5', String(4 + index * .5));
    }
    assert(await buttonDisabled(page, 'Submit assessment'), 'Two scorecards cannot submit');
    await fill(page, 'Assessor Gamma interview marks out of 20', '18');
    await fill(page, 'Assessor Gamma personality marks out of 5', '5');
    await fill(page, 'Extracurricular activities /10', '8');
    await fill(page, 'Previous academic record /5', '4.25');
    await fill(page, 'Evidence / assessment-sheet reference', 'Synthetic activity certificate', 0);
    await fill(page, 'Evidence / assessment-sheet reference', 'Synthetic academic transcript', 1);
    await (await field(page, 'Evidence and score reviewed', 0)).click();
    await (await field(page, 'Evidence and score reviewed', 1)).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Unsaved calculation · provisional"]')?.textContent?.includes('81.75'));
    assert.equal(await buttonDisabled(page, 'Submit assessment'), false);
    await reviewScreenshot(page, path.join(output, 'desktop-assessment.png'));
    await clickButton(page, 'Submit assessment');
    await waitText(page, 'Assessment submitted for Synthetic Candidate One');
    assert.equal(saved.get('placement-0')?.totals.total, 81.75);
    assert.equal(saved.get('placement-0')?.status, 'SUBMITTED');
    assert.equal(mutations.at(-1)?.body.expectedRevision, 1);
    assert(mutations.at(-1)?.body.idempotencyKey);
    await clickButton(page, 'Merit preview');
    await page.waitForSelector('section[aria-label="Private provisional merit preview"]');
    await waitText(page, '81.75');
    const readiness = await page.$$eval('section[aria-label="Private provisional merit preview"] tbody tr', items => items.map(item => item.textContent));
    assert(readiness[0]?.includes('#1') && readiness[0]?.includes('Ready'));
    assert(readiness[1]?.includes('Unranked') && readiness[2]?.includes('Unranked'));
    await reviewScreenshot(page, path.join(output, 'desktop-merit-preview.png'));
    await clickButton(page, 'Marks & assessments');
    await page.waitForSelector('[aria-label="Open assessment for Synthetic Candidate Two"]');
    await page.click('[aria-label="Open assessment for Synthetic Candidate Two"]');
    await page.waitForSelector('form[aria-label="Assessment for Synthetic Candidate Two"]');
    await fill(page, 'Assessor Alpha interview marks out of 20', '12.5');
    rejectNextSave = true;
    await clickButton(page, 'Save draft');
    await waitText(page, 'Your unsaved entries remain in this form.');
    assert.equal(await (await field(page, 'Assessor Alpha interview marks out of 20')).evaluate(el => el.value), '12.5');
    assert(await buttonDisabled(page, 'Save draft'), 'Stale form cannot overwrite newer data');
    await clickButton(page, 'Load latest record');
    await page.waitForFunction(() => (document.querySelector('[aria-label="Assessor Alpha interview marks out of 20"]') as HTMLInputElement)?.value === '');
    await fill(page, 'Assessor Alpha interview marks out of 20', '0');
    await clickButton(page, 'Save draft & next');
    await page.waitForSelector('form[aria-label="Assessment for Synthetic Pending Candidate"]');
    assert.equal(saved.get('placement-1')?.scores[0].interview, 0, 'Explicit zero is saved distinctly from missing');
    assert.equal(saved.get('placement-1')?.scores[1].interview, null);
    assert(await buttonDisabled(page, 'Submit assessment'));
    await page.setViewport({ width: 390, height: 844 });
    await page.click('[aria-label="Open assessment for Synthetic Candidate One"]');
    await page.waitForSelector('form[aria-label="Assessment for Synthetic Candidate One"]');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile assessment layout must not overflow the page');
    const nameOverlaps = await page.evaluate(() => ['Assessor Alpha', 'Assessor Beta', 'Assessor Gamma'].filter(name => {
      const form = document.querySelector('form[aria-label="Assessment for Synthetic Candidate One"]')!;
      const label = Array.from(form.querySelectorAll('fieldset span')).find(el => el.textContent === name);
      const input = form.querySelector('input[aria-label="' + name + ' interview marks out of 20"]');
      if (!label || !input) return true;
      const text = document.createRange(); text.selectNodeContents(label);
      return Array.from(text.getClientRects()).some(rect => rect.right > input.getBoundingClientRect().left - 4);
    }));
    assert.deepEqual(nameOverlaps, [], 'Assessor names must stay readable beside their own mobile score fields');
    await reviewScreenshot(page, path.join(output, 'mobile-assessment.png'));
    await clickButton(page, 'Merit preview');
    await page.waitForSelector('section[aria-label="Private provisional merit preview"]');
    await waitText(page, '81.75');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile merit table must scroll within its container');
    await reviewScreenshot(page, path.join(output, 'mobile-merit-preview.png'));
    assert.deepEqual(errors, []);
    assert.equal(rows[0].written.marks, 80);
    console.log('INTERVIEW_ASSESSMENT_BROWSER_PASS: finalized timetable access, panel names, blank/zero distinction, three-member completion, 81.75 total, saved submit, private merit, conflict preservation, save-and-next, dark desktop and mobile');
  } catch (error) {
    if (reviewPage && !reviewPage.isClosed()) {
      await reviewScreenshot(reviewPage, path.join(output, 'failure-state.png')).catch(() => undefined);
      const visible = await reviewPage.evaluate(() => document.body.innerText).catch(() => 'No browser page available.');
      console.error('SYNTHETIC_BROWSER_FAILURE_STATE:', visible.slice(0,12000));
    }
    throw error;
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function field(page: Page, label: string, index = 0): Promise<ElementHandle<HTMLInputElement & HTMLSelectElement>> {
  const handle = await page.evaluateHandle((name, position) => Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,textarea,select'))
    .filter(el => el.getAttribute('aria-label') === name || Array.from(el.labels ?? []).some(item => item.textContent?.trim() === name))[position], label, index);
  const element = handle.asElement(); assert(element, 'Field missing: ' + label);
  return element as ElementHandle<HTMLInputElement & HTMLSelectElement>;
}
async function fill(page: Page, label: string, text: string, index = 0) {
  const element = await field(page, label, index);
  await element.click();
  await page.keyboard.down('Control');
  try { await page.keyboard.press('a'); } finally { await page.keyboard.up('Control'); }
  await element.press('Backspace'); await element.type(text);
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
async function waitText(page: Page, text: string) {
  await page.waitForFunction(value => document.body.textContent?.includes(value), {}, text);
}
async function reviewScreenshot(page: Page, target: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.screenshot({ path: target, fullPage: true });
}
run().catch(error => { console.error(error); process.exitCode = 1; });

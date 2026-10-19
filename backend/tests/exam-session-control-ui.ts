import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
/** Uses the real authenticated routes and the caller's synthetic restricted-runtime database. */
export async function verifyExamControlUI() {
    const root = path.resolve(__dirname, '../..');
    const { default: attendanceRoutes } = await import('../src/modules/attendance/attendance.routes');
    const { default: hallRoutes } = await import('../src/modules/exam-halls/examHalls.routes');
    const { default: centerRoutes } = await import('../src/modules/test-centers/testCenters.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    const token = (userId: string, tokenVersion = 0) => signAccessToken({ userId, name: userId, email: userId + '@test.invalid', role: userId === 'SUPER_ADMIN_OTHER' ? 'SUPER_ADMIN' : userId, tokenVersion });
    const { prisma } = await import('../src/lib/prisma');
    await prisma.user.create({ data: { id: 'SUPER_ADMIN_OTHER', name: 'Synthetic second super admin', email: 'SUPER_ADMIN_OTHER@test.invalid', passwordHash: 'fixture', role: 'SUPER_ADMIN' } });
    const app = express();
    app.use(express.json());
    app.use('/api/attendance', attendanceRoutes);
    app.use('/api/exam-halls', hallRoutes);
    app.use('/api/test-centers', centerRoutes);
    const assets = path.join(root, 'dist/assets');
    const css = fs.readdirSync(assets).filter(n => n.endsWith('.css')).map(n => fs.readFileSync(path.join(assets, n), 'utf8')).join('\n');
    const entry = path.join(root, 'verification/exam-control-ui-entry.tsx');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {ExamSessionControl} from '../src/components/admin/attendance/ExamSessionControl';const actorId=new URLSearchParams(location.search).get('actor')||'SUPER_ADMIN';createRoot(document.getElementById('root')).render(<ExamSessionControl key={actorId} actorId={actorId}/>);`);
    const { build } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
    const { default: react } = await import(pathToFileURL(path.join(root, 'node_modules/@vitejs/plugin-react/dist/index.js')).href);
    const bundled = await build({ configFile: false, root, plugins: [react()], esbuild: { jsxDev: false }, build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'ExamControlFixture' }, rollupOptions: { output: { inlineDynamicImports: true } } }, define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_API_URL': 'window.location.origin' } });
    const bundleCode = (Array.isArray(bundled) ? bundled[0] : bundled).output.find((file: any) => file.type === 'chunk' && file.isEntry).code;
    app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="mx-auto max-w-7xl p-4"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`));
    app.get('/fixture.js', (_req, res) => res.type('js').send(bundleCode));
    app.use(errorHandler);
    const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const result = app.listen(0, '127.0.0.1', () => resolve(result)); });
    const address = server.address();
    assert(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    const request = (url: string, role: string, body?: unknown, version = 0) => fetch(origin + url, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token(role, version), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let browser: any;
    let checks = 0;
    try {
        for (const role of ['ADMIN', 'TEACHER', 'ACCOUNTANT']) {
            const response = await request('/api/attendance/control/preview', role, { action: 'FREEZE', testCenterId: 'A', businessDate: '2026-11-15' });
            assert.equal(response.status, 403);
            checks++;
        }
        assert.equal((await request('/api/attendance/control/preview', 'SUPER_ADMIN', { action: 'FREEZE', testCenterId: 'A', businessDate: '2026-11-15' }, 3)).status, 401);
        checks++;
        assert.equal((await request('/api/attendance/reset/confirm', 'SUPER_ADMIN', {})).status, 410);
        checks++;
        const output = path.resolve(process.env.EXAM_CONTROL_QA_DIR || path.join(root, 'verification/exam-control'));
        fs.mkdirSync(output, { recursive: true });
        browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e: any) => errors.push(e.message));
        await page.evaluateOnNewDocument((tokens: Record<string, string>) => { const actor = new URLSearchParams(location.search).get('actor') || 'SUPER_ADMIN'; localStorage.setItem('jps_access_token', tokens[actor]); }, { SUPER_ADMIN: token('SUPER_ADMIN'), SUPER_ADMIN_OTHER: token('SUPER_ADMIN_OTHER') });
        async function click(text: string) { const button = await page.evaluateHandle((label: string) => Array.from(document.querySelectorAll('button')).find(e => e.textContent?.trim() === label), text); assert(await button.asElement(), `Button ${text} exists`); await button.asElement()!.click(); }
        await page.setViewport({ width: 1440, height: 1000 });
        await page.goto(origin, { waitUntil: 'networkidle0' });
        try {
            await page.waitForFunction(() => document.body.textContent?.includes('Placements editable'));
        }
        catch (e) {
            console.error('Synthetic UI errors', errors, 'Body:', await page.$eval('body', (el: any) => el.innerText));
            throw e;
        }
        assert(await page.evaluate(() => document.body.textContent?.includes('PRE_OPEN')));
        checks++;
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        checks++;
        await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
        await click('Freeze placements');
        await click('Review impact');
        await page.waitForSelector('[role="dialog"] textarea');
        const phrase = await page.$eval('[role="dialog"] input[autocomplete="off"]', (el: any) => el.closest('label').textContent.replace(/^Type /, ''));
        await page.type('[role="dialog"] textarea', 'Synthetic browser freeze verification');
        await page.type('[role="dialog"] input[autocomplete="off"]', phrase);
        assert(await page.evaluate(() => document.querySelector('[role="dialog"]')!.contains(document.activeElement)));
        checks++;
        await page.screenshot({ path: path.join(output, 'freeze-review.png'), fullPage: true });
        // Drop the committed confirmation response, then reload. The UI must recover the same receipt.
        let dropped = false;
        let abortNextConfirmation = false;
        let capturePreview: ((request: any) => void) | null = null;
        const confirmations: { key: string; body: string }[] = [];
        await page.setRequestInterception(true);
        page.on('request', async (req: any) => {
            if (capturePreview && req.url().endsWith('/api/attendance/control/preview')) {
                const capture = capturePreview;
                capturePreview = null;
                capture(req); // The regression explicitly releases this reviewed request.
                return;
            }
            if (req.url().endsWith('/api/attendance/control/confirm')) {
                confirmations.push({ key: req.headers()['idempotency-key'], body: req.postData() });
                if (abortNextConfirmation) {
                    abortNextConfirmation = false;
                    await req.abort('failed');
                    return;
                }
            }
            if (!dropped && req.url().endsWith('/api/attendance/control/confirm')) {
            dropped = true;
            await fetch(req.url(), { method: req.method(), headers: { Authorization: 'Bearer ' + token('SUPER_ADMIN'), 'Content-Type': 'application/json', 'Idempotency-Key': req.headers()['idempotency-key'] }, body: req.postData() });
            await req.abort('failed');
        }
        else
            await req.continue(); });
        const submit = await page.evaluateHandle(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find(e => e.textContent?.trim() === 'Freeze placements'));
        await submit.asElement()!.click();
        await page.waitForFunction(() => document.body.textContent?.includes('Check operation status'));
        const firstActorPending = await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v2:SUPER_ADMIN'));
        assert(firstActorPending, 'Unresolved confirmation is stored for its authenticated actor');
        await page.evaluate((value: string) => sessionStorage.setItem('azm.exam-control.pending.v1', value), firstActorPending);
        await page.goto(origin + '?actor=SUPER_ADMIN_OTHER', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.body.textContent?.includes('Placements frozen'));
        assert.equal(await page.$('[aria-label="Unresolved operation"]'), null, "Another authenticated super admin is not blocked by this actor's request");
        assert.equal(await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v2:SUPER_ADMIN')), firstActorPending);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v1')), firstActorPending);
        checks++; // Account switching keeps another actor's unresolved operation without applying it to the new actor.
        // Simulate a pending request retained by the previous UI version and recover it only for its signed actor.
        await page.evaluate(() => sessionStorage.removeItem('azm.exam-control.pending.v2:SUPER_ADMIN'));
        await page.goto(origin, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.body.textContent?.includes('Resolve the submitted operation first'));
        checks++;
        await click('Check operation status');
        await page.waitForFunction(() => !document.body.textContent?.includes('Resolve the submitted operation first') && document.body.textContent?.includes('Placements frozen'));
        assert.equal(await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v1')), null, 'The resolved legacy request is cleared only by its actor');
        checks++;
        await page.screenshot({ path: path.join(output, 'recovered-frozen.png'), fullPage: true });
        await click('Unfreeze placements');
        await click('Review impact');
        await page.waitForSelector('[role="dialog"] textarea');
        const unfreezePhrase = await page.$eval('[role="dialog"] input[autocomplete="off"]', (el: any) => el.closest('label').textContent.replace(/^Type /, ''));
        await page.type('[role="dialog"] textarea', 'Synthetic browser unfreeze verification');
        await page.type('[role="dialog"] input[autocomplete="off"]', unfreezePhrase);
        const confirm = await page.evaluateHandle(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find(e => e.textContent?.trim() === 'Unfreeze placements'));
        await confirm.asElement()!.click();
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]') && document.body.textContent?.includes('Placements editable'));
        checks++;
        await page.setViewport({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        checks++;
        const checkboxes = await page.$$('table input[type="checkbox"]');
        assert(checkboxes.length > 0);
        await checkboxes[0].click();
        await click('Reset to pre-open');
        await click('Review impact');
        await page.waitForSelector('[role="dialog"] textarea');
        assert(await page.evaluate(() => document.body.textContent?.includes('Replacement state')));
        await page.screenshot({ path: path.join(output, 'mobile-reset-review.png'), fullPage: true });
        await page.keyboard.press('Escape');
        assert.equal(await page.$('[role="dialog"]'), null);
        checks++;
        // These regressions exercise actual destructive confirmations through the UI.
        // Requests are real authenticated routes against the isolated fixture database.
        async function data(url: string, body?: unknown, headers: Record<string, string> = {}) {
            const response = await fetch(origin + url, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { Authorization: 'Bearer ' + token('SUPER_ADMIN'), 'Content-Type': 'application/json', ...headers },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            });
            const payload = await response.json();
            assert(response.ok, `${url}: ${response.status} ${JSON.stringify(payload)}`);
            return payload.data ?? payload;
        }
        const state = () => data('/api/attendance/control/current?testCenterId=A&businessDate=2026-11-15');
        async function clickDialog(label: string) {
            const handle = await page.evaluateHandle((text: string) => Array.from(document.querySelectorAll('[role="dialog"] button')).find(e => e.textContent?.trim() === text), label);
            assert(await handle.asElement(), `Dialog button ${label} exists`);
            await handle.asElement()!.click();
        }
        async function fillConfirmation(reason: string) {
            await page.waitForSelector('[role="dialog"] textarea');
            const text = await page.$eval('[role="dialog"] input[autocomplete="off"]', (el: any) => el.closest('label').textContent.replace(/^Type /, ''));
            await page.type('[role="dialog"] textarea', reason);
            await page.type('[role="dialog"] input[autocomplete="off"]', text);
        }
        async function clickRow(hallId: string, sessionId: string | null, label: string) {
            const handle = await page.evaluateHandle((input: any) => {
                const row = Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-hall-id]')).find(e => e.dataset.hallId === input.hallId && (e.dataset.sessionId || null) === input.sessionId);
                return row && Array.from(row.querySelectorAll('button')).find(e => e.textContent?.trim() === input.label);
            }, { hallId, sessionId, label });
            assert(await handle.asElement(), `Hall ${hallId}: ${label} exists`);
            await handle.asElement()!.click();
        }
        async function selectOnly(sessionId: string) {
            await page.waitForFunction((id: string) => !!document.querySelector(`tr[data-session-id="${id}"] input[type="checkbox"]`) && !document.body.textContent?.includes('Loading current examination state'), {}, sessionId);
            await page.evaluate((id: string) => {
                for (const row of document.querySelectorAll<HTMLTableRowElement>('tr[data-session-id]')) {
                    const input = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
                    if (input && input.checked !== (row.dataset.sessionId === id)) input.click();
                }
            }, sessionId);
        }
        async function openIfNeeded(hallId: string, attempt: any) {
            if (attempt.status === 'PRE_OPEN') {
                await clickRow(hallId, attempt.id, 'Open');
            } else if (attempt.status === 'CLOSED') {
                await clickRow(hallId, attempt.id, 'Reopen and keep progress');
                await page.type('[role="dialog"] textarea', 'Synthetic browser examination reopening');
                await page.type('[role="dialog"] input[autocomplete="off"]', 'REOPEN SESSION');
                await clickDialog('Reopen and keep progress');
            }
            await page.waitForFunction((id: string) => document.querySelector(`tr[data-session-id="${id}"]`)?.textContent?.includes('Close, keep unmarked'), {}, attempt.id);
        }
        const initial = await state();
        const hall = initial.halls.find((h: any) => h.current && h.assignedCount > 0 && h.current.status !== 'CANCELLED' &&
            !initial.legacyResults.some((student: any) => student.sessionIds.includes(h.current.id)));
        assert(hall, 'At least one current allocated synthetic Hall without ambiguous legacy results is available');
        await openIfNeeded(hall.id, hall.current);
        const historicalId = hall.current.id;
        const cancellation = await data(`/api/attendance/sessions/${historicalId}/cancel/preview`, { purgeAttendance: false });
        await data(`/api/attendance/sessions/${historicalId}/cancel/confirm`, {
            challenge: cancellation.challenge,
            reason: 'Synthetic cancelled-only history fixture',
            confirmationText: 'CANCEL SESSION',
        }, { 'Idempotency-Key': randomUUID() });
        await click('Refresh');
        await page.waitForFunction((id: string) => Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-hall-id]')).some(row =>
            row.dataset.hallId === id && !row.dataset.sessionId && row.textContent?.includes('Prepare session')), {}, hall.id);
        assert((await state()).halls.find((h: any) => h.id === hall.id).canPrepare);
        await clickRow(hall.id, null, 'Prepare session');
        await page.waitForFunction((id: string) => Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-hall-id]')).some(row =>
            row.dataset.hallId === id && row.dataset.sessionId && row.textContent?.includes('PRE_OPEN')), {}, hall.id);
        checks++; // Existing history must not hide Prepare when no current attempt exists.

        let current = (await state()).halls.find((h: any) => h.id === hall.id).current;
        await openIfNeeded(hall.id, current);
        let detail = await data(`/api/attendance/sessions/${current.id}`);
        const unmarked = detail.roster.find((student: any) => student.status === 'NOT_MARKED');
        assert(unmarked, 'Freshly opened fixture has an unmarked candidate');
        await data(`/api/attendance/sessions/${current.id}/mark`, { studentId: unmarked.studentId, status: 'PRESENT', revision: detail.session.revision });
        await click('Refresh');
        await selectOnly(current.id);
        await click('Reset to pre-open');
        await clickDialog('Review impact');
        await fillConfirmation('Synthetic real destructive reset with unresolved response');
        const priorConfirmations = confirmations.length;
        abortNextConfirmation = true;
        await clickDialog('Delete progress and reset to pre-open');
        await page.waitForFunction(() => {
            const region = document.querySelector('[aria-label="Unresolved operation"]');
            return region && Array.from(region.querySelectorAll<HTMLButtonElement>('button')).some(b => b.textContent === 'Check operation status' && !b.disabled);
        });
        const originalPending = await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v2:SUPER_ADMIN'));
        assert(originalPending);
        await click('Check operation status');
        await page.waitForFunction(() => document.body.textContent?.includes('The outcome remains unresolved'));
        assert.equal(await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Discard'))), false);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v2:SUPER_ADMIN')), originalPending);
        checks++; // Missing receipt is nonterminal: no discard or fresh request key.
        await click('Retry same request');
        await page.waitForFunction(() => !document.querySelector('[aria-label="Unresolved operation"]') && !document.body.textContent?.includes('Loading current examination state'));
        assert.deepEqual(confirmations[priorConfirmations + 1], confirmations[priorConfirmations]);
        const resetOldId = current.id;
        const resetOldRevision = detail.session.revision;
        current = (await state()).halls.find((h: any) => h.id === hall.id).current;
        assert.notEqual(current.id, resetOldId);
        assert.equal(current.status, 'PRE_OPEN');
        assert.equal(current.marked, 0);
        assert.equal((await request(`/api/attendance/sessions/${resetOldId}`, 'SUPER_ADMIN')).status, 404);
        detail = await data(`/api/attendance/sessions/${current.id}`);
        assert.equal(detail.roster.length, 0);
        assert.equal(detail.stats.markedCount, 0);
        assert(detail.stats.expectedCount > 0, 'Reset retained current allocations');
        checks++; // A browser-confirmed reset actually deletes progress and creates PRE_OPEN.
        assert.equal((await request('/api/attendance/sessions', 'SUPER_ADMIN', { examHallId: hall.id, sessionId: resetOldId, revision: resetOldRevision })).status, 409);
        assert.equal((await state()).halls.find((h: any) => h.id === hall.id).current.status, 'PRE_OPEN');
        checks++; // Stale Open must not open the replacement the operator has not selected.

        await selectOnly(current.id);
        await click('Delete session…');
        await page.$eval('[role="dialog"]', (dialog: Element) => {
            const label = Array.from(dialog.querySelectorAll('label')).find(e => e.textContent?.includes('Include entire logical Hall/exam session'));
            (label?.querySelector('input') as HTMLInputElement).click();
        });
        const previewWait = new Promise<any>(resolve => { capturePreview = resolve; });
        await clickDialog('Review impact');
        const held = await previewWait;
        await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[role="dialog"] input,[role="dialog"] select,[role="dialog"] textarea')).every(input => input.disabled));
        const draft = await page.$eval('[role="dialog"]', (dialog: Element) => {
            const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'));
            const replace = Array.from(dialog.querySelectorAll('label')).find(e => e.textContent?.includes('Create fresh PRE_OPEN replacement'))?.querySelector('input') as HTMLInputElement;
            const before = replace.checked;
            replace.click(); // A user click while Review is pending must have no effect.
            return { allDisabled: inputs.every(input => input.disabled), before, after: replace.checked };
        });
        assert.deepEqual(draft, { allDisabled: true, before: true, after: true });
        await held.continue();
        await page.waitForSelector('[role="dialog"] textarea');
        assert(await page.$eval('[role="dialog"]', (dialog: Element) => Array.from(dialog.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Delete session and create fresh')));
        assert(await page.$eval('[role="dialog"]', (dialog: Element) => Array.from(dialog.querySelectorAll('dl > div')).some(e => e.querySelector('dt')?.textContent === 'Replacement state' && e.querySelector('dd')?.textContent === 'PRE_OPEN')));
        checks++; // Delayed preview cannot change the reviewed replacement choice.
        const deletedIds = [historicalId, current.id];
        await fillConfirmation('Synthetic browser full lineage deletion confirmation');
        await clickDialog('Delete session and create fresh');
        await page.waitForFunction(() => !document.querySelector('[aria-label="Unresolved operation"]') && !document.querySelector('[role="dialog"]') && !document.body.textContent?.includes('Loading current examination state'));
        const freshHall = (await state()).halls.find((h: any) => h.id === hall.id);
        assert.equal(freshHall.attempts.length, 1);
        assert.equal(freshHall.current.status, 'PRE_OPEN');
        assert.equal(freshHall.current.marked, 0);
        assert.equal(freshHall.assignedCount, 0);
        for (const id of deletedIds) assert.equal((await request(`/api/attendance/sessions/${id}`, 'SUPER_ADMIN')).status, 404);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('azm.exam-control.pending.v2:SUPER_ADMIN')), null);
        checks++; // Full-lineage deletion is real and clears only reviewed allocations.
        assert.deepEqual(errors, []);
        checks++;
        console.log(`PASS ${checks} authenticated HTTP/browser checks; synthetic screenshots: ${output}`);
    }
    finally {
        await browser?.close();
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
}

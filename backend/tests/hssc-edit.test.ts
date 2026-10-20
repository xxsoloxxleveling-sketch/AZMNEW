import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

/** Actual edit form -> actual API. Only the private object store is synthetic. */
export async function exerciseAdminEdits(apiBase: string, token: string, cases: Array<{ id: string; group?: string; partial?: boolean; intervene?: () => Promise<void> }>) {
  assert(['localhost', '127.0.0.1'].includes(new URL(apiBase).hostname));
  const root = path.resolve(__dirname, '../..');
  const output = path.join(root, 'tmp/hssc-flow-20261020');
  fs.mkdirSync(output, { recursive: true });
  const image = path.join(output, 'synthetic-edit-photo.png');
  fs.writeFileSync(image, await sharp({ create: { width: 80, height: 100, channels: 3, background: '#185b9d' } }).png().toBuffer());
  const bundle = await build({ stdin: { contents: `import React from'react';import{createRoot}from'react-dom/client';import{AdminWalkInModal}from'./src/components/admin/students/AdminWalkInModal';
    fetch('/fixture-student').then(r=>r.json()).then(student=>createRoot(document.getElementById('root')).render(<AdminWalkInModal isOpen mode="edit" studentToEdit={student} onSuccess={()=>{window.saved=true}} onClose={()=>{}}/>));`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' } });
  const css = fs.readdirSync(path.join(root, 'dist/assets')).filter(n => n.endsWith('.css')).map(n => fs.readFileSync(path.join(root, 'dist/assets', n), 'utf8')).join('\n');
  let candidate: any, partial = false, failNext = false;
  const writes: Array<{ path: string; body: any; status: number }> = [];
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  const server = createServer(async (req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
    if (req.url === '/fixture-student') { const current = await (await fetch(apiBase + '/api/students/' + candidate.id, { headers })).json() as any; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(current.data)); }
    if (req.url?.startsWith('/api/')) {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      const binary = req.url.includes('upload-document-binary');
      const body = binary ? { docType: req.headers['x-document-type'] } : raw.length ? JSON.parse(raw.toString()) : {};
      if (partial && failNext && body.docType === 'bform') { failNext = false; res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ success: false, error: { message: 'Synthetic storage unavailable' } })); }
      const forwarded = { ...headers, 'Content-Type': String(req.headers['content-type'] || 'application/json'),
        ...(binary ? Object.fromEntries(['x-candidate-key', 'x-document-type', 'x-file-name'].map(key => [key, String(req.headers[key])])) : {}) };
      const response = await fetch(apiBase + req.url, { method: req.method, headers: forwarded, ...(raw.length ? { body: raw } : {}) });
      if (req.method !== 'GET') writes.push({ path: req.url, body, status: response.status });
      res.statusCode = response.status; res.setHeader('Content-Type', 'application/json'); return res.end(await response.text());
    }
    res.setHeader('Content-Type', 'text/html'); res.end(`<html><head><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 });
    await page.evaluateOnNewDocument(token => localStorage.setItem('jps_access_token', token), token);
    await page.setRequestInterception(true); page.on('request', request => { if (request.url().includes('/api/')) void request.continue({ url: `http://127.0.0.1:${address.port}` + new URL(request.url()).pathname + new URL(request.url()).search }); else void request.continue(); });
    for (const [i, test] of cases.entries()) {
      candidate = (await (await fetch(apiBase + '/api/students/' + test.id, { headers })).json() as any).data;
      partial = !!test.partial; failNext = partial; writes.length = 0;
      await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle0' });
      const parentMobile = '0300111000' + i;
      await page.$eval('input[name="parentMobile"]', (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, parentMobile);
      if (test.group) {
        await page.select('#admin-study-group', test.group);
        await page.evaluate(() => { const label = [...document.querySelectorAll('label')].find(el => el.textContent?.includes('Confirmation / source')); const input = label!.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Synthetic current admission evidence'); input.dispatchEvent(new Event('input', { bubbles: true })); });
      }
      await (await page.$('input[type="file"][aria-label="Student photo"]'))!.uploadFile(image);
      if (partial) await (await page.$('input[type="file"][aria-label="Student B-Form / CNIC"]'))!.uploadFile(image);
      if (test.intervene) await test.intervene();
      await page.$eval('form', form => (form as HTMLFormElement).requestSubmit());
      if (test.intervene) {
        await page.waitForFunction(() => document.body.textContent?.includes('This student changed'));
        assert.equal(await page.$eval('input[name="parentMobile"]', el => (el as HTMLInputElement).value), parentMobile);
        assert.equal(await page.$eval('#admin-study-group', el => (el as HTMLSelectElement).value), test.group);
        assert.equal(writes.filter(w => w.path.includes('upload-document')).length, 0);
        assert.equal(writes.filter(w => w.status === 409).length, 1);
        await page.screenshot({ path: path.join(output, 'edit-conflict.png') });
        continue;
      }
      if (partial) {
        await page.waitForFunction(() => document.body.textContent?.includes('Student details saved.'));
        assert(await page.$eval('input[name="parentMobile"]', el => el.matches(':disabled')));
        assert.equal(writes.filter(w => w.body.docType === 'photo').length, 1);
        await page.screenshot({ path: path.join(output, 'edit-partial-upload.png') });
        await page.$eval('form', form => (form as HTMLFormElement).requestSubmit());
      }
      await page.waitForFunction(() => (window as any).saved === true).catch(async error => {
        console.error('Edit fixture diagnostics', await page.evaluate(() => ({ alerts: [...document.querySelectorAll('[role="alert"]')].map(e => e.textContent), invalid: [...document.querySelectorAll(':invalid')].map((e: any) => ({ name: e.name, value: e.value, message: e.validationMessage })) })), writes.map(w => ({ path: w.path, status: w.status })));
        await page.screenshot({ path: path.join(output, 'edit-failure.png') }); throw error;
      });
      assert.equal(writes.filter(w => w.path === '/api/students/' + test.id && w.status === 200).length, 1, 'Do not resubmit the saved profile');
      assert.equal(writes.filter(w => w.body.docType === 'photo').length, 1, 'Never repeat a confirmed photo upload');
      const detail = (await (await fetch(apiBase + '/api/students/' + test.id, { headers })).json() as any).data;
      assert.equal(detail.parentMobile, parentMobile); if (test.group) assert.equal(detail.hsscGroup, test.group);
      assert(detail.uploadedDocuments.photo.checksumSha256);
      await page.reload({ waitUntil: 'networkidle0' });
      assert.equal(await page.$eval('input[name="parentMobile"]', el => (el as HTMLInputElement).value), parentMobile);
    }
    console.log('PASS actual edit form/API: HSSC correction + photo, non-HSSC contact + photo, partial upload retry without repeated writes, intervening staff edit protected');
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

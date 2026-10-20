import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

// Exercise the real React form and HTTP serialization, without a production API.
export async function captureAdminRequests(apiBase?: string, token?: string) {
  if (apiBase) assert(['localhost', '127.0.0.1'].includes(new URL(apiBase).hostname), 'Synthetic loopback API only');
  const repo = path.resolve(__dirname, '../..');
  const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
    import{AdminWalkInModal}from'./src/components/admin/students/AdminWalkInModal';
    createRoot(document.getElementById('root')).render(<AdminWalkInModal isOpen onClose={()=>{}} onSuccess={()=>{}}/>);`,
    resolveDir: repo, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' } });
  const bodies: any[] = [];
  const created: any[] = [];
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.end();
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
    if (req.url?.startsWith('/api/')) {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const payload = raw ? JSON.parse(raw) : {};
      if (req.url.endsWith('/admin-register')) bodies.push(payload);
      if (apiBase) {
        const response = await fetch(apiBase + req.url, { method: req.method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, ...(raw ? { body: raw } : {}) });
        const body = await response.json();
        if (req.url.endsWith('/admin-register')) created.push(body.data);
        res.statusCode = response.status; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(body));
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, data: req.url.includes('?') ? { students: [] } : { ...payload, id: 'synthetic', applicationNo: 'SYNTHETIC-1' } }));
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    // Route the actual API abstraction to this fixture server, regardless of its build defaults.
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('/api/')) void request.continue({ url: `http://127.0.0.1:${address.port}` + new URL(request.url()).pathname + new URL(request.url()).search });
      else void request.continue();
    });
    for (const [index, [grade, group]] of [['1st Year', 'Pre-Engineering'], ['2nd Year', 'ICS']].entries()) {
      await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle0' });
      for (const [name, value] of Object.entries({ fullName: 'Synthetic Candidate', fatherName: 'Synthetic Guardian', cnicOrBForm: `00000-000000${index}-0`, dateOfBirth: '2008-01-01', parentMobile: '03001234567', address: 'Synthetic Address', schoolName: 'Synthetic College', boardOrUniversity: 'BISE' })) {
        await page.$eval(`input[name="${name}"]`, (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
          setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
      }
      const selectByLabel = async (label: string, value: string) => {
        const id = await page.evaluate(label => { document.getElementById('fixture-select')?.removeAttribute('id'); const found = [...document.querySelectorAll('label')].find(el => el.textContent?.toLowerCase().includes(label.toLowerCase())); const el = found?.control || found?.querySelector('select'); if (!el) throw new Error('Missing ' + label); el.id = 'fixture-select'; return el.id; }, label);
        await page.select('#' + id, value);
      };
      await selectByLabel('Applying for class', grade);
      await selectByLabel('group', group);
      await page.evaluate(() => { const el = [...document.querySelectorAll('label')].find(el => el.textContent?.includes('Save with missing documents'))?.querySelector('input'); (el as HTMLInputElement)?.click(); });
      await page.evaluate(() => { (document.querySelector('form') as HTMLFormElement).requestSubmit(); });
      await page.waitForFunction(() => document.body.textContent?.includes('has been added'));
      const body = bodies.at(-1);
      console.log('Serialized admin request:', JSON.stringify({ currentClass: body.currentClass, hsscGroup: body.hsscGroup, hasGroup: Object.hasOwn(body, 'hsscGroup') }));
      assert.equal(body.hsscGroup, group, `${grade}: selected group must survive the serialized form request`);
    }
    console.log('PASS: actual admin create requests preserve both year selections');
    return { bodies, created };
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
if (require.main === module) captureAdminRequests().catch(error => { console.error(error); process.exitCode = 1; });

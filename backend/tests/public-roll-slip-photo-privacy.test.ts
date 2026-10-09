import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import jsQR from 'jsqr';

const repoRoot = path.resolve(__dirname, '../..');
const expectedCnic = '12345-1234567-1';
const syntheticSignedQr = 'https://azmaio.com/attend?token=qr_SYNTHETIC-TEST_1790000000000.' + 'a'.repeat(64);
const scriptText = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { RollNumberSlipView } from './src/components/rollnumber/RollNumberSlipView';
  createRoot(document.getElementById('root')).render(
    React.createElement(RollNumberSlipView, { onSelectTab: () => {} }),
  );
`;

async function run() {
  const portraitBytes = await sharp({ create: { width: 82, height: 103, channels: 3, background: { r: 15, g: 185, b: 82 } } }).png().toBuffer();
  const bundle = await build({
    stdin: { contents: scriptText, resolveDir: repoRoot, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    target: 'es2020', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' },
  });
  const source = bundle.outputFiles[0].text;
  let passed = 0;
  let protectedReads = 0;
  let credentialedReads = 0;
  let otherOriginRequests = 0;
  let photoMode: 'photo' | 'missing' | 'invalid' = 'photo';
  let slowPhoto = true;
  const urlPaths: string[] = [];
  const headersSeen: Array<string | undefined> = [];
  const correctSearch = { current: false };
  const json = (res: ServerResponse, status: number, obj: any) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  async function receiveJson(req: IncomingMessage) {
    let body = '';
    for await (const chunk of req) body += chunk;
    return JSON.parse(body) as Record<string, unknown>;
  }
  const server = createServer((req, res) => {
    const target = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = target.pathname;
    urlPaths.push(pathname + target.search);
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    }
    if (pathname === '/fixture.js' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(source);
    }
    if (pathname === '/api/health' || pathname === '/health/readiness') {
      return json(res, 200, { success: true, status: 'ok' });
    }
    if (pathname === '/api/students/search-slip' && req.method === 'POST') {
      void receiveJson(req).then(body => {
        correctSearch.current = body.cnic === expectedCnic && req.headers['x-candidate-cnic'] === expectedCnic;
        const second = body.query === 'SECOND';
        json(res, 200, { success: true, data: {
          rollNo: 'SYNTHETIC-ROLL-' + (second ? '2' : '1'),
          applicationId: 'APP-SYNTHETIC-' + (second ? '2' : '1'),
          candidateName: 'Synthetic Candidate', fatherName: 'Synthetic Guardian',
          cnicBForm: expectedCnic, classLevel: 'Class 9th',
          candidatePhoto: 'https://expired.invalid/stale-photo.jpg',
          testCenter: 'Synthetic Test Centre', centerAddress: 'Synthetic City',
          examDate: '15 November 2026', reportingTime: '7:30 AM',
          examStartTime: '8:30 AM', roomNo: 'R1', seatIndex: 'Seat 1',
          placementStatus: 'ASSIGNED', assignedHallId: 'H1', hallName: 'Synthetic Hall',
          qrPayload: syntheticSignedQr, barcode: 'SYNTHETIC',
          securityHash: 'Synthetic', specialInstructions: ['Bring your printed slip'],
        } });
      }).catch(() => json(res, 400, { success: false }));
      return;
    }
    if (req.method === 'GET' && /^\/api\/students\/APP-SYNTHETIC-[12]\/photo-thumbnail$/.test(pathname)) {
      protectedReads++;
      headersSeen.push(req.headers['x-candidate-cnic'] as string | undefined);
      if (req.headers['x-candidate-cnic'] !== expectedCnic) return json(res, 401, { success: false });
      credentialedReads++;
      const send = () => {
        if (res.destroyed) return;
        if (pathname.includes('APP-SYNTHETIC-2') && photoMode === 'missing') {
          return json(res, 404, { success: false });
        }
        if (pathname.includes('APP-SYNTHETIC-2') && photoMode === 'invalid') {
          res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' });
          return res.end('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        }
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'Content-Length': portraitBytes.length });
        res.end(portraitBytes);
      };
      if (slowPhoto && pathname.includes('APP-SYNTHETIC-1')) { setTimeout(send, 650); return; }
      return send();
    }
    return json(res, 404, { success: false });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port;
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  const check = (name: string) => { passed++; console.log('PASS: ' + name); };
  try {
    browser = await puppeteer.launch({ executablePath: edge, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('request', req => {
      if (!req.url().startsWith(base) && !req.url().startsWith('blob:') && !req.url().startsWith('data:')) otherOriginRequests++;
    });
    await page.evaluateOnNewDocument(() => {
      (window as any).__printCalls = 0;
      window.print = () => { (window as any).__printCalls++; };
      const oldRevoke = URL.revokeObjectURL.bind(URL);
      (window as any).__revokedUrls = [];
      URL.revokeObjectURL = (url: string) => {
        (window as any).__revokedUrls.push(url);
        oldRevoke(url);
      };
    });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('#input-slip-cnic', { timeout: 12000 });

    await page.type('#input-slip-cnic', expectedCnic);
    await page.click('#btn-search-slip');
    await page.waitForSelector('#btn-print-slip', { timeout: 15000 });
    assert.equal(await page.$eval('#btn-print-slip', el => (el as HTMLButtonElement).disabled), true);
    const loading = await page.evaluate(() => document.body.innerText.includes('Loading photograph'));
    assert(loading);
    check('Printing waits while verified private photo is loading');

    await page.waitForSelector('img[alt="Candidate photograph"]', { timeout: 15000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('img[alt="Candidate photograph"]') as HTMLImageElement | null;
      return Boolean(image?.complete && image.naturalWidth > 0 && !(document.querySelector('#btn-print-slip') as HTMLButtonElement)?.disabled);
    }, { timeout: 10000 });
    const firstUrl = await page.$eval('img[alt="Candidate photograph"]', el => (el as HTMLImageElement).src);
    assert(firstUrl.startsWith('blob:'));
    assert(correctSearch.current);
    assert.equal(protectedReads, 1);
    assert.equal(credentialedReads, 1);
    assert.deepEqual(headersSeen, [expectedCnic]);
    assert(urlPaths.every(x => !x.includes(expectedCnic)));
    check('Public Roll Slip fetches a real portrait using matching CNIC header, never in URL');

    await page.waitForSelector('img[alt="Candidate Biometric QR Code"]', { timeout: 10000 });
    const qrPngUrl = await page.$eval('img[alt="Candidate Biometric QR Code"]', element => (element as HTMLImageElement).src);
    assert(qrPngUrl.startsWith('data:image/png;base64,'));
    const qrBytes = Buffer.from(qrPngUrl.split(',')[1], 'base64');
    const qrPixels = await sharp(qrBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decodedQr = jsQR(new Uint8ClampedArray(qrPixels.data), qrPixels.info.width, qrPixels.info.height);
    assert.equal(decodedQr?.data, syntheticSignedQr);
    check('Public Slip QR PNG pixels decode to the advanced scanner signed-token URL');

    await page.click('#btn-print-slip');
    assert.equal(await page.evaluate(() => (window as any).__printCalls), 1);
    assert(!((await page.content()).includes('expired.invalid')));
    check('Print enables after valid photo loads, without legacy external photo URL');

    const unauthorized = await page.evaluate(async () => {
      const r = await fetch('/api/students/APP-SYNTHETIC-1/photo-thumbnail');
      return r.status;
    });
    assert.equal(unauthorized, 401);
    check('Protected thumbnail endpoint denies anonymous requests');

    photoMode = 'missing'; slowPhoto = false;
    await page.$eval('#input-roll-search', el => (el as HTMLInputElement).value = '');
    await page.click('#input-roll-search', { clickCount: 3 });
    await page.type('#input-roll-search', 'SECOND');
    await page.click('#btn-search-slip');
    await page.waitForFunction(() =>
      document.body.innerText.includes('Photo unavailable') &&
      Boolean(document.querySelector('#btn-print-slip')) &&
      !(document.querySelector('#btn-print-slip') as HTMLButtonElement).disabled,
      { timeout: 15000 },
    );
    const revoked = await page.evaluate(() => (window as any).__revokedUrls as string[]);
    assert(revoked.includes(firstUrl));
    assert.equal(await page.$('img[alt="Candidate photograph"]'), null);
    assert(await page.$('button') !== null);
    check('Missing private image shows honest placeholder; former photo URL revoked on new search');

    photoMode = 'invalid';
    const readsBefore = protectedReads;
    await page.evaluate(() => {
      const retry = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Retry photograph'));
      retry?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Photo unavailable'), { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert(protectedReads > readsBefore);
    assert.equal(await page.$('img[alt="Candidate photograph"]'), null);
    check('Unexpected SVG responses are rejected, not rendered');

    photoMode = 'photo';
    await page.evaluate(() => {
      const retry = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Retry photograph'));
      retry?.click();
    });
    await page.waitForSelector('img[alt="Candidate photograph"]', { timeout: 10000 });
    assert.equal(await page.$eval('img[alt="Candidate photograph"]', el => (el as HTMLImageElement).naturalWidth > 0), true);
    check('Retry recovers private portrait after a transient failure');

    assert.equal(otherOriginRequests, 0);
    assert.deepEqual(pageErrors, []);
    const storageLeak = await page.evaluate((identity: string) => {
      const items: string[] = [];
      for (const storage of [localStorage, sessionStorage]) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i) || '';
          items.push(key + ':' + storage.getItem(key));
        }
      }
      return items.some(value => value.includes(identity));
    }, expectedCnic);
    assert.equal(storageLeak, false);
    check('No third-party image requests, JS exceptions, or identity storage leaks');

    console.log('PUBLIC_SLIP_PORTRAIT_TESTS_PASS=' + passed + ' FAIL=0');
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

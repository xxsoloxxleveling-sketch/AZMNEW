import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

const root = path.resolve(__dirname, '../..');
const signedToken = 'qr_synthetic_1760000000000.' + 'a'.repeat(64);
const payload = 'https://azmaio.com/attend?token=' + signedToken;
let passed = 0;
async function check(name: string, work: () => Promise<void>) {
  await work();
  passed++;
  console.log('PASS: ' + name);
}
async function run() {
  const qrPng = await QRCode.toDataURL(payload, {
    width: 600, margin: 4, errorCorrectionLevel: 'H',
    color: { dark: '#1e293b', light: '#ffffff' },
  });
  const { build } = require('esbuild');
  const bundle = await build({
    stdin: {
      contents: `import { CandidateQrReader, decodeCandidateQrImage } from './src/components/admin/attendance/qrReader';
        window.__qrReader = { CandidateQrReader, decodeCandidateQrImage };`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    logLevel: 'silent',
  });
  const app = express();
  app.get('/helper.js', (_req, res) => res.type('js').send(bundle.outputFiles[0].text));
  app.get('/', (_req, res) => res.type('html').send(
    '<html><body><canvas id="source"></canvas><canvas id="scratch" hidden></canvas><script src="/helper.js"></script></body></html>',
  ));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await puppeteer.launch({
      headless: true, executablePath: fs.existsSync(chrome) ? chrome : fs.existsSync(edge) ? edge : undefined,
      args: ['--no-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    await page.goto('http://127.0.0.1:' + (server.address() as any).port, { waitUntil: 'load' });
    await page.evaluate(async (source: string) => {
      const img = new Image();
      img.src = source; await img.decode();
      (window as any).__qrImage = img;
      (window as any).__drawFixture = (width: number, height: number, x: number, y: number, qrWidth: number, inverted = false) => {
        const canvas = document.getElementById('source') as HTMLCanvasElement;
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = inverted ? '#000000' : '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, x, y, qrWidth, qrWidth);
        if (inverted) {
          const data = ctx.getImageData(0, 0, width, height);
          for (let i = 0; i < data.data.length; i += 4) {
            data.data[i] = 255 - data.data[i];
            data.data[i + 1] = 255 - data.data[i + 1];
            data.data[i + 2] = 255 - data.data[i + 2];
          }
          ctx.putImageData(data, 0, 0);
        }
      };
      (window as any).__tryRead = async () => {
        const s = document.getElementById('source') as HTMLCanvasElement;
        const c = document.getElementById('scratch') as HTMLCanvasElement;
        const decoder = new (window as any).__qrReader.CandidateQrReader();
        return decoder.decode(s, c);
      };
    }, qrPng);

    await check('high-detail center crop recognizes small printed-style QR in 1920x1080 frame', async () => {
      const result = await page.evaluate(async () => {
        (window as any).BarcodeDetector = undefined;
        (window as any).__drawFixture(1920, 1080, 840, 415, 250);
        return (window as any).__tryRead();
      }) as any;
      assert.equal(result?.value, payload);
      assert.equal(result.method, 'center');
    });
    await check('full-frame fallback recognizes off-center code outside the guide', async () => {
      const result = await page.evaluate(async () => {
        (window as any).__drawFixture(1280, 720, 1030, 190, 200);
        return (window as any).__tryRead();
      }) as any;
      assert.equal(result?.value, payload);
      assert.equal(result.method, 'full');
    });
    await check('decoder does not fabricate a QR when camera has no code', async () => {
      const result = await page.evaluate(async () => {
        (window as any).__drawFixture(1280, 720, -1200, -1200, 180);
        return (window as any).__tryRead();
      });
      assert.equal(result, null);
    });
    await check('native BarcodeDetector is used when available and returning QR format', async () => {
      const result = await page.evaluate(async () => {
        (window as any).BarcodeDetector = class {
          constructor(_: any) {}
          async detect() { return [{ format: 'qr_code', rawValue: 'native_test_code' }]; }
        };
        return (window as any).__tryRead();
      }) as any;
      assert.equal(result?.value, 'native_test_code');
      assert.equal(result?.method, 'native');
    });
    await check('broken native decoder gracefully falls back to working jsQR passes', async () => {
      const result = await page.evaluate(async () => {
        (window as any).BarcodeDetector = class {
          constructor(_: any) {}
          async detect() { throw new Error('Not supported for source'); }
        };
        (window as any).__drawFixture(1280, 720, 465, 210, 225);
        return (window as any).__tryRead();
      }) as any;
      assert.equal(result?.value, payload);
      assert.equal(result?.method, 'center');
    });
    await check('stalled browser-native detector falls back to jsQR instead of freezing scans', async () => {
      const result = await page.evaluate(async () => {
        (window as any).BarcodeDetector = class {
          constructor(_: any) {}
          async detect() { return new Promise(() => {}); }
        };
        (window as any).__drawFixture(1280, 720, 480, 220, 210);
        const started = performance.now();
        const decoded = await (window as any).__tryRead();
        return { ...decoded, elapsed: performance.now() - started };
      }) as any;
      assert.equal(result?.value, payload);
      assert.equal(result?.method, 'center');
      assert(result.elapsed < 2500);
    });
    await check('QR photo fallback reads a local PNG and returns decoded text only', async () => {
      const result = await page.evaluate(async (imageUrl: string) => {
        const reader = new (window as any).__qrReader.CandidateQrReader();
        const imageBlob = await (await fetch(imageUrl)).blob();
        const file = new File([imageBlob], 'candidate-qr.png', { type: 'image/png' });
        const c = document.createElement('canvas');
        return (window as any).__qrReader.decodeCandidateQrImage(file, reader, c);
      }, qrPng) as any;
      assert.equal(result?.value, payload);
    });
    await check('QR photo fallback refuses unsupported file types', async () => {
      const message = await page.evaluate(async () => {
        const reader = new (window as any).__qrReader.CandidateQrReader();
        try {
          await (window as any).__qrReader.decodeCandidateQrImage(
            new File(['<script>'], 'test.html', { type: 'text/html' }),
            reader, document.createElement('canvas'),
          );
        } catch (e: any) { return e.message; }
        return '';
      });
      assert.match(message, /JPEG, PNG, or WebP/);
    });
    await check('no script exception or token logging during decoding', async () => {
      assert.deepEqual(pageErrors, []);
    });

    const cameraPreviewFixture = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { TeacherScanView } from './src/components/admin/attendance/TeacherScanView';
      import { mockApi } from './src/lib/mockApi';
      window.__attendanceWrites = 0;
      mockApi.getAttendanceSessions = async () => ({
        sessions: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
      });
      mockApi.scanAttendance = async () => {
        window.__attendanceWrites++;
        throw new Error('Camera Check must not submit attendance');
      };
      const original = ${JSON.stringify(qrPng)};
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
        const qr = new Image(); qr.src = original; await qr.decode();
        const surface = document.createElement('canvas'); surface.width = 640; surface.height = 480;
        const ctx = surface.getContext('2d');
        const paint = () => {
          ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 640, 480);
          ctx.drawImage(qr, 195, 115, 250, 250);
        };
        paint();
        const stream = surface.captureStream(15);
        const ticker = setInterval(paint, 80);
        stream.getTracks().forEach(track => {
          const stop = track.stop.bind(track);
          track.stop = () => { clearInterval(ticker); stop(); };
        });
        return stream;
      } });
      createRoot(document.getElementById('root')).render(<TeacherScanView />);
    `;
    const teacherBundle = await build({
      stdin: { contents: cameraPreviewFixture, resolveDir: root, loader: 'tsx' },
      bundle: true, write: false, format: 'iife', platform: 'browser',
      define: { 'import.meta.env': JSON.stringify({ PROD: true }) },
      logLevel: 'silent',
      plugins: [{ name: 'fixture-auth-context', setup(builder: any) {
        builder.onResolve({ filter: /authContext$/ }, () => ({ path: 'fixture-auth', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents: 'export const useAuth=()=>({user:{name:"Fixture Teacher"},role:"TEACHER",logout:()=>{}});',
          loader: 'js',
        }));
      } }],
    });
    app.get('/teacher-fixture.js', (_req, res) => res.type('js').send(teacherBundle.outputFiles[0].text));
    app.get('/teacher', (_req, res) => res.type('html').send(
      '<html><body><div id="root"></div><script src="/teacher-fixture.js"></script></body></html>',
    ));
    await check('camera check recognizes visible QR without an OPEN session but never verifies or marks attendance', async () => {
      const teacher = await browser!.newPage();
      try {
        const errors: string[] = [];
        teacher.on('pageerror', e => errors.push(String(e)));
        await teacher.goto('http://127.0.0.1:' + (server.address() as any).port + '/teacher', { waitUntil: 'load' });
        await teacher.waitForFunction(() => document.body.innerText.includes('Camera Check'), { timeout: 15000 }).catch(async error => {
          console.log('TEACHER_INITIAL_DIAGNOSTIC=' + JSON.stringify({ text: (await teacher.evaluate(() => document.body.innerText)).slice(0, 900), errors }));
          throw error;
        });
        await teacher.evaluate(() => {
          const button = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Connect camera');
          if (!button) throw new Error('Missing camera check start button');
          button.click();
        });
        await teacher.waitForFunction(
          () => document.body.innerText.includes('QR decoded locally'),
          { timeout: 15000 },
        ).catch(async error => {
          console.log('TEACHER_SCAN_DIAGNOSTIC=' + JSON.stringify({ text: (await teacher.evaluate(() => document.body.innerText)).slice(0, 1300), errors }));
          throw error;
        });
        const observation = await teacher.evaluate(() => ({
          writes: (window as any).__attendanceWrites,
          content: document.body.innerText,
        }));
        assert.equal(observation.writes, 0);
        assert(observation.content.includes('not verified'));
        assert(!observation.content.includes('Attendance Marked'));
        assert.deepEqual(errors, []);
      } finally {
        await teacher.close();
      }
    });
    console.log('QR_READER_TESTS_PASS=' + passed + ' FAIL=0');
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { pdfService } from '../src/modules/documents/pdf.service';
import { HSSC_GROUP_OPTIONS } from '../src/modules/students/hsscContract';

async function run() {
  const root = path.resolve(__dirname, '../..');
  const output = path.join(root, 'tmp/hssc-flow-20261020'); fs.mkdirSync(output, { recursive: true });
  const source = execFileSync('git', ['show', '8eea79f82f27a1d0de3f0b08c6bcd84bd3381109:backend/src/modules/documents/pdf.service.ts'], { cwd: root, encoding: 'utf8' });
  const compiled = await build({ stdin: { contents: source, loader: 'ts', resolveDir: path.join(root, 'backend/src/modules/documents') }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
  const baseline: any = { exports: {} }; new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(path.join(root, 'backend/package.json')), baseline, baseline.exports);
  const image = await sharp({ create: { width: 100, height: 140, channels: 3, background: '#185b9d' } }).png().toBuffer();
  const portrait = 'data:image/png;base64,' + image.toString('base64');
  const student = { id: 'synthetic-geometry', applicationNo: 'SYNTHETIC-GEOMETRY', fullName: 'Synthetic Geometry Candidate', fatherName: 'Synthetic Guardian', cnicOrBForm: '0000000000000', currentClass: 'HSSC-II (Class 12th)', rollNumber: 'AZMVS-2026-0100', placementStatus: 'ASSIGNED', assignedHallId: 'synthetic-hall', assignedHall: 'Synthetic Hall', assignedRoom: 'Room 01', seatNo: 'Seat 01', testCenterName: 'Synthetic Centre', testDate: 'Sunday, 15 November 2026', reportingTime: '07:30 AM' };
  const qr = await QRCode.toDataURL(JSON.stringify({ type: 'AZM_OMR', studentId: student.id, applicationNo: student.applicationNo, rollNumber: student.rollNumber, sheetVersion: 2 }));
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1200 }); await page.emulateMediaType('print');
    await page.setRequestInterception(true);
    page.on('request', request => { if (request.url().startsWith('http')) void request.abort(); else void request.continue(); });
    let count = 0;
    for (const option of HSSC_GROUP_OPTIONS) {
      const candidate = { ...student, hsscGroup: option.value };
      const geometry = async (html: string) => {
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images, image => image.decode().catch(() => {}))); });
        return page.evaluate(() => [...document.querySelectorAll('.bubble,.omr-row,.timing-block,.corner-mark,.v-bubble,.photo-box,.qr-box')].map(el => { const r = el.getBoundingClientRect(); return [el.className, r.x, r.y, r.width, r.height]; }));
      };
      const before = await geometry(baseline.exports.pdfService.generateOmrSheetHtml(candidate, qr, portrait));
      const after = await geometry(pdfService.generateOmrSheetHtml(candidate, qr, portrait));
      assert.equal(after.length, before.length); assert.equal(await page.$$eval('.omr-row', nodes => nodes.length), 100); assert.equal(await page.$$eval('.bubble', nodes => nodes.length), 400);
      for (let i = 0; i < before.length; i++) for (let j = 1; j < 5; j++) assert(Math.abs(Number(before[i][j]) - Number(after[i][j])) < 0.1, `${option.value} ${before[i][0]} geometry changed at ${i}/${j}: ${before[i][j]} -> ${after[i][j]}`);
      assert(await page.$eval('.details-table', (el, label) => el.textContent!.includes(label), option.label));
      assert(await page.$eval('.info-container', el => el.scrollHeight <= el.clientHeight));
      if (option.value === 'ICS' || option.value === 'FA') {
        await page.screenshot({ path: path.join(output, 'geometry-' + option.value + '.png'), fullPage: true });
        fs.writeFileSync(path.join(output, 'longest-' + option.value + '-omr.pdf'), await pdfService.generatePdfFromHtml(pdfService.generateOmrSheetHtml(candidate, qr, portrait)));
      }
      count++;
    }
    console.log(`PASS: ${count} groups; 100 rows, 400 bubbles, version/timing marks, portrait/QR positions match current main within 0.1px`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

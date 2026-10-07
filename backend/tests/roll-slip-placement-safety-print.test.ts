import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { pdfService } from '../src/modules/documents/pdf.service';

const stale = { id: 'synthetic', applicationNo: 'APP-TEST', assignedHallId: null,
  assignedHall: 'STALE-HALL', assignedRoom: 'STALE-ROOM', seatNo: 'STALE-SEAT',
  testCenterName: 'STALE-CENTER', registrationCentre: 'REGISTRATION-ONLY',
  testDate: 'STALE-DATE', reportingTime: 'STALE-TIME',
  officeUse: { testCentre: 'STALE-OFFICE', testDate: '2026-11-15', testReportingTime: 'STALE-OFFICE-TIME' } };
const pendingPdf = pdfService.generateRollSlipHtml(stale);
for (const marker of ['STALE-', 'REGISTRATION-ONLY', 'Hall A', 'Room 101', 'Seat # 01']) assert(!pendingPdf.includes(marker));
assert(pendingPdf.includes('To be assigned'));
assert(pendingPdf.includes('To be announced'));
const assigned = { ...stale, placementStatus: 'ASSIGNED', assignedHallId: 'real', assignedHall: 'Confirmed Hall',
  assignedRoom: 'Confirmed Room', seatNo: 'N-7', testCenterName: null, testDate: 'Confirmed date', reportingTime: '08:15 AM' };
const assignedPdf = pdfService.generateRollSlipHtml(assigned);
for (const marker of ['Confirmed Hall', 'Confirmed Room', 'N-7', 'Confirmed date', '08:15 AM', 'To be assigned']) assert(assignedPdf.includes(marker));
assert(!assignedPdf.includes('STALE-'));

let html = '', opened = 0;
const alerts: string[] = [];
const code = buildSync({ stdin: { contents: "import {printRollNumberSlip} from './src/lib/mockApi'; globalThis.printSlip = printRollNumberSlip;",
  resolveDir: path.resolve(__dirname, '../..'), loader: 'ts' }, bundle: true, write: false, platform: 'browser',
  define: { 'import.meta.env': JSON.stringify({ PROD: false, VITE_API_BASE_URL: 'http://127.0.0.1:1' }) } }).outputFiles[0].text;
const context: any = { window: { location: { hostname: 'localhost', origin: 'http://localhost' },
  open: () => { opened++; return { document: { open() {}, write(value: string) { html = value; }, close() {} } }; } },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, alert: (message: string) => alerts.push(message),
  console, setTimeout() {}, clearTimeout() {}, URL, Blob, AbortController, fetch: () => { throw Error('Network forbidden'); } };
vm.runInNewContext(code, context);
context.printSlip(stale);
for (const marker of ['STALE-', 'REGISTRATION-ONLY', 'Hall A', 'Room 101', 'Seat # 01']) assert(!html.includes(marker));
assert(html.includes('PROV-APP-TEST'));
assert(html.includes('To be assigned') && html.includes('To be announced'));
context.printSlip({ ...stale, rollNumber: 'ISSUED-001' });
assert.equal(opened, 1, 'Unassigned official fallback must not open a printable window');
assert(alerts.some(message => message.includes('PLACEMENT_PENDING')));
context.printSlip(assigned);
assert(html.includes('Confirmed Hall') && html.includes('Confirmed Room') && html.includes('N-7'));
console.log('PASS: Roll Slip PDF and client fallback reject stale fields and show truthful placement');

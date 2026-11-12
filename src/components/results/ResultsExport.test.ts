import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadResultsCsv, downloadResultsTableCsv, downloadResultsTableXlsx, downloadResultsXlsx } from './ResultsExport.ts';
import type { DemoStudentResult } from './ResultsTypes.ts';

const pendingDemoRow: DemoStudentResult = {
  id: 'demo-1', rollNumber: '000123', studentName: '=1+1, Fictional', className: 'Class 9',
  examinationId: 'exam-1', examinationName: 'Demo examination', obtainedMarks: null, maximumMarks: 100,
  percentage: null, correct: 0, wrong: 0, multiple: 0, blank: 0, uncertain: 2,
  status: 'Review Required', reviewReason: 'Uncertain answers need review',
};

async function captureDownload(action: () => void): Promise<Blob> {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  let downloaded: Blob | null = null;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ href: '', download: '', click() {} }) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout() {} } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => { downloaded = blob; return 'blob:demo'; } });
  try {
    action();
    const result = downloaded as Blob | null;
    if (!result) throw new Error('Download was not captured');
    return result;
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', previousCreateObjectUrl); else Reflect.deleteProperty(URL, 'createObjectURL');
  }
}

test('CSV export marks the file as demo, preserves zero-padded identifiers and escapes spreadsheet formulas', async () => {
  const blob = await captureDownload(() => downloadResultsCsv([pendingDemoRow]));
  const csv = await blob.text();
  assert.match(csv, /DEMO \/ NOT OFFICIAL/);
  assert.match(csv, /'000123/);
  assert.match(csv, /'=1\+1, Fictional/);
  assert.doesNotMatch(csv, /,"=1\+1/);
  assert.match(csv, /Review Required/);
  assert.match(csv, /,Demo examination,,100,,0,0,0,0,2,Review Required/); // pending marks and percentage are blank
});

test('Excel export creates an XLSX zip with typed blanks and safe text cells', async () => {
  const blob = await captureDownload(() => downloadResultsXlsx([pendingDemoRow]));
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  const workbookContents = new TextDecoder().decode(bytes);
  assert.match(workbookContents, /DEMO \/ NOT OFFICIAL/);
  assert.match(workbookContents, /000123/);
  assert.match(workbookContents, /&apos;=1\+1, Fictional/);
  assert.doesNotMatch(workbookContents, /<c r="E3"><v>0<\/v><\/c>/);
});

test('connected legacy CSV is page-scoped, unverified, formula-safe and keeps zero-padded roll numbers', async () => {
  const blob = await captureDownload(() => downloadResultsTableCsv(
    'UNVERIFIED LEGACY RECORDS — CURRENT PAGE ONLY',
    ['Roll number', 'Student', 'Legacy score', 'Maximum marks'],
    [['000123', '=2+2, Candidate', 72, null]],
    'legacy-page.csv',
  ));
  const csv = await blob.text();
  assert.match(csv, /CURRENT PAGE ONLY/);
  assert.match(csv, /'000123/);
  assert.match(csv, /'=2\+2, Candidate/);
  assert.match(csv, /,72,$/);
  assert.doesNotMatch(csv, /72,0/);
});

test('connected legacy XLSX preserves roll identifiers and leaves unavailable maximum marks blank', async () => {
  const blob = await captureDownload(() => downloadResultsTableXlsx(
    'UNVERIFIED LEGACY RECORDS — CURRENT PAGE ONLY',
    ['Roll number', 'Student', 'Legacy score', 'Maximum marks'],
    [['000123', '=2+2 Candidate', 72, null]],
    'legacy-page.xlsx',
  ));
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const workbookContents = new TextDecoder().decode(await blob.arrayBuffer());
  assert.match(workbookContents, /CURRENT PAGE ONLY/);
  assert.match(workbookContents, /000123/);
  assert.match(workbookContents, /&apos;=2\+2 Candidate/);
  assert.match(workbookContents, /<c r="D3"\/>/);
});

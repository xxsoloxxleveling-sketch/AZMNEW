import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Table } from 'jspdf-autotable';
import type { MeritPreviewRow } from './assessmentApi';
import { buildMeritPdf } from './meritPdf';
import type { MeritPdfOptions } from './meritPdf';

function candidate(index: number, overrides: Partial<MeritPreviewRow> = {}): MeritPreviewRow {
  return {
    placementId: 'synthetic-placement-' + index, studentId: 'synthetic-student-' + index,
    studentName: 'Synthetic Candidate ' + index, rollNumber: 'PDF-TEST-' + index, className: 'Class 9th',
    panel: 1, batch: 2, rank: index + 1, status: 'READY', assessmentStatus: 'SUBMITTED', issues: [],
    written: { marks: 80, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL', reference: 'synthetic-written', revision: 'synthetic-revision', status: 'QUALIFIED' },
    totals: { written: 48, interview: 17, extracurricular: 8, academic: 4.25, personality: 4.5, total: 81.75 },
    ...overrides,
  };
}
function options(rows: MeritPreviewRow[]): MeritPdfOptions {
  return {
    rows, roundTitle: 'Synthetic Session V', sessionRef: '2026-V', policyVersion: 'SYNTHETIC_60_20_10_5_5',
    filters: { className: '', readiness: '', search: '', sortLabel: 'Merit rank', direction: 'desc' },
    generatedAt: new Date('2026-11-23T10:30:00Z'), logoDataUrl: '',
  };
}
const table = (doc: Awaited<ReturnType<typeof buildMeritPdf>>) => (doc as typeof doc & { lastAutoTable: Table }).lastAutoTable;
const cell = (value: Table, row: number, column: number) => value.body[row].cells[column].text.join(' ');

describe('branded merit PDF data safeguards', () => {
  it('exports every supplied row in caller order across pages without changing class ranks or ties', async () => {
    const rows = Array.from({ length: 42 }, (_, index) => candidate(index));
    rows[0].rank = 3; rows[1].rank = 1; rows[2].rank = 1;
    const before = structuredClone(rows);
    const doc = await buildMeritPdf(options(rows));
    const rendered = table(doc);
    assert(doc.getNumberOfPages() > 1);
    assert.equal(rendered.body.length, 42);
    assert.match(cell(rendered, 0, 0), /#3$/);
    assert.match(cell(rendered, 1, 0), /#1$/);
    assert.match(cell(rendered, 2, 0), /#1$/);
    for (let index = 0; index < rows.length; index++) assert(cell(rendered, index, 1).includes('PDF-TEST-' + index));
    assert.deepEqual(rows, before);
  });

  it('retains zero scores, suppresses unverified written values, and never prints a blocked aggregate', async () => {
    const rows = [candidate(0), candidate(1, { rank: null, status: 'SOURCE_CHANGED' }), candidate(2, { rank: null, status: 'ABSENT' })];
    rows[0].totals.extracurricular = 0;
    rows[1].written = { ...rows[1].written, marks: 99, isFinal: false };
    rows[1].totals = { ...rows[1].totals, written: 59.4, total: 93.87 };
    rows[2].totals.total = 99.97;
    const rendered = table(await buildMeritPdf(options(rows)));
    assert.equal(cell(rendered, 0, 2), '80.00');
    assert.equal(cell(rendered, 0, 3), '48.00');
    assert.equal(cell(rendered, 0, 5), '0.00');
    assert.equal(cell(rendered, 1, 2), '-');
    assert.equal(cell(rendered, 1, 3), '-');
    assert.equal(cell(rendered, 1, 8), '-');
    assert.equal(cell(rendered, 2, 8), '-');
    assert.match(cell(rendered, 1, 0), /Unranked/);
    assert.match(cell(rendered, 1, 9), /Written unverified/);
  });

  it('preserves accented Latin names and normalises common smart punctuation', async () => {
    const rendered = table(await buildMeritPdf(options([candidate(0, { studentName: 'Jose\u0301 O’Neil–Zoë' })])));
    assert(cell(rendered, 0, 1).includes("José O'Neil-Zoë"));
  });

  it('shows a changed final written mark without presenting the old saved weighted contribution as current', async () => {
    const row = candidate(0, { rank: null, status: 'SOURCE_CHANGED' });
    row.written.marks = 90;
    row.totals.written = 48;
    const rendered = table(await buildMeritPdf(options([row])));
    assert.equal(cell(rendered, 0, 2), '90.00');
    assert.equal(cell(rendered, 0, 3), '-');
    assert.equal(cell(rendered, 0, 8), '-');
  });

  it('reports unsupported characters instead of generating corrupted candidate names', async () => {
    await assert.rejects(buildMeritPdf(options([candidate(0, { studentName: 'نام' })])), /cannot render some characters/);
  });

  it('handles empty filtered results and long filter metadata without losing table space', async () => {
    const long = options([]);
    long.roundTitle = 'Synthetic long round title '.repeat(30);
    long.filters.className = 'Synthetic class '.repeat(20);
    long.filters.search = 'Synthetic search '.repeat(30);
    const doc = await buildMeritPdf(long);
    assert.equal(doc.getNumberOfPages(), 1);
    assert.match(cell(table(doc), 0, 0), /No candidates match/);
    assert(table(doc).startPageNumber === 1);
  });
});

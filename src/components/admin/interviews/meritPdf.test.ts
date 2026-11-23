import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Table } from 'jspdf-autotable';
import type { MeritPreviewRow } from './assessmentApi';
import { buildMeritPdf } from './meritPdf';
import type { MeritPdfOptions } from './meritPdf';

const headings = ['Merit Rank', 'Roll No', 'Name', 'Father Name', 'Institute', 'Percentage Obtained', 'Scholarship Category'];
function candidate(index: number, overrides: Partial<MeritPreviewRow> = {}): MeritPreviewRow {
  return {
    placementId: 'synthetic-placement-' + index, studentId: 'synthetic-student-' + index,
    studentName: 'Synthetic Candidate ' + index, rollNumber: 'PDF-TEST-' + index, className: 'Class 9th',
    fatherName: 'Synthetic Father ' + index, institute: 'Synthetic Institute ' + index, scholarshipCategory: 'GENERAL_MERIT',
    panel: 1, batch: 2, rank: index + 1, overallRank: index + 1, status: 'READY', assessmentStatus: 'SUBMITTED', issues: [],
    written: { marks: 80, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL', reference: 'synthetic-written', revision: 'synthetic-revision', status: 'QUALIFIED' },
    totals: { written: 48, interview: 17, extracurricular: 8, academic: 4.25, personality: 4.5, total: 81.75 },
    ...overrides,
  };
}
function options(rows: MeritPreviewRow[]): MeritPdfOptions {
  return {
    rows, roundTitle: 'Synthetic Session V', sessionRef: '2026-V', policyVersion: 'SYNTHETIC_60_20_10_5_5', grouping: 'overall',
    filters: { className: '', readiness: '', search: '', sortLabel: 'Total marks', direction: 'desc' },
    generatedAt: new Date('2026-11-23T10:30:00Z'), logoDataUrl: '',
  };
}
const table = (doc: Awaited<ReturnType<typeof buildMeritPdf>>) => (doc as typeof doc & { lastAutoTable: Table }).lastAutoTable;
const cell = (value: Table, row: number, column: number) => value.body[row].cells[column].text.join(' ');
const header = (value: Table) => Object.values(value.head.at(-1)!.cells).map(item => item.text.join(' '));

describe('seven-column branded merit PDF', () => {
  it('prints only the seven requested columns in order with the exact candidate identity fields', async () => {
    const row = candidate(0, { fatherName: 'Synthetic Parent Exact Name', institute: 'Synthetic Exact School Name' });
    const rendered = table(await buildMeritPdf(options([row])));
    assert.equal(rendered.columns.length, 7);
    assert.deepEqual(header(rendered), headings);
    assert.deepEqual(Array.from({ length: 7 }, (_, index) => cell(rendered, 0, index)), [
      '1', 'PDF-TEST-0', 'Synthetic Candidate 0', 'Synthetic Parent Exact Name',
      'Synthetic Exact School Name', '81.75%', 'General Merit',
    ]);
    assert.equal(Object.keys(rendered.body[0].cells).length, 7);
  });

  it('exports all supplied rows across pages without changing order, selected overall ranks, or ties', async () => {
    const rows = Array.from({ length: 42 }, (_, index) => candidate(index));
    rows[0].overallRank = 3; rows[1].overallRank = 1; rows[2].overallRank = 1;
    rows[0].rank = 1; rows[1].rank = 1; rows[2].rank = 1;
    rows[1].className = 'Class 7th'; rows[2].className = 'Class 10th';
    const before = structuredClone(rows);
    const doc = await buildMeritPdf(options(rows));
    const rendered = table(doc);
    assert(doc.getNumberOfPages() > 1);
    assert.equal(rendered.body.length, 42);
    assert.deepEqual([cell(rendered, 0, 0), cell(rendered, 1, 0), cell(rendered, 2, 0)], ['3', '1', '1']);
    for (let index = 0; index < rows.length; index++) assert.equal(cell(rendered, index, 1), 'PDF-TEST-' + index);
    assert.deepEqual(rows, before);
  });

  it('uses a full-width class heading outside the same seven columns and retains original class ranks', async () => {
    const rows = [candidate(0, { rank: 1, overallRank: 7 }), candidate(1, { rank: 1, overallRank: 9 }), candidate(2, { rank: 3, overallRank: 12 })];
    const before = structuredClone(rows);
    const rendered = table(await buildMeritPdf({ ...options(rows), grouping: 'class' }));
    assert.deepEqual(header(rendered), headings);
    assert.equal(rendered.head[0].cells[0].colSpan, 7);
    assert.equal(rendered.head[0].cells[0].text.join(' '), 'Class: Class 9th');
    assert.deepEqual(rows.map((_, index) => cell(rendered, index, 0)), ['1', '1', '3']);
    assert.equal(rendered.columns.length, 7);
    assert.deepEqual(rows, before);
  });

  it('retains filtered overall rank gaps and never substitutes a class rank', async () => {
    const rows = [candidate(0, { rank: 1, overallRank: 4 }), candidate(1, { rank: 2, overallRank: 10 }), candidate(2, { rank: 3, overallRank: undefined })];
    const selected = options(rows); selected.filters.className = 'Class 9th';
    const rendered = table(await buildMeritPdf(selected));
    assert.deepEqual(rows.map((_, index) => cell(rendered, index, 0)), ['4', '10', '-']);
  });

  it('uses only ready combined totals as percentages and preserves zero distinctly from unavailable values', async () => {
    const rows = [candidate(0), candidate(1, { status: 'SOURCE_CHANGED' }), candidate(2, { status: 'ABSENT' }), candidate(3, { status: 'INCOMPLETE' }), candidate(4), candidate(5)];
    rows[1].totals.total = 93.87; rows[2].totals.total = 99.97; rows[3].totals.total = 82.5;
    rows[4].totals.total = 0; rows[5].totals.total = null;
    const rendered = table(await buildMeritPdf(options(rows)));
    assert.deepEqual(rows.map((_, index) => cell(rendered, index, 5)), ['81.75%', '-', '-', '-', '0.00%', '-']);
    assert.deepEqual([1, 2, 3].map(index => cell(rendered, index, 0)), ['-', '-', '-']);
    assert.notEqual(cell(rendered, 0, 5), '80.00%', 'The written test mark is not the combined percentage');
    assert.notEqual(cell(rendered, 0, 5), '48.00%', 'The weighted written contribution is not the combined percentage');
  });

  it('displays stored category labels and missing source fields without inventing identities or awards', async () => {
    const categories = ['GENERAL_MERIT', 'FINANCIALLY_NEEDY', 'ORPHAN', 'PERSON_WITH_DISABILITY'];
    const rows = categories.map((scholarshipCategory, index) => candidate(index, { scholarshipCategory }));
    rows.push(candidate(4, { fatherName: undefined, institute: '', scholarshipCategory: undefined, rollNumber: null }));
    const rendered = table(await buildMeritPdf(options(rows)));
    assert.deepEqual(rows.map((_, index) => cell(rendered, index, 6)), ['General Merit', 'Financially Needy', 'Orphan', 'Person with Disability', '-']);
    for (const column of [1, 3, 4, 6]) assert.equal(cell(rendered, 4, column), '-');
  });

  it('preserves accented identity fields and normalises common smart punctuation', async () => {
    const row = candidate(0, { studentName: 'Jose\u0301 O’Neil–Zoë', fatherName: 'René O’Hara', institute: 'Collège–St Mary’s' });
    const rendered = table(await buildMeritPdf(options([row])));
    assert.equal(cell(rendered, 0, 2), "José O'Neil-Zoë");
    assert.equal(cell(rendered, 0, 3), "René O'Hara");
    assert.equal(cell(rendered, 0, 4), "Collège-St Mary's");
  });

  it('reports unsupported text in every identity field instead of producing corrupted characters', async () => {
    for (const field of ['studentName', 'fatherName', 'institute', 'scholarshipCategory'] as const) {
      await assert.rejects(buildMeritPdf(options([candidate(0, { [field]: 'نام' })])), /cannot render some characters/);
    }
  });

  it('handles empty results and long session/class metadata without losing table space', async () => {
    const long = options([]);
    long.roundTitle = 'Synthetic long round title '.repeat(30);
    long.filters.className = 'Synthetic class '.repeat(20);
    const doc = await buildMeritPdf(long);
    assert.equal(doc.getNumberOfPages(), 1);
    assert.deepEqual(header(table(doc)), headings);
    assert.match(cell(table(doc), 0, 0), /No candidates match/);
    assert.equal(table(doc).body[0].cells[0].colSpan, 7);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MeritPreviewRow } from './assessmentApi.ts';
import { meritWrittenContribution, sortMeritRows } from './meritViewModel.ts';

function candidate(id: string, overrides: Partial<MeritPreviewRow> = {}): MeritPreviewRow {
  return {
    placementId: id, studentId: id, studentName: 'Synthetic ' + id,
    rollNumber: 'SYNTHETIC-' + id, className: 'Class 9th', panel: 1, batch: 1,
    rank: 1, status: 'READY', assessmentStatus: 'SUBMITTED', issues: [],
    written: { marks: 80, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL',
      reference: 'synthetic-exam', revision: 'synthetic-revision', status: 'QUALIFIED' },
    totals: { written: 48, interview: 17, extracurricular: 8, academic: 4.25, personality: 4.5, total: 81.75 },
    ...overrides,
  };
}

const ids = (rows: MeritPreviewRow[]) => rows.map(row => row.placementId);

describe('merit preview display ordering', () => {
  it('hides a changed draft contribution even while its status remains incomplete', () => {
    const row = candidate('draft', { status: 'INCOMPLETE', assessmentStatus: 'DRAFT', rank: null });
    row.written.marks = 90;
    row.totals.written = 48;
    assert.equal(meritWrittenContribution(row), null);
    row.written.marks = 99.99;
    row.totals.written = 59.99;
    assert.equal(meritWrittenContribution(row), 59.99, 'Server rounding to two decimals remains valid');
    row.written.maximumMarks = 0;
    assert.equal(meritWrittenContribution(row), null);
  });
  it('hides the saved weighted written mark after its final source changes', () => {
    const changed = candidate('changed', { rank: null, status: 'SOURCE_CHANGED' });
    changed.written.marks = 90;
    changed.totals.written = 48;
    assert.equal(meritWrittenContribution(changed), null, 'Old 80 x 0.6 cannot accompany the current final 90');
    assert.equal(changed.written.marks, 90);
    assert.equal(changed.totals.written, 48, 'Presentation must not rewrite the saved assessment');
  });

  it('retains a current weighted zero and suppresses unverified or missing written sources', () => {
    const row = candidate('zero');
    row.written.marks = 0; row.totals.written = 0;
    assert.equal(meritWrittenContribution(row), 0);
    row.written.isFinal = false;
    assert.equal(meritWrittenContribution(row), null);
    row.written.isFinal = true; row.written.marks = null;
    assert.equal(meritWrittenContribution(row), null);
    row.written.marks = 80; row.totals.written = Number.NaN;
    assert.equal(meritWrittenContribution(row), null);
    row.totals.written = 48;
    assert.equal(meritWrittenContribution(row), 48);
  });

  it('sorts numeric ranks both ways and keeps absent, incomplete and source-changed candidates last', () => {
    const rows = [candidate('third', { rank: 3 }), candidate('absent', { rank: null, status: 'ABSENT' }),
      candidate('first', { rank: 1 }), candidate('pending', { rank: null, status: 'INCOMPLETE' }),
      candidate('changed', { rank: 1, status: 'SOURCE_CHANGED' }), candidate('tenth', { rank: 10 })];
    assert.deepEqual(ids(sortMeritRows(rows, 'rank', 'asc')), ['first', 'third', 'tenth', 'absent', 'pending', 'changed']);
    assert.deepEqual(ids(sortMeritRows(rows, 'rank', 'desc')), ['tenth', 'third', 'first', 'absent', 'pending', 'changed']);
  });

  it('uses exact server ranks when total scores round to the same displayed value', () => {
    const rows = [candidate('lower', { rank: 2 }), candidate('higher', { rank: 1 })];
    assert.equal(rows[0].totals.total, rows[1].totals.total);
    assert.deepEqual(ids(sortMeritRows(rows, 'total', 'desc')), ['higher', 'lower']);
    assert.deepEqual(ids(sortMeritRows(rows, 'total', 'asc')), ['lower', 'higher']);
  });

  it('preserves shared competition ranks and the incoming order of true ties', () => {
    const rows = [candidate('tie-b', { rank: 1 }), candidate('third', { rank: 3 }), candidate('tie-a', { rank: 1 })];
    for (const field of ['rank', 'total'] as const) {
      const sorted = sortMeritRows(rows, field, field === 'rank' ? 'asc' : 'desc');
      assert.deepEqual(ids(sorted), ['tie-b', 'tie-a', 'third']);
      assert.deepEqual(sorted.map(row => row.rank), [1, 1, 3]);
    }
  });

  it('does not expose stale or unranked totals as sortable merit scores', () => {
    const stale = candidate('changed', { status: 'SOURCE_CHANGED', rank: null });
    stale.totals.total = 99;
    const missing = candidate('missing', { rank: 2 }); missing.totals.total = null;
    const rows = [stale, candidate('ready'), missing, candidate('unranked', { rank: null })];
    for (const direction of ['asc', 'desc'] as const) {
      assert.deepEqual(ids(sortMeritRows(rows, 'total', direction)), ['ready', 'changed', 'missing', 'unranked']);
    }
  });

  it('sorts final written marks numerically, preserves zero, and keeps missing or unverified marks last', () => {
    const row = (id: string, marks: number | null, isFinal = true) => {
      const value = candidate(id); value.written = { ...value.written, marks, isFinal }; return value;
    };
    const rows = [row('missing', null), row('ten', 10), row('zero', 0), row('unverified', 99, false),
      row('two', 2), row('invalid', Number.NaN), row('infinite', Number.POSITIVE_INFINITY)];
    assert.deepEqual(ids(sortMeritRows(rows, 'written', 'asc')), ['zero', 'two', 'ten', 'missing', 'unverified', 'invalid', 'infinite']);
    assert.deepEqual(ids(sortMeritRows(rows, 'written', 'desc')), ['ten', 'two', 'zero', 'missing', 'unverified', 'invalid', 'infinite']);
  });

  it('uses natural roll-number order with missing rolls last in either direction', () => {
    const rows = [candidate('ten', { rollNumber: 'AZM-10' }), candidate('missing', { rollNumber: null }),
      candidate('two', { rollNumber: 'AZM-2' }), candidate('blank', { rollNumber: '  ' })];
    assert.deepEqual(ids(sortMeritRows(rows, 'rollNumber', 'asc')), ['two', 'ten', 'missing', 'blank']);
    assert.deepEqual(ids(sortMeritRows(rows, 'rollNumber', 'desc')), ['ten', 'two', 'missing', 'blank']);
  });

  it('sorts names in either direction without using names as a merit tie-break', () => {
    const rows = [candidate('z', { studentName: 'Zara' }), candidate('a', { studentName: 'Ali' }),
      candidate('a2', { studentName: 'ali' })];
    assert.deepEqual(ids(sortMeritRows(rows, 'studentName', 'asc')), ['a', 'a2', 'z']);
    assert.deepEqual(ids(sortMeritRows(rows, 'studentName', 'desc')), ['z', 'a', 'a2']);
    assert.deepEqual(ids(sortMeritRows(rows, 'rank', 'asc')), ['z', 'a', 'a2']);
  });

  it('keeps classes separate in natural ascending order regardless of within-class direction', () => {
    const rows = [candidate('eleven-first', { className: 'Class 11th', rank: 1 }),
      candidate('seven-first', { className: 'Class 7th', rank: 1 }),
      candidate('eleven-third', { className: 'Class 11th', rank: 3 }),
      candidate('seven-third', { className: 'Class 7th', rank: 3 })];
    const sorted = sortMeritRows(rows, 'rank', 'desc');
    assert.deepEqual(ids(sorted), ['seven-third', 'seven-first', 'eleven-third', 'eleven-first']);
    assert.deepEqual(sorted.map(row => row.rank), [3, 1, 3, 1]);
  });

  it('does not combine class labels that compare equal under case-insensitive or numeric collation', () => {
    const rows = [candidate('alias-second', { className: 'class 9th', rank: 2 }),
      candidate('original-first', { className: 'Class 9th', rank: 1 }),
      candidate('alias-first', { className: 'class 9th', rank: 1 }),
      candidate('original-second', { className: 'Class 9th', rank: 2 })];
    const sorted = sortMeritRows(rows, 'rank', 'asc');
    assert.deepEqual(ids(sorted), ['original-first', 'original-second', 'alias-first', 'alias-second']);
    assert.deepEqual(sorted.map(row => row.rank), [1, 2, 1, 2]);
  });

  it('preserves the original row objects and never mutates input order or rank after filtering', () => {
    const rows = [candidate('third', { rank: 3 }), candidate('first', { rank: 1 })];
    const before = structuredClone(rows);
    const sorted = sortMeritRows(Object.freeze(rows), 'rank', 'asc');
    assert.deepEqual(rows, before);
    assert.notEqual(sorted, rows);
    assert.equal(sorted[0], rows[1]);
    assert.equal(sorted[1], rows[0]);
    assert.deepEqual(sortMeritRows(rows.filter(row => row.rank === 3), 'rank', 'asc').map(row => row.rank), [3]);
  });
});

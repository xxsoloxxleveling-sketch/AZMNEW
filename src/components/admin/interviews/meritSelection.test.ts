import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MeritPreviewRow } from './assessmentApi';
import { matchesMeritSchool, meritSchoolOptions, meritSchoolFilenamePart, parseMeritListLimit, selectMeritRows, sortMeritRows } from './meritViewModel';
import { meritAwardOptions, meritScholarshipLabel } from './meritAwards';

function candidate(id: number, overrides: Partial<MeritPreviewRow> = {}): MeritPreviewRow {
  return {
    placementId: String(id), studentId: 'student-' + id, studentName: 'Synthetic ' + id,
    rollNumber: 'SYNTHETIC-' + id, className: id % 2 ? 'Class 9th' : 'BS', panel: 1, batch: 1,
    scholarshipCategory: 'GENERAL_MERIT', rank: Math.ceil(id / 2), overallRank: id,
    status: 'READY', assessmentStatus: 'SUBMITTED', issues: [],
    written: { marks: 80, maximumMarks: 100, isFinal: true, sourceType: 'VERIFIED_MANUAL', reference: 'synthetic', revision: 'one', status: 'QUALIFIED' },
    totals: { written: 48, interview: 17, extracurricular: 8, academic: 4, personality: 4, total: 81 },
    ...overrides,
  };
}
const ids = (rows: readonly MeritPreviewRow[]) => rows.map(row => row.placementId);

describe('administrator-selected merit list size', () => {
  it('selects top candidates by exact server rank before any display grouping or ascending order', () => {
    const rows = [candidate(4), candidate(2), candidate(3), candidate(1)];
    const snapshot = structuredClone(rows);
    const selected = selectMeritRows(rows, 3, true, false);
    assert.deepEqual(ids(selected.rows), ['1', '2', '3']);
    assert.deepEqual(ids(sortMeritRows(selected.rows, 'total', 'asc', 'overall')), ['3', '2', '1']);
    assert.deepEqual(ids(sortMeritRows(selected.rows, 'total', 'desc', 'overall')), ['1', '2', '3']);
    assert.deepEqual(new Set(ids(sortMeritRows(selected.rows, 'rank', 'desc', 'class'))), new Set(['1', '2', '3']));
    assert.deepEqual(rows, snapshot, 'Selection never changes source rows, ranks, totals or awards');
  });

  it('uses one total limit across classes and excludes all unready statuses instead of filling the list', () => {
    const rows = [candidate(1), candidate(2), candidate(3, { status: 'INCOMPLETE' }),
      candidate(4, { status: 'ABSENT' }), candidate(5, { status: 'SOURCE_CHANGED' })];
    const selected = selectMeritRows(rows, 20, true, false);
    assert.deepEqual(ids(selected.rows), ['1', '2']);
    assert.equal(selected.available, 2);
    assert.equal(selected.includeTiesCount, null);
    assert.equal(selectMeritRows(rows, null, true, false).rows.length, 5, 'All preserves the existing full-review list');
  });

  it('keeps an exact count and reports a shared-rank boundary without assigning a tie break or award', () => {
    const rows = [candidate(1), candidate(2, { overallRank: 2 }), candidate(3, { overallRank: 2 }), candidate(4, { overallRank: 2 }), candidate(5)];
    const selected = selectMeritRows(rows, 2, true, false);
    assert.deepEqual(ids(selected.rows), ['1', '2']);
    assert.equal(selected.cutoffRank, 2);
    assert.equal(selected.includeTiesCount, 4);
    const expanded = selectMeritRows(rows, selected.includeTiesCount, true, false);
    assert.deepEqual(expanded.rows.map(row => row.overallRank), [1, 2, 2, 2]);
    assert.equal(expanded.includeTiesCount, null);
    assert(expanded.rows.every(row => row.meritAward === undefined));
  });

  it('preserves rank gaps after filters and never treats equal rounded totals as a tie', () => {
    const rows = [candidate(9), candidate(5), candidate(7)];
    const selected = selectMeritRows(rows, 2, true, true);
    assert.deepEqual(selected.rows.map(row => row.overallRank), [5, 7]);
    assert.equal(selected.includeTiesCount, null);
    assert(selected.rows.every(row => row.totals.total === 81));
  });

  it('never constructs a cross-class cutoff from legacy class ranks', () => {
    const legacy = [candidate(1, { overallRank: undefined }), candidate(2, { overallRank: undefined })];
    const unavailable = selectMeritRows(legacy, 1, false, false);
    assert.match(unavailable.error, /combined student limit is unavailable/);
    assert.deepEqual(unavailable.rows, []);
    assert.equal(selectMeritRows(legacy.slice(0, 1), 1, false, true).rows.length, 1);
    assert.equal(selectMeritRows(legacy, null, false, false).rows.length, 2);
  });

  it('rejects empty, fractional, negative, nonfinite and oversized custom counts', () => {
    assert.deepEqual(parseMeritListLimit('all', ''), { limit: null, error: '' });
    for (const value of ['', '0', '-1', '2.5', '1e2', 'NaN', 'Infinity', 'abc', '10001']) {
      assert(parseMeritListLimit('custom', value).error, value);
    }
    for (const value of ['1', '20', '100', '200', '10000']) {
      assert.deepEqual(parseMeritListLimit('custom', value), { limit: Number(value), error: '' });
    }
    for (const count of [0, -1, 2.5, Infinity, 10001]) assert(selectMeritRows([candidate(1)], count, true, false).error);
  });
});

describe('manual award presentation', () => {
  it('has exactly the seven requested labels and never derives an award from a high rank or score', () => {
    assert.deepEqual(meritAwardOptions.map(option => option.label), ['Umrah Ticket', 'Laptop', 'Full Year Scholarship',
      'Partial Scholarship', 'Educational Voucher', '3000-Cash Prize', '5000-Cash Prize']);
    const row = candidate(1);
    row.totals.total = 100;
    assert.equal(meritScholarshipLabel(row), '-');
    for (const option of meritAwardOptions) {
      row.meritAward = { id: 'synthetic-award', revision: 1, awardCode: option.value, actorName: 'Synthetic Admin', createdAt: '2026-11-23T00:00:00Z' };
      assert.equal(meritScholarshipLabel(row), option.label);
    }
    row.meritAward.awardCode = null;
    assert.equal(meritScholarshipLabel(row), '-');
  });

  it('never prints registration labels as awards and preserves explicit choices across all categories', () => {
    for (const scholarshipCategory of ['GENERAL_MERIT', 'ORPHAN', 'FINANCIALLY_NEEDY', 'PERSON_WITH_DISABILITY', undefined]) {
      const row = candidate(1, { scholarshipCategory });
      assert.equal(meritScholarshipLabel(row), '-');
      row.meritAward = { id: 'synthetic-award', revision: 1, awardCode: 'LAPTOP', actorName: 'Synthetic Super Admin', createdAt: null };
      assert.equal(meritScholarshipLabel(row), 'Laptop');
      row.meritAward.awardCode = null;
      assert.equal(meritScholarshipLabel(row), '-');
    }
  });
});


describe('school-filtered merit selection', () => {
  const candidates = [
    candidate(1, { institute: 'Hazara Convent School' }),
    candidate(4, { institute: '  HAZARA   CONVENT-school ' }),
    candidate(6, { institute: 'Hazara Convent School - Campus II' }),
    candidate(3, { institute: 'Hazara Public School' }),
    candidate(8, { institute: '' }),
    candidate(9, { institute: undefined }),
    candidate(11, { institute: 'St. Mary’s Academy' }),
  ];

  it('matches partial school names case-insensitively and handles whitespace and punctuation variants', () => {
    assert.deepEqual(ids(candidates.filter(row => matchesMeritSchool(row, ' hazara--CONVENT '))), ['1', '4', '6']);
    assert.deepEqual(ids(candidates.filter(row => matchesMeritSchool(row, 'campus ii'))), ['6']);
    assert.deepEqual(ids(candidates.filter(row => matchesMeritSchool(row, 'st marys'))), ['11']);
    assert.deepEqual(ids(candidates.filter(row => matchesMeritSchool(row, 'different school'))), []);
    assert.deepEqual(ids(candidates.filter(row => matchesMeritSchool(row, '***'))), []);
    assert.deepEqual(ids(candidates.filter(row => matchesMeritSchool(row, '  '))), ids(candidates));
  });

  it('lists distinct recorded schools, deduplicating formatting variants without inventing spelling aliases', () => {
    assert.deepEqual(meritSchoolOptions(candidates), [
      'Hazara Convent School', 'Hazara Convent School - Campus II', 'Hazara Public School', 'St. Mary’s Academy',
    ]);
    assert.deepEqual(meritSchoolOptions([candidate(1, { institute: 'مدرسہ' }), candidate(2, { institute: 'مدرسہ' })]), ['مدرسہ']);
  });

  it('filters before the top-student limit and preserves source ranks, awards and all original records', () => {
    const before = structuredClone(candidates);
    const matching = candidates.filter(row => matchesMeritSchool(row, 'Hazara Convent'));
    const selected = selectMeritRows(matching, 2, true, false);
    assert.equal(selected.available, 3);
    assert.deepEqual(ids(selected.rows), ['1', '4']);
    assert.deepEqual(sortMeritRows(selected.rows, 'rank', 'desc').map(row => row.overallRank), [4, 1]);
    assert.deepEqual(candidates, before);
  });

  it('uses safe bounded school components for filtered download filenames', () => {
    assert.equal(meritSchoolFilenamePart('  ../Hazara: Convent / School?  '), 'Hazara-Convent-School');
    assert.equal(meritSchoolFilenamePart('W'.repeat(100)).length, 45);
    assert.equal(meritSchoolFilenamePart(''), '');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_SCHEDULE_PDF_SHA256, InvalidFixedSchedule,
  validateFixedScheduleStructure, validateFixedSchedule,
  decodeScheduleCsvBase64,
} from '../src/modules/interviews/fixedSchedule.ts';

const headers = [
  'interview_date','panel','batch','batch_start','batch_end','sequence','slot_time','roll_number',
  'candidate_details_as_printed','test_marks_as_printed','lock_on_import','source_pdf_page',
].join(',');

function time(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  return String((hour24 + 11) % 12 + 1).padStart(2, '0') + ':' +
    String(minutes % 60).padStart(2, '0') + ' ' + (hour24 >= 12 ? 'PM' : 'AM');
}

function fixture(): string[][] {
  const records: string[][] = [];
  let index = 1;
  for (let panel = 1; panel <= 6; panel++) {
    for (let batch = 1; batch <= 2; batch++) {
      const count = panel === 1 && batch === 1 ? 30 : 29;
      for (let sequence = 1; sequence <= count; sequence++) {
        records.push([
          '2026-11-22', String(panel), String(batch),
          batch === 1 ? '09:00 AM' : '11:30 AM',
          batch === 1 ? '11:30 AM' : '02:00 PM',
          String(sequence),
          time((batch === 1 ? 540 : 690) + 5 * (sequence - 1)),
          'AZMVS-2026-' + String(index++).padStart(4, '0'),
          'Synthetic candidate ' + index,
          '60','TRUE',String((panel - 1) * 2 + batch),
        ]);
      }
    }
  }
  return records;
}
const csv = (records: string[][]) => headers + '\r\n' + records.map(row => row.join(',')).join('\r\n') + '\r\n';

describe('approved final panel CSV structural validation (synthetic only)', () => {
  it('recognizes 349 unique candidates across six panels and twelve exact batches', () => {
    const result = validateFixedScheduleStructure(csv(fixture()));
    assert.equal(result.rows.length, 349);
    assert.equal(result.batches.length, 12);
    assert.equal(result.batches.reduce((sum, batch) => sum + batch.count, 0), 349);
    assert.equal(result.batches[0].count, 30);
    assert.ok(result.batches.slice(1).every(batch => batch.count === 29));
    assert.equal(result.rows[0].slotTime, '09:00 AM');
    assert.equal(result.rows.at(-1)?.slotTime, '01:50 PM');
  });
  it('rejects duplicate roll numbers even if individual slots differ', () => {
    const rows = fixture();
    rows[1][7] = rows[0][7];
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
  });
  it('rejects altered five-minute interview slots', () => {
    const rows = fixture();
    rows[4][6] = '11:05 AM';
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
  });
  it('rejects a 59-mark candidate', () => {
    const rows = fixture();
    rows[348][9] = '59';
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
  });
  it('rejects an incomplete batch', () => {
    const rows = fixture();
    rows.pop();
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
  });
  it('rejects a schedule date change', () => {
    const rows = fixture();
    rows[0][0] = '2026-11-23';
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
  });
  it('rejects unlocked and duplicate slot records', () => {
    const rows = fixture();
    rows[0][10] = 'FALSE';
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
    rows[0][10] = 'TRUE';
    rows[1][5] = '1';
    assert.throws(() => validateFixedScheduleStructure(csv(rows)), InvalidFixedSchedule);
  });
  it('requires exact private source hashes, not only a valid synthetic layout', () => {
    assert.throws(
      () => validateFixedSchedule(Buffer.from(csv(fixture()), 'utf8'), FINAL_SCHEDULE_PDF_SHA256),
      /CSV differs/,
    );
  });
  it('rejects corrupt upload encoding', () => {
    assert.throws(() => decodeScheduleCsvBase64('non-base64!!!'), InvalidFixedSchedule);
  });
});

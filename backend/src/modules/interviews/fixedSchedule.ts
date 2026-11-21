import { createHash } from 'node:crypto';

// SHA-256 fingerprints of the final private schedule supplied by the program.
// The 349 candidates and their personal details are intentionally NOT in Git.
export const FINAL_SCHEDULE_CSV_SHA256 = '75913f0be6d40ed51ee928389c06703acf34d34249a9ba034d3e1f196c423cf5';
export const FINAL_SCHEDULE_PDF_SHA256 = '185d21d97ad592f0b5953cafcb07fae8889d31fe9338bd5cdae737cb34250e09';
export const FINAL_SCHEDULE_DATE = '2026-11-22';
export const FINAL_SCHEDULE_ROWS = 349;

export type FixedPlacementRow = {
  panel: number;
  batch: number;
  sequence: number;
  slotTime: string;
  rollNumber: string;
  printedMarks: number;
};

const columns = [
  'interview_date', 'panel', 'batch', 'batch_start', 'batch_end', 'sequence',
  'slot_time', 'roll_number', 'candidate_details_as_printed',
  'test_marks_as_printed', 'lock_on_import', 'source_pdf_page',
] as const;

export class InvalidFixedSchedule extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidFixedSchedule'; }
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n') {
      record.push(field);
      rows.push(record);
      record = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (quoted) throw new InvalidFixedSchedule('CSV has an unclosed quoted field.');
  if (field !== '' || record.length) {
    record.push(field);
    rows.push(record);
  }
  if (rows.length && rows[0][0]?.charCodeAt(0) === 0xFEFF) {
    rows[0][0] = rows[0][0].slice(1);
  }
  return rows;
}

function numberField(value: string, label: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new InvalidFixedSchedule('Invalid ' + label);
  return Number(value);
}

function clockMinutes(value: string): number {
  const m = /^(0?[1-9]|1[012]):([0-5]\d) (AM|PM)$/.exec(value);
  if (!m) throw new InvalidFixedSchedule('Invalid interview time: ' + value);
  return (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
}

export function validateFixedSchedule(csvBytes: Buffer, pdfSha256: string): {
  csvSha256: string;
  pdfSha256: string;
  rows: FixedPlacementRow[];
  batches: Array<{ panel: number; batch: number; count: number }>;
} {
  if (csvBytes.length > 100_000) throw new InvalidFixedSchedule('CSV is larger than the permitted final schedule.');
  const csvSha256 = createHash('sha256').update(csvBytes).digest('hex');
  if (csvSha256 !== FINAL_SCHEDULE_CSV_SHA256) {
    throw new InvalidFixedSchedule('CSV differs from the final approved Session V schedule.');
  }
  if (pdfSha256.toLowerCase() !== FINAL_SCHEDULE_PDF_SHA256) {
    throw new InvalidFixedSchedule('The PDF fingerprint does not match the approved schedule.');
  }
  return {
    csvSha256, pdfSha256: FINAL_SCHEDULE_PDF_SHA256,
    ...validateFixedScheduleStructure(csvBytes.toString('utf8')),
  };
}

export function validateFixedScheduleStructure(csvText: string): {
  rows: FixedPlacementRow[];
  batches: Array<{ panel: number; batch: number; count: number }>;
} {
  const parsed = parseCsv(csvText);
  if (parsed.length !== FINAL_SCHEDULE_ROWS + 1) {
    throw new InvalidFixedSchedule('Expected exactly 349 candidate rows.');
  }
  if (parsed[0].length !== columns.length || columns.some((v, i) => parsed[0][i] !== v)) {
    throw new InvalidFixedSchedule('CSV header is not the approved schedule format.');
  }
  const usedRolls = new Set<string>();
  const usedSlots = new Set<string>();
  const usedSequences = new Set<string>();
  const counts = new Map<string, number>();
  const rows: FixedPlacementRow[] = [];
  for (const [index, fields] of parsed.slice(1).entries()) {
    if (fields.length !== columns.length) {
      throw new InvalidFixedSchedule('Malformed CSV row ' + (index + 2));
    }
    const [date, panelText, batchText, start, end, sequenceText, slotTime, rollNumber,
      candidateDetails, marksText, lock, pageText] = fields;
    const panel = numberField(panelText, 'panel');
    const batch = numberField(batchText, 'batch');
    const sequence = numberField(sequenceText, 'sequence');
    const printedMarks = numberField(marksText, 'marks');
    const page = numberField(pageText, 'source page');
    if (date !== FINAL_SCHEDULE_DATE || panel < 1 || panel > 6 || (batch !== 1 && batch !== 2)) {
      throw new InvalidFixedSchedule('Incorrect interview date, panel or batch at row ' + (index + 2));
    }
    if (start !== (batch === 1 ? '09:00 AM' : '11:30 AM') ||
        end !== (batch === 1 ? '11:30 AM' : '02:00 PM')) {
      throw new InvalidFixedSchedule('Batch start or end has been changed.');
    }
    const expectedCount = panel === 1 && batch === 1 ? 30 : 29;
    const firstMinutes = batch === 1 ? 9 * 60 : 11 * 60 + 30;
    if (sequence < 1 || sequence > expectedCount ||
        clockMinutes(slotTime) !== firstMinutes + (sequence - 1) * 5) {
      throw new InvalidFixedSchedule('Candidate sequence or five-minute slot differs from the approved PDF.');
    }
    if (!/^AZMVS-2026-\d{4}$/.test(rollNumber) || usedRolls.has(rollNumber)) {
      throw new InvalidFixedSchedule('Duplicate or invalid roll number at row ' + (index + 2));
    }
    if (!candidateDetails.trim() || printedMarks < 60 || printedMarks > 100 ||
        lock !== 'TRUE' || page !== (panel - 1) * 2 + batch) {
      throw new InvalidFixedSchedule('Candidate evidence, score or lock flag is invalid.');
    }
    const batchKey = panel + ':' + batch;
    const sequenceKey = batchKey + ':' + sequence;
    const slotKey = batchKey + ':' + slotTime;
    if (usedSequences.has(sequenceKey) || usedSlots.has(slotKey)) {
      throw new InvalidFixedSchedule('Duplicate sequence or interview time in ' + batchKey);
    }
    usedRolls.add(rollNumber);
    usedSequences.add(sequenceKey);
    usedSlots.add(slotKey);
    counts.set(batchKey, (counts.get(batchKey) ?? 0) + 1);
    rows.push({ panel, batch, sequence, slotTime, rollNumber, printedMarks });
  }
  const batches = [];
  for (let panel = 1; panel <= 6; panel++) {
    for (let batch = 1; batch <= 2; batch++) {
      const count = counts.get(panel + ':' + batch) ?? 0;
      if (count !== (panel === 1 && batch === 1 ? 30 : 29)) {
        throw new InvalidFixedSchedule('Missing students or incorrect capacity in Panel ' + panel + ', Batch ' + batch);
      }
      batches.push({ panel, batch, count });
    }
  }
  return { rows, batches };
}

export function decodeScheduleCsvBase64(value: string): Buffer {
  if (value.length > 135_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new InvalidFixedSchedule('Invalid or oversized schedule file.');
  }
  return Buffer.from(value, 'base64');
}

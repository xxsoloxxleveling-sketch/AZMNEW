import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

// The approved private Session V key package is never returned to clients.
export const OMR_KEYPACK_SHA256 = '422c531bcd4587c11726c0c3f4cdb3d6418a3f4a6a673f1790d80b860e2a5527';
export const OMR_SOURCE_PDF_SHA256 = 'd11e968de7b7dd3b27293d4ac551958b0b20911b251784a25d0c060ca4afc871';
export const OMR_COHORTS = [
  'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11 — Pre-Engineering', 'Class 11 — Pre-Medical', 'Class 11 — Pre-Computer Science',
  'Class 12 — Pre-Engineering', 'Class 12 — Pre-Medical', 'Class 12 — Pre-Computer Science',
  'BS — Combined Groups',
] as const;
export type OmrAnswer = 'A' | 'B' | 'C' | 'D' | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN';
export type OmrClassification = 'CORRECT' | 'WRONG' | 'BLANK' | 'MULTIPLE';

/** Map trusted roster fields to PDF labels; unknown values fail closed. */
export function rosterOmrCohort(currentClass: string | null, group: string | null): string | null {
  const name = (currentClass ?? '').trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\s_]+/g, ' ').replace(/\s*-\s*/g, '-');
  if (['bs', 'undergraduate', 'bs program (undergraduate)', 'bs program'].includes(name)) return OMR_COHORTS[10];
  const aliases: Record<string, number> = {
    'class 7': 7, 'class 7th': 7, '7th': 7, '7': 7,
    'class 8': 8, 'class 8th': 8, '8th': 8, '8': 8,
    'class 9': 9, 'class 9th': 9, '9th': 9, '9': 9, 'ssc-i': 9, 'ssc-1': 9, 'ssc-i (class 9th)': 9, 'ssc-i (class 9)': 9,
    'class 10': 10, 'class 10th': 10, '10th': 10, '10': 10, 'ssc-ii': 10, 'ssc-2': 10, 'ssc-ii (class 10th)': 10, 'ssc-ii (class 10)': 10,
    'hssc-i': 11, 'hssc-1': 11, 'first year': 11, '1st year': 11, 'class 11': 11, 'class 11th': 11, '11th': 11, '11': 11, 'hssc-i (class 11th)': 11, 'hssc-i (class 11)': 11,
    'hssc-ii': 12, 'hssc-2': 12, 'second year': 12, '2nd year': 12, 'class 12': 12, 'class 12th': 12, '12th': 12, '12': 12, 'hssc-ii (class 12th)': 12, 'hssc-ii (class 12)': 12,
  };
  const year = aliases[name];
  if (year >= 7 && year <= 10) return `Class ${year}`;
  if (year !== 11 && year !== 12) return null;
  const normalizedGroup = (group ?? '').trim().toLowerCase().replace(/[\s_\-\u2010-\u2015\u2212]+/g, ' ');
  const groups: Record<string, string> = {
    'pre medical': 'Pre-Medical', 'pre engineering': 'Pre-Engineering', 'pre engg': 'Pre-Engineering',
    'computer science': 'Pre-Computer Science', 'computer science (ics)': 'Pre-Computer Science',
    'ics': 'Pre-Computer Science', 'science (computer science)': 'Pre-Computer Science',
    'science (pre engineering)': 'Pre-Engineering', 'science (maths/pre engineering)': 'Pre-Engineering',
  };
  return groups[normalizedGroup] ? `Class ${year} — ${groups[normalizedGroup]}` : null;
}

function unavailable(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 503, code: 'OMR_KEYPACK_UNAVAILABLE' });
}

/** Decode only a complete, integrity-matched package; never log its contents. */
export function decodeOmrKeypack(text: string, packHash = OMR_KEYPACK_SHA256, pdfHash = OMR_SOURCE_PDF_SHA256): string[] {
  const lines = text.trimEnd().split(/\r?\n/);
  if (lines.length !== 3 || lines[1] !== packHash || lines[2] !== pdfHash || !/^[A-Za-z0-9_-]+$/.test(lines[0])) {
    return unavailable('The approved OMR key package is missing or failed integrity checks.');
  }
  const raw = Buffer.from(lines[0], 'base64url');
  if (raw.length !== 1100 || createHash('sha256').update(raw).digest('hex') !== packHash) {
    return unavailable('The approved OMR key package is missing or failed integrity checks.');
  }
  const answers = Array.from(raw).flatMap((byte) => [6, 4, 2, 0].map((shift) => 'ABCD'[(byte >> shift) & 3]));
  return Array.from({ length: 44 }, (_, index) => answers.slice(index * 100, (index + 1) * 100).join(''));
}

export function loadApprovedOmrKeys(): string[] {
  const file = process.env.AZM_OMR_KEYPACK_PATH;
  if (!file) return unavailable('The approved OMR key package has not been configured on the server.');
  try {
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > 4096 || (process.platform !== 'win32' && (stat.mode & 0o027) !== 0)) {
      return unavailable('The approved OMR key package permissions or size are unsafe.');
    }
    return decodeOmrKeypack(readFileSync(file, 'ascii'));
  } catch (error: any) {
    if (error?.code === 'OMR_KEYPACK_UNAVAILABLE') throw error;
    return unavailable('The approved OMR key package is unavailable.');
  }
}

/** Score only complete readings; an unreadable answer is never counted as wrong. */
export function scoreOmrAnswers(keys: string[], cohort: string, version: string, answers: OmrAnswer[]) {
  const cohortIndex = OMR_COHORTS.findIndex((item) => item === cohort);
  const versionIndex = ['A', 'B', 'C', 'D'].indexOf(version);
  if (cohortIndex < 0 || versionIndex < 0 || keys.length !== 44) throw Object.assign(new Error('The selected class or paper version has no approved key.'), { statusCode: 409, code: 'OMR_KEY_NOT_FOUND' });
  if (answers.length !== 100 || answers.some((answer) => !['A', 'B', 'C', 'D', 'BLANK', 'MULTIPLE', 'UNCERTAIN'].includes(answer))) {
    throw Object.assign(new Error('Exactly 100 valid readings are required.'), { statusCode: 400, code: 'OMR_ANSWERS_INVALID' });
  }
  if (answers.includes('UNCERTAIN')) throw Object.assign(new Error('Unreadable or uncertain answers must be resolved before final scoring.'), { statusCode: 409, code: 'OMR_UNCERTAIN_ANSWERS' });
  const key = keys[cohortIndex * 4 + versionIndex];
  if (!key || !/^[ABCD]{100}$/.test(key)) return unavailable('The approved OMR key package is incomplete.');
  const responses = answers.map((answer, index) => ({
    questionNumber: index + 1,
    detectedAnswer: answer === 'BLANK' || answer === 'MULTIPLE' ? null : answer,
    classification: (answer === 'BLANK' ? 'BLANK' : answer === 'MULTIPLE' ? 'MULTIPLE' : answer === key[index] ? 'CORRECT' : 'WRONG') as OmrClassification,
  }));
  return { responses, marks: responses.filter((item) => item.classification === 'CORRECT').length };
}

import type { DemoQuestionResult, DemoStudentResult, ResultExamination, ResultStatus } from './ResultsTypes';

export const DEMO_EXAMINATIONS: ResultExamination[] = [
  { id: 'exam-2026-bio', name: 'Session V Scholarship Examination', className: 'Classes 9–11', subject: 'General Science', date: '2026-11-08', maximumMarks: 100, registeredStudents: 4000 },
  { id: 'exam-2026-math', name: 'Session V Scholarship Examination', className: 'Classes 9–11', subject: 'Mathematics', date: '2026-11-09', maximumMarks: 100, registeredStudents: 4000 },
  { id: 'exam-2026-english', name: 'Session V Scholarship Examination', className: 'Classes 9–11', subject: 'English', date: '2026-11-10', maximumMarks: 100, registeredStudents: 4000 },
];

const STATUSES: ResultStatus[] = ['Published', 'Verified', 'Review Required', 'Processing', 'Draft', 'Withheld'];
const REVIEW_REASONS = ['Uncertain answer needs review', 'Identity confirmation pending', 'Paper version needs confirmation', 'Scan quality check pending'];
const FIRST_NAMES = ['Amina', 'Hassan', 'Zara', 'Bilal', 'Maryam', 'Hamza', 'Noor', 'Usman', 'Sara', 'Ibrahim', 'Fatima', 'Daniyal'];
const LAST_NAMES = ['Khan', 'Ahmed', 'Malik', 'Shah', 'Iqbal', 'Hussain', 'Siddiqui', 'Raza', 'Ali', 'Qureshi'];

function statusFor(index: number): ResultStatus {
  const bucket = index % 100;
  if (bucket < 38) return 'Published';
  if (bucket < 58) return 'Verified';
  if (bucket < 72) return 'Review Required';
  if (bucket < 84) return 'Processing';
  if (bucket < 94) return 'Draft';
  return 'Withheld';
}

function makeResult(exam: ResultExamination, index: number): DemoStudentResult {
  const status = statusFor(index);
  const uncertain = status === 'Review Required' ? 1 + (index % 3) : 0;
  const multiple = 1 + (index % 5);
  const blank = 1 + (index % 4);
  const wrong = 5 + ((index * 11 + exam.id.length) % 34);
  const correct = 100 - wrong - multiple - blank - uncertain;
  const finalised = status === 'Verified' || status === 'Published' || status === 'Withheld';
  const obtainedMarks = finalised ? correct : null;
  const studentNumber = index + 1;

  return {
    id: `${exam.id}-${studentNumber}`,
    rollNumber: `DEMO-${exam.id.slice(-3).toUpperCase()}-${String(studentNumber).padStart(4, '0')}`,
    studentName: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7) % LAST_NAMES.length]}`,
    className: `Class ${9 + (index % 3)}`,
    examinationId: exam.id,
    examinationName: `${exam.name} · ${exam.subject}`,
    obtainedMarks,
    maximumMarks: exam.maximumMarks,
    percentage: obtainedMarks === null ? null : obtainedMarks,
    correct,
    wrong,
    multiple,
    blank,
    uncertain,
    status,
    reviewReason: status === 'Review Required' ? REVIEW_REASONS[index % REVIEW_REASONS.length] : status === 'Processing' ? 'Scan processing is in progress' : status === 'Draft' ? 'Awaiting verification' : status === 'Withheld' ? 'Temporarily withheld by the examination office' : '',
  };
}

export const DEMO_RESULTS: DemoStudentResult[] = DEMO_EXAMINATIONS.flatMap((exam) =>
  Array.from({ length: exam.registeredStudents }, (_, index) => makeResult(exam, index)),
);

export function buildDemoQuestionRows(result: DemoStudentResult): DemoQuestionResult[] {
  const correctKeys = ['A', 'B', 'C', 'D'];
  const rows: DemoQuestionResult[] = [];
  let remaining = 100;
  const counts: Array<[DemoQuestionResult['classification'], number]> = [
    ['Correct', result.correct],
    ['Wrong', result.wrong],
    ['Multiple', result.multiple],
    ['Blank', result.blank],
    ['Uncertain', result.uncertain],
  ];

  for (const [classification, count] of counts) {
    for (let index = 0; index < count && remaining > 0; index += 1) {
      const questionNumber = 101 - remaining;
      const answer = correctKeys[(questionNumber + result.id.length) % correctKeys.length];
      const detected = classification === 'Blank' ? 'Blank' : classification === 'Multiple' ? 'A + C' : classification === 'Uncertain' ? 'Uncertain' : classification === 'Wrong' ? correctKeys[(correctKeys.indexOf(answer) + 1) % correctKeys.length] : answer;
      rows.push({ questionNumber, detected, correct: classification === 'Uncertain' ? 'Not available' : answer, classification, marks: classification === 'Uncertain' ? null : classification === 'Correct' ? 1 : 0 });
      remaining -= 1;
    }
  }
  while (remaining > 0) {
    const questionNumber = 101 - remaining;
    const answer = correctKeys[(questionNumber + result.id.length) % correctKeys.length];
    rows.push({ questionNumber, detected: answer, correct: answer, classification: 'Correct', marks: 1 });
    remaining -= 1;
  }
  return rows;
}

export const PUBLIC_DEMO_LOOKUPS = [
  {
    examinationId: 'exam-2026-bio',
    rollNumber: 'DEMO-RESULT-0001',
    verificationCode: 'AZM-DEMO-1001',
    studentName: 'Amina Khan (Fictional)',
    className: 'Class 9',
    status: 'Published' as const,
    marks: 78,
    correct: 78,
    wrong: 14,
    multiple: 4,
    blank: 4,
  },
  {
    examinationId: 'exam-2026-bio',
    rollNumber: 'DEMO-RESULT-0002',
    verificationCode: 'AZM-DEMO-1002',
    studentName: 'Hassan Ahmed (Fictional)',
    className: 'Class 9',
    status: 'Withheld' as const,
    marks: null,
    correct: 0,
    wrong: 0,
    multiple: 0,
    blank: 0,
  },
];

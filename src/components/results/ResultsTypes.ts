export type ResultStatus = 'Draft' | 'Processing' | 'Review Required' | 'Verified' | 'Published' | 'Withheld';

export type QuestionClassification = 'Correct' | 'Wrong' | 'Multiple' | 'Blank' | 'Uncertain';

export interface ResultExamination {
  id: string;
  name: string;
  className: string;
  subject: string;
  date: string;
  maximumMarks: number;
  registeredStudents: number;
}

export interface DemoStudentResult {
  id: string;
  rollNumber: string;
  studentName: string;
  className: string;
  examinationId: string;
  examinationName: string;
  obtainedMarks: number | null;
  maximumMarks: number;
  percentage: number | null;
  correct: number;
  wrong: number;
  multiple: number;
  blank: number;
  uncertain: number;
  status: ResultStatus;
  reviewReason: string;
}

export interface DemoQuestionResult {
  questionNumber: number;
  detected: string;
  correct: string;
  classification: QuestionClassification;
  marks: number | null;
}

export type ExportScope = 'filtered' | 'all' | 'verified' | 'published' | 'pending' | 'selected';

export interface ResultFilters {
  query: string;
  className: string;
  status: 'All statuses' | ResultStatus;
  minimumMarks: string;
  maximumMarks: string;
}

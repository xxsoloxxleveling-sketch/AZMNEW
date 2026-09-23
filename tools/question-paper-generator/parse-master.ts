import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MasterQuestion {
  id: string; // e.g. "C6-001" to "C6-100"
  masterNumber: number; // 1 to 100
  subject: 'SCIENCE' | 'MATHEMATICS' | 'ENGLISH' | 'ISLAMIAT' | 'SOCIAL STUDIES' | 'COMPUTER SCIENCE';
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

function parseMasterFile(): MasterQuestion[] {
  const filePath = path.resolve(__dirname, 'locked-master.txt');
  const rawText = fs.readFileSync(filePath, 'utf-8');

  // Split content into questions portion and answer key portion
  const [questionsPart, answerKeyPart] = rawText.split('Version A — Answer Key');
  if (!questionsPart || !answerKeyPart) {
    throw new Error('Failed to split questions and answer key in locked-master.txt');
  }

  // Parse Answer Key
  const answerKeyMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const answerKeyRegex = /(\d{1,3})\s*-\s*([ABCD])/g;
  let match: RegExpExecArray | null;
  while ((match = answerKeyRegex.exec(answerKeyPart)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2] as 'A' | 'B' | 'C' | 'D';
    answerKeyMap.set(qNum, ans);
  }

  if (answerKeyMap.size !== 100) {
    throw new Error(`Expected 100 answers in Answer Key, found ${answerKeyMap.size}`);
  }

  // Define subject ranges
  const getSubject = (qNum: number): MasterQuestion['subject'] => {
    if (qNum >= 1 && qNum <= 20) return 'SCIENCE';
    if (qNum >= 21 && qNum <= 40) return 'MATHEMATICS';
    if (qNum >= 41 && qNum <= 60) return 'ENGLISH';
    if (qNum >= 61 && qNum <= 80) return 'ISLAMIAT';
    if (qNum >= 81 && qNum <= 90) return 'SOCIAL STUDIES';
    if (qNum >= 91 && qNum <= 100) return 'COMPUTER SCIENCE';
    throw new Error(`Invalid question number for subject determination: ${qNum}`);
  };

  // Parse Questions
  const questions: MasterQuestion[] = [];
  const lines = questionsPart.split(/\r?\n/);
  
  let currentQNum: number | null = null;
  let currentQTextLines: string[] = [];
  let currentOptions: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};

  const finalizeCurrentQuestion = () => {
    if (currentQNum !== null) {
      if (!currentOptions.A || !currentOptions.B || !currentOptions.C || !currentOptions.D) {
        throw new Error(`Question ${currentQNum} is missing one or more options: ${JSON.stringify(currentOptions)}`);
      }
      const ans = answerKeyMap.get(currentQNum);
      if (!ans) {
        throw new Error(`No answer key entry for question ${currentQNum}`);
      }

      const padId = String(currentQNum).padStart(3, '0');
      questions.push({
        id: `C6-${padId}`,
        masterNumber: currentQNum,
        subject: getSubject(currentQNum),
        questionText: currentQTextLines.join('\n').trim(),
        options: {
          A: currentOptions.A.trim(),
          B: currentOptions.B.trim(),
          C: currentOptions.C.trim(),
          D: currentOptions.D.trim(),
        },
        correctAnswer: ans,
      });

      currentQNum = null;
      currentQTextLines = [];
      currentOptions = {};
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for section header
    if (/^(SCIENCE|MATHEMATICS|ENGLISH|ISLAMIAT|SOCIAL STUDIES|COMPUTER SCIENCE)\s*—/i.test(trimmed)) {
      continue;
    }

    // Check for start of question: e.g. "1. A student observes..."
    const qMatch = trimmed.match(/^(\d{1,3})\.\s*(.*)$/);
    if (qMatch) {
      finalizeCurrentQuestion();
      currentQNum = parseInt(qMatch[1], 10);
      currentQTextLines = [qMatch[2]];
      continue;
    }

    // Check for option: e.g. "A) Nucleus"
    const optMatch = trimmed.match(/^([ABCD])\)\s*(.*)$/);
    if (optMatch && currentQNum !== null) {
      const optKey = optMatch[1] as 'A' | 'B' | 'C' | 'D';
      currentOptions[optKey] = optMatch[2];
      continue;
    }

    // Otherwise continuation of question text or option
    if (currentQNum !== null) {
      if (Object.keys(currentOptions).length === 0) {
        currentQTextLines.push(trimmed);
      } else {
        // Continuation of previous option
        const lastOptKey = Object.keys(currentOptions).pop() as 'A' | 'B' | 'C' | 'D';
        currentOptions[lastOptKey] += ' ' + trimmed;
      }
    }
  }

  finalizeCurrentQuestion();

  // Verification
  if (questions.length !== 100) {
    throw new Error(`Expected 100 parsed questions, got ${questions.length}`);
  }

  for (let i = 1; i <= 100; i++) {
    const q = questions[i - 1];
    if (q.masterNumber !== i) {
      throw new Error(`Question index mismatch at ${i}: found masterNumber ${q.masterNumber}`);
    }
  }

  console.log(`✅ Successfully parsed all 100 master questions and verified answer keys.`);
  return questions;
}

const questions = parseMasterFile();
const outJsonPath = path.resolve(__dirname, 'master-questions.json');
fs.writeFileSync(outJsonPath, JSON.stringify(questions, null, 2), 'utf-8');
console.log(`Saved structured master questions to ${outJsonPath}`);

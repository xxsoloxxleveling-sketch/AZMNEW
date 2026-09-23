import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MasterQuestion } from './parse-master.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VariantQuestion {
  paperVersion: 'A' | 'B' | 'C' | 'D';
  paperQuestionNumber: number; // 1 to 100
  masterId: string; // e.g. "C6-014"
  masterNumber: number; // 1 to 100
  subject: MasterQuestion['subject'];
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

export interface PaperVariant {
  version: 'A' | 'B' | 'C' | 'D';
  title: string;
  questions: VariantQuestion[];
  answerKey: Map<number, 'A' | 'B' | 'C' | 'D'>;
}

export function createPrng(seedString: string): () => number {
  const hash = crypto.createHash('sha256').update(seedString).digest();
  let state = hash.readUInt32BE(0);

  // Mulberry32 32-bit PRNG
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSection<T>(items: T[], prng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export function buildAllVariants(masterQuestions: MasterQuestion[]): Record<'A' | 'B' | 'C' | 'D', PaperVariant> {
  if (masterQuestions.length !== 100) {
    throw new Error(`Expected exactly 100 master questions, got ${masterQuestions.length}`);
  }

  // Split into subject sections
  const science = masterQuestions.slice(0, 20); // 1-20
  const math = masterQuestions.slice(20, 40); // 21-40
  const english = masterQuestions.slice(40, 60); // 41-60
  const islamiat = masterQuestions.slice(60, 80); // 61-80
  const sst = masterQuestions.slice(80, 90); // 81-90
  const cs = masterQuestions.slice(90, 100); // 91-100

  const buildPaper = (
    version: 'A' | 'B' | 'C' | 'D',
    seed?: string
  ): PaperVariant => {
    let combined: MasterQuestion[] = [];

    if (version === 'A') {
      // Paper A is the exact master sequence
      combined = [...masterQuestions];
    } else {
      if (!seed) throw new Error(`Seed required for variant ${version}`);
      const prng = createPrng(seed);
      combined = [
        ...shuffleSection(science, prng),
        ...shuffleSection(math, prng),
        ...shuffleSection(english, prng),
        ...shuffleSection(islamiat, prng),
        ...shuffleSection(sst, prng),
        ...shuffleSection(cs, prng),
      ];
    }

    const answerKey = new Map<number, 'A' | 'B' | 'C' | 'D'>();
    const questions: VariantQuestion[] = combined.map((q, idx) => {
      const paperQNum = idx + 1;
      answerKey.set(paperQNum, q.correctAnswer);
      return {
        paperVersion: version,
        paperQuestionNumber: paperQNum,
        masterId: q.id,
        masterNumber: q.masterNumber,
        subject: q.subject,
        questionText: q.questionText,
        options: { ...q.options },
        correctAnswer: q.correctAnswer,
      };
    });

    return {
      version,
      title: `QUESTION PAPER — VERSION ${version}`,
      questions,
      answerKey,
    };
  };

  const paperA = buildPaper('A');
  const paperB = buildPaper('B', 'CLASS6-SESSION5-PAPER-B-2026');
  const paperC = buildPaper('C', 'CLASS6-SESSION5-PAPER-C-2026');
  const paperD = buildPaper('D', 'CLASS6-SESSION5-PAPER-D-2026');

  const variants = { A: paperA, B: paperB, C: paperC, D: paperD };

  // =========================================================================
  // INTEGRITY ASSERTIONS
  // =========================================================================
  for (const v of ['A', 'B', 'C', 'D'] as const) {
    const paper = variants[v];
    if (paper.questions.length !== 100) {
      throw new Error(`Variant ${v} does not have 100 questions`);
    }

    const seenMasterIds = new Set<string>();
    const subjectCounts: Record<string, number> = {};

    paper.questions.forEach((q, idx) => {
      if (q.paperQuestionNumber !== idx + 1) {
        throw new Error(`Variant ${v} question number sequence broken at index ${idx}`);
      }
      if (seenMasterIds.has(q.masterId)) {
        throw new Error(`Variant ${v} duplicate master question ID ${q.masterId}`);
      }
      seenMasterIds.add(q.masterId);

      subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;

      // Check subject range boundaries
      const qNum = q.paperQuestionNumber;
      if (qNum <= 20 && q.subject !== 'SCIENCE') throw new Error(`Q${qNum} in ${v} is not Science`);
      if (qNum >= 21 && qNum <= 40 && q.subject !== 'MATHEMATICS') throw new Error(`Q${qNum} in ${v} is not Mathematics`);
      if (qNum >= 41 && qNum <= 60 && q.subject !== 'ENGLISH') throw new Error(`Q${qNum} in ${v} is not English`);
      if (qNum >= 61 && qNum <= 80 && q.subject !== 'ISLAMIAT') throw new Error(`Q${qNum} in ${v} is not Islamiat`);
      if (qNum >= 81 && qNum <= 90 && q.subject !== 'SOCIAL STUDIES') throw new Error(`Q${qNum} in ${v} is not Social Studies`);
      if (qNum >= 91 && qNum <= 100 && q.subject !== 'COMPUTER SCIENCE') throw new Error(`Q${qNum} in ${v} is not Computer Science`);

      // Verify answer key matches original master answer
      const masterOrig = masterQuestions.find((m) => m.id === q.masterId);
      if (!masterOrig) throw new Error(`Master question ${q.masterId} not found`);
      if (q.correctAnswer !== masterOrig.correctAnswer) {
        throw new Error(`Answer mismatch for ${q.masterId} in variant ${v}: ${q.correctAnswer} vs ${masterOrig.correctAnswer}`);
      }
      if (paper.answerKey.get(qNum) !== masterOrig.correctAnswer) {
        throw new Error(`Answer key mismatch for Q${qNum} in variant ${v}`);
      }
    });

    if (seenMasterIds.size !== 100) {
      throw new Error(`Variant ${v} has missing master questions (${seenMasterIds.size}/100)`);
    }

    if (
      subjectCounts['SCIENCE'] !== 20 ||
      subjectCounts['MATHEMATICS'] !== 20 ||
      subjectCounts['ENGLISH'] !== 20 ||
      subjectCounts['ISLAMIAT'] !== 20 ||
      subjectCounts['SOCIAL STUDIES'] !== 10 ||
      subjectCounts['COMPUTER SCIENCE'] !== 10
    ) {
      throw new Error(`Subject count mismatch in variant ${v}: ${JSON.stringify(subjectCounts)}`);
    }
  }

  // Verify that B, C, D have distinct orderings
  const getOrderSig = (p: PaperVariant) => p.questions.map((q) => q.masterId).join(',');
  const sigA = getOrderSig(paperA);
  const sigB = getOrderSig(paperB);
  const sigC = getOrderSig(paperC);
  const sigD = getOrderSig(paperD);

  if (sigA === sigB || sigA === sigC || sigA === sigD) {
    throw new Error('One of the shuffled papers is identical to Paper A');
  }
  if (sigB === sigC || sigB === sigD || sigC === sigD) {
    throw new Error('Shuffled papers B, C, D are not distinct');
  }

  console.log('✅ All 4 paper variants generated & verified with 100% integrity.');
  return variants;
}

// Generate CSV mapping file
export function generateMappingCsv(
  variants: Record<'A' | 'B' | 'C' | 'D', PaperVariant>,
  outCsvPath: string
) {
  const lines: string[] = [
    'paperVersion,newQuestionNumber,masterQuestionId,masterQuestionNumber,subject,correctAnswer',
  ];

  for (const v of ['A', 'B', 'C', 'D'] as const) {
    const paper = variants[v];
    for (const q of paper.questions) {
      lines.push(
        `${q.paperVersion},${q.paperQuestionNumber},${q.masterId},${q.masterNumber},${q.subject},${q.correctAnswer}`
      );
    }
  }

  fs.writeFileSync(outCsvPath, lines.join('\n'), 'utf-8');
  console.log(`Saved variant mapping CSV to: ${outCsvPath}`);
}

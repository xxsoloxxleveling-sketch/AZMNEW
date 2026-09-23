import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MasterQuestion } from './parse-master.js';
import { buildAllVariants, generateMappingCsv } from './generate-variants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const masterJsonPath = path.resolve(__dirname, 'master-questions.json');
const masterQuestions: MasterQuestion[] = JSON.parse(fs.readFileSync(masterJsonPath, 'utf-8'));

const variants = buildAllVariants(masterQuestions);

const outCsvPath = path.resolve(__dirname, '../../output/question-papers/class-6/AZMAIO_Class6_SessionV_2026_Variant_Mapping.csv');
generateMappingCsv(variants, outCsvPath);

console.log('\n--- Variant Question Samples ---');
for (const v of ['A', 'B', 'C', 'D'] as const) {
  const paper = variants[v];
  console.log(`Paper ${v}:`);
  console.log(`  Q1: ${paper.questions[0].masterId} (${paper.questions[0].subject}) -> Ans: ${paper.questions[0].correctAnswer}`);
  console.log(`  Q21 (Math): ${paper.questions[20].masterId} -> Ans: ${paper.questions[20].correctAnswer}`);
  console.log(`  Q41 (English): ${paper.questions[40].masterId} -> Ans: ${paper.questions[40].correctAnswer}`);
  console.log(`  Q61 (Islamiat): ${paper.questions[60].masterId} -> Ans: ${paper.questions[60].correctAnswer}`);
  console.log(`  Q81 (SST): ${paper.questions[80].masterId} -> Ans: ${paper.questions[80].correctAnswer}`);
  console.log(`  Q91 (CS): ${paper.questions[90].masterId} -> Ans: ${paper.questions[90].correctAnswer}`);
}

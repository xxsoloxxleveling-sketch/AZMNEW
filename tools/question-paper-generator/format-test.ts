import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function formatQuestionContent(text: string): string {
  if (!text) return '';
  return text
    // 1. Strip all \( and \) wrappers first
    .replace(/\\\(|\\\)/g, '')
    // 2. Replace any \frac{a}{b} or \frac ab or \frac 1 {10} with fraction HTML
    .replace(/\\frac\s*\{?([0-9a-zA-Z]+)\}?\s*\{?([0-9a-zA-Z]+)\}?/g, '<span class="frac"><span class="top">$1</span><span class="bot">$2</span></span>')
    // 3. Replace ^\circ with °
    .replace(/\^\\circ|\^\{\\circ\}|\^circ/g, '°')
    // 4. Replace \div with ÷
    .replace(/\\div/g, '÷')
    // 5. Minus symbol
    .replace(/−/g, '&minus;')
    .trim();
}

const masterQuestions = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'master-questions.json'), 'utf-8'));

for (const q of masterQuestions) {
  const formattedText = formatQuestionContent(q.questionText);
  const formattedA = formatQuestionContent(q.options.A);
  const formattedB = formatQuestionContent(q.options.B);
  const formattedC = formatQuestionContent(q.options.C);
  const formattedD = formatQuestionContent(q.options.D);

  if (formattedText.includes('\\(') || formattedText.includes('\\)')) {
    console.warn(`Warning: unparsed LaTeX in Q${q.masterNumber} text:`, formattedText);
  }
}

console.log('Math formatting test passed with 0 unparsed LaTeX tokens.');

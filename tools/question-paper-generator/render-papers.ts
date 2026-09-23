import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'C:/Projects/Azm/backend/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js';
import { MasterQuestion } from './parse-master.js';
import { buildAllVariants, generateMappingCsv, PaperVariant, VariantQuestion } from './generate-variants.js';
import { formatQuestionContent } from './format-test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Projects\\Azm\\backend\\.cache\\puppeteer\\chrome\\win64-152.0.7977.42\\chrome-win64\\chrome.exe';
const OUTPUT_DIR = path.resolve(__dirname, '../../output/question-papers/class-6');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate HTML for a single student paper booklet
export function generateStudentPaperHtml(paper: PaperVariant): string {
  const version = paper.version;

  let currentSubject = '';
  let questionsHtml = '';

  const subjectNames: Record<string, string> = {
    'SCIENCE': 'SECTION 1: SCIENCE',
    'MATHEMATICS': 'SECTION 2: MATHEMATICS',
    'ENGLISH': 'SECTION 3: ENGLISH',
    'ISLAMIAT': 'SECTION 4: ISLAMIAT',
    'SOCIAL STUDIES': 'SECTION 5: SOCIAL STUDIES',
    'COMPUTER SCIENCE': 'SECTION 6: COMPUTER SCIENCE',
  };

  const subjectRanges: Record<string, string> = {
    'SCIENCE': '(Questions 1 &ndash; 20)',
    'MATHEMATICS': '(Questions 21 &ndash; 40)',
    'ENGLISH': '(Questions 41 &ndash; 60)',
    'ISLAMIAT': '(Questions 61 &ndash; 80)',
    'SOCIAL STUDIES': '(Questions 81 &ndash; 90)',
    'COMPUTER SCIENCE': '(Questions 91 &ndash; 100)',
  };

  paper.questions.forEach((q) => {
    if (q.subject !== currentSubject) {
      currentSubject = q.subject;
      questionsHtml += `
        <div class="subject-header">
          <span class="subject-title">${subjectNames[currentSubject]}</span>
          <span class="subject-range">${subjectRanges[currentSubject]}</span>
        </div>
      `;
    }

    const qNum = q.paperQuestionNumber;
    const formattedText = formatQuestionContent(q.questionText);
    const optA = formatQuestionContent(q.options.A);
    const optB = formatQuestionContent(q.options.B);
    const optC = formatQuestionContent(q.options.C);
    const optD = formatQuestionContent(q.options.D);

    // Determine if options are long (switch to 1 column)
    const isLong = [optA, optB, optC, optD].some((opt) => opt.replace(/<[^>]+>/g, '').length > 32);

    questionsHtml += `
      <div class="question-item">
        <div class="q-header">
          <span class="q-num">${qNum}.</span>
          <div class="q-text">${formattedText}</div>
        </div>
        <div class="options-grid ${isLong ? 'long-opts' : ''}">
          <div class="opt-item"><span class="opt-label">A)</span> <span class="opt-val">${optA}</span></div>
          <div class="opt-item"><span class="opt-label">B)</span> <span class="opt-val">${optB}</span></div>
          <div class="opt-item"><span class="opt-label">C)</span> <span class="opt-val">${optC}</span></div>
          <div class="opt-item"><span class="opt-label">D)</span> <span class="opt-val">${optD}</span></div>
        </div>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AZM.AIO Class 6 Scholarship Exam - Paper ${version}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 9.5pt;
      line-height: 1.35;
    }

    /* Fixed security watermark repeating on every printed page */
    .watermark-fixed {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      text-align: center;
      pointer-events: none;
      user-select: none;
      z-index: -1;
      opacity: 0.045;
      color: #000000;
    }
    .wm-brand {
      font-size: 76pt;
      font-weight: 900;
      letter-spacing: 10px;
      line-height: 1;
    }
    .wm-session {
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: 6px;
      margin-top: 10px;
      text-transform: uppercase;
    }

    /* Page 1 Document Header */
    .exam-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 3mm;
      margin-bottom: 2.5mm;
    }
    .header-main {
      flex: 1;
    }
    .inst-org {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #0f172a;
      line-height: 1.1;
    }
    .inst-exam {
      font-size: 10pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #1e293b;
      margin-top: 1px;
    }
    .inst-class {
      font-size: 9pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* High-contrast boxed Version Badge */
    .version-box {
      border: 2px solid #0f172a;
      background: #0f172a;
      color: #ffffff;
      padding: 2.5mm 5mm;
      border-radius: 4px;
      text-align: center;
      flex-shrink: 0;
      margin-left: 15px;
    }
    .vb-title {
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .vb-version {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 1px;
      color: #ffffff;
      white-space: nowrap;
    }

    /* Meta Bar (Total questions, marks, time) */
    .meta-strip {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      padding: 1.5mm 3.5mm;
      font-size: 8.5pt;
      color: #1e293b;
      margin-bottom: 2.5mm;
    }

    /* Candidate Fields */
    .candidate-bar {
      display: flex;
      gap: 15px;
      border: 1px solid #0f172a;
      border-radius: 3px;
      padding: 2mm 3.5mm;
      font-size: 8.5pt;
      margin-bottom: 2.5mm;
      background: #ffffff;
    }
    .cand-field {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cand-field .lbl {
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
    }
    .cand-field .line {
      flex: 1;
      border-bottom: 1px dashed #64748b;
      height: 12px;
    }

    /* Instructions Box */
    .instructions-box {
      border: 1.2px solid #0f172a;
      border-radius: 3px;
      padding: 2mm 3.5mm;
      background: #f1f5f9;
      margin-bottom: 3.5mm;
    }
    .inst-head {
      font-size: 8pt;
      font-weight: 900;
      letter-spacing: 0.8px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 1.5mm;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 1mm;
    }
    .inst-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5px 14px;
      padding-left: 14px;
      font-size: 7.6pt;
      line-height: 1.25;
      color: #334155;
    }
    .inst-list li {
      margin-bottom: 0.5px;
    }

    /* Questions 2-Column Container */
    .questions-container {
      columns: 2;
      column-gap: 18px;
    }

    /* Subject Header */
    .subject-header {
      column-span: all;
      break-after: avoid;
      page-break-after: avoid;
      break-before: auto;
      page-break-before: auto;
      margin-top: 10px;
      margin-bottom: 7px;
      padding: 2.5px 7px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      font-size: 8.8pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 2px;
      letter-spacing: 0.4px;
    }
    .subject-header:first-of-type {
      margin-top: 0;
    }
    .subject-title {
      text-transform: uppercase;
      font-weight: 900;
    }
    .subject-range {
      font-size: 7.8pt;
      font-weight: 700;
      color: #94a3b8;
    }

    /* Question Item */
    .question-item {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 8px;
      padding-bottom: 2px;
    }
    .q-header {
      display: flex;
      align-items: flex-start;
      margin-bottom: 2px;
    }
    .q-num {
      font-weight: 900;
      min-width: 26px;
      margin-right: 4px;
      color: #0f172a;
      font-size: 9.2pt;
      line-height: 1.35;
      flex-shrink: 0;
    }
    .q-text {
      flex: 1;
      font-weight: 600;
      color: #1e293b;
      font-size: 9.2pt;
      line-height: 1.35;
    }

    /* Options Grid */
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5px 6px;
      padding-left: 30px;
      font-size: 8.8pt;
      line-height: 1.3;
    }
    .options-grid.long-opts {
      grid-template-columns: 1fr;
    }
    .opt-item {
      display: flex;
      align-items: flex-start;
      gap: 3.5px;
    }
    .opt-label {
      font-weight: 800;
      color: #334155;
      font-size: 8.5pt;
      min-width: 14px;
    }
    .opt-val {
      color: #1e293b;
      word-break: normal;
    }

    /* Math fraction styling */
    .frac {
      display: inline-flex;
      flex-direction: column;
      vertical-align: -0.45em;
      text-align: center;
      font-size: 0.88em;
      line-height: 1;
      padding: 0 1px;
    }
    .frac .top {
      border-bottom: 1.1px solid currentColor;
      padding-bottom: 1px;
    }
    .frac .bot {
      padding-top: 1px;
    }
  </style>
</head>
<body>

  <!-- Background Watermark (repeats on every printed page) -->
  <div class="watermark-fixed">
    <div class="wm-brand">AZM.AIO</div>
    <div class="wm-session">SESSION V &bull; 2026</div>
  </div>

  <!-- Page 1 Header -->
  <div class="exam-header">
    <div class="header-main">
      <div class="inst-org">AZM.AIO</div>
      <div class="inst-exam">SCHOLARSHIP EXAMINATION &mdash; SESSION V 2026</div>
      <div class="inst-class">CLASS 6</div>
    </div>
    <div class="version-box">
      <div class="vb-title">QUESTION PAPER</div>
      <div class="vb-version">VERSION ${version}</div>
    </div>
  </div>

  <div class="meta-strip">
    <div><strong>Total Questions:</strong> 100</div>
    <div><strong>Total Marks:</strong> 100</div>
    <div><strong>Time Allowed:</strong> 60 Minutes</div>
  </div>

  <div class="candidate-bar">
    <div class="cand-field"><span class="lbl">Candidate Name:</span> <span class="line"></span></div>
    <div class="cand-field"><span class="lbl">Roll No:</span> <span class="line"></span></div>
  </div>

  <div class="instructions-box">
    <div class="inst-head">Instructions</div>
    <ol class="inst-list">
      <li>This paper contains 100 multiple-choice questions.</li>
      <li>Each question carries 1 mark.</li>
      <li>Select the single best answer.</li>
      <li>Mark answers only on the official OMR answer sheet.</li>
      <li>Do not mark answers on this question paper for machine evaluation.</li>
      <li>Before beginning, mark the correct Paper Version A/B/C/D bubble on your OMR sheet corresponding to this booklet.</li>
      <li>Use a blue or black ballpoint pen on the OMR sheet.</li>
      <li>Completely fill only one answer bubble for each question.</li>
      <li>Do not fold, tear or damage the OMR sheet.</li>
      <li>No electronic devices are permitted during the examination.</li>
    </ol>
  </div>

  <!-- Questions Container (2 columns) -->
  <div class="questions-container">
    ${questionsHtml}
  </div>

</body>
</html>
`;
}

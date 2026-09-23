import { PaperVariant } from './generate-variants.js';
import { MasterQuestion } from './parse-master.js';
import { formatQuestionContent } from './format-test.js';

export function generateAnswerKeysHtml(
  variants: Record<'A' | 'B' | 'C' | 'D', PaperVariant>,
  masterQuestions: MasterQuestion[]
): string {
  // Build lookup maps for Paper B, C, D to find which paper question corresponds to which master question
  // Also build question 1-100 table
  const rows: Array<{
    qNum: number;
    subject: string;
    ansA: string;
    ansB: string;
    ansC: string;
    ansD: string;
  }> = [];

  const subjectShort: Record<string, string> = {
    'SCIENCE': 'SCI',
    'MATHEMATICS': 'MATH',
    'ENGLISH': 'ENG',
    'ISLAMIAT': 'ISL',
    'SOCIAL STUDIES': 'SST',
    'COMPUTER SCIENCE': 'CS',
  };

  for (let i = 1; i <= 100; i++) {
    const qA = variants.A.questions[i - 1];
    const qB = variants.B.questions[i - 1];
    const qC = variants.C.questions[i - 1];
    const qD = variants.D.questions[i - 1];

    rows.push({
      qNum: i,
      subject: subjectShort[qA.subject] || qA.subject,
      ansA: qA.correctAnswer,
      ansB: qB.correctAnswer,
      ansC: qC.correctAnswer,
      ansD: qD.correctAnswer,
    });
  }

  // Render 4-column blocks for 100 questions (25 rows per column)
  const renderQuarterTable = (start: number, end: number) => {
    let trs = '';
    for (let i = start; i <= end; i++) {
      const r = rows[i - 1];
      const isAlt = i % 2 === 0;
      trs += `
        <tr class="${isAlt ? 'alt-row' : ''}">
          <td class="cell-qnum">${r.qNum}</td>
          <td class="cell-subj">${r.subject}</td>
          <td class="cell-key cell-a">${r.ansA}</td>
          <td class="cell-key cell-b">${r.ansB}</td>
          <td class="cell-key cell-c">${r.ansC}</td>
          <td class="cell-key cell-d">${r.ansD}</td>
        </tr>
      `;
    }
    return `
      <div class="key-col">
        <table class="key-table">
          <thead>
            <tr>
              <th>Q#</th>
              <th>Subj</th>
              <th class="th-a">A</th>
              <th class="th-b">B</th>
              <th class="th-c">C</th>
              <th class="th-d">D</th>
            </tr>
          </thead>
          <tbody>
            ${trs}
          </tbody>
        </table>
      </div>
    `;
  };

  // Detailed Reverse Lookup Table: Master ID -> Paper A, B, C, D question numbers
  const masterLookupRows: string[] = [];
  masterQuestions.forEach((m) => {
    const qNumA = variants.A.questions.findIndex((q) => q.masterId === m.id) + 1;
    const qNumB = variants.B.questions.findIndex((q) => q.masterId === m.id) + 1;
    const qNumC = variants.C.questions.findIndex((q) => q.masterId === m.id) + 1;
    const qNumD = variants.D.questions.findIndex((q) => q.masterId === m.id) + 1;

    // First 45 chars of question text
    const snippet = m.questionText.replace(/<[^>]+>/g, '').substring(0, 48) + '...';

    masterLookupRows.push(`
      <tr>
        <td class="font-mono"><strong>${m.id}</strong></td>
        <td>${m.masterNumber}</td>
        <td>${subjectShort[m.subject]}</td>
        <td class="key-highlight">${m.correctAnswer}</td>
        <td>Q.${qNumA}</td>
        <td>Q.${qNumB}</td>
        <td>Q.${qNumC}</td>
        <td>Q.${qNumD}</td>
        <td class="text-muted">${snippet}</td>
      </tr>
    `);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AZM.AIO Class 6 Scholarship Exam - Master Answer Keys</title>
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
      font-size: 8.5pt;
      line-height: 1.3;
    }

    /* Fixed security watermark */
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
    }
    .wm-session {
      font-size: 24pt;
      font-weight: 800;
      letter-spacing: 6px;
      margin-top: 8px;
    }

    /* Header */
    .admin-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .adm-title {
      font-size: 15pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 1px;
    }
    .adm-sub {
      font-size: 10pt;
      font-weight: 800;
      color: #334155;
      margin-top: 1px;
    }
    .adm-badge {
      background: #dc2626;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 8pt;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .meta-box {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      padding: 1.5mm 3.5mm;
      font-size: 8.2pt;
      margin-bottom: 4mm;
    }

    /* 4-column answer key layout */
    .keys-grid {
      display: flex;
      gap: 10px;
      justify-content: space-between;
      margin-bottom: 5mm;
    }
    .key-col {
      flex: 1;
    }
    .key-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      border: 1px solid #94a3b8;
    }
    .key-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 2px 3px;
      font-size: 7.5pt;
      text-align: center;
      border: 1px solid #0f172a;
    }
    .key-table td {
      padding: 1.8px 2px;
      text-align: center;
      border: 0.8px solid #cbd5e1;
    }
    .cell-qnum {
      font-weight: 800;
      background: #f1f5f9;
      width: 22px;
    }
    .cell-subj {
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      width: 32px;
    }
    .cell-key {
      font-weight: 900;
      font-size: 8.5pt;
      width: 22px;
    }
    .cell-a { background: #eff6ff; color: #1e40af; }
    .cell-b { background: #f0fdf4; color: #166534; }
    .cell-c { background: #fefce8; color: #854d0e; }
    .cell-d { background: #faf5ff; color: #6b21a8; }
    .alt-row {
      background: #fafafa;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    /* Mapping table */
    .section-title {
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      margin-top: 4mm;
      margin-bottom: 2mm;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 1mm;
    }
    .map-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.2pt;
      border: 1px solid #94a3b8;
    }
    .map-table th {
      background: #1e293b;
      color: #ffffff;
      padding: 2.5px 3px;
      text-align: left;
      font-size: 7pt;
      border: 0.8px solid #334155;
    }
    .map-table td {
      padding: 1.6px 3px;
      border: 0.6px solid #cbd5e1;
    }
    .key-highlight {
      font-weight: 900;
      color: #b91c1c;
      text-align: center;
    }
    .text-muted {
      color: #64748b;
      font-size: 6.8pt;
    }
    .font-mono {
      font-family: monospace;
    }
  </style>
</head>
<body>

  <div class="watermark-fixed">
    <div class="wm-brand">AZM.AIO</div>
    <div class="wm-session">SESSION V &bull; 2026</div>
  </div>

  <div class="admin-header">
    <div>
      <div class="adm-title">AZM.AIO SCHOLARSHIP EXAMINATION &bull; SESSION V 2026</div>
      <div class="adm-sub">CLASS 6 &mdash; OFFICIAL ADMINISTRATIVE ANSWER KEYS (VARIANTS A, B, C, D)</div>
    </div>
    <div class="adm-badge">CONFIDENTIAL &bull; ADMIN ONLY</div>
  </div>

  <div class="meta-box">
    <div><strong>Total Questions:</strong> 100</div>
    <div><strong>Total Marks:</strong> 100</div>
    <div><strong>Security Hash Verified:</strong> SHA-256 DETERMINISTIC REPRODUCIBLE SHUFFLE</div>
    <div><strong>Audit Date:</strong> Session V 2026</div>
  </div>

  <!-- 4-Column Quick Grading Table (Q1 - Q100) -->
  <div class="keys-grid">
    ${renderQuarterTable(1, 25)}
    ${renderQuarterTable(26, 50)}
    ${renderQuarterTable(51, 75)}
    ${renderQuarterTable(76, 100)}
  </div>

  <!-- Page 2: Detailed Master ID to Variant Mapping -->
  <div class="page-break"></div>

  <div class="admin-header">
    <div>
      <div class="adm-title">AZM.AIO SCHOLARSHIP EXAMINATION &bull; SESSION V 2026</div>
      <div class="adm-sub">CLASS 6 &mdash; MASTER QUESTION VARIANT CROSS-REFERENCE MAPPING</div>
    </div>
    <div class="adm-badge">CONFIDENTIAL &bull; ADMIN ONLY</div>
  </div>

  <div class="section-title">MASTER QUESTIONS 1 TO 100 &bull; REVERSE LOOKUP TABLE</div>

  <table class="map-table">
    <thead>
      <tr>
        <th>Master ID</th>
        <th>Orig Q#</th>
        <th>Subject</th>
        <th>Answer</th>
        <th>Paper A</th>
        <th>Paper B</th>
        <th>Paper C</th>
        <th>Paper D</th>
        <th>Question Snippet / Reference</th>
      </tr>
    </thead>
    <tbody>
      ${masterLookupRows.join('')}
    </tbody>
  </table>

</body>
</html>
`;
}

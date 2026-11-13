import fs from 'node:fs';
import path from 'node:path';
import { pdfService } from '../documents/pdf.service';
import type { OfficialDmcPdfData, OfficialResultDetail } from './official-results.dto';

const PDF_MARGINS = { top: '8mm', right: '10mm', bottom: '15mm', left: '10mm' };

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

function decimal(value: string | null | undefined): number | null {
  if (value == null || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMarks(value: string | null | undefined): string {
  const parsed = decimal(value);
  if (parsed === null) return 'Not available';
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(parsed);
}

function formatPercent(obtained: string | null | undefined, maximum: string | null | undefined): string {
  const earned = decimal(obtained);
  const total = decimal(maximum);
  if (earned === null || total === null || total <= 0) return 'Not available';
  return `${((earned / total) * 100).toFixed(2)}%`;
}

function count(value: number | null | undefined): string {
  return Number.isInteger(value) && value! >= 0 ? value!.toLocaleString('en') : 'Not available';
}

function sumCounts(values: Array<number | null>): number | null {
  if (values.some((value) => !Number.isInteger(value) || value! < 0)) return null;
  return values.reduce<number>((sum, value) => sum + value!, 0);
}

function hasCompleteResponseEvidence(result: OfficialResultDetail): boolean {
  const questionCount = result.examination.questionCount;
  if (!Number.isInteger(questionCount) || questionCount <= 0 || result.responses.length !== questionCount) return false;
  const counts = { CORRECT: 0, WRONG: 0, BLANK: 0, MULTIPLE: 0, UNCERTAIN: 0 };
  const questionNumbers = new Set<number>();
  for (const response of result.responses) {
    if (!Number.isInteger(response.questionNumber) || response.questionNumber < 1 || response.questionNumber > questionCount || questionNumbers.has(response.questionNumber)) return false;
    if (!Object.prototype.hasOwnProperty.call(counts, response.classification)) return false;
    if (['CORRECT', 'WRONG'].includes(response.classification) && !['A', 'B', 'C', 'D'].includes(response.reviewedAnswer || '')) return false;
    questionNumbers.add(response.questionNumber);
    counts[response.classification]++;
  }
  return questionNumbers.size === questionCount
    && counts.CORRECT === result.correctCount
    && counts.WRONG === result.wrongCount
    && counts.BLANK === result.blankCount
    && counts.MULTIPLE === result.multipleCount
    && counts.UNCERTAIN === result.uncertainCount;
}

function loadLogoDataUri(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../public/logo_cropped.png'),
    path.resolve(process.cwd(), '../public/logo_cropped.png'),
    path.resolve(process.cwd(), 'public/logo_cropped.png'),
  ];
  const logoPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!logoPath) return null;
  try {
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  } catch {
    return null;
  }
}

function assertFinalResult(data: OfficialDmcPdfData, expectedType: OfficialDmcPdfData['documentType']): void {
  const result = data.result;
  if (!result.attempt?.id || !Number.isInteger(result.attempt.attemptNumber)) throw new Error('A verified examination attempt is required to generate a certificate.');
  if (data.documentType !== expectedType) throw new Error('The requested certificate type does not match the result snapshot.');
  if (!data.documentNumber.trim()) throw new Error('A document number is required to render a marks certificate.');
  if (data.resultRevision !== result.resultRevision) throw new Error('The certificate snapshot revision does not match the result revision.');
  if (result.examination.publicationStatus !== 'PUBLISHED' || result.publicationStatus !== 'PUBLISHED') {
    throw new Error('A marks certificate is available only for a published examination and result.');
  }
  if (result.identityStatus !== 'VERIFIED' || result.scoringStatus !== 'VERIFIED' || result.verificationStatus !== 'VERIFIED') {
    throw new Error('A marks certificate requires verified identity, scoring, and result review.');
  }
  if (result.uncertainCount !== 0 || result.responses.some((response) => response.classification === 'UNCERTAIN')) {
    throw new Error('A marks certificate cannot be generated while responses remain unresolved.');
  }
  if (!hasCompleteResponseEvidence(result)) {
    throw new Error('A marks certificate requires complete, internally consistent question-level response evidence.');
  }
  if (decimal(result.obtainedMarks) === null || decimal(result.maximumMarks) === null || decimal(result.maximumMarks)! <= 0) {
    throw new Error('Verified marks and a positive maximum mark are required to generate a certificate.');
  }
  const examMaximum = decimal(result.examination.maximumMarks);
  if (examMaximum === null || examMaximum <= 0 || examMaximum !== decimal(result.maximumMarks)) {
    throw new Error('The result maximum marks do not match the examination policy snapshot.');
  }
  if (!Number.isInteger(result.examination.questionCount) || result.examination.questionCount <= 0) {
    throw new Error('A valid examination question count is required to generate a certificate.');
  }

  const totals = [result.correctCount, result.wrongCount, result.blankCount, result.multipleCount, result.uncertainCount];
  if (totals.every((value) => Number.isInteger(value) && value! >= 0)) {
    const knownTotal = sumCounts(totals);
    if (knownTotal !== result.examination.questionCount) {
      throw new Error('The recorded response counts do not match the examination question count.');
    }
  }
}

function logoMarkup(): string {
  const source = loadLogoDataUri();
  if (!source) {
    return '<div class="wordmark" aria-label="AZM.AIO">AZM<span>.AIO</span></div>';
  }
  return `<img class="logo" src="${source}" alt="AZM.AIO logo" />`;
}

function styles(): string {
  return `
    @page { size: A4 portrait; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #182538; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: 100%; min-height: 260mm; page-break-after: always; position: relative; }
    .sheet:last-child { page-break-after: auto; }
    .brandline { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #173b67; padding: 0 0 10px; }
    .logo { width: 64px; height: 54px; object-fit: contain; }
    .wordmark { color: #173b67; font-size: 22px; font-weight: 800; letter-spacing: -.7px; }
    .wordmark span { color: #315fa4; }
    .brandcopy { flex: 1; min-width: 0; }
    .brandcopy strong { display: block; color: #173b67; font-size: 15px; letter-spacing: .1px; }
    .brandcopy span { display: block; margin-top: 3px; color: #667386; font-size: 8px; letter-spacing: 1.3px; text-transform: uppercase; }
    .type-label { border: 1px solid #c7d3e0; color: #173b67; padding: 6px 9px; border-radius: 3px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; white-space: nowrap; }
    h1 { color: #173b67; font-size: 21px; line-height: 1.15; margin: 14px 0 4px; }
    .subtitle { color: #687689; margin: 0; font-size: 10px; }
    .refline { display: flex; justify-content: space-between; gap: 12px; margin: 14px 0 12px; padding: 8px 10px; background: #f0f4f8; border-left: 3px solid #315fa4; font-size: 9px; }
    .refline span { color: #536277; }
    .refline strong { color: #173b67; overflow-wrap: anywhere; }
    .section-title { color: #173b67; font-size: 9px; letter-spacing: .8px; text-transform: uppercase; margin: 14px 0 7px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; border-top: 1px solid #dce3eb; }
    .detail { min-width: 0; padding: 7px 0 6px; border-bottom: 1px solid #dce3eb; }
    .detail .label { display: block; color: #788496; font-size: 7.5px; letter-spacing: .55px; text-transform: uppercase; margin-bottom: 3px; }
    .detail .value { display: block; color: #1d2b3d; font-size: 10px; font-weight: 600; overflow-wrap: anywhere; }
    .marks { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #173b67; color: #fff; border-radius: 5px; padding: 13px 16px; margin: 14px 0 10px; }
    .marks .caption { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; opacity: .82; }
    .marks .score { margin-top: 4px; font-size: 27px; font-weight: 700; line-height: 1; }
    .marks .total { font-size: 12px; font-weight: 400; opacity: .85; }
    .marks .percent { text-align: right; font-size: 16px; font-weight: 700; }
    .marks .percent small { display: block; margin-top: 4px; font-size: 7px; font-weight: 400; text-transform: uppercase; letter-spacing: .8px; opacity: .82; }
    .counts { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 8px 0 10px; }
    .count-card { border: 1px solid #dce3eb; border-radius: 4px; padding: 8px 6px; text-align: center; background: #fff; }
    .count-card .number { color: #173b67; font-size: 15px; font-weight: 700; }
    .count-card .label { margin-top: 4px; color: #667386; font-size: 7px; line-height: 1.2; text-transform: uppercase; letter-spacing: .3px; }
    .status { display: inline-block; border: 1px solid #8ac8a3; background: #edf8f1; color: #20663b; padding: 4px 7px; border-radius: 3px; font-size: 8px; font-weight: 700; }
    .adjustment { margin-top: 8px; padding: 8px 10px; border-left: 3px solid #b88223; background: #fff8e9; color: #664b1c; font-size: 8px; line-height: 1.4; }
    .certification { margin: 13px 0; color: #4b596d; font-size: 9px; line-height: 1.5; }
    .issue-box { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; border: 1px solid #dce3eb; padding: 10px 12px; border-radius: 4px; }
    .issue-box .label { display: block; color: #788496; font-size: 7px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .issue-box .value { color: #25344a; font-size: 8.5px; font-weight: 600; overflow-wrap: anywhere; }
    .signature { margin-top: 10px; border-top: 1px solid #667386; padding-top: 4px; color: #667386; font-size: 7px; }
    .document-footer { position: absolute; left: 0; right: 0; bottom: 0; border-top: 1px solid #dce3eb; padding-top: 7px; display: flex; justify-content: space-between; gap: 10px; color: #758194; font-size: 7px; }
    .page-heading { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #dce3eb; padding-bottom: 9px; margin-bottom: 12px; }
    .page-heading h2 { margin: 0; color: #173b67; font-size: 16px; }
    .page-heading p { margin: 4px 0 0; color: #69778a; font-size: 8px; }
    .policy-note { color: #56657a; border: 1px solid #dce3eb; border-radius: 4px; padding: 9px 10px; font-size: 8px; line-height: 1.5; margin-top: 12px; }
    .small-note { color: #6d7989; font-size: 8px; line-height: 1.4; margin-top: 8px; }
    @media print { .sheet { break-after: page; } .sheet:last-child { break-after: auto; } }
  `;
}

function countCards(result: OfficialResultDetail): string {
  const items: Array<[string, number | null]> = [
    ['Correct', result.correctCount],
    ['Wrong', result.wrongCount],
    ['Blank', result.blankCount],
    ['Multiple', result.multipleCount],
    ['Uncertain', result.uncertainCount],
    ['Total questions', result.examination.questionCount],
  ];
  return items.map(([label, value]) => `
    <div class="count-card"><div class="number">${escapeHtml(count(value))}</div><div class="label">${escapeHtml(label)}</div></div>
  `).join('');
}

function marksBlock(result: OfficialResultDetail): string {
  return `
    <div class="marks" aria-label="Marks obtained">
      <div><div class="caption">Marks obtained</div><div class="score">${escapeHtml(formatMarks(result.obtainedMarks))} <span class="total">/ ${escapeHtml(formatMarks(result.maximumMarks))}</span></div></div>
      <div class="percent">${escapeHtml(formatPercent(result.obtainedMarks, result.maximumMarks))}<small>Percentage</small></div>
    </div>
  `;
}

function resultAdjustment(result: OfficialResultDetail): string {
  if (!result.administrativelyAdjusted) return '';
  const reason = result.administrativeAdjustmentReason?.trim();
  return `<p class="adjustment"><strong>Administratively adjusted score.</strong>${reason ? ` ${escapeHtml(reason)}` : ' An administrative score adjustment is recorded; question-level response counts remain the original reviewed evidence.'}</p>`;
}

function commonHtml(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${styles()}</style></head><body>${body}</body></html>`;
}

function electronicHtml(data: OfficialDmcPdfData): string {
  const { result } = data;
  const generatedAt = formatDate(data.generatedAt);
  return commonHtml('Electronic Detailed Marks Certificate', `
    <main class="sheet" aria-labelledby="edmc-title">
      <header class="brandline">${logoMarkup()}<div class="brandcopy"><strong>AZM.AIO</strong><span>Scholarship examination results</span></div><div class="type-label">Electronic certificate</div></header>
      <h1 id="edmc-title">Electronic Detailed Marks Certificate</h1>
      <p class="subtitle">${escapeHtml(result.examination.title)} · ${escapeHtml(result.examination.sessionReference)} · Attempt ${escapeHtml(String(result.attempt?.attemptNumber ?? 'unverified'))} (${escapeHtml(result.attempt?.businessDate ?? 'date unavailable')})</p>
      <div class="refline"><span>Result reference&nbsp; <strong>${escapeHtml(result.resultReference)}</strong></span><span>Examination reference&nbsp; <strong>${escapeHtml(result.examination.reference)}</strong></span></div>
      <h2 class="section-title">Candidate and examination</h2>
      <div class="details">
        <div class="detail"><span class="label">Candidate name</span><span class="value">${escapeHtml(result.student.fullName)}</span></div>
        <div class="detail"><span class="label">Roll number</span><span class="value">${escapeHtml(result.student.rollNumber || 'Not available')}</span></div>
        <div class="detail"><span class="label">Application reference</span><span class="value">${escapeHtml(result.student.applicationNo || 'Not available')}</span></div>
        <div class="detail"><span class="label">Class / group</span><span class="value">${escapeHtml(result.examination.classGroup || result.student.classGroup || 'Not available')}</span></div>
        <div class="detail"><span class="label">Examination date</span><span class="value">${escapeHtml(formatDate(result.examination.examDate))}</span></div>
        <div class="detail"><span class="label">Paper version</span><span class="value">${escapeHtml(result.paperVersion || 'Not recorded')}</span></div>
        <div class="detail"><span class="label">Grade / qualification</span><span class="value">Not available — no approved examination policy configured</span></div>
      </div>
      ${marksBlock(result)}
      <div><span class="status">Verified and published</span></div>
      ${resultAdjustment(result)}
      <h2 class="section-title">OMR response summary</h2>
      <div class="counts" role="group" aria-label="Response category counts">${countCards(result)}</div>
      <p class="small-note">Response counts reflect the verified examination record. No answer key or scan image is included in this certificate.</p>
      <footer class="document-footer"><span>Document ${escapeHtml(data.documentNumber)} · Revision ${escapeHtml(result.resultRevision)}</span><span>Generated ${escapeHtml(generatedAt)} · Electronically generated document</span></footer>
    </main>
  `);
}

function officialHtml(data: OfficialDmcPdfData): string {
  const { result } = data;
  const examDate = formatDate(result.examination.examDate);
  const issueDate = formatDate(data.generatedAt);
  const fatherName = data.fatherName?.trim() || 'Not available';
  const examinationCenter = data.examinationCenter?.trim() || 'Not available';
  const issuer = data.issuedByName?.trim() || 'Not available';
  const verificationReference = data.verificationReference?.trim() || 'Not available';
  const attempted = sumCounts([result.correctCount, result.wrongCount, result.multipleCount]);
  const resolved = result.uncertainCount === 0 ? result.examination.questionCount : null;

  return commonHtml('Official Detailed Marks Certificate', `
    <main class="sheet" aria-labelledby="official-title">
      <header class="brandline">${logoMarkup()}<div class="brandcopy"><strong>AZM.AIO</strong><span>Scholarship examination results</span></div><div class="type-label">Official document</div></header>
      <h1 id="official-title">Official Detailed Marks Certificate</h1>
      <p class="subtitle">${escapeHtml(result.examination.title)} · ${escapeHtml(result.examination.sessionReference)} · Attempt ${escapeHtml(String(result.attempt?.attemptNumber ?? 'unverified'))} (${escapeHtml(result.attempt?.businessDate ?? 'date unavailable')})</p>
      <div class="refline"><span>Certificate number&nbsp; <strong>${escapeHtml(data.documentNumber)}</strong></span><span>Result revision&nbsp; <strong>${escapeHtml(data.resultRevision)}</strong></span></div>
      <h2 class="section-title">Candidate and examination particulars</h2>
      <div class="details">
        <div class="detail"><span class="label">Candidate name</span><span class="value">${escapeHtml(result.student.fullName)}</span></div>
        <div class="detail"><span class="label">Father / guardian</span><span class="value">${escapeHtml(fatherName)}</span></div>
        <div class="detail"><span class="label">Roll number</span><span class="value">${escapeHtml(result.student.rollNumber || 'Not available')}</span></div>
        <div class="detail"><span class="label">Registration reference</span><span class="value">${escapeHtml(result.student.applicationNo || 'Not available')}</span></div>
        <div class="detail"><span class="label">Class / group</span><span class="value">${escapeHtml(result.examination.classGroup || result.student.classGroup || 'Not available')}</span></div>
        <div class="detail"><span class="label">Examination date</span><span class="value">${escapeHtml(examDate)}</span></div>
        <div class="detail"><span class="label">Examination centre</span><span class="value">${escapeHtml(examinationCenter)}</span></div>
        <div class="detail"><span class="label">Paper version</span><span class="value">${escapeHtml(result.paperVersion || 'Not recorded')}</span></div>
      </div>
      ${marksBlock(result)}
      <div><span class="status">Official result · verified and published</span></div>
      ${resultAdjustment(result)}
      <p class="certification">This document reflects the published examination result identified above, at revision ${escapeHtml(data.resultRevision)}. The examination and result were verified before issuance.</p>
      <div class="issue-box">
        <div><span class="label">Certificate number</span><span class="value">${escapeHtml(data.documentNumber)}</span></div>
        <div><span class="label">Issued on</span><span class="value">${escapeHtml(issueDate)}</span></div>
        <div><span class="label">Issued by</span><span class="value">${escapeHtml(issuer)}</span></div>
        <div><span class="label">Verification reference</span><span class="value">${escapeHtml(verificationReference)}</span></div>
      </div>
      <div class="signature">Authorized signature</div>
      <footer class="document-footer"><span>Official DMC · ${escapeHtml(data.documentNumber)}</span><span>Revision ${escapeHtml(data.resultRevision)} · Page 1</span></footer>
    </main>
    <main class="sheet" aria-labelledby="performance-title">
      <header class="page-heading"><div><h2 id="performance-title">Detailed performance statement</h2><p>${escapeHtml(result.examination.title)} · ${escapeHtml(result.examination.reference)}</p></div><div class="type-label">${escapeHtml(result.student.rollNumber || result.resultReference)}</div></header>
      <div class="refline"><span>Candidate&nbsp; <strong>${escapeHtml(result.student.fullName)}</strong></span><span>Certificate&nbsp; <strong>${escapeHtml(data.documentNumber)}</strong></span></div>
      <h3 class="section-title">Overall response classification</h3>
      <div class="counts" role="group" aria-label="Response category counts">${countCards(result)}</div>
      <div class="details">
        <div class="detail"><span class="label">Total questions</span><span class="value">${escapeHtml(count(result.examination.questionCount))}</span></div>
        <div class="detail"><span class="label">Attempted responses</span><span class="value">${escapeHtml(count(attempted))}</span></div>
        <div class="detail"><span class="label">Resolved responses</span><span class="value">${escapeHtml(count(resolved))}</span></div>
        <div class="detail"><span class="label">Paper version</span><span class="value">${escapeHtml(result.paperVersion || 'Not recorded')}</span></div>
        <div class="detail"><span class="label">Marks obtained</span><span class="value">${escapeHtml(formatMarks(result.obtainedMarks))} / ${escapeHtml(formatMarks(result.maximumMarks))}</span></div>
        <div class="detail"><span class="label">Percentage</span><span class="value">${escapeHtml(formatPercent(result.obtainedMarks, result.maximumMarks))}</span></div>
      </div>
      <div class="policy-note"><strong>Result status:</strong> verified and published. Wrong, blank, and multiple responses receive marks according to the approved examination scoring policy. Question-level answers and confidential answer keys are not printed on this certificate.</div>
      ${resultAdjustment(result)}
      <p class="small-note">Only aggregate response classifications are shown because no verified subject-wise breakdown was provided. No grade, rank, qualification decision, or subject score has been inferred.</p>
      <footer class="document-footer"><span>Official DMC · ${escapeHtml(data.documentNumber)}</span><span>Revision ${escapeHtml(data.resultRevision)} · Page 2</span></footer>
    </main>
  `);
}

export async function renderElectronicDmcPdf(data: OfficialDmcPdfData): Promise<Buffer> {
  assertFinalResult(data, 'ELECTRONIC');
  return pdfService.generatePdfFromHtml(electronicHtml(data), { format: 'A4', landscape: false, margin: PDF_MARGINS });
}

export async function renderOfficialDmcPdf(data: OfficialDmcPdfData): Promise<Buffer> {
  assertFinalResult(data, 'OFFICIAL');
  if (!data.verificationReference?.trim()) throw new Error('An opaque verification reference is required for an Official DMC.');
  return pdfService.generatePdfFromHtml(officialHtml(data), { format: 'A4', landscape: false, margin: PDF_MARGINS });
}

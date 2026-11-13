import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { pdfService } from '../documents/pdf.service';
import type { OfficialDmcPdfData } from './official-results.dto';
import { renderElectronicDmcPdf, renderOfficialDmcPdf } from './dmc-pdf';

function fixture(overrides: Partial<OfficialDmcPdfData> = {}): OfficialDmcPdfData {
  const result: OfficialDmcPdfData['result'] = {
    id: 'result-synthetic-01',
    resultReference: 'R-SYNTH-001',
    studentId: 'student-synthetic-01',
    examinationId: 'exam-synthetic-01',
    student: {
      id: 'student-synthetic-01',
      fullName: 'Synthetic Candidate <script>alert(1)</script>',
      rollNumber: 'SYN-001',
      applicationNo: 'APP-SYN-001',
      classGroup: 'Synthetic Class 9',
    },
    examination: {
      id: 'exam-synthetic-01',
      revision: 1,
      reference: 'EX-SYN-2026',
      title: 'Synthetic Scholarship Examination',
      sessionReference: 'Synthetic Session',
      examDate: '2026-11-01T00:00:00.000Z',
      classGroup: 'Synthetic Class 9',
      maximumMarks: '100.00',
      questionCount: 5,
      paperVersions: ['A', 'B', 'C', 'D'],
      publicationStatus: 'PUBLISHED',
    },
    paperVersion: 'B',
    obtainedMarks: '82.50',
    maximumMarks: '100.00',
    correctCount: 3,
    wrongCount: 1,
    blankCount: 1,
    multipleCount: 0,
    uncertainCount: 0,
    identityStatus: 'VERIFIED',
    scoringStatus: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'PUBLISHED',
    resultRevision: 2,
    administrativelyAdjusted: false,
    administrativeAdjustmentReason: null,
    verifiedAt: '2026-11-02T00:00:00.000Z',
    publishedAt: '2026-11-03T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
    documents: {
      electronicAvailable: true,
      latestOfficialIssuanceStatus: 'ISSUED',
      officialIssuanceCount: 1,
    },
    sourceScanReference: null,
    responses: [
      { questionNumber: 1, detectedAnswer: 'A', reviewedAnswer: 'A', classification: 'CORRECT', marksAwarded: '27.50', responseSource: 'HUMAN_REVIEW' },
      { questionNumber: 2, detectedAnswer: 'B', reviewedAnswer: 'B', classification: 'CORRECT', marksAwarded: '27.50', responseSource: 'HUMAN_REVIEW' },
      { questionNumber: 3, detectedAnswer: 'C', reviewedAnswer: 'C', classification: 'CORRECT', marksAwarded: '27.50', responseSource: 'HUMAN_REVIEW' },
      { questionNumber: 4, detectedAnswer: 'D', reviewedAnswer: 'A', classification: 'WRONG', marksAwarded: '0.00', responseSource: 'HUMAN_REVIEW' },
      { questionNumber: 5, detectedAnswer: null, reviewedAnswer: null, classification: 'BLANK', marksAwarded: '0.00', responseSource: 'OMR_DETECTED' },
    ],
    administrativeRemarks: null,
  };
  return {
    documentType: 'ELECTRONIC',
    documentNumber: 'EDMC-SYN-001-R2',
    resultRevision: 2,
    generatedAt: '2026-11-03T12:30:00.000Z',
    verificationReference: 'opaque-synthetic-verification-ref',
    ...overrides,
    result: overrides.result ?? result,
  };
}

test('E-DMC renders an A4 PDF from the verified published snapshot and escapes candidate text', async () => {
  let capturedHtml = '';
  let capturedOptions: Record<string, unknown> | undefined;
  const pdfMock = mock.method(pdfService, 'generatePdfFromHtml', async (html: string, options?: { landscape?: boolean; format?: any; margin?: any }) => {
    capturedHtml = html;
    capturedOptions = options;
    return Buffer.from('%PDF-1.7 synthetic fixture');
  });
  try {
    const result = await renderElectronicDmcPdf(fixture());
    assert.ok(Buffer.isBuffer(result));
    assert.match(result.toString(), /^%PDF-/);
    assert.equal(capturedOptions?.format, 'A4');
    assert.equal(capturedOptions?.landscape, false);
    assert.match(capturedHtml, /Electronic Detailed Marks Certificate/);
    assert.match(capturedHtml, /82\.5/);
    assert.match(capturedHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(capturedHtml, /<script>alert\(1\)<\/script>/);
    assert.match(capturedHtml, /Not available/);
    assert.match(capturedHtml, /paper version/i);
    assert.match(capturedHtml, /Result reference/);
    assert.match(capturedHtml, /@page \{ size: A4 portrait; \}/);
    assert.doesNotMatch(capturedHtml, /answerKey|answer key value|correct answer/i);
  } finally {
    pdfMock.mock.restore();
  }
});

test('Official DMC renders two explicit pages and includes issue/revision/verification details without a fake signature', async () => {
  let capturedHtml = '';
  const pdfMock = mock.method(pdfService, 'generatePdfFromHtml', async (html: string) => {
    capturedHtml = html;
    return Buffer.from('%PDF-1.7 synthetic fixture');
  });
  try {
    const input = fixture({
      documentType: 'OFFICIAL',
      documentNumber: 'ODMC-SYN-001-R2-I1',
      issuedByName: 'Synthetic Super Admin',
      fatherName: 'Synthetic Guardian',
      examinationCenter: 'Synthetic Hall',
    });
    const result = await renderOfficialDmcPdf(input);
    assert.ok(Buffer.isBuffer(result));
    assert.match(capturedHtml, /Official Detailed Marks Certificate/);
    assert.match(capturedHtml, /Detailed performance statement/);
    assert.match(capturedHtml, /Certificate number/);
    assert.match(capturedHtml, /Synthetic Guardian/);
    assert.match(capturedHtml, /Synthetic Hall/);
    assert.match(capturedHtml, /opaque-synthetic-verification-ref/);
    assert.match(capturedHtml, /Authorized signature/);
    assert.doesNotMatch(capturedHtml, /<img[^>]+signature|data:image\/[^;]+;base64,[^" ]*signature/i);
    assert.match(capturedHtml, /Page 1/);
    assert.match(capturedHtml, /Page 2/);
    assert.match(capturedHtml, /No grade, rank, qualification decision, or subject score has been inferred/);
  } finally {
    pdfMock.mock.restore();
  }
});

test('certificate renderers refuse unpublished, unverified, stale, or unresolved results before PDF generation', async () => {
  let calls = 0;
  const pdfMock = mock.method(pdfService, 'generatePdfFromHtml', async () => {
    calls += 1;
    return Buffer.from('%PDF-1.7 synthetic fixture');
  });
  try {
    await assert.rejects(renderElectronicDmcPdf(fixture({
      result: { ...fixture().result, publicationStatus: 'UNPUBLISHED' },
    })), /published examination and result/);
    await assert.rejects(renderElectronicDmcPdf(fixture({
      result: { ...fixture().result, identityStatus: 'PENDING' },
    })), /verified identity/);
    await assert.rejects(renderElectronicDmcPdf(fixture({
      resultRevision: 1,
    })), /snapshot revision/);
    await assert.rejects(renderElectronicDmcPdf(fixture({
      result: { ...fixture().result, uncertainCount: 1, responses: [{ questionNumber: 1, detectedAnswer: null, reviewedAnswer: null, classification: 'UNCERTAIN', marksAwarded: null, responseSource: 'OMR_DETECTED' }] },
    })), /unresolved/);
    await assert.rejects(renderElectronicDmcPdf(fixture({ result: { ...fixture().result, responses: [] } })), /complete, internally consistent question-level response evidence/);
    assert.equal(calls, 0);
  } finally {
    pdfMock.mock.restore();
  }
});

test('Official DMC requires an opaque verification reference', async () => {
  const pdfMock = mock.method(pdfService, 'generatePdfFromHtml', async () => Buffer.from('%PDF-1.7 synthetic fixture'));
  try {
    await assert.rejects(renderOfficialDmcPdf(fixture({
      documentType: 'OFFICIAL',
      verificationReference: null,
    })), /opaque verification reference/);
  } finally {
    pdfMock.mock.restore();
  }
});

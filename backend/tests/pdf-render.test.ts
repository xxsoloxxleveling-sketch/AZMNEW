import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pdfService } from '../src/modules/documents/pdf.service';

async function run() {
  const student = {
    id: 'pdf-test', applicationNo: 'APP-TEST-0001', fullName: 'Test Candidate',
    fatherName: 'Test Guardian', currentClass: 'Class 10', cnicOrBForm: '00000-0000000-0',
    officeUse: { testRollNo: 'AZMVS-2026-0100' },
  };
  const omr = pdfService.generateOmrSheetHtml(student, '');
  const slip = pdfService.generateRollSlipHtml(student);
  assert(omr.includes(student.officeUse.testRollNo));
  assert(slip.includes(student.officeUse.testRollNo));
  assert(!omr.includes('PROV-APP-TEST'));
  const cases = {
    omr, slip,
    'bulk-omr': pdfService.generateBulkOmrSheetsHtml([{ student, qrDataUrl: '' }, { student, qrDataUrl: '' }]),
    'bulk-slip': pdfService.generateBulkRollSlipsHtml([{ student, qrDataUrl: '' }, { student, qrDataUrl: '' }]),
  };
  fs.mkdirSync('tmp/pdfs', { recursive: true });
  for (const [name, html] of Object.entries(cases)) {
    const buffer = await pdfService.generatePdfFromHtml(html);
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    assert(buffer.length > 1000);
    fs.writeFileSync(`tmp/pdfs/test-${name}.pdf`, buffer);
    console.log(`PASS: ${name} rendered (${buffer.length} bytes)`);
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

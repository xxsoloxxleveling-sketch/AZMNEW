import assert from 'node:assert/strict';
import { getPrintableHsscGroup, pdfService } from '../src/modules/documents/pdf.service';

for (const grade of ['HSSC-I (Class 11th)', 'HSSC-II (Class 12th)', 'First Year', 'Second Year',
  'HSSC-I', 'HSSC-II', 'HSSC1', 'HSSC2', '1st Year', '2nd Year', 'Class 11th (HSSC-I)',
  'Class 12th (HSSC-II)', 'Class 11', 'Class 12', 'Class 11th', 'Class 12th', '11th', '12th', '11', '12']) {
  for (const group of ['Pre-Medical', 'Pre-Engineering', 'ICS', 'FA', 'I.Com', 'General Science']) {
    const student = { id: 'synthetic', applicationNo: 'APP-TEST', fullName: 'Synthetic Student', fatherName: 'Synthetic Guardian',
      currentClass: grade, hsscGroup: group, cnicOrBForm: '0000000000000' };
    assert.equal(getPrintableHsscGroup(student), group);
    const roll = pdfService.generateRollSlipHtml(student);
    const omr = pdfService.generateOmrSheetHtml(student);
    assert(roll.includes('HSSC Group:') && roll.includes(group), 'Roll slip missing ' + grade + ' ' + group);
    assert(omr.includes('Class / HSSC Group:') && omr.includes(group), 'OMR missing ' + grade + ' ' + group);
  }
}
assert.equal(getPrintableHsscGroup({ currentClass: 'First Year' }), 'Not specified');
assert.equal(getPrintableHsscGroup({ currentClass: ' First Year ', hsscGroup: '  pre-medical ' }), 'Pre-Medical');
for (const group of [null, '', ' ', 'Unknown']) {
  const student = { currentClass: 'Second Year', hsscGroup: group, bsDepartment: 'Unrelated department' };
  assert.equal(getPrintableHsscGroup(student), 'Not specified');
  for (const html of [pdfService.generateRollSlipHtml(student), pdfService.generateOmrSheetHtml(student)]) {
    assert(html.includes('Not specified'));
    assert(!html.includes('Unrelated department'), 'Missing HSSC group must not fall back to BS department');
  }
}
for (const grade of ['Class 10th', 'SSC-I', 'Class 110', 'BS 11th Semester', 'Not HSSC', '', null]) {
  const student = { currentClass: grade, hsscGroup: 'Pre-Medical', bsDepartment: 'Computer Science' };
  assert.equal(getPrintableHsscGroup(student), null);
  for (const html of [pdfService.generateRollSlipHtml(student), pdfService.generateOmrSheetHtml(student)]) {
    assert(!html.includes('HSSC Group:'), 'Non-HSSC class incorrectly labelled: ' + grade);
    assert(!html.includes('Pre-Medical'), 'Stale HSSC group printed for non-HSSC class');
    assert(html.includes('Computer Science'), 'BS department no longer printed');
  }
}
const bulkStudents = ['Pre-Medical', 'Pre-Engineering', 'ICS', 'FA', 'I.Com', 'General Science'].map((group, index) => ({
  student: { currentClass: index % 2 ? 'Second Year' : 'First Year', hsscGroup: group }, qrDataUrl: '',
}));
for (const html of [pdfService.generateBulkRollSlipsHtml(bulkStudents), pdfService.generateBulkOmrSheetsHtml(bulkStudents)]) {
  assert.equal((html.match(/HSSC Group:/g) || []).length, 6);
  for (const { student } of bulkStudents) assert(html.includes(student.hsscGroup), 'Bulk PDF missing ' + student.hsscGroup);
}
assert.equal(getPrintableHsscGroup({ currentClass: 'Class 10th', hsscGroup: 'Pre-Medical' }), null);
assert(!pdfService.generateRollSlipHtml({currentClass: 'Class 10th'}).includes('HSSC Group:'));
assert(!pdfService.generateOmrSheetHtml({currentClass: 'Class 10th'}).includes('Class / HSSC Group:'));
console.log('PASS: HSSC groups on both PDF templates and non-HSSC controls');

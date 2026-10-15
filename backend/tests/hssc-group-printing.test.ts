import assert from 'node:assert/strict';
import { getPrintableHsscGroup, pdfService } from '../src/modules/documents/pdf.service';

for (const grade of ['HSSC-I (Class 11th)', 'HSSC-II (Class 12th)', 'First Year', 'Second Year']) {
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
assert.equal(getPrintableHsscGroup({ currentClass: 'Class 10th', hsscGroup: 'Pre-Medical' }), null);
assert(!pdfService.generateRollSlipHtml({currentClass: 'Class 10th'}).includes('HSSC Group:'));
assert(!pdfService.generateOmrSheetHtml({currentClass: 'Class 10th'}).includes('Class / HSSC Group:'));
console.log('PASS: HSSC groups on both PDF templates and non-HSSC controls');

import assert from 'node:assert/strict';
import { getPrintableHsscGroup, pdfService } from '../src/modules/documents/pdf.service';
import { HSSC_GROUP_OPTIONS, classifyHsscClass, resolveHsscGroup, STUDY_GROUP_REVIEW } from '../src/modules/students/hsscContract';
import { getPrintableHsscGroup as frontendGroup } from '../../src/utils/hsscGroup';

const aliases = ['HSSC-I (Class 11th)', 'HSSC-II (Class 12th)', 'First Year', 'Second Year',
  'HSSC-I', 'HSSC-II', 'HSSC1', 'HSSC2', 'HSSC 1', 'HSSC 2', '1st Year', '2nd Year',
  'Class 11th (HSSC-I)', 'Class 12th (HSSC-II)', 'Class 11', 'Class 12', 'Class 11th', 'Class 12th', '11th', '12th', '11', '12',
  '  hssc – ii ( class 12th )  ', ' FIRST   YEAR ', 'HSSC — I'];
let combinations = 0;
for (const currentClass of aliases) for (const option of HSSC_GROUP_OPTIONS) {
  const student = { id: 'synthetic', applicationNo: 'SYNTHETIC-1', fullName: 'Synthetic Student', fatherName: 'Synthetic Guardian', currentClass, hsscGroup: option.value, cnicOrBForm: '0000000000000' };
  assert.equal(classifyHsscClass(currentClass).kind, 'hssc');
  assert.equal(getPrintableHsscGroup(student), option.label);
  assert.equal(frontendGroup(student), getPrintableHsscGroup(student));
  for (const html of [pdfService.generateRollSlipHtml(student), pdfService.generateOmrSheetHtml(student)]) assert(html.includes('HSSC Group:') && html.includes(option.label));
  combinations++;
}
for (const [value, group] of [['Pre Medical', 'Pre-Medical'], ['Pre-Engg', 'Pre-Engineering'], ['Pre_Engineering', 'Pre-Engineering'], ['Computer Science', 'ICS'], ['Science (computer science)', 'ICS'], ['Computer Science (ICS)', 'ICS']]) {
  const result = resolveHsscGroup({ currentClass: 'Class 12th', hsscGroup: value }); assert.equal(result.group, group); assert.equal(result.status, 'alias');
}
for (const [hsscGroup, status] of [[null, 'missing'], ['', 'missing'], [' ', 'missing'], ['Unknown', 'unsupported'], ['Science', 'unsupported'], ['Biology', 'unsupported'], ['Fsc', 'unsupported'], ['Pre-Medical / ICS', 'conflicting'], ['Science / Pre-Medical', 'unverified-default'], ['Science (Biology/Pre-Medical)', 'unverified-default']] as const) {
  const student = { id: 'synthetic', currentClass: 'Second Year', hsscGroup, bsDepartment: 'Unrelated department' };
  assert.equal(resolveHsscGroup(student).status, status); assert.equal(resolveHsscGroup(student).group, null);
  assert.equal(getPrintableHsscGroup(student), STUDY_GROUP_REVIEW);
  for (const render of [() => pdfService.generateRollSlipHtml(student), () => pdfService.generateOmrSheetHtml(student), () => pdfService.generateBulkOmrSheetsHtml([{ student, qrDataUrl: '' }])]) assert.throws(render, (error: any) => error.code === 'HSSC_GROUP_REVIEW_REQUIRED');
}
for (const currentClass of ['Class 10th', 'SSC-I', 'Class 110', 'BS 11th Semester', 'Not HSSC', '', null]) {
  const student = { id: 'synthetic', currentClass, hsscGroup: 'Pre-Medical', bsDepartment: 'Computer Science' };
  assert.equal(getPrintableHsscGroup(student), null);
  for (const html of [pdfService.generateRollSlipHtml(student), pdfService.generateOmrSheetHtml(student)]) {
    assert(!html.includes('HSSC Group:')); assert(!html.includes('Pre-Medical')); assert(html.includes('Computer Science'));
  }
}
for (const currentClass of ['HSSC-I (Class 12th)', 'Class 11 (HSSC-II)', 'HSSC-I / HSSC-II']) {
  assert.equal(classifyHsscClass(currentClass).kind, 'conflicting');
  assert.throws(() => pdfService.generateOmrSheetHtml({ id: 'synthetic', currentClass, hsscGroup: 'ICS' }));
}
const sheets = HSSC_GROUP_OPTIONS.map((option, index) => ({ student: { id: 'synthetic-' + index, currentClass: index % 2 ? 'Second Year' : 'First Year', hsscGroup: option.value }, qrDataUrl: '' }));
for (const html of [pdfService.generateBulkRollSlipsHtml(sheets), pdfService.generateBulkOmrSheetsHtml(sheets)]) {
  assert.equal((html.match(/HSSC Group:/g) || []).length, 6);
  for (const option of HSSC_GROUP_OPTIONS) assert(html.includes(option.label));
}
console.log(`PASS: ${combinations} class/group render pairs, exact aliases, unresolved/default blocking, contradictory-year and non-HSSC controls`);

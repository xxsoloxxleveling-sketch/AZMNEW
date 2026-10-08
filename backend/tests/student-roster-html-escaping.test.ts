import assert from 'node:assert/strict';
import sharp from 'sharp';
import { pdfService } from '../src/modules/documents/pdf.service';

async function run() {
  let passed = 0;
  const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`PASS ${name}`); };
  const render = (student: any, filters: any = {}) => pdfService.generateStudentsListHtml([student], filters, 1);
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const attacks = ["<script>alert('x')</script>", '<img src=x onerror=alert(1)>', '</td><script>alert(1)</script>', `A & < > ' "`];
  const fields = ['fullName', 'fatherName', 'applicationNo', 'id', 'cnicOrBForm', 'currentClass', 'scholarshipCategory', 'attendancePercentage', 'schoolName', 'parentMobile', 'studentMobile', 'mobile', 'whatsapp', 'emergencyContact'];
  for (const field of fields) check(`${field} escapes every malicious string`, () => {
    for (const attack of attacks) {
      const html = render({ [field]: attack });
      assert(html.includes(escape(attack)), field);
      assert(!html.includes(attack), field);
      assert(!html.includes('&amp;lt;script'), 'escape exactly once');
    }
  });
  check('roll number is escaped without altering paid behavior', () => {
    const html = render({ rollNumber: attacks[0] });
    assert(html.includes(escape(attacks[0]))); assert(!html.includes(attacks[0])); assert(html.includes('badge-paid'));
  });
  check('fee record status is escaped', () => {
    for (const attack of attacks) { const html = render({ feeRecords: [{ status: attack }] }); assert(html.includes(escape(attack))); assert(!html.includes(attack)); }
  });
  for (const field of ['classLevel', 'status', 'search', 'gender']) check(`${field} filter safe in populated and empty rosters`, () => {
    for (const attack of attacks) for (const students of [[], [{}]]) {
      const html = pdfService.generateStudentsListHtml(students, { [field]: attack }, students.length);
      assert(!html.includes(attack));
      if (field !== 'gender') assert(html.includes(escape(attack)));
      assert(!html.includes('&amp;lt;script'));
    }
  });
  check('ordinary names, Unicode and Urdu remain readable', () => {
    const html = render({ fullName: 'محمد علی — Zoë', fatherName: 'عبدالرحمان', schoolName: 'École' });
    for (const text of ['محمد علی — Zoë', 'عبدالرحمان', 'École']) assert(html.includes(text));
  });
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#567890' } }).toFormat(format).toBuffer();
    const source = `data:image/${format};base64,${bytes.toString('base64')}`;
    check(`valid ${format} portrait preserved`, () => { const html = render({ rosterPhotoDataUrl: source }); assert(html.includes(`src="${source}"`)); assert(!html.includes('>No photo<')); });
    check(`mismatched ${format} MIME rejected`, () => { assert(render({ rosterPhotoDataUrl: source.replace(`image/${format}`, `image/${format === 'png' ? 'jpeg' : 'png'}`) }).includes('>No photo<')); });
  }
  check('unsafe, malformed, remote and missing portraits use placeholders', () => {
    for (const source of [undefined, '', 'https://attacker.invalid/photo.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YXR0YWNr', 'data:image/jpeg;base64,/9j/2Q==" onerror="alert(1)', 'data:image/png;base64,!!!!']) {
      const html = render({ rosterPhotoDataUrl: source }); assert(html.includes('>No photo<')); assert(!html.includes('<img class="roster-photo"'));
    }
  });
  check('roster columns, layout, counts and filtered/selected calling conventions preserved', () => {
    const students = [{ fullName: 'Candidate One', rollNumber: 'R-1' }, { fullName: 'Candidate Two' }];
    for (const filters of [{}, { classLevel: 'Class 9th', gender: 'FEMALE', status: 'ACTIVE', search: 'Candidate' }]) {
      const html = pdfService.generateStudentsListHtml(students, filters, 2);
      assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 11);
      assert.equal((html.match(/<tbody>([\s\S]*?)<\/tbody>/)![1].match(/<tr /g) || []).length, 2);
      assert(html.includes('width: 28px; height: 28px;'));
      assert(html.includes('Total Candidates: <strong>2</strong>'));
      assert(html.includes('Paid: <strong style="color: #166534;">1</strong>'));
      assert(html.includes('Unpaid: <strong style="color: #92400e;">1</strong>'));
      assert(html.includes('Candidate One') && html.includes('Candidate Two'));
    }
  });
  console.log(`TOTAL ${passed} PASS; 0 FAIL`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });

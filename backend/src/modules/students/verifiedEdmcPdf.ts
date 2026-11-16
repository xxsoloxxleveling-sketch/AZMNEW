import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../lib/prisma';
import { pdfService } from '../documents/pdf.service';
import { studentsService } from './students.service';
import { findPublishedProvisionalMarks, provisionalEdmcOutcome, type ProvisionalOmrMark } from './provisionalOmrMarks';
import { findPublishedManualExamMarks } from './manualExamMarks';

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const notices = [
  'This E-DMC displays verified final examination marks. It is not the Official / Original DMC.',
  'The Official / Original DMC will be provided by the Regional Office.',
  'Errors and omissions excepted.',
  'This E-DMC is an information copy and is not a substitute for the Official / Original DMC in government or private-sector proceedings.',
  'This E-DMC does not guarantee the award of a scholarship.',
  'The second phase of selection will be interviews.',
] as const;

export interface VerifiedEdmcPrintData {
  fullName: string; fatherName: string; rollNumber: string; applicationNo: string;
  className: string; studyGroup: string | null; semester: string | null;
  schoolName: string | null; district: string | null; testCenter: string | null;
  verifiedAt: Date; obtainedMarks: number; maximumMarks: number;
  photoDataUrl: string | null; logoDataUrl: string | null;
  resultSource?: 'OMR_SCAN' | 'MANUAL_ENTRY';
}

function conflict(message: string): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = 409;
  throw err;
}

export function assertVerifiedEdmcScore(mark: ProvisionalOmrMark | undefined): asserts mark is ProvisionalOmrMark {
  if (!mark?.verified || !mark.verifiedAt) conflict('Verify this student\'s final marks before downloading the E-DMC.');
  provisionalEdmcOutcome(mark.obtainedMarks, mark.maximumMarks);
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi',
}).format(date);

function field(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return '<div class="field"><span>' + escapeHtml(label)
    + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

const style = [
  '@page{size:A4 portrait;margin:7mm 8mm 11mm}',
  '*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif;color:#14314a;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
  '.sheet{min-height:244mm;padding:10px 17px;border:3px double #0c355a;position:relative;background:#fff}',
  '.sheet:before,.sheet:after{content:"";position:absolute;left:0;right:0;height:7px;background:linear-gradient(90deg,#0c355a 0 29%,#2b88bc 29% 53%,#24834f 53% 77%,#0c355a 77%)}',
  '.sheet:before{top:0}.sheet:after{bottom:0}',
  'header{text-align:center;padding:4px 0 9px}.logo{max-height:53px;max-width:160px;object-fit:contain;display:block;margin:0 auto 5px}',
  '.wordmark{font:800 30px Arial,sans-serif;color:#0c355a}.kicker{font:700 10px Arial,sans-serif;letter-spacing:1.7px;color:#137743}',
  'h1{font-size:43px;letter-spacing:2px;color:#0c355a;margin:5px 0}.ribbon{display:inline-block;background:#0c355a;color:white;padding:8px 22px;border-left:5px solid #137743;border-right:5px solid #137743;font-size:16px;font-weight:700}',
  '.sub{font:700 9px Arial,sans-serif;color:#62778a;letter-spacing:1px;margin-top:11px}',
  '.identity{display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:12px;padding:9px 12px;background:#f5f9fc;border:1px solid #bfd2df;border-radius:7px}',
  'h2{font:800 12px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#0c355a;margin:0 0 9px}',
  '.field{display:grid;grid-template-columns:36% minmax(0,1fr);gap:8px;padding:3px 0;border-bottom:1px solid #ddeaf0;font:10px/1.5 Arial,sans-serif}',
  '.field span{color:#537186;font-weight:600}.field strong{color:#123550;font-size:11px;overflow-wrap:anywhere}',
  '.portrait{width:132px;margin:0}.portrait img,.no-photo{display:block;width:132px;height:140px;object-fit:cover;object-position:center top;border:3px solid white;outline:1px solid #9db9cb}',
  '.no-photo{background:#e9eff4;display:flex;align-items:center;justify-content:center;text-align:center;font:700 10px Arial,sans-serif;color:#668093}',
  'figcaption{margin-top:8px;font:700 8px Arial,sans-serif;letter-spacing:.5px;text-align:center;color:#617d90}',
  '.section-title{margin:10px 0 6px;padding:7px 11px;background:#0c355a;border-left:5px solid #137743;color:white;border-radius:5px;font-size:14px;font-weight:700}',
  '.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}',
  '.stat{padding:9px 4px;text-align:center;border:1px solid #b9d0df;border-radius:6px;background:#f5f9fc}.stat label{font:700 10px Arial,sans-serif;text-transform:uppercase;color:#55758b}',
  '.stat strong{display:block;margin:6px 0;font:bold 36px Georgia,serif;color:#0c355a}.stat strong small{font-size:15px;font-weight:500;color:#617c90}',
  '.stat.pass{background:#eef8ef;border-color:#a6cfb3}.stat.pass strong{color:#076b39}.stat.fail{background:#fff3eb;border-color:#eec7ad}.stat.fail strong{color:#994b28}',
  '.stat em{font:700 9px Arial,sans-serif;font-style:normal;color:#657d8d}.pass-rule{background:#eff8f1;color:#215e3a;border:1px solid #c1e2c9;border-radius:5px;margin:8px 0 0;padding:9px 11px;font:11px Arial,sans-serif}',
  '.notices{list-style:none;padding:7px 11px;margin:0;border:1px solid #c9dae4;border-radius:0 0 5px 5px;background:#fafeff}',
  '.notices li{display:flex;gap:9px;margin:0 0 4px;font:10px/1.4 Arial,sans-serif;color:#294a63}.notices li:last-child{margin:0}',
  '.notice-num{flex:0 0 18px;height:18px;text-align:center;line-height:18px;border-radius:50%;background:#18723e;color:white;font:700 10px/18px Arial,sans-serif}',
  'footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #cbdce6;margin-top:7px;padding-top:6px;color:#597487;font:10px/1.45 Arial,sans-serif}',
  'footer b{font-size:13px;color:#0c355a}',
].join('\n');

/** Escapes student data and renders exactly one overall mark, never fabricated subjects. */
export function buildVerifiedEdmcHtml(record: VerifiedEdmcPrintData): string {
  const result = provisionalEdmcOutcome(record.obtainedMarks, record.maximumMarks);
  const photo = record.photoDataUrl
    ? '<img src="' + escapeHtml(record.photoDataUrl) + '" alt="Student photograph"/>'
    : '<div class="no-photo">PHOTO NOT<br/>AVAILABLE</div>';
  const logo = record.logoDataUrl
    ? '<img class="logo" src="' + escapeHtml(record.logoDataUrl) + '" alt="AZM.AIO logo"/>'
    : '<div class="wordmark">AZM.AIO</div>';
  const percentage = Number.isInteger(result.percentage) ? String(result.percentage) : result.percentage.toFixed(2);

  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>AZM E-DMC</title><style>',
    style,
    '</style></head><body><main class="sheet"><header>',
    logo,
    '<div class="kicker">AZM.AIO · SESSION V 2026</div><h1>E-DMC</h1>',
    '<div class="ribbon">Electronic Detailed Marks Certificate</div>',
    '<div class="sub">VERIFIED FINAL MARKS · NOT THE OFFICIAL / ORIGINAL DMC</div></header>',
    '<section class="identity"><div><h2>Candidate information</h2>',
    field('Student name',record.fullName),
    field("Father's name",record.fatherName),
    field('Roll number',record.rollNumber),
    field('Application number',record.applicationNo),
    field('Class',record.className),
    field('Study group',record.studyGroup),
    field('Semester',record.semester),
    field('School / institution',record.schoolName),
    field('Test centre',record.testCenter),
    field('District',record.district),
    field('Examination session','Session V · 2026'),
    field('Marks verified',formatDate(record.verifiedAt)),
    field('Marks source',record.resultSource === 'MANUAL_ENTRY' ? 'Verified administrative mark entry' : 'Verified OMR score'),
    '</div><figure class="portrait">',photo,'<figcaption>STUDENT PHOTOGRAPH</figcaption></figure></section>',
    '<div class="section-title">Examination marks summary</div><section class="stats">',
    '<div class="stat"><label>Final obtained marks</label><strong>',
    String(record.obtainedMarks),'<small> / ',String(record.maximumMarks),'</small></strong></div>',
    '<div class="stat"><label>Percentage</label><strong>',percentage,'<small>%</small></strong></div>',
    '<div class="stat ',result.resultStatus==='PASS'?'pass':'fail','"><label>Result status</label><strong>',
    result.resultStatus,'</strong><em>VERIFIED</em></div></section>',
    '<p class="pass-rule">Passing rule: <b>60 marks or above = Pass.</b> Below 60 is Fail.</p>',
    '<div class="section-title">Important notice</div><ol class="notices">',
    ...notices.map((notice,i) => '<li><span class="notice-num">'+(i+1)+'</span><span>'+escapeHtml(notice)+'</span></li>'),
    '</ol><footer><div><b>AZM.AIO</b><div>Scholarship Examination · Session V 2026</div></div>',
    '<div>Electronically generated for information only.<br/>Official / Original DMC issued separately by Regional Office.</div>',
    '</footer></main></body></html>',
  ].join('');
}

function loadLogo(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../public/logo_cropped.png'),
    '/var/www/azmaio/logo_cropped.png',
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const file = fs.readFileSync(candidate);
        if (file.length > 0 && file.length < 900_000) {
          return 'data:image/png;base64,' + file.toString('base64');
        }
      }
    } catch { /* The print fallback is the text brand. */ }
  }
  return null;
}

/** Super Admin-only controller route calls this method. */
export async function generateVerifiedEdmcPdf(studentId: string): Promise<{ buffer: Buffer; filename: string }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      status: true, fullName: true, fatherName: true, rollNumber: true,
      applicationNo: true, currentClass: true, schoolName: true, hsscGroup: true,
      bsDepartment: true, bsSemester: true, district: true, registrationCentre: true,
      officeUse: { select: { testCentre: true } },
    },
  });
  if (!student || student.status !== 'ACTIVE' || !student.rollNumber) {
    const error = new Error('Student record is unavailable for E-DMC issuance.') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }
  const omr = (await findPublishedProvisionalMarks([studentId])).get(studentId);
  const manual = omr ? undefined : (await findPublishedManualExamMarks([studentId])).get(studentId);
  if (omr) {
    assertVerifiedEdmcScore(omr);
  } else if (!manual?.verified || !manual.verifiedAt ||
    manual.rollNumberSnapshot !== student.rollNumber ||
    manual.applicationNoSnapshot !== student.applicationNo) {
    conflict('Verify this student\'s manual examination marks before downloading the E-DMC.');
  }
  const obtainedMarks = omr?.obtainedMarks ?? manual!.obtainedMarks;
  const maximumMarks = omr?.maximumMarks ?? manual!.maximumMarks;
  const verifiedAt = (omr?.verifiedAt ?? manual!.verifiedAt)!;
  let photoDataUrl: string | null = null;
  try {
    const image = await studentsService.getStudentDocument(studentId, 'photoThumbnail');
    if (['image/jpeg','image/png','image/webp'].includes(image.contentType) &&
        image.buffer.length > 0 && image.buffer.length <= 250_000) {
      photoDataUrl = 'data:' + image.contentType + ';base64,' + image.buffer.toString('base64');
    }
  } catch { /* Never substitute an unrelated photograph. */ }

  const html = buildVerifiedEdmcHtml({
    fullName: student.fullName, fatherName: student.fatherName,
    rollNumber: student.rollNumber, applicationNo: student.applicationNo,
    className: student.currentClass, studyGroup: student.hsscGroup || student.bsDepartment || null,
    semester: student.bsSemester || null, schoolName: student.schoolName,
    district: student.district, testCenter: student.officeUse?.testCentre || student.registrationCentre || null,
    verifiedAt, obtainedMarks, maximumMarks,
    logoDataUrl: loadLogo(), photoDataUrl,
    resultSource: manual ? 'MANUAL_ENTRY' : 'OMR_SCAN',
  });
  const buffer = await pdfService.generatePdfFromHtml(html, {
    format: 'A4', landscape: false,
    margin: { top: '7mm', right: '8mm', bottom: '11mm', left: '8mm' },
  });

  // Verification is revision-specific. A correction or an identity change
  // during rendering must invalidate this download.
  const currentOmr = (await findPublishedProvisionalMarks([studentId])).get(studentId);
  const currentManual = currentOmr ? undefined : (await findPublishedManualExamMarks([studentId])).get(studentId);
  const current = currentOmr ?? currentManual;
  if (!current?.verified || current.obtainedMarks !== obtainedMarks ||
      current.maximumMarks !== maximumMarks ||
      current.verifiedAt?.getTime() !== verifiedAt.getTime() ||
      Boolean(currentManual) !== Boolean(manual)) {
    conflict('The verified result changed while generating the E-DMC. Refresh and try again.');
  }
  const safeRoll = student.rollNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return { buffer, filename: 'AZM-E-DMC-' + safeRoll + '.pdf' };
}

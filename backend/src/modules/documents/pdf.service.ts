import puppeteer from 'puppeteer';
import { logger } from '../../lib/logger';

export class PdfService {
  /**
   * Generates a PDF buffer from an HTML string using Puppeteer.
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
      });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '10mm',
          right: '10mm',
        },
      });

      return Buffer.from(pdfUint8Array);
    } catch (err) {
      logger.error('Error generating PDF via Puppeteer:', err);
      throw err;
    } finally {
      await browser.close();
    }
  }

  /**
   * Formats CNIC as 13 digit visual box cells
   */
  private formatCnicBoxes(cnic?: string): string {
    const raw = (cnic || '').replace(/\D/g, '').padEnd(13, ' ');
    const digits = raw.split('');
    const p1 = digits.slice(0, 5).map((d) => `<span class="digit-box">${d.trim()}</span>`).join('');
    const p2 = digits.slice(5, 12).map((d) => `<span class="digit-box">${d.trim()}</span>`).join('');
    const p3 = digits.slice(12, 13).map((d) => `<span class="digit-box">${d.trim()}</span>`).join('');
    return `<div class="cnic-container">${p1} <span class="hyphen">-</span> ${p2} <span class="hyphen">-</span> ${p3}</div>`;
  }

  /**
   * Helper for checkmark box
   */
  private renderCheck(checked: boolean, label: string): string {
    return `<span class="check-item"><span class="check-box">${checked ? '&#10003;' : '&nbsp;'}</span> <span class="check-label">${label}</span></span>`;
  }

  /**
   * Generates filled HTML template for the 2-page Student Registration Form
   */
  generateStudentRegistrationHtml(student: any): string {
    const cnicBoxes = this.formatCnicBoxes(student.cnicOrBForm);
    const dobStr = student.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString().split('T')[0]
      : '';
    const docs = student.documents || {};
    const office = student.officeUse || {};
    const academicRecords = student.academicRecords || [];

    const isMale = student.gender === 'MALE';
    const isFemale = student.gender === 'FEMALE';

    const isGeneral = student.scholarshipCategory === 'GENERAL_MERIT';
    const isNeedy = student.scholarshipCategory === 'FINANCIALLY_NEEDY';
    const isOrphan = student.scholarshipCategory === 'ORPHAN';
    const isPwd = student.scholarshipCategory === 'PERSON_WITH_DISABILITY';

    const qrImg = student.qrImageUrl
      ? `<img src="${student.qrImageUrl}" class="qr-code-img" alt="QR" />`
      : '';
    const photoImg = student.photoUrl
      ? `<img src="${student.photoUrl}" class="photo-img" alt="Photo" />`
      : `<div class="photo-placeholder">Affix 1 Recent<br/>Passport Size<br/>Photograph<br/>(Attested)</div>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM Scholarship Registration - ${student.applicationNo || 'Form'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; }
    body { background: #fff; padding: 0; }
    .page { width: 100%; min-height: 277mm; page-break-after: always; padding: 5mm 0; position: relative; }
    .page:last-child { page-break-after: avoid; }
    
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; }
    .header-left { width: 75%; vertical-align: top; }
    .header-right { width: 25%; text-align: right; vertical-align: top; }
    
    .org-title { font-size: 17px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
    .form-title { font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
    .sub-title { font-size: 10px; color: #475569; font-weight: 500; }
    
    .photo-box { width: 85px; height: 100px; border: 1.5px dashed #64748b; display: inline-flex; align-items: center; justify-content: center; text-align: center; font-size: 8.5px; color: #64748b; background: #f8fafc; border-radius: 4px; overflow: hidden; }
    .photo-img { width: 100%; height: 100%; object-fit: cover; }
    .qr-code-img { width: 80px; height: 80px; }

    .id-ribbon { display: flex; justify-content: space-between; background: #f1f5f9; padding: 5px 10px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 8px; font-weight: 600; }
    .id-ribbon span { font-size: 10.5px; }
    .id-ribbon strong { color: #1e3a8a; }

    .section-bar { background: #1e3a8a; color: #ffffff; font-size: 10.5px; font-weight: 700; padding: 4px 8px; border-radius: 3px; margin: 7px 0 5px 0; text-transform: uppercase; letter-spacing: 0.3px; }
    
    .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .grid-table td { padding: 3.5px 4px; vertical-align: middle; }
    .label { font-weight: 600; color: #334155; width: 18%; font-size: 10px; }
    .value { border-bottom: 1px solid #94a3b8; font-weight: 500; font-size: 10.5px; color: #0f172a; padding-left: 4px; }
    
    .cnic-container { display: inline-flex; align-items: center; gap: 2px; }
    .digit-box { display: inline-block; width: 14px; height: 17px; border: 1px solid #334155; text-align: center; line-height: 17px; font-size: 10px; font-weight: 700; background: #fff; border-radius: 2px; }
    .hyphen { font-weight: 700; margin: 0 1px; font-size: 11px; }

    .check-item { display: inline-flex; align-items: center; margin-right: 14px; }
    .check-box { display: inline-block; width: 13px; height: 13px; border: 1.2px solid #334155; text-align: center; line-height: 12px; font-size: 10px; font-weight: 800; border-radius: 2px; margin-right: 4px; background: #fff; }
    .check-label { font-size: 10px; font-weight: 500; }

    .data-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10px; }
    .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; }
    .data-table th { background: #f8fafc; font-weight: 700; color: #1e3a8a; }

    .declaration-card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-top: 6px; background: #fdfdfd; }
    .declaration-text { font-size: 9.5px; color: #334155; line-height: 1.35; margin-bottom: 10px; text-align: justify; }
    .sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; }
    .sig-line { width: 38%; border-top: 1px solid #64748b; text-align: center; font-size: 9px; padding-top: 3px; font-weight: 600; color: #475569; }

    .office-box { border: 2px solid #1e3a8a; border-radius: 4px; padding: 6px 8px; margin-top: 8px; background: #fafafa; }
    .office-header { font-weight: 800; font-size: 11px; color: #1e3a8a; text-transform: uppercase; text-align: center; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
  </style>
</head>
<body>

  <!-- ==================== PAGE 1: PARTS A - F ==================== -->
  <div class="page">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="org-title">AZM SCHOLARSHIP PROGRAM</div>
          <div class="form-title">Candidate Registration Form — Session V (2026)</div>
          <div class="sub-title">Jadoon Public School & College System | AZM.AIO Educational Network</div>
        </td>
        <td class="header-right">
          <div class="photo-box">
            ${photoImg}
          </div>
        </td>
      </tr>
    </table>

    <div class="id-ribbon">
      <span>Application No: <strong>${student.applicationNo || 'N/A'}</strong></span>
      <span>Roll No: <strong>${student.rollNumber || 'PENDING'}</strong></span>
      <span>Reg. Centre: <strong>${student.registrationCentre || 'Main Campus'}</strong></span>
    </div>

    <!-- PART A -->
    <div class="section-bar">Part A: Personal Information</div>
    <table class="grid-table">
      <tr>
        <td class="label">Full Name:</td>
        <td class="value" colspan="3">${(student.fullName || '').toUpperCase()}</td>
      </tr>
      <tr>
        <td class="label">Father's Name:</td>
        <td class="value" colspan="3">${(student.fatherName || '').toUpperCase()}</td>
      </tr>
      <tr>
        <td class="label">Gender:</td>
        <td class="value">${this.renderCheck(isMale, 'Male')} ${this.renderCheck(isFemale, 'Female')}</td>
        <td class="label">Date of Birth:</td>
        <td class="value">${dobStr} ${student.age ? `(Age: ${student.age} yrs)` : ''}</td>
      </tr>
      <tr>
        <td class="label">CNIC / B-Form:</td>
        <td class="value">${cnicBoxes}</td>
        <td class="label">Nationality / Rel:</td>
        <td class="value">${student.nationality || 'Pakistani'} / ${student.religion || 'Islam'}</td>
      </tr>
    </table>

    <!-- PART B -->
    <div class="section-bar">Part B: Contact Information</div>
    <table class="grid-table">
      <tr>
        <td class="label">Residential Address:</td>
        <td class="value" colspan="3">${student.address || ''}</td>
      </tr>
      <tr>
        <td class="label">District & Province:</td>
        <td class="value">${student.district || ''}, ${student.province || ''}</td>
        <td class="label">Parent Mobile:</td>
        <td class="value">${student.parentMobile || ''}</td>
      </tr>
      <tr>
        <td class="label">Student Mobile:</td>
        <td class="value">${student.studentMobile || 'N/A'}</td>
        <td class="label">WhatsApp / Email:</td>
        <td class="value">${student.whatsapp || student.parentMobile} | ${student.email || 'N/A'}</td>
      </tr>
    </table>

    <!-- PART C -->
    <div class="section-bar">Part C: Educational Information</div>
    <table class="grid-table">
      <tr>
        <td class="label">Current Class / Level:</td>
        <td class="value" colspan="3"><strong>${student.currentClass || ''}</strong> ${student.hsscGroup ? `(${student.hsscGroup})` : ''} ${student.bsDepartment ? `[Dept: ${student.bsDepartment}, Sem: ${student.bsSemester || '1st'}]` : ''}</td>
      </tr>
      <tr>
        <td class="label">Present School / College:</td>
        <td class="value" colspan="3">${student.schoolName || ''}</td>
      </tr>
      <tr>
        <td class="label">Board / University:</td>
        <td class="value">${student.boardOrUniversity || 'BISE'}</td>
        <td class="label">School Roll No:</td>
        <td class="value">${student.currentRollNo || 'N/A'}</td>
      </tr>
    </table>

    <!-- PART D -->
    <div class="section-bar">Part D: Scholarship Category Applied</div>
    <div style="padding: 4px 6px;">
      ${this.renderCheck(isGeneral, 'General Merit')}
      ${this.renderCheck(isNeedy, 'Financially Needy')}
      ${this.renderCheck(isOrphan, 'Orphan')}
      ${this.renderCheck(isPwd, 'Person with Disability (PWD)')}
    </div>

    <!-- PART E -->
    <div class="section-bar">Part E: Emergency & Family Information</div>
    <table class="grid-table">
      <tr>
        <td class="label">Guardian Occupation:</td>
        <td class="value">${student.guardianOccupation || 'N/A'}</td>
        <td class="label">Monthly Income:</td>
        <td class="value">${student.guardianMonthlyIncome ? `PKR ${student.guardianMonthlyIncome}` : 'N/A'}</td>
      </tr>
      <tr>
        <td class="label">Emergency Contact:</td>
        <td class="value">${student.emergencyContact || ''} (${student.emergencyRelation || 'Guardian'})</td>
        <td class="label">Signed Date:</td>
        <td class="value">${student.applicantSignedAt ? new Date(student.applicantSignedAt).toLocaleDateString() : new Date().toLocaleDateString()}</td>
      </tr>
    </table>

    <!-- PART F Preview -->
    <div class="section-bar">Part F: Candidate Verification Token</div>
    <table style="width: 100%; margin-top: 4px;">
      <tr>
        <td style="width: 75%; vertical-align: middle; font-size: 9.5px; color: #475569;">
          This form is digitally validated for the 2026 AZM Scholarship Session.<br/>
          Bring this printed form with attested documents on test day.<br/>
          QR Code encodes tamper-proof candidate token for examiner scanning.
        </td>
        <td style="width: 25%; text-align: right; vertical-align: middle;">
          ${qrImg}
        </td>
      </tr>
    </table>
  </div>

  <!-- ==================== PAGE 2: PARTS G - L ==================== -->
  <div class="page">
    <div class="id-ribbon" style="margin-bottom: 6px;">
      <span>AZM Scholarship — Session V (2026) | Page 2</span>
      <span>App No: <strong>${student.applicationNo || ''}</strong></span>
      <span>Candidate: <strong>${student.fullName || ''}</strong></span>
    </div>

    <!-- PART G -->
    <div class="section-bar">Part G: Academic Record</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Qualification / Certificate</th>
          <th>Board / University</th>
          <th>Passing Year</th>
          <th>Total Marks</th>
          <th>Obtained Marks</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${
          academicRecords.length > 0
            ? academicRecords
                .map(
                  (r: any) => `
          <tr>
            <td><strong>${r.examLevel || ''}</strong></td>
            <td>${r.boardOrUni || ''}</td>
            <td>${r.yearOfPassing || ''}</td>
            <td>${r.totalMarks || ''}</td>
            <td>${r.obtainedMarks || ''}</td>
            <td>${r.percentage ? `${r.percentage}%` : ''}</td>
          </tr>`
                )
                .join('')
            : `
          <tr><td>Last Qualification</td><td>${student.boardOrUniversity || 'BISE'}</td><td>2025</td><td>1100</td><td>-</td><td>-</td></tr>
          <tr><td>Middle / Primary</td><td>School Exam</td><td>2023</td><td>-</td><td>-</td><td>-</td></tr>
        `
        }
      </tbody>
    </table>

    <!-- PART H -->
    <div class="section-bar">Part H: Document Checklist (Attached Photocopies)</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px 6px;">
      <div>${this.renderCheck(!!docs.bformCnicCopy, 'Attested Copy of Student B-Form / CNIC')}</div>
      <div>${this.renderCheck(!!docs.fatherCnicCopy, 'Attested Copy of Father / Guardian CNIC')}</div>
      <div>${this.renderCheck(!!docs.passportPhotos, '2x Recent Passport Size Photographs')}</div>
      <div>${this.renderCheck(!!docs.previousResultCard, 'Attested Copy of Previous Result Card')}</div>
      <div>${this.renderCheck(!!docs.domicileCertificate, 'Domicile Certificate Copy')}</div>
      <div>${this.renderCheck(!!docs.incomeCertificate, 'Income / Salary Certificate (if applicable)')}</div>
    </div>

    <!-- PART I -->
    <div class="section-bar">Part I: Referral Source</div>
    <div style="padding: 3px 6px; font-size: 10px;">
      How did you hear about AZM Scholarship: <strong>${student.referralSource || 'School / Social Media Advertisement'}</strong>
    </div>

    <!-- PART J -->
    <div class="section-bar">Part J: Candidate Declaration</div>
    <div class="declaration-card">
      <p class="declaration-text">
        I hereby solemnly declare that all information provided in this application form is true, correct, and complete to the best of my knowledge. I have read and agree to comply with all rules and criteria of the AZM Scholarship Program. In case of any false or misleading statement, my candidature shall be cancelled immediately.
      </p>
      <div class="sig-row">
        <div class="sig-line">Date: ${student.applicantSignedAt ? new Date(student.applicantSignedAt).toLocaleDateString() : '____/____/2026'}</div>
        <div class="sig-line">Signature of Applicant</div>
      </div>
    </div>

    <!-- PART K -->
    <div class="section-bar">Part K: Parent / Guardian Declaration</div>
    <div class="declaration-card">
      <p class="declaration-text">
        I certify that my son/daughter/ward is submitting this application with my consent. I endorse the accuracy of the family details provided above and agree to abide by the decisions of the AZM Scholarship Selection Committee.
      </p>
      <div class="sig-row">
        <div class="sig-line">Date: ${student.parentSignedAt ? new Date(student.parentSignedAt).toLocaleDateString() : '____/____/2026'}</div>
        <div class="sig-line">Signature of Father / Guardian</div>
      </div>
    </div>

    <!-- PART L -->
    <div class="office-box">
      <div class="office-header">Part L: For Official Use Only (AZM Administration)</div>
      <table class="grid-table">
        <tr>
          <td class="label">Documents Verification:</td>
          <td class="value">Verified By: <strong>${office.documentVerifiedBy || 'Pending'}</strong></td>
          <td class="label">Eligibility:</td>
          <td class="value"><strong>${office.eligibility || 'UNDER_REVIEW'}</strong> ${office.eligibilityRemarks ? `(${office.eligibilityRemarks})` : ''}</td>
        </tr>
        <tr>
          <td class="label">Test Roll No / Centre:</td>
          <td class="value">${office.testRollNo || student.rollNumber || 'TBA'} | ${office.testCentre || 'Main Exam Hall'}</td>
          <td class="label">Reporting Time / Date:</td>
          <td class="value">${office.testReportingTime || '09:00 AM'} | ${office.testDate ? new Date(office.testDate).toLocaleDateString() : 'TBA'}</td>
        </tr>
        <tr>
          <td class="label">Interview Details:</td>
          <td class="value">${office.interviewDate ? new Date(office.interviewDate).toLocaleDateString() : 'N/A'} (Panel ${office.panelNo || 'A'})</td>
          <td class="label">Final Status:</td>
          <td class="value"><strong style="color: #1e3a8a;">${office.finalStatus || 'PENDING'}</strong></td>
        </tr>
      </table>
      <div class="sig-row" style="margin-top: 10px;">
        <div class="sig-line">Checked & Verified By</div>
        <div class="sig-line">Authorized Signature & Stamp</div>
      </div>
    </div>
  </div>

</body>
</html>
    `;
  }

  /**
   * Generates filled HTML template for the Partner Institution Registration Form
   */
  generatePartnerRegistrationHtml(partner: any): string {
    const isSchool = partner.institutionType === 'SCHOOL';
    const isCollege = partner.institutionType === 'COLLEGE';
    const isAcademy = partner.institutionType === 'ACADEMY';
    const isUni = partner.institutionType === 'UNIVERSITY';

    const classes = partner.classesOffered || [];

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Partner Institution Registration - ${partner.partnerCode || 'Form'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; color: #1e293b; }
    body { background: #fff; padding: 0; }
    .page { width: 100%; min-height: 277mm; padding: 5mm 0; position: relative; }
    
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 8px; }
    .org-title { font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
    .form-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
    .sub-title { font-size: 10.5px; color: #475569; }

    .id-ribbon { display: flex; justify-content: space-between; background: #f1f5f9; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 12px; font-weight: 600; font-size: 11px; }
    .id-ribbon strong { color: #1e3a8a; }

    .section-bar { background: #1e3a8a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 3px; margin: 12px 0 8px 0; text-transform: uppercase; letter-spacing: 0.3px; }
    
    .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .grid-table td { padding: 4.5px 6px; vertical-align: middle; }
    .label { font-weight: 600; color: #334155; width: 22%; font-size: 10.5px; }
    .value { border-bottom: 1px solid #94a3b8; font-weight: 500; font-size: 11px; color: #0f172a; padding-left: 4px; }

    .check-item { display: inline-flex; align-items: center; margin-right: 16px; }
    .check-box { display: inline-block; width: 13px; height: 13px; border: 1.2px solid #334155; text-align: center; line-height: 12px; font-size: 10px; font-weight: 800; border-radius: 2px; margin-right: 4px; background: #fff; }
    .check-label { font-size: 10.5px; font-weight: 500; }

    .declaration-card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 12px; margin-top: 12px; background: #fdfdfd; }
    .declaration-text { font-size: 10px; color: #334155; line-height: 1.45; margin-bottom: 14px; text-align: justify; }
    .sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; }
    .sig-line { width: 40%; border-top: 1px solid #64748b; text-align: center; font-size: 9.5px; padding-top: 4px; font-weight: 600; color: #475569; }

    .office-box { border: 2px solid #1e3a8a; border-radius: 4px; padding: 8px 12px; margin-top: 16px; background: #fafafa; }
    .office-header { font-weight: 800; font-size: 11.5px; color: #1e3a8a; text-transform: uppercase; text-align: center; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  </style>
</head>
<body>

  <div class="page">
    <table class="header-table">
      <tr>
        <td>
          <div class="org-title">AZM SCHOLARSHIP PROGRAM</div>
          <div class="form-title">Partner Institution Registration Form</div>
          <div class="sub-title">Institutional Partnership & Examination Centre Agreement</div>
        </td>
      </tr>
    </table>

    <div class="id-ribbon">
      <span>Partner Code: <strong>${partner.partnerCode || 'PENDING ASSIGNMENT'}</strong></span>
      <span>Application Date: <strong>${partner.applicationDate ? new Date(partner.applicationDate).toLocaleDateString() : new Date().toLocaleDateString()}</strong></span>
      <span>Status: <strong>${partner.status || 'PENDING'}</strong></span>
    </div>

    <!-- Section 1 -->
    <div class="section-bar">1. Institution Profile</div>
    <table class="grid-table">
      <tr>
        <td class="label">Institution Name:</td>
        <td class="value" colspan="3"><strong>${(partner.institutionName || '').toUpperCase()}</strong></td>
      </tr>
      <tr>
        <td class="label">Institution Type:</td>
        <td class="value" colspan="3">
          ${this.renderCheck(isSchool, 'School')}
          ${this.renderCheck(isCollege, 'College')}
          ${this.renderCheck(isAcademy, 'Academy / Tuition Centre')}
          ${this.renderCheck(isUni, 'University / Institute')}
        </td>
      </tr>
      <tr>
        <td class="label">Campus / Branch:</td>
        <td class="value" colspan="3">${partner.campus || 'Main Campus'}</td>
      </tr>
      <tr>
        <td class="label">Physical Address:</td>
        <td class="value" colspan="3">${partner.address || ''}</td>
      </tr>
      <tr>
        <td class="label">District & Province:</td>
        <td class="value" colspan="3">${partner.district || ''}, ${partner.province || ''}</td>
      </tr>
    </table>

    <!-- Section 2 -->
    <div class="section-bar">2. Focal Person / Contact Details</div>
    <table class="grid-table">
      <tr>
        <td class="label">Contact Person:</td>
        <td class="value">${partner.contactName || ''}</td>
        <td class="label">Designation:</td>
        <td class="value">${partner.contactDesignation || 'Principal / Director'}</td>
      </tr>
      <tr>
        <td class="label">Mobile Number:</td>
        <td class="value">${partner.contactMobile || ''}</td>
        <td class="label">WhatsApp Number:</td>
        <td class="value">${partner.contactWhatsapp || partner.contactMobile}</td>
      </tr>
      <tr>
        <td class="label">Email Address:</td>
        <td class="value">${partner.contactEmail || 'N/A'}</td>
        <td class="label">Official Website:</td>
        <td class="value">${partner.website || 'N/A'}</td>
      </tr>
    </table>

    <!-- Section 3 -->
    <div class="section-bar">3. Educational Scope & Capacity</div>
    <table class="grid-table">
      <tr>
        <td class="label">Classes Offered:</td>
        <td class="value" colspan="3">
          ${this.renderCheck(classes.includes('Class 6-8') || classes.includes('Class 6') || classes.includes('Middle'), 'Class 6 - 8')}
          ${this.renderCheck(classes.includes('SSC') || classes.includes('Matric'), 'SSC (9th - 10th)')}
          ${this.renderCheck(classes.includes('HSSC') || classes.includes('FSc/FA'), 'HSSC (11th - 12th)')}
          ${this.renderCheck(classes.includes('BS') || classes.includes('Undergraduate'), 'BS / Degree')}
        </td>
      </tr>
      <tr>
        <td class="label">Total Student Strength:</td>
        <td class="value">${partner.studentStrength || 'N/A'} Students</td>
        <td class="label">Expected Applicants:</td>
        <td class="value"><strong>${partner.expectedApplicants || 'N/A'}</strong> Candidates</td>
      </tr>
    </table>

    <!-- Section 4 -->
    <div class="section-bar">4. Partnership Agreement & Authorization</div>
    <div class="declaration-card">
      <p class="declaration-text">
        We hereby apply for institutional partnership under the AZM Scholarship Program. We agree to facilitate candidate awareness, registration support, and exam venue logistics in accordance with AZM policies. We confirm that all information provided above is authentic and certified by the institution management.
      </p>
      <div class="sig-row">
        <div class="sig-line">Date: ${partner.signedAt ? new Date(partner.signedAt).toLocaleDateString() : new Date().toLocaleDateString()}</div>
        <div class="sig-line">Principal / Head of Institution (Signature & Stamp)</div>
      </div>
    </div>

    <!-- Section 5 -->
    <div class="office-box">
      <div class="office-header">5. For AZM Program Secretariat Use Only</div>
      <table class="grid-table">
        <tr>
          <td class="label">Assigned Partner Code:</td>
          <td class="value"><strong>${partner.partnerCode || 'PENDING'}</strong></td>
          <td class="label">Approval Decision:</td>
          <td class="value"><strong>${partner.status || 'PENDING'}</strong></td>
        </tr>
      </table>
      <div class="sig-row" style="margin-top: 15px;">
        <div class="sig-line">Regional Coordinator</div>
        <div class="sig-line">Program Director (Signature & Seal)</div>
      </div>
    </div>
  </div>

</body>
</html>
    `;
  }
}

export const pdfService = new PdfService();

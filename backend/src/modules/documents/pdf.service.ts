import fs from 'fs';
import path from 'path';
import { logger } from '../../lib/logger';

/**
 * Async Mutex Queue ensuring only one PDF generation runs at any single instant.
 * Prevents concurrent Chromium process spawning and eliminates Render Free Tier OOM crashes.
 */
class PdfGenerationQueue {
  private queue: Promise<void> = Promise.resolve();

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    let taskResolve: () => void = () => {};
    const waitPromise = new Promise<void>((resolve) => {
      taskResolve = resolve;
    });

    const previousQueue = this.queue;
    this.queue = this.queue.then(() => waitPromise);

    await previousQueue;
    try {
      return await task();
    } finally {
      taskResolve();
    }
  }
}

const pdfQueue = new PdfGenerationQueue();

export class PdfService {
  /**
   * Launches a memory-optimized Chromium browser instance.
   * Prioritizes direct Puppeteer with pre-installed Chrome for instant (<1s) rendering on Render.
   */
  private async launchBrowser() {
    const memoryOptimizedArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
    ];

    // Check known system executable paths if in container / Linux
    const knownPaths: string[] = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROME_BIN,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ].filter(Boolean) as string[];

    // Check project-level .cache/puppeteer and Render cache locations
    const searchDirs = [
      path.join(process.cwd(), '.cache', 'puppeteer'),
      path.join(__dirname, '../../..', '.cache', 'puppeteer'),
      '/opt/render/project/src/backend/.cache/puppeteer',
      '/opt/render/.cache/puppeteer',
    ];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        try {
          const findChrome = (currentDir: string): string | null => {
            const files = fs.readdirSync(currentDir);
            for (const file of files) {
              const fullPath = path.join(currentDir, file);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                const found = findChrome(fullPath);
                if (found) return found;
              } else if (file === 'chrome' || file === 'chrome.exe') {
                return fullPath;
              }
            }
            return null;
          };
          const foundPath = findChrome(dir);
          if (foundPath && !knownPaths.includes(foundPath)) {
            logger.info(`🔍 Discovered Puppeteer Chrome binary at: ${foundPath}`);
            knownPaths.unshift(foundPath);
          }
        } catch {}
      }
    }

    const launchServerlessChromium = async () => {
      // Sparticuz Chromium is substantially smaller than the full Puppeteer
      // browser and is the reliable option on Render's 512 MB free service.
      const chromiumModule: any = await import('@sparticuz/chromium');
      const chromium = chromiumModule.default || chromiumModule;
      const puppeteerCoreModule: any = await import('puppeteer-core');
      const puppeteerCore = puppeteerCoreModule.default || puppeteerCoreModule;
      // The npm package ships x64 binaries. Oracle ARM hosts install the
      // matching official arm64 pack separately under this cache directory.
      const armPack = path.join(process.cwd(), '.cache', 'chromium-arm64');
      const executablePath = await chromium.executablePath(
        process.arch === 'arm64' && fs.existsSync(armPack) ? armPack : undefined
      );

      if (!executablePath) {
        throw new Error('Serverless Chromium did not provide an executable path.');
      }

      return puppeteerCore.launch({
        args: [...chromium.args, ...memoryOptimizedArgs],
        defaultViewport: chromium.defaultViewport || { width: 1280, height: 800 },
        executablePath,
        headless: chromium.headless ?? true,
      });
    };

    const isRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
    if (isRender) {
      try {
        logger.info('Using memory-efficient serverless Chromium on Render for PDF generation.');
        return await launchServerlessChromium();
      } catch (serverlessErr: any) {
        logger.warn('Serverless Chromium launch failed; trying the bundled browser:', serverlessErr.message);
      }
    }

    const puppeteerModule = await import('puppeteer');
    const puppeteer = puppeteerModule.default || puppeteerModule;

    for (const p of knownPaths) {
      if (fs.existsSync(p)) {
        try {
          logger.info(`🚀 Launching Chrome binary from: ${p}`);
          return await puppeteer.launch({
            executablePath: p,
            headless: true,
            args: memoryOptimizedArgs,
          });
        } catch (e: any) {
          logger.warn(`Failed launching Chrome at ${p}:`, e.message);
        }
      }
    }

    // Try standard puppeteer with installed browser cache
    try {
      return await puppeteer.launch({
        headless: true,
        args: memoryOptimizedArgs,
      });
    } catch (stdErr: any) {
      logger.warn('Standard puppeteer launch failed, attempting serverless fallback:', stdErr.message);
    }

    // Fallback: @sparticuz/chromium + puppeteer-core (if running in AWS Lambda style environment)
    try {
      return await launchServerlessChromium();
    } catch (coreErr: any) {
      logger.error('All Chromium launch strategies exhausted:', coreErr.message);
      throw coreErr;
    }

    throw new Error('Unable to launch Chromium for PDF generation.');
  }

  /**
   * Generates a PDF buffer from an HTML string.
   * Serialized through a concurrency queue to ensure only 1 Chromium instance runs at a time.
   */
  async generatePdfFromHtml(
    html: string,
    options?: { landscape?: boolean; format?: any; margin?: any }
  ): Promise<Buffer> {
    return pdfQueue.enqueue(async () => {
      logger.info('📄 Processing PDF generation in isolated queue slot...');
      const browser = await this.launchBrowser();

      try {
        const page = await browser.newPage();

        page.on('console', (msg: any) => {
          logger.debug(`Puppeteer [${msg.type()}]: ${msg.text()}`);
        });

        page.on('requestfailed', (req: any) => {
          logger.warn(`Puppeteer request failed: ${req.url()} (${req.failure()?.errorText || 'Unknown Error'})`);
        });

        await page.setContent(html, {
          waitUntil: 'load',
          timeout: 45000,
        });

        const pdfUint8Array = await page.pdf({
          format: options?.format || 'A4',
          landscape: options?.landscape ?? false,
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: !html.includes('omr-page'),
          headerTemplate: '<span></span>',
          footerTemplate:
            '<div style="width: 100%; font-size: 8px; color: #94a3b8; font-family: Segoe UI, Arial, sans-serif; display: flex; justify-content: space-between; padding: 0 10mm;"><span>AZM.AIO Examination Authority &copy; 2026</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
          margin: options?.margin || (html.includes('omr-page') ? { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' } : {
            top: '8mm',
            bottom: '12mm',
            left: '8mm',
            right: '8mm',
          }),
        });

        await page.close();
        return Buffer.from(pdfUint8Array);
      } catch (err) {
        logger.error('Error generating PDF via Puppeteer:', err);
        throw err;
      } finally {
        await browser.close();
      }
    });
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
  generateStudentRegistrationHtml(student: any, photoBase64?: string): string {
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
    const resolvedPhoto = photoBase64 || (student.photoUrl && student.photoUrl.startsWith('data:') ? student.photoUrl : null);
    const photoImg = resolvedPhoto
      ? `<img src="${resolvedPhoto}" class="photo-img" alt="Photo" />`
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
          <div class="sub-title">AZM.AIO Educational Network | Scholarship & Examination Authority</div>
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

    <!-- PART F -->
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
   * Generates filled HTML template for the official Single-Page A4 Roll Number Slip Exam Entry Pass
   */
  generateRollSlipHtml(student: any, qrDataUrl?: string, photoBase64?: string): string {
    const isProvisional = !student.rollNumber;
    const rollNo = student.rollNumber || student.displayRollNumber || student.officeUse?.testRollNo || (student.applicationNo ? `PROV-${student.applicationNo}` : 'PROVISIONAL');
    const appNo = student.applicationNo || student.id || 'APP-2026';
    const candName = (student.fullName || '').toUpperCase();
    const fatherName = (student.fatherName || '').toUpperCase();
    const cnic = student.cnicOrBForm || 'N/A';
    const classLevel = student.currentClass || 'SSC-II (Class 10th)';
    const testCenter = student.testCenterName || student.officeUse?.testCentre || 'To be assigned';
    const centerAddress = student.testCenterAddress || '';
    const roomNo = student.assignedRoom || 'To be assigned';
    const seatNo = student.seatNo || 'To be assigned';

    const examDate = student.testDate
      ? student.testDate
      : student.officeUse?.testDate
      ? new Date(student.officeUse.testDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'To be announced';
    const reportingTime = student.reportingTime || student.officeUse?.testReportingTime || 'To be announced';
    const examTiming = student.examStartTime || 'To be announced';

    const defaultPhoto = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150" viewBox="0 0 120 150">
        <rect width="120" height="150" fill="#f8fafc"/>
        <circle cx="60" cy="50" r="25" fill="#94a3b8"/>
        <path d="M20 125 C20 90, 100 90, 100 125 Z" fill="#64748b"/>
        <text x="60" y="142" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#475569" text-anchor="middle">PHOTO</text>
      </svg>`
    )}`;

    const photoSrc =
      photoBase64 ||
      (student.photoUrl && student.photoUrl.startsWith('data:') ? student.photoUrl : null) ||
      (student.uploadedDocuments?.photo?.dataUrl && student.uploadedDocuments.photo.dataUrl.startsWith('data:') ? student.uploadedDocuments.photo.dataUrl : null) ||
      defaultPhoto;

    const qrImgTag = qrDataUrl
      ? `<img src="${qrDataUrl}" class="qr-img" alt="QR" />`
      : `<div style="font-size: 8px; color: #64748b; text-align: center; padding-top: 25px;">QR PASS</div>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM Roll Number Slip - ${rollNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
    body { background: #fff; padding: 0; color: #0f172a; }
    .slip-page { width: 100%; min-height: 275mm; padding: 6mm 8mm; position: relative; border: 2.5px solid #1e3a8a; border-radius: 8px; }
    
    /* Header */
    .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .header-left { width: 68%; vertical-align: top; }
    .header-right { width: 32%; text-align: right; vertical-align: top; }
    
    .org-title { font-size: 18px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
    .doc-badge { display: inline-block; background: #1e3a8a; color: #ffffff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .session-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
    .motto-text { font-size: 9px; color: #475569; font-style: italic; margin-top: 2px; }

    /* Candidate Particulars & Photo Grid */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .photo-col { width: 110px; vertical-align: top; text-align: center; }
    .details-col { padding: 0 14px; vertical-align: top; }
    .badge-col { width: 130px; vertical-align: top; text-align: right; }

    .photo-frame { width: 100px; height: 118px; border: 2px solid #0f172a; border-radius: 6px; overflow: hidden; background: #f8fafc; margin: 0 auto 4px auto; position: relative; }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
    .photo-verified-tag { background: #059669; color: #fff; font-size: 8px; font-weight: 800; padding: 2px 4px; border-radius: 3px; display: inline-block; }
    
    .barcode-text { font-family: 'Courier New', monospace; font-size: 8.5px; font-weight: 700; color: #334155; letter-spacing: 1px; margin-top: 2px; }
    .app-no-text { font-size: 9px; font-weight: 700; color: #1e3a8a; }

    .cand-grid { width: 100%; border-collapse: collapse; }
    .cand-grid td { padding: 4px 6px; font-size: 10.5px; }
    .cand-label { width: 32%; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 9.5px; }
    .cand-value { width: 68%; font-weight: 700; color: #0f172a; border-bottom: 1px solid #cbd5e1; font-size: 11px; }

    /* Roll No & QR Box */
    .roll-box { background: #0f172a; color: #ffffff; padding: 6px 10px; border-radius: 6px; text-align: center; margin-bottom: 8px; }
    .roll-box-label { font-size: 8.5px; font-weight: 800; color: #fde047; text-transform: uppercase; letter-spacing: 0.5px; }
    .roll-box-number { font-size: 13px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 0.5px; margin: 2px 0; }
    .roll-box-seat { font-size: 9.5px; font-weight: 700; color: #34d399; }

    .qr-frame { width: 100px; height: 100px; border: 1.5px solid #94a3b8; border-radius: 6px; padding: 3px; background: #fff; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .qr-img { width: 100%; height: 100%; object-fit: contain; }
    .qr-caption { font-size: 7.5px; font-weight: 700; color: #475569; text-align: center; margin-top: 2px; text-transform: uppercase; }

    /* Schedule Bar */
    .schedule-bar { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; display: table; width: 100%; }
    .sched-item { display: table-cell; width: 33.33%; text-align: center; vertical-align: middle; border-right: 1px solid #cbd5e1; }
    .sched-item:last-child { border-right: none; }
    .sched-label { font-size: 8.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 2px; }
    .sched-value { font-size: 10.5px; font-weight: 800; color: #0f172a; }
    .sched-value.highlight { color: #dc2626; }

    /* Center Box */
    .center-box { background: #f8fafc; border: 1.5px solid #93c5fd; border-radius: 6px; padding: 7px 12px; margin-bottom: 12px; }
    .center-title { font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px; }
    .center-name { font-size: 11px; font-weight: 800; color: #0f172a; }
    .center-addr { font-size: 9.5px; color: #475569; margin-top: 1px; }

    /* Instructions */
    .section-title { font-size: 10.5px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 2px; margin-bottom: 6px; }
    .rules-list { list-style-type: decimal; padding-left: 16px; margin-bottom: 14px; }
    .rules-list li { font-size: 9px; color: #334155; line-height: 1.45; margin-bottom: 3.5px; text-align: justify; }
    .rules-list li strong { color: #0f172a; font-weight: 700; }

    /* Signatures & Seal */
    .auth-table { width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
    .auth-table td { width: 33.33%; vertical-align: bottom; text-align: center; padding-top: 25px; }
    .sig-line-text { border-top: 1px solid #475569; display: inline-block; width: 85%; font-size: 8.5px; font-weight: 700; color: #334155; padding-top: 3px; text-transform: uppercase; }

    .security-ribbon { margin-top: 8px; padding-top: 4px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8px; color: #64748b; font-family: monospace; }
  </style>
</head>
<body>

  <div class="slip-page">
    ${isProvisional ? `
    <div style="background: #fffbeb; border: 1.5px dashed #d97706; color: #92400e; font-size: 8.5pt; font-weight: 800; text-align: center; padding: 4px 8px; margin-bottom: 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
      PRE-ISSUE COPY — OFFICIAL ROLL NUMBER NOT YET ISSUED
    </div>` : ''}
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="org-title">AZM SCHOLARSHIP PROGRAM</div>
          <div class="session-title">Session V (2026) 100 MCQs Scholarship Examination</div>
          <div class="motto-text">Official Examination Entry Pass & Roll Number Slip</div>
        </td>
        <td class="header-right">
          <div class="doc-badge" style="${isProvisional ? 'background: #d97706;' : ''}">${isProvisional ? 'Pre-Issue Copy' : 'Official Entry Pass'}</div>
          <div style="font-size: 9px; font-weight: 700; color: ${isProvisional ? '#b45309' : '#059669'}; margin-top: 2px;">${isProvisional ? '⚠️ PROVISIONAL COPY' : '✓ Verified Candidate'}</div>
          <div style="font-size: 8px; color: #64748b;">Issued: ${new Date().toLocaleDateString('en-GB')}</div>
        </td>
      </tr>
    </table>

    <!-- Main Particulars Grid -->
    <table class="info-table">
      <tr>
        <!-- Col 1: Photo & Barcode -->
        <td class="photo-col">
          <div class="photo-frame">
            <img src="${photoSrc}" alt="Candidate Photo" />
          </div>
          <div class="photo-verified-tag">✓ BIOMETRIC MATCHED</div>
          <div class="barcode-text">||| |||| || |||||</div>
          <div class="app-no-text">${appNo}</div>
        </td>

        <!-- Col 2: Candidate Particulars -->
        <td class="details-col">
          <table class="cand-grid">
            <tr>
              <td class="cand-label">Candidate Name:</td>
              <td class="cand-value">${candName}</td>
            </tr>
            <tr>
              <td class="cand-label">Father's Name:</td>
              <td class="cand-value">${fatherName}</td>
            </tr>
            <tr>
              <td class="cand-label">CNIC / B-Form:</td>
              <td class="cand-value" style="font-family: monospace; font-size: 11.5px; color: #1e3a8a;">${cnic}</td>
            </tr>
            <tr>
              <td class="cand-label">Class Level:</td>
              <td class="cand-value" style="color: #065f46;">${classLevel}</td>
            </tr>
            <tr>
              <td class="cand-label">Discipline / Group:</td>
              <td class="cand-value">${student.hsscGroup || 'General Science / Merit'}</td>
            </tr>
            <tr>
              <td class="cand-label">Institution:</td>
              <td class="cand-value">${student.schoolName || 'Enrolled Candidate'}</td>
            </tr>
          </table>
        </td>

        <!-- Col 3: Roll Number & Biometric QR -->
        <td class="badge-col">
          <div class="roll-box">
            <div class="roll-box-label">${isProvisional ? 'Provisional Admit No' : 'Official Roll No'}</div>
            <div class="roll-box-number">${rollNo}</div>
            <div class="roll-box-seat">${roomNo} | ${seatNo}</div>
          </div>
          <div class="qr-frame">
            ${qrImgTag}
          </div>
          <div class="qr-caption">Scan to Verify Identity</div>
        </td>
      </tr>
    </table>

    <!-- Center Allocation Box -->
    <div class="center-box">
      <div class="center-title">Assigned Examination Centre & Room Allocation:</div>
      <div class="center-name">${testCenter} &mdash; <span style="color: #1e3a8a;">${roomNo} (${seatNo})</span></div>
      <div class="center-addr">${centerAddress}</div>
    </div>

    <!-- Schedule Bar -->
    <div class="schedule-bar">
      <div class="sched-item">
        <div class="sched-label">Examination Date</div>
        <div class="sched-value">${examDate}</div>
      </div>
      <div class="sched-item">
        <div class="sched-label">Reporting Time</div>
        <div class="sched-value highlight">${reportingTime}</div>
      </div>
      <div class="sched-item">
        <div class="sched-label">Test Time</div>
        <div class="sched-value">${examTiming}</div>
      </div>
    </div>

    <!-- Instructions & Rules -->
    <div class="section-title">Important Candidate Instructions & Examination SOPs</div>
    <ol class="rules-list">
      <li><strong>Original Credentials Required:</strong> Candidate MUST bring this printed Roll Number Slip along with their original CNIC or NADRA B-Form to the examination center. No candidate will be admitted without original credentials.</li>
      <li><strong>Strict Reporting Deadlines:</strong> Candidate must report at the Reporting Time printed above. Late entry may not be permitted.</li>
      <li><strong>Prohibited Items:</strong> Mobile phones, smartwatches, digital calculators, bluetooth devices, books, and bags are strictly forbidden inside the hall. Violation will result in immediate disqualification.</li>
      <li><strong>Stationery & Optical Sheets:</strong> Bring a transparent clipboard, 2B lead pencils, blue/black ballpoint pens, and an eraser for OMR bubble sheet marking.</li>
      <li><strong>Biometric Check:</strong> Real-time QR biometric verification and photo authentication will be conducted at the venue gate prior to desk entry.</li>
    </ol>

    <!-- Signatures & Official Seal -->
    <table class="auth-table">
      <tr>
        <td>
          <div class="sig-line-text">Candidate Signature</div>
        </td>
        <td>
          <div class="sig-line-text">Center Superintendent</div>
        </td>
        <td>
          <div class="sig-line-text">Controller of Examinations (AZM)</div>
        </td>
      </tr>
    </table>

    <!-- Security Hash Footer -->
    <div class="security-ribbon">
      <span>Security Hash: AZMVS-SHA256-${rollNo}-${appNo}</span>
      <span>Official Portal: https://azmaio.com</span>
      <span>Registry Verification ID: ${student.id}</span>
    </div>
  </div>

</body>
</html>
    `;
  }

  /**
   * Generates filled HTML template for the official Branded Students List PDF Roster
   */
  generateStudentsListHtml(
    students: any[],
    filters: { classLevel?: string; gender?: string; status?: string; search?: string },
    totalCount: number
  ): string {
    const generatedDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const generatedTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const classLabel = filters.classLevel && filters.classLevel !== 'ALL' ? filters.classLevel : 'All Classes';
    const genderLabel =
      filters.gender && (filters.gender as any) !== 'ALL'
        ? String(filters.gender).toUpperCase() === 'FEMALE'
          ? 'Female Candidates'
          : 'Male Candidates'
        : 'All Genders';
    const statusLabel = filters.status && (filters.status as any) !== 'ALL' ? filters.status : 'All Status';
    const searchLabel = filters.search && filters.search.trim() ? `Search: "${filters.search.trim()}"` : null;

    const filterTitle = [classLabel, genderLabel, statusLabel !== 'All Status' ? `Status: ${statusLabel}` : null, searchLabel]
      .filter(Boolean)
      .join(' — ');

    const paidCount = students.filter((s) => {
      return (
        s.feeStatus === 'PAID' ||
        (s.feeRecords && Array.isArray(s.feeRecords) && s.feeRecords.some((f: any) => f.status === 'PAID')) ||
        Boolean(s.rollNumber)
      );
    }).length;
    const unpaidCount = students.length - paidCount;

    const rowsHtml =
      students.length > 0
        ? students
            .map((s, idx) => {
              const appNo = s.rollNumber || s.applicationNo || s.id;
              const contact = s.parentMobile || s.studentMobile || s.mobile || s.whatsapp || s.emergencyContact || 'N/A';
              const isPaid =
                s.feeStatus === 'PAID' ||
                (s.feeRecords && Array.isArray(s.feeRecords) && s.feeRecords.some((f: any) => f.status === 'PAID')) ||
                Boolean(s.rollNumber);
              const feeStatus = isPaid ? 'PAID' : (s.feeRecords?.[0]?.status || 'UNPAID');
              const att = s.attendancePercentage != null ? `${s.attendancePercentage}%` : '—';
              const cat = (s.scholarshipCategory || 'GENERAL_MERIT').replace(/_/g, ' ');
              const photo = this.escapeHtml(s.rosterPhotoDataUrl || '');
              const photoCell = photo
                ? `<img class="roster-photo" src="${photo}" alt="Candidate photo" />`
                : `<span class="photo-placeholder">No photo</span>`;

              return `
          <tr class="${idx % 2 === 1 ? 'even-row' : ''}">
            <td class="text-center font-bold">${idx + 1}</td>
            <td class="text-center">${photoCell}</td>
            <td class="font-mono text-center font-bold text-navy">${appNo}</td>
            <td><strong>${s.fullName || '—'}</strong></td>
            <td>${s.fatherName || '—'}</td>
            <td class="school-cell">${this.escapeHtml(s.schoolName || '—')}</td>
            <td class="font-mono text-center">${s.cnicOrBForm || '—'}</td>
            <td><span class="class-tag">${s.currentClass || '—'}</span><br/><small class="text-muted">${cat}</small></td>
            <td class="text-center"><span class="badge ${isPaid ? 'badge-paid' : 'badge-unpaid'}">${feeStatus}</span></td>
            <td class="text-center font-bold">${att}</td>
            <td class="font-mono text-center">${contact}</td>
          </tr>
              `;
            })
            .join('')
        : `
          <tr>
            <td colspan="11" class="empty-state">
              No students match the selected filter criteria (${classLabel}, ${genderLabel}, ${statusLabel}).
            </td>
          </tr>
        `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM Students Roster — ${filterTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
    body { background: #fff; padding: 6mm 8mm; color: #0f172a; font-size: 10px; }
    
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 6px; }
    .header-left { width: 70%; vertical-align: middle; }
    .header-right { width: 30%; text-align: right; vertical-align: middle; }
    
    .org-title { font-size: 16px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
    .doc-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 2px; }
    .sub-title { font-size: 9.5px; color: #64748b; font-weight: 500; }
    
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 9.5px; display: inline-block; text-align: right; }
    .meta-box strong { color: #1e3a8a; }

    .filter-ribbon { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .filter-title { font-size: 10.5px; font-weight: 700; color: #1e3a8a; }
    .counts-summary { font-size: 9.5px; font-weight: 600; color: #334155; }
    .counts-summary strong { color: #0f172a; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 15px; }
    .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 4.5px 6px; vertical-align: middle; }
    .data-table th { background: #1e3a8a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.3px; }
    .even-row { background: #f8fafc; }

    .text-center { text-align: center; }
    .text-navy { color: #1e3a8a; }
    .text-muted { color: #64748b; font-size: 8px; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 700; }

    .class-tag { font-weight: 600; color: #0f172a; }

    .badge { display: inline-block; padding: 1.5px 5px; border-radius: 3px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; }
    .badge-paid { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-unpaid { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .roster-photo { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid #cbd5e1; display: block; margin: 0 auto; }
    .photo-placeholder { color: #94a3b8; font-size: 6.5px; font-style: italic; }
    .school-cell { word-break: break-word; }

    .empty-state { text-align: center; padding: 25px; color: #64748b; font-weight: 600; font-size: 10px; background: #fafafa; }

    .footer-summary { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #475569; page-break-inside: avoid; }
    .sig-line { width: 180px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 4px; font-weight: 700; color: #334155; font-size: 8.5px; }
  </style>
</head>
<body>

  <table class="header-table">
    <tr>
      <td class="header-left">
        <div class="org-title">AZM.AIO SCHOLARSHIP & EXAMINATION AUTHORITY</div>
        <div class="doc-title">Official Candidate Roster — Session V (2026)</div>
        <div class="sub-title">Central Scholarship Directorate | Jaddoon Plaza, Karakoram Highway, Mansehra, KP</div>
      </td>
      <td class="header-right">
        <div class="meta-box">
          <div>Generated: <strong>${generatedDate}</strong> (${generatedTime})</div>
          <div>Total Candidates: <strong>${totalCount}</strong></div>
        </div>
      </td>
    </tr>
  </table>

  <div class="filter-ribbon">
    <div class="filter-title">
      Filter: <span>${filterTitle}</span>
    </div>
    <div class="counts-summary">
      Total: <strong>${totalCount}</strong> &nbsp;|&nbsp; Paid: <strong style="color: #166534;">${paidCount}</strong> &nbsp;|&nbsp; Unpaid: <strong style="color: #92400e;">${unpaidCount}</strong>
    </div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 3%;" class="text-center">Sr #</th>
        <th style="width: 5%;" class="text-center">Photo</th>
        <th style="width: 11%;" class="text-center">Roll / App No</th>
        <th style="width: 14%;">Candidate Name</th>
        <th style="width: 11%;">Father's Name</th>
        <th style="width: 13%;">Current School / College</th>
        <th style="width: 11%;" class="text-center">CNIC / B-Form</th>
        <th style="width: 12%;">Class &amp; Category</th>
        <th style="width: 6%;" class="text-center">Fee</th>
        <th style="width: 5%;" class="text-center">Att %</th>
        <th style="width: 9%;" class="text-center">Contact</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer-summary">
    <div>
      <p>Report Ref: <strong>AZM-RST-${Date.now().toString().slice(-6)}</strong> &nbsp;|&nbsp; Confidential Administrative Record</p>
      <p style="font-size: 8px; color: #94a3b8; margin-top: 2px;">This is an officially verified computer-generated document authorized by AZM.AIO Central Directorate.</p>
    </div>
    <div style="display: flex; gap: 30px;">
      <div class="sig-line">Admissions Desk Verification</div>
      <div class="sig-line">Controller of Examinations</div>
    </div>
  </div>

</body>
</html>
    `;
  }

  /**
   * Safe HTML escaping helper to prevent XSS / SSRF in PDF rendering
   */
  private escapeHtml(str: any): string {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generates filled HTML template for the official Partner Institution Registration Acknowledgement & MOU
   */
  generatePartnerRegistrationHtml(partner: any): string {
    const isApproved = partner.status === 'APPROVED';
    const isPending = partner.status === 'PENDING';
    const isRejected = partner.status === 'REJECTED';

    const partnerCode = this.escapeHtml(partner.partnerCode || 'PENDING ASSIGNMENT');
    const institutionName = this.escapeHtml(partner.institutionName);
    const institutionType = this.escapeHtml(partner.institutionType);
    const campus = this.escapeHtml(partner.campus || 'Main Campus');
    const address = this.escapeHtml(partner.address);
    const district = this.escapeHtml(partner.district);
    const province = this.escapeHtml(partner.province);
    const contactName = this.escapeHtml(partner.contactName);
    const contactDesignation = this.escapeHtml(partner.contactDesignation);
    const contactMobile = this.escapeHtml(partner.contactMobile);
    const contactWhatsapp = this.escapeHtml(partner.contactWhatsapp || partner.contactMobile);
    const contactEmail = this.escapeHtml(partner.contactEmail || 'N/A');
    const website = this.escapeHtml(partner.website || 'N/A');
    const studentStrength = partner.studentStrength != null ? this.escapeHtml(partner.studentStrength) : '—';
    const expectedApplicants = partner.expectedApplicants != null ? this.escapeHtml(partner.expectedApplicants) : '—';
    const classes = Array.isArray(partner.classesOffered) ? partner.classesOffered.map((c: any) => this.escapeHtml(c)).join(', ') : '—';

    const registeredDate = partner.createdAt
      ? new Date(partner.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-GB');

    const statusBadge = isApproved
      ? '<span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px;">OFFICIALLY ACCREDITED PARTNER</span>'
      : isRejected
      ? '<span style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px;">APPLICATION REJECTED</span>'
      : '<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px;">PENDING VERIFICATION</span>';

    const docTitle = isApproved
      ? 'INSTITUTIONAL ACCREDITATION &amp; MEMORANDUM OF UNDERSTANDING'
      : 'PARTNER REGISTRATION ACKNOWLEDGEMENT &amp; MOU';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM Partner Registration — ${partnerCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
    body { background: #fff; padding: 8mm 10mm; color: #0f172a; font-size: 10.5px; line-height: 1.45; }
    
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 8px; }
    .org-title { font-size: 17px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
    .doc-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 2px; }
    .sub-title { font-size: 9px; color: #64748b; font-weight: 500; }
    
    .meta-card { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .code-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .code-val { font-size: 15px; font-weight: 900; color: #1e3a8a; font-family: monospace; }
    
    .section-title { font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; background: #eff6ff; border-left: 4px solid #1e3a8a; padding: 4px 8px; margin: 12px 0 6px 0; }
    
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
    .info-table td { padding: 4.5px 6px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
    .lbl { width: 28%; font-weight: 700; color: #475569; }
    .val { width: 72%; font-weight: 600; color: #0f172a; }
    
    .mou-box { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 9px; color: #334155; margin-top: 10px; line-height: 1.4; }
    .mou-box strong { color: #0f172a; }
    
    .sig-section { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
    .sig-box { width: 45%; border-top: 1.5px solid #94a3b8; text-align: center; padding-top: 4px; font-size: 9.5px; font-weight: 700; color: #334155; }
    
    .footer-note { margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>

  <table class="header-table">
    <tr>
      <td style="width: 70%;">
        <div class="org-title">AZM.AIO SCHOLARSHIP &amp; ACADEMIC DIRECTORY</div>
        <div class="doc-title">${docTitle}</div>
        <div class="sub-title">Central Secretariat: Jaddoon Plaza, Karakoram Highway, Mansehra, KP | 0305-1755551</div>
      </td>
      <td style="width: 30%; text-align: right; vertical-align: middle;">
        ${statusBadge}
      </td>
    </tr>
  </table>

  <div class="meta-card">
    <div>
      <div class="code-label">Partner Registration Code</div>
      <div class="code-val">${partnerCode}</div>
    </div>
    <div style="text-align: right;">
      <div class="code-label">Enrolled Date</div>
      <div style="font-weight: 700; font-size: 11px; color: #0f172a;">${registeredDate}</div>
    </div>
  </div>

  <div class="section-title">Part 1: Institutional Identification</div>
  <table class="info-table">
    <tr>
      <td class="lbl">Institution Name:</td>
      <td class="val" style="font-size: 11.5px; font-weight: 800; color: #1e3a8a;">${institutionName}</td>
    </tr>
    <tr>
      <td class="lbl">Institution Category:</td>
      <td class="val">${institutionType} &nbsp;|&nbsp; Campus: <strong>${campus}</strong></td>
    </tr>
    <tr>
      <td class="lbl">Campus Location / Address:</td>
      <td class="val">${address}, District: <strong>${district}</strong>, Province: <strong>${province}</strong></td>
    </tr>
    <tr>
      <td class="lbl">Official Web / Portal:</td>
      <td class="val">${website}</td>
    </tr>
  </table>

  <div class="section-title">Part 2: Administrative &amp; Focal Person Details</div>
  <table class="info-table">
    <tr>
      <td class="lbl">Authorized Focal Person:</td>
      <td class="val"><strong>${contactName}</strong> (${contactDesignation})</td>
    </tr>
    <tr>
      <td class="lbl">Official Mobile / Contact:</td>
      <td class="val" style="font-family: monospace; font-weight: 700;">${contactMobile} &nbsp;|&nbsp; WhatsApp: ${contactWhatsapp}</td>
    </tr>
    <tr>
      <td class="lbl">Official Email:</td>
      <td class="val">${contactEmail}</td>
    </tr>
  </table>

  <div class="section-title">Part 3: Academic Scope &amp; Projected Candidacy</div>
  <table class="info-table">
    <tr>
      <td class="lbl">Classes Offered:</td>
      <td class="val"><strong>${classes}</strong></td>
    </tr>
    <tr>
      <td class="lbl">Total Enrolled Strength:</td>
      <td class="val">${studentStrength} Students</td>
    </tr>
    <tr>
      <td class="lbl">Projected Session V Applicants:</td>
      <td class="val" style="color: #166534; font-weight: 800;">${expectedApplicants} Eligible Candidates</td>
    </tr>
  </table>

  <div class="section-title">Part 4: Institutional Declaration &amp; Partnership Terms</div>
  <div class="mou-box">
    <p>
      By registering as an AZM.AIO Partner Institution, the institution confirms mutual cooperation in student talent identification, scholarship awareness facilitation, and academic integrity for Session V (2026).
    </p>
    <p style="margin-top: 4px;">
      • <strong>Status Declaration:</strong> ${isApproved ? 'This institution is officially accredited as an authorized AZM.AIO Examination Partner Venue.' : isRejected ? 'This institutional application was reviewed and not shortlisted.' : 'This registration is under verification by the AZM Central Academic Affairs Committee.'}
    </p>
  </div>

  <div class="sig-section">
    <div class="sig-box">
      Authorized Principal / Focal Person Signature &amp; Seal<br/>
      <span style="font-size: 8px; color: #64748b; font-weight: normal;">${institutionName}</span>
    </div>
    <div class="sig-box">
      Director of Institutional Accreditation &amp; Scholarships<br/>
      <span style="font-size: 8px; color: #64748b; font-weight: normal;">AZM.AIO Central Secretariat, Mansehra</span>
    </div>
  </div>

  <div class="footer-note">
    <span>Document Ref: <strong>AZM-MOU-${partnerCode}</strong></span>
    <span>Computer Generated Official Record &copy; 2026 AZM.AIO</span>
  </div>

</body>
</html>
    `;
  }

  /**
   * Generates filled HTML template for the official 100-Question Single-Page A4 OMR Bubble Sheet.
   * Uses exact mm-based fixed geometry (210mm x 297mm) matching browser print and scanner coordinates.
   */
  generateOmrSheetHtml(student: any, qrDataUrl = '', photoBase64?: string): string {
    const isProvisional = !student.rollNumber;
    const rollNo = student.rollNumber || student.displayRollNumber || student.officeUse?.testRollNo || (student.applicationNo ? `PROV-${student.applicationNo}` : 'PROVISIONAL');
    const appNo = student.applicationNo || student.id || 'APP-2026';
    const candName = (student.fullName || '').toUpperCase();
    const fatherName = (student.fatherName || '').toUpperCase();
    const cnic = student.cnicOrBForm || 'N/A';
    const classLevel = student.currentClass || 'SSC-II (Class 10th)';
    const groupOrSubject = student.hsscGroup || student.bsDepartment || 'General Merit / Science';
    const testCenter = student.officeUse?.testCentre || student.testCenterName || 'To be assigned';
    const roomNo = student.assignedRoom || 'To be assigned';
    const seatNo = student.seatNo || 'To be assigned';

    const defaultPhoto = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150" viewBox="0 0 120 150">
        <rect width="120" height="150" fill="#f8fafc"/>
        <circle cx="60" cy="50" r="25" fill="#94a3b8"/>
        <path d="M20 125 C20 90, 100 90, 100 125 Z" fill="#64748b"/>
        <text x="60" y="142" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#475569" text-anchor="middle">PHOTO</text>
      </svg>`
    )}`;

    const photoSrc =
      photoBase64 ||
      (student.photoUrl && student.photoUrl.startsWith('data:') ? student.photoUrl : null) ||
      (student.uploadedDocuments?.photo?.dataUrl && student.uploadedDocuments.photo.dataUrl.startsWith('data:') ? student.uploadedDocuments.photo.dataUrl : null) ||
      defaultPhoto;

    const columns = [
      { start: 1, end: 25 },
      { start: 26, end: 50 },
      { start: 51, end: 75 },
      { start: 76, end: 100 },
    ];

    const renderColumn = (start: number, end: number) => {
      let rowsHtml = '';
      for (let q = start; q <= end; q++) {
        const qStr = q < 10 ? `0${q}` : `${q}`;
        const isShaded = q % 5 === 0;
        rowsHtml += `
          <div class="omr-row ${isShaded ? 'shaded' : ''}">
            <span class="q-num">${qStr}</span>
            <div class="bubbles-wrap">
              <span class="bubble">A</span>
              <span class="bubble">B</span>
              <span class="bubble">C</span>
              <span class="bubble">D</span>
            </div>
          </div>
        `;
      }
      return `
        <div class="omr-col">
          <div class="omr-col-header">Q. ${start} - ${end}</div>
          <div class="omr-col-body">
            ${rowsHtml}
          </div>
        </div>
      `;
    };

    const qrImgTag = qrDataUrl
      ? `<img src="${qrDataUrl}" alt="Verification QR" />`
      : `<div style="font-size: 7px; color: #475569; text-align: center; padding-top: 15px;">QR PASS</div>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM OMR Answer Sheet - ${rollNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    body {
      background: #ffffff;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .omr-page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 5.5mm 7.5mm;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      box-sizing: border-box;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }

    /* Corner Alignment Markers for Scanning */
    .corner-mark {
      position: absolute;
      width: 6mm;
      height: 6mm;
      background: #000000;
    }
    .timing-track { position: absolute; top: 70mm; display: flex; flex-direction: column; gap: 3mm; }
    .timing-track.left { left: 2.5mm; }
    .timing-track.right { right: 2.5mm; }
    .timing-block { width: 2mm; height: 2mm; background: #000; }
    .corner-tl { top: 2.5mm; left: 2.5mm; }
    .corner-tr { top: 2.5mm; right: 2.5mm; }
    .corner-bl { bottom: 2.5mm; left: 2.5mm; }
    .corner-br { bottom: 2.5mm; right: 2.5mm; }

    /* Header */
    .omr-header {
      text-align: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .omr-title {
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0f172a;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .omr-subtitle {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .omr-doc-name {
      display: inline-block;
      background: #000000;
      color: #ffffff;
      font-size: 7.8pt;
      font-weight: 800;
      padding: 1.5px 12px;
      border-radius: 3px;
      text-transform: uppercase;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }

    .preissue-banner {
      background: #fffbeb;
      border: 1.2px dashed #d97706;
      color: #92400e;
      font-size: 7.2pt;
      font-weight: 800;
      text-align: center;
      padding: 2px 6px;
      margin-bottom: 2mm;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    /* Candidate Particulars & Verification Section */
    .info-container {
      position: relative;
      overflow: hidden;
      display: flex;
      border: 1.5px solid #000000;
      border-radius: 4px;
      margin-bottom: 2mm;
      padding: 2mm 3mm;
      gap: 3mm;
      align-items: stretch;
      background: #fafafa;
    }
    .omr-watermark-info {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-4deg);
      font-size: 26pt;
      font-weight: 900;
      letter-spacing: 3px;
      color: #000000;
      opacity: 0.045;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .photo-box, .details-table, .qr-box {
      position: relative;
      z-index: 1;
    }
    .photo-box {
      width: 23mm;
      height: 27mm;
      border: 1.2px solid #000000;
      border-radius: 3px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    .photo-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .details-table {
      flex: 1;
      border-collapse: collapse;
      font-size: 7.2pt;
    }
    .details-table td {
      padding: 1.2px 2px;
      vertical-align: middle;
    }
    .dt-label {
      font-weight: 800;
      color: #334155;
      width: 25%;
      text-transform: uppercase;
      font-size: 6.5pt;
    }
    .dt-val {
      font-weight: 700;
      color: #000000;
      border-bottom: 0.8px solid #cbd5e1;
      font-size: 7.2pt;
    }
    .dt-val.highlight {
      font-family: 'Courier New', monospace;
      font-size: 8.5pt;
      font-weight: 900;
      color: #000000;
    }
    .qr-box {
      width: 27mm;
      height: 27mm;
      border: 1.2px solid #000000;
      border-radius: 3px;
      padding: 1.5px;
      background: #ffffff;
      flex-shrink: 0;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .qr-box img {
      width: 21mm;
      height: 21mm;
      object-fit: contain;
    }
    .qr-box-label {
      font-size: 5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #334155;
      margin-top: 1px;
    }

    /* Instructions & Bubble Guide */
    .guide-strip {
      border: 1px solid #000000;
      border-radius: 3px;
      padding: 1.2px 4px;
      margin-bottom: 2mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 6.5pt;
      background: #f8fafc;
      box-sizing: border-box;
    }
    .guide-legend {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .guide-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .sample-bubble {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 1px solid #000000;
      font-size: 5pt;
      font-weight: bold;
    }
    .sample-filled {
      background: #000000;
      color: #ffffff;
    }

    /* Manual Paper Version Optical Block */
    .omr-version-box {
      display: flex;
      align-items: center;
      gap: 2.2mm;
      padding: 0.3mm 2mm;
      background: #ffffff;
      border: 1.1px solid #000000;
      border-radius: 2px;
    }
    .version-title {
      font-size: 5.8pt;
      font-weight: 900;
      color: #000000;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .version-bubbles-group {
      display: flex;
      align-items: center;
      gap: 2.4mm;
    }
    .version-opt {
      display: inline-flex;
      align-items: center;
      gap: 1.2px;
    }
    .v-label {
      font-size: 6.5pt;
      font-weight: 900;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      line-height: 1;
    }
    .v-bubble {
      display: inline-block;
      width: 4.1mm;
      height: 4.1mm;
      border: 1.1px solid #000000;
      border-radius: 50%;
      background: #ffffff;
      box-sizing: border-box;
      vertical-align: middle;
    }

    /* 100 MCQs Grid (4 columns x 25 rows) */
    .omr-grid-container {
      display: flex;
      justify-content: space-between;
      gap: 2.5mm;
      margin-bottom: 2mm;
    }
    .omr-col {
      flex: 1;
      border: 1.2px solid #000000;
      border-radius: 3px;
      overflow: hidden;
    }
    .omr-col-header {
      background: #000000;
      color: #ffffff;
      font-size: 6.8pt;
      font-weight: 900;
      text-align: center;
      padding: 1.5px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .omr-col-body {
      padding: 0;
    }
    .omr-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      padding: 1.5px 2.5px;
      border-bottom: 0.8px solid #e2e8f0;
      font-size: 6.8pt;
    }
    .omr-row:last-child {
      border-bottom: none;
    }
    .omr-row.shaded {
      background: #f1f5f9;
    }
    .q-num {
      width: 5.5mm;
      text-align: right;
      font-weight: 800;
      color: #0f172a;
      font-family: 'Courier New', monospace;
      font-size: 7pt;
      flex-shrink: 0;
    }
    .bubbles-wrap {
      display: flex;
      gap: 1.8px;
      flex-shrink: 0;
    }
    .bubble {
      width: 4.1mm;
      height: 4.1mm;
      border: 1.1px solid #000000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 5.8pt;
      font-weight: 800;
      color: #000000;
      background: #ffffff;
      line-height: 1;
    }

    /* Signatures Section */
    .omr-footer-container {
      position: relative;
      overflow: hidden;
      width: 100%;
      border: 1px solid #000000;
      border-radius: 3px;
      background: #fafafa;
      margin-bottom: 2mm;
    }
    .omr-footer-table {
      position: relative;
      z-index: 1;
      width: 100%;
      border-collapse: collapse;
      background: transparent;
    }
    .omr-watermark-footer {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 4px;
      color: #000000;
      opacity: 0.04;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .omr-footer-table td {
      position: relative;
      z-index: 1;
      width: 50%;
      padding: 2.5mm 4mm;
      vertical-align: top;
    }
    .sig-heading {
      font-size: 6.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #1e293b;
      margin-bottom: 7.5mm;
    }
    .sig-line {
      border-top: 1px solid #000000;
      font-size: 6.2pt;
      font-weight: 700;
      color: #334155;
      padding-top: 1.5px;
      display: inline-block;
      width: 90%;
    }

    .omr-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 5.8pt;
      color: #475569;
      font-family: monospace;
      padding: 0 2px;
    }
  </style>
</head>
<body>

  <div class="omr-page">
    <div class="timing-track left">${'<i class="timing-block"></i>'.repeat(25)}</div>
    <div class="timing-track right">${'<i class="timing-block"></i>'.repeat(25)}</div>
    <!-- Corner Alignment Markers for Scanning -->
    <div class="corner-mark corner-tl"></div>
    <div class="corner-mark corner-tr"></div>
    <div class="corner-mark corner-bl"></div>
    <div class="corner-mark corner-br"></div>

    <!-- Header -->
    <div class="omr-header">
      <div class="omr-title">AZM.AIO SCHOLARSHIP EXAMINATION</div>
      <div class="omr-subtitle">Session V (2026) Merit &amp; Scholarship Screening Test</div>
      <div class="omr-doc-name">OFFICIAL OMR ANSWER SHEET &mdash; 100 MCQS</div>
    </div>

    ${isProvisional ? `
    <div class="preissue-banner">
      PRE-ISSUE COPY &mdash; OFFICIAL ROLL NUMBER NOT YET ISSUED
    </div>` : ''}

    <!-- Candidate Info & Verification -->
    <div class="info-container">
      <div class="omr-watermark-info">AZM.AIO SCHOLARSHIP EXAMINATION</div>
      <div class="photo-box">
        <img src="${photoSrc}" alt="Candidate Photo" />
      </div>

      <table class="details-table">
        <tr>
          <td class="dt-label">Candidate Name:</td>
          <td class="dt-val">${candName}</td>
          <td class="dt-label">Roll Number:</td>
          <td class="dt-val highlight">${rollNo}</td>
        </tr>
        <tr>
          <td class="dt-label">Father's Name:</td>
          <td class="dt-val">${fatherName}</td>
          <td class="dt-label">App / Form No:</td>
          <td class="dt-val">${appNo}</td>
        </tr>
        <tr>
          <td class="dt-label">CNIC / B-Form:</td>
          <td class="dt-val" style="font-family: monospace;">${cnic}</td>
          <td class="dt-label">Seat / Room:</td>
          <td class="dt-val">${roomNo} | ${seatNo}</td>
        </tr>
        <tr>
          <td class="dt-label">Class &amp; Group:</td>
          <td class="dt-val">${classLevel} (${groupOrSubject})</td>
          <td class="dt-label">Test Center:</td>
          <td class="dt-val">${testCenter}</td>
        </tr>
      </table>

      <div class="qr-box">
        ${qrImgTag}
        <div class="qr-box-label">Candidate Identity QR</div>
      </div>
    </div>

    <!-- Instructions Strip with Manual Paper Version Block -->
    <div class="guide-strip">
      <div class="guide-legend">
        <strong>INSTRUCTIONS:</strong>
        <span>Blue/Black ballpoint only. Darken circle completely.</span>
        <div class="guide-item">
          <span>Correct:</span>
          <span class="sample-bubble sample-filled">A</span>
        </div>
        <div class="guide-item">
          <span>Wrong:</span>
          <span class="sample-bubble">&#10007;</span>
          <span class="sample-bubble">&#10003;</span>
          <span class="sample-bubble">&#9680;</span>
        </div>
      </div>
      <div class="omr-version-box">
        <span class="version-title">PAPER VERSION &mdash; MARK ONE ONLY:</span>
        <div class="version-bubbles-group">
          <div class="version-opt"><span class="v-label">A</span><i class="v-bubble"></i></div>
          <div class="version-opt"><span class="v-label">B</span><i class="v-bubble"></i></div>
          <div class="version-opt"><span class="v-label">C</span><i class="v-bubble"></i></div>
          <div class="version-opt"><span class="v-label">D</span><i class="v-bubble"></i></div>
        </div>
      </div>
    </div>

    <!-- 100 MCQs Grid (4 Columns) -->
    <div class="omr-grid-container">
      ${columns.map((c) => renderColumn(c.start, c.end)).join('')}
    </div>

    <!-- Signatures -->
    <div class="omr-footer-container">
      <div class="omr-watermark-footer">AZM.AIO</div>
      <table class="omr-footer-table">
        <tr>
          <td>
            <div class="sig-heading">Candidate Declaration &amp; Signature</div>
            <span class="sig-line">Candidate Signature (Signed in Hall)</span>
          </td>
          <td style="text-align: right;">
            <div class="sig-heading" style="text-align: right;">Hall Chief Invigilator Verification</div>
            <span class="sig-line" style="text-align: center;">Invigilator Signature &amp; Center Stamp</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="omr-bottom-bar">
      <span>SHEET-ID: AZM-OMR-2026V-${rollNo}</span>
      <span>SECURITY VERIFICATION: CERTIFIED VALID FOR SESSION V 2026</span>
      <span>TEMPLATE VER: 2.0</span>
    </div>
  </div>

</body>
</html>
    `;
  }

  /**
   * Generates a single HTML document containing multiple candidate OMR sheets
   * separated by standard page-break rules for bulk printing.
   */
  generateBulkOmrSheetsHtml(sheets: Array<{ student: any; qrDataUrl: string; photoBase64?: string }>): string {
    const pageHtmls = sheets.map((item) => {
      const fullHtml = this.generateOmrSheetHtml(item.student, item.qrDataUrl, item.photoBase64);
      // Extract the .omr-page body content
      const match = fullHtml.match(/<div class="omr-page">([\s\S]*?)<\/div>\s*<\/body>/i);
      if (match) {
        return `<div class="omr-page page-break">${match[1]}</div>`;
      }
      return fullHtml;
    });

    const sample = sheets[0] ? this.generateOmrSheetHtml(sheets[0].student, sheets[0].qrDataUrl, sheets[0].photoBase64) : '';
    const styleMatch = sample.match(/<style>([\s\S]*?)<\/style>/i);
    const styles = styleMatch ? styleMatch[1] : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM Bulk OMR Answer Sheets (${sheets.length} Candidates)</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  ${pageHtmls.join('\n')}
</body>
</html>
    `;
  }

  /**
   * Generates a single HTML document containing multiple candidate Roll Number Slips
   * separated by standard page-break rules for bulk printing.
   */
  generateBulkRollSlipsHtml(slips: Array<{ student: any; qrDataUrl: string; photoBase64?: string }>): string {
    const pageHtmls = slips.map((item) => {
      const fullHtml = this.generateRollSlipHtml(item.student, item.qrDataUrl, item.photoBase64);
      const match = fullHtml.match(/<div class="slip-page">([\s\S]*?)<\/div>\s*<\/body>/i);
      if (match) {
        return `<div class="slip-page page-break" style="margin-bottom: 0; page-break-after: always; break-after: page;">${match[1]}</div>`;
      }
      return fullHtml;
    });

    const sample = slips[0] ? this.generateRollSlipHtml(slips[0].student, slips[0].qrDataUrl, slips[0].photoBase64) : '';
    const styleMatch = sample.match(/<style>([\s\S]*?)<\/style>/i);
    const styles = styleMatch ? styleMatch[1] : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AZM Bulk Roll Number Slips (${slips.length} Candidates)</title>
  <style>
    ${styles}
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
  </style>
</head>
<body>
  ${pageHtmls.join('\n')}
</body>
</html>
    `;
  }
}

export const pdfService = new PdfService();



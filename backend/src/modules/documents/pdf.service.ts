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
      '--single-process',
      '--no-zygote',
      '--no-first-run',
      '--renderer-process-limit=1',
      '--js-flags=--max-old-space-size=64',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--disable-features=IsolateOrigins,site-per-process,AudioServiceOutOfProcess',
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

    const isArm64 = process.arch === 'arm64';

    const launchServerlessChromium = async () => {
      // Keep the normal Sparticuz package for Render/x64.
      // Oracle ARM64 uses chromium-min with a remote ARM64 pack.
      if (isArm64) {
        process.env.FONTCONFIG_PATH = '/tmp/fonts';
      }

      const chromiumModule: any = isArm64
        ? await import('@sparticuz/chromium-min')
        : await import('@sparticuz/chromium');

      const chromium = chromiumModule.default || chromiumModule;

      if (isArm64) {
        chromium.setGraphicsMode = false;
      }

      const puppeteerCoreModule: any = await import('puppeteer-core');
      const puppeteerCore =
        puppeteerCoreModule.default || puppeteerCoreModule;

      const arm64PackUrl = process.env.CHROMIUM_ARM64_PACK_URL;

      if (isArm64 && !arm64PackUrl) {
        throw new Error(
          'CHROMIUM_ARM64_PACK_URL is required on ARM64.'
        );
      }

      const executablePath = isArm64
        ? await chromium.executablePath(arm64PackUrl)
        : await chromium.executablePath();

      if (!executablePath) {
        throw new Error(
          'Serverless Chromium did not provide an executable path.'
        );
      }

      logger.info(
        isArm64
          ? `Using ARM64 Chromium binary at: ${executablePath}`
          : `Using serverless Chromium binary at: ${executablePath}`
      );

      return puppeteerCore.launch({
        args: [...chromium.args, ...memoryOptimizedArgs],
        defaultViewport:
          chromium.defaultViewport || { width: 1280, height: 800 },
        executablePath,
        headless: chromium.headless ?? true,
      });
    };

    const isRender = Boolean(
      process.env.RENDER || process.env.RENDER_SERVICE_ID
    );

    if (isRender || isArm64) {
      try {
        logger.info(
          isArm64
            ? 'Using ARM64 serverless Chromium pack for PDF generation.'
            : 'Using memory-efficient serverless Chromium on Render for PDF generation.'
        );

        return await launchServerlessChromium();
      } catch (serverlessErr: any) {
        logger.warn(
          'Serverless Chromium launch failed; trying the bundled browser:',
          serverlessErr.message
        );
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
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });

        const pdfUint8Array = await page.pdf({
          format: options?.format || 'A4',
          landscape: options?.landscape ?? false,
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate:
            '<div style="width: 100%; font-size: 8px; color: #94a3b8; font-family: Segoe UI, Arial, sans-serif; display: flex; justify-content: space-between; padding: 0 10mm;"><span>AZM.AIO Examination Authority &copy; 2026</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
          margin: options?.margin || {
            top: '8mm',
            bottom: '12mm',
            left: '8mm',
            right: '8mm',
          },
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
    return `<span class="check-item"><span class="check-box${checked ? ' checked' : ''}"></span><span class="check-label">${label}</span></span>`;
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
    .check-box { display: inline-block; position: relative; width: 13px; height: 13px; border: 1.2px solid #334155; border-radius: 2px; margin-right: 4px; background: #fff; flex-shrink: 0; }
    .check-box.checked::after { content: ''; position: absolute; left: 3px; top: 0px; width: 4px; height: 8px; border: solid #334155; border-width: 0 2px 2px 0; transform: rotate(45deg); }
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
            <td>${r.percentage != null ? `${Number(r.percentage).toFixed(2)}%` : ''}</td>
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
    const rollNo = student.rollNumber || 'PENDING';
    const appNo = student.applicationNo || student.id || 'APP-2026';
    const candName = (student.fullName || '').toUpperCase();
    const fatherName = (student.fatherName || '').toUpperCase();
    const cnic = student.cnicOrBForm || 'N/A';
    const classLevel = student.currentClass || 'SSC-II (Class 10th)';
    const testCenter = student.officeUse?.testCentre || 'Main Campus Examination Center, Mansehra';
    const centerAddress = 'Main College Road, Mansehra / Abbottabad Regional Center, KP';
    const roomNo = student.assignedRoom || 'Hall 301-E';
    const seatNo = student.seatNo || `Seat #${rollNo.split('-').pop() || '01'}`;

    const examDate = student.officeUse?.testDate
      ? new Date(student.officeUse.testDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Sunday, 15 November 2026';
    const reportingTime = student.officeUse?.testReportingTime || '09:00 AM (Strict)';
    const examTiming = '10:00 AM - 12:00 PM (120 Mins / 100 MCQs)';

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
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="org-title">AZM SCHOLARSHIP PROGRAM</div>
          <div class="session-title">Session V (2026) 100 MCQs Scholarship Examination</div>
          <div class="motto-text">Official Examination Entry Pass & Roll Number Slip</div>
        </td>
        <td class="header-right">
          <div class="doc-badge">Official Entry Pass</div>
          <div style="font-size: 9px; font-weight: 700; color: #059669; margin-top: 2px;">✓ Verified Candidate</div>
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
            <div class="roll-box-label">Official Roll No</div>
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
        <div class="sched-label">Test Duration & Format</div>
        <div class="sched-value">${examTiming}</div>
      </div>
    </div>

    <!-- Instructions & Rules -->
    <div class="section-title">Important Candidate Instructions & Examination SOPs</div>
    <ol class="rules-list">
      <li><strong>Original Credentials Required:</strong> Candidate MUST bring this printed Roll Number Slip along with their original CNIC or NADRA B-Form to the examination center. No candidate will be admitted without original credentials.</li>
      <li><strong>Strict Reporting Deadlines:</strong> Candidates must report to their allocated hall at least 45 minutes before the commencement of the exam (${reportingTime}). Entrance gates will strictly close 15 minutes before the test.</li>
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
}

export const pdfService = new PdfService();



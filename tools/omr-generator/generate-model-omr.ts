import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Projects/Azm/backend/node_modules/puppeteer');
const QRCode = require('C:/Projects/Azm/backend/node_modules/qrcode');
import { pdfService } from '../../backend/src/modules/documents/pdf.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHROME_PATH = 'C:\\Projects\\Azm\\backend\\.cache\\puppeteer\\chrome\\win64-152.0.7977.42\\chrome-win64\\chrome.exe';
const OUT_DIR = path.resolve(__dirname, '../../output/omr-sheets');

async function main() {
  console.log('Generating AZM.AIO Model OMR Sheets for students...');
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // 1. Model / Specimen Practice Copy
  const specimenQrPayload = JSON.stringify({
    type: 'AZM_OMR_MODEL_SPECIMEN',
    session: '2026-V',
    purpose: 'STUDENT_EXAM_ORIENTATION_AND_PRACTICE',
    totalQuestions: 100,
    sheetVersion: 2,
    notice: 'OFFICIAL SPECIMEN COPY - FOR ORIENTATION & PRACTICE'
  });
  const specimenQr = await QRCode.toDataURL(specimenQrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256
  });

  const modelStudent = {
    id: 'MODEL-SPECIMEN-2026',
    applicationNo: '2026-XXXX',
    rollNumber: 'AZM-2026-XXXX',
    fullName: 'CANDIDATE FULL NAME (SAMPLE)',
    fatherName: 'FATHER / GUARDIAN NAME',
    cnicOrBForm: '13501-XXXXXXX-X',
    currentClass: 'CLASS 6TH TO 12TH',
    hsscGroup: 'ALL GROUPS & CATEGORIES',
    testCenterName: 'OFFICIAL DESIGNATED TEST CENTER',
    assignedRoom: 'EXAM HALL / ROOM NO',
    seatNo: 'SEAT NO',
    gender: 'MALE',
    examDurationMinutes: 60,
  };

  // 2. Realistic Sample Candidate Copy
  const sampleQrPayload = JSON.stringify({
    type: 'AZM_OMR',
    session: '2026-V',
    studentId: 'std-sample-2026',
    applicationNo: '20261234',
    rollNumber: 'AZM-2026-1234',
    rollType: 'OFFICIAL',
    sheetVersion: 2,
  });
  const sampleQr = await QRCode.toDataURL(sampleQrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256
  });

  const sampleStudent = {
    id: 'std-sample-2026',
    applicationNo: '20261234',
    rollNumber: 'AZM-2026-1234',
    fullName: 'MUHAMMAD HAMZA',
    fatherName: 'TARIQ MEHMOOD',
    cnicOrBForm: '13501-1234567-1',
    currentClass: 'SSC-II (CLASS 10TH)',
    hsscGroup: 'SCIENCE (COMPUTER SCIENCE)',
    testCenterName: 'Govt Post Graduate College Mansehra',
    assignedRoom: 'Hall A - Room 12',
    seatNo: 'Seat-44',
    gender: 'MALE',
    examDurationMinutes: 60,
  };

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const renderSheet = async (studentData: any, qrUrl: string, baseName: string) => {
    const html = pdfService.generateOmrSheetHtml(studentData, qrUrl);
    const htmlPath = path.join(OUT_DIR, baseName + '.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // PDF
    const pdfPath = path.join(OUT_DIR, baseName + '.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });
    console.log('Generated PDF: ' + pdfPath);

    // High-res preview image for sharing
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    const imgPath = path.join(OUT_DIR, baseName + '.png');
    await page.screenshot({ path: imgPath, fullPage: true });
    console.log('Generated PNG: ' + imgPath);

    await page.close();
  };

  // Render both
  await renderSheet(modelStudent, specimenQr, 'AZMAIO_SessionV_2026_Model_OMR_Sheet');
  await renderSheet(sampleStudent, sampleQr, 'AZMAIO_SessionV_2026_Sample_Candidate_OMR_Sheet');

  await browser.close();
  console.log('All OMR Model & Sample artifacts successfully generated!');
}

main().catch(err => {
  console.error('Error generating model OMR:', err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Projects/Azm/backend/node_modules/puppeteer');
import { MasterQuestion } from './parse-master.js';
import { buildAllVariants, generateMappingCsv, PaperVariant } from './generate-variants.js';
import { generateStudentPaperHtml } from './render-papers.js';
import { generateAnswerKeysHtml } from './render-answer-keys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Projects\\Azm\\backend\\.cache\\puppeteer\\chrome\\win64-152.0.7977.42\\chrome-win64\\chrome.exe';
const OUTPUT_DIR = path.resolve(__dirname, '../../output/question-papers/class-6');

async function main() {
  console.log('🚀 Starting AZM.AIO Class 6 Question Paper & Answer Key Generation...');

  // 1. Load structured master questions
  const masterJsonPath = path.resolve(__dirname, 'master-questions.json');
  if (!fs.existsSync(masterJsonPath)) {
    throw new Error('master-questions.json not found. Run parse-master.ts first.');
  }
  const masterQuestions: MasterQuestion[] = JSON.parse(fs.readFileSync(masterJsonPath, 'utf-8'));
  console.log(`Loaded ${masterQuestions.length} master questions.`);

  // 2. Build variants A, B, C, D
  const variants = buildAllVariants(masterQuestions);

  // 3. Generate Mapping CSV
  const csvPath = path.join(OUTPUT_DIR, 'AZMAIO_Class6_SessionV_2026_Variant_Mapping.csv');
  generateMappingCsv(variants, csvPath);

  // 4. Launch Puppeteer Chrome
  console.log('Launching Puppeteer Chrome...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const generatePaperPdf = async (paper: PaperVariant, outFileName: string) => {
    const html = generateStudentPaperHtml(paper);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const outPdfPath = path.join(OUTPUT_DIR, outFileName);
    await page.pdf({
      path: outPdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '13mm',
        bottom: '13mm',
        left: '11mm',
        right: '11mm',
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width: 100%; font-size: 7.2pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: space-between; padding: 0 11mm; color: #64748b; border-bottom: 0.5px solid #e2e8f0;">
          <span>AZM.AIO Scholarship Examination &bull; Session V 2026 &bull; Class 6</span>
          <span style="font-weight: 800; color: #0f172a;">PAPER ${paper.version}</span>
        </div>
      `,
      footerTemplate: `
        <div style="width: 100%; font-size: 7pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: space-between; padding: 0 11mm; color: #64748b; border-top: 0.5px solid #e2e8f0;">
          <span>AZM.AIO &bull; Scholarship Examination &bull; Session V 2026 &bull; Class 6 &bull; Paper ${paper.version}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await page.close();
    console.log(`Generated: ${outFileName}`);
  };

  // Generate Individual Student Papers
  await generatePaperPdf(variants.A, 'AZMAIO_Class6_SessionV_2026_Paper_A.pdf');
  await generatePaperPdf(variants.B, 'AZMAIO_Class6_SessionV_2026_Paper_B.pdf');
  await generatePaperPdf(variants.C, 'AZMAIO_Class6_SessionV_2026_Paper_C.pdf');
  await generatePaperPdf(variants.D, 'AZMAIO_Class6_SessionV_2026_Paper_D.pdf');

  // Generate Combined All Papers PDF
  console.log('Generating combined All Papers PDF...');
  const combinedHtmlParts = (['A', 'B', 'C', 'D'] as const).map((v) => {
    const rawHtml = generateStudentPaperHtml(variants[v]);
    // Extract contents inside <body>
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    return `
      <div class="paper-booklet-wrapper" style="page-break-before: always; break-before: page;">
        ${bodyContent}
      </div>
    `;
  });

  // Extract head style from Paper A
  const sampleHtml = generateStudentPaperHtml(variants.A);
  const headStyleMatch = sampleHtml.match(/<style[^>]*>([\s\S]*)<\/style>/i);
  const headStyles = headStyleMatch ? headStyleMatch[1] : '';

  const allPapersHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AZM.AIO Class 6 Scholarship Examination - All Papers (A, B, C, D)</title>
  <style>
    ${headStyles}
    .paper-booklet-wrapper:first-of-type {
      page-break-before: avoid !important;
      break-before: avoid !important;
    }
  </style>
</head>
<body>
  ${combinedHtmlParts.join('')}
</body>
</html>`;

  const allPage = await browser.newPage();
  await allPage.setContent(allPapersHtml, { waitUntil: 'networkidle0' });
  const allPdfPath = path.join(OUTPUT_DIR, 'AZMAIO_Class6_SessionV_2026_All_Papers.pdf');
  await allPage.pdf({
    path: allPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '13mm',
      bottom: '13mm',
      left: '11mm',
      right: '11mm',
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width: 100%; font-size: 7.2pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: space-between; padding: 0 11mm; color: #64748b; border-bottom: 0.5px solid #e2e8f0;">
        <span>AZM.AIO Scholarship Examination &bull; Session V 2026 &bull; Class 6 (Complete Examination Set)</span>
        <span style="font-weight: 800; color: #0f172a;">PAPERS A &ndash; D</span>
      </div>
    `,
    footerTemplate: `
      <div style="width: 100%; font-size: 7pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: space-between; padding: 0 11mm; color: #64748b; border-top: 0.5px solid #e2e8f0;">
        <span>AZM.AIO &bull; Scholarship Examination &bull; Session V 2026 &bull; Class 6 Master Booklet</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
  });
  await allPage.close();
  console.log('Generated: AZMAIO_Class6_SessionV_2026_All_Papers.pdf');

  // Generate Administrative Answer Keys PDF
  console.log('Generating Administrative Answer Keys PDF...');
  const answerKeysHtml = generateAnswerKeysHtml(variants, masterQuestions);
  const keyPage = await browser.newPage();
  await keyPage.setContent(answerKeysHtml, { waitUntil: 'networkidle0' });
  const keyPdfPath = path.join(OUTPUT_DIR, 'AZMAIO_Class6_SessionV_2026_Answer_Keys.pdf');
  await keyPage.pdf({
    path: keyPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '13mm',
      bottom: '13mm',
      left: '11mm',
      right: '11mm',
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width: 100%; font-size: 7.2pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: space-between; padding: 0 11mm; color: #b91c1c; border-bottom: 0.5px solid #e2e8f0;">
        <span style="font-weight: 800;">CONFIDENTIAL &bull; ADMINISTRATIVE ANSWER KEYS ONLY</span>
        <span style="font-weight: 800; color: #0f172a;">CLASS 6 VARIANTS (A, B, C, D)</span>
      </div>
    `,
    footerTemplate: `
      <div style="width: 100%; font-size: 7pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: space-between; padding: 0 11mm; color: #64748b; border-top: 0.5px solid #e2e8f0;">
        <span>AZM.AIO &bull; Scholarship Examination Session V 2026 &bull; Internal Grading Document</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
  });
  await keyPage.close();
  console.log('Generated: AZMAIO_Class6_SessionV_2026_Answer_Keys.pdf');

  await browser.close();
  console.log('🎉 All PDFs successfully rendered and saved to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('❌ Error generating PDFs:', err);
  process.exit(1);
});

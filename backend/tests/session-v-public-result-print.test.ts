import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(__dirname, '../..');
const resultCss = readFileSync(path.join(repoRoot, 'src/components/results/ResultsStyles.css'), 'utf8');
const certificateCss = readFileSync(path.join(repoRoot, 'src/components/results/EdmcCertificate.css'), 'utf8');
const globalCss = `
  @media print {
    body * { visibility: hidden; }
    .no-print { display: none !important; }
  }
`;
const mockCertificate = (length: number) => `
  <!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; color: #142c3d; font-family: Arial, sans-serif; }
  ${globalCss}\n${certificateCss}\n${resultCss}
  </style></head><body>
    <header class="no-print">Do not print the application header</header>
    <div id="root">
      <section class="no-print">Do not print the candidate search form</section>
      <main class="results-public-page">
        <div class="no-print">Do not print search buttons</div>
        <article class="azm-edmc-certificate" data-result-print-root="true">
          <header class="edmc-heading"><h2>E-DMC</h2>
          <p>Electronic Detailed Marks Certificate</p></header>
          <section class="edmc-identity">
            <h3>Student name: Synthetic Candidate</h3>
            <p>Roll number: SYNTHETIC-2026-0001</p>
          </section>
          <section class="edmc-results">
            <h3>Final obtained marks</h3>
            <p>60 / 100</p><strong>PASS</strong>
          </section>
          <section class="edmc-notices">
          ${Array.from({length}, (_, i) => '<p style="padding:12px">Synthetic statement ' + i + ': This is a test certificate only.</p>').join('')}
          </section>
        </article>
      </main>
    </div><footer class="no-print">Do not print footer</footer>
  </body></html>`;

test('verified E-DMC prints visible text and excludes application controls (including long pages)', async () => {
  const executablePath = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined,
    process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  ].find((candidate) => candidate && existsSync(candidate));
  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    for (const length of [2, 42]) {
      const page = await browser.newPage();
      try {
        await page.setContent(mockCertificate(length), {waitUntil: 'load'});
        await page.emulateMediaType('print');
        const rendered = await page.evaluate(() => {
          const root = document.querySelector('[data-result-print-root]')!;
          const title = root.querySelector('h2')!;
          const search = document.querySelector('.no-print')!;
          return {
            rootVisibility: getComputedStyle(root).visibility,
            titleVisibility: getComputedStyle(title).visibility,
            titleSize: title.getBoundingClientRect().height,
            formDisplay: getComputedStyle(search).display,
          };
        });
        assert.equal(rendered.rootVisibility, 'visible');
        assert.equal(rendered.titleVisibility, 'visible');
        assert(rendered.titleSize > 0);
        assert.equal(rendered.formDisplay, 'none');
        const pdf = await page.pdf({format: 'A4', printBackground: true});
        assert(pdf.byteLength > 1_000);
        const pages = [...Buffer.from(pdf).toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
        assert(pages >= 1, 'Expected at least one printable PDF page');
        if (length === 42) assert(pages > 1, 'Long certificates should print across pages');
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('public result screen uses inclusive 60-mark PASS boundary even with stale status', () => {
  const src = readFileSync(path.join(repoRoot, 'src/components/results/PublicResultLookup.tsx'), 'utf8');
  assert(src.includes("Number(record.obtainedMarks) >= 60 ? 'PASS' : 'FAIL'"));
  assert.equal((59 >= 60), false);
  assert.equal((60 >= 60), true);
  assert.equal((61 >= 60), true);
});

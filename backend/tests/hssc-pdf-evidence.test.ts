import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { getStudyClassLabel, resolveHsscGroup } from '../src/modules/students/hsscContract';

const jsQR = createRequire(path.resolve(__dirname, '../../package.json'))('jsqr');
type Candidate = { id: string; applicationNo: string; currentClass: string; group: string };
export async function verifyHsscPdf(file: string, candidates: Candidate[]) {
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8', windowsHide: true });
  assert.equal(Number(/Pages:\s+(\d+)/.exec(info)?.[1]), candidates.length);
  const size = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info); assert(size);
  assert(Math.abs(Number(size[1]) - 595.28) < 1 && Math.abs(Number(size[2]) - 841.89) < 1, 'A4 within browser point rounding');
  const evidence: any[] = [];
  for (const [i, candidate] of candidates.entries()) {
    const page = i + 1;
    const extracted = spawnSync('pdftotext', ['-f', String(page), '-l', String(page), file, '-'], { encoding: 'utf8', windowsHide: true });
    // The bundled Windows Poppler runtime omits pdftotext; reuse its existing Python/pypdf runtime.
    const text = (extracted.error as NodeJS.ErrnoException)?.code === 'ENOENT'
      ? execFileSync(process.env.HSSC_TEST_PYTHON || 'python', ['-X', 'utf8', '-c', 'import sys; from pypdf import PdfReader; print(PdfReader(sys.argv[1]).pages[int(sys.argv[2])].extract_text())', file, String(i)], { encoding: 'utf8', windowsHide: true })
      : (assert.equal(extracted.status, 0, extracted.stderr), extracted.stdout);
    const normalized = text.replace(/\s+/g, '');
    const resolution = resolveHsscGroup({ currentClass: candidate.currentClass, hsscGroup: candidate.group });
    assert(resolution.ready && resolution.group);
    for (const expected of [candidate.applicationNo, getStudyClassLabel(candidate.currentClass), resolution.label!]) assert(normalized.includes(expected.replace(/\s+/g, '')), `Page ${page} missing ${expected}`);
    assert(!/Not specified|needs verification|Unidentified|Unknown|unverified-default/i.test(text));
    const prefix = file.replace(/\.pdf$/, '') + '-page-' + page;
    execFileSync('pdftoppm', ['-r', '150', '-f', String(page), '-singlefile', '-png', file, prefix], { windowsHide: true });
    const { data, info: pixels } = await sharp(prefix + '.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qr = jsQR(new Uint8ClampedArray(data), pixels.width, pixels.height); assert(qr, 'Missing QR on page ' + page);
    const decoded = JSON.parse(qr.data);
    assert.equal(decoded.studentId, candidate.id, 'Page order and QR student must match requested IDs');
    assert.equal(decoded.applicationNo, candidate.applicationNo);
    evidence.push({ page, applicationNo: candidate.applicationNo, studentId: candidate.id, classLabel: getStudyClassLabel(candidate.currentClass), groupLabel: resolution.label, qrPairing: 'PASS' });
  }
  fs.writeFileSync(file.replace(/\.pdf$/, '-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(`PASS actual PDF ${path.basename(file)}: ${evidence.length} A4 pages, year/group text, exact requested order, QR identity pairs, no unresolved labels`);
}
if (require.main === module) {
  const output = path.resolve(__dirname, '../../tmp/hssc-flow-20261020');
  const manifest: Candidate[] = JSON.parse(fs.readFileSync(path.join(output, 'pdf-candidate-manifest.json'), 'utf8'));
  verifyHsscPdf(path.join(output, 'ready-subset-omr.pdf'), manifest).catch(error => { console.error(error); process.exitCode = 1; });
}

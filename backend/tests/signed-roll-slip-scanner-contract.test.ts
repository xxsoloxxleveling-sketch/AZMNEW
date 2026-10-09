import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { createRequire } from 'node:module';
import { buildSignedAttendanceQrUrl, extractSignedAttendanceToken } from '../../src/utils/signedAttendanceQr';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = 'qr_SYNTHETIC-ROLL_1720000000000.' + 'a'.repeat(64);
const url = buildSignedAttendanceQrUrl(token);
assert.equal(url, 'https://azmaio.com/attend?token=' + token);
assert.equal(extractSignedAttendanceToken(url), token);
assert.equal(extractSignedAttendanceToken(token), token);
for (const invalid of [
  '', 'PENDING-FEE-100', 'PROV-100', 'https://azmaio.com/verify?rollNo=1',
  'https://evil.test/attend?token=' + token,
  'https://azmaio.com/attend?token=' + token + '&token=' + token,
  'https://azmaio.com/attend?token=' + token + '#frag',
  'qr_unsigned', '{"type":"AZM_SLIP"}', 'SYNTHETIC-ROLL-1',
]) {
  assert.equal(extractSignedAttendanceToken(invalid), null, String(invalid));
}
assert.equal(buildSignedAttendanceQrUrl('PENDING-FEE-100'), null);

// Decode the actual PNG pixels (not just the input string) with the same
// jsQR library that powers the scanner's fallback.
async function main() {
const png = await QRCode.toBuffer(url!, {
  type: 'png', width: 320, margin: 3, errorCorrectionLevel: 'M',
  color: { dark: '#000000', light: '#ffffff' },
});
const rgba = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const decoded = jsQR(new Uint8ClampedArray(rgba.data), rgba.info.width, rgba.info.height, { inversionAttempts: 'attemptBoth' });
assert.equal(decoded?.data, url);
assert.equal(extractSignedAttendanceToken(decoded?.data), token);

// A source-contract test guards against reintroducing roll-number/URL/JSON
// stand-ins which the advanced scanner cannot authenticate.
const src = (p: string) => readFileSync(path.join(root, p), 'utf8');
const service = src('backend/src/modules/students/students.service.ts');
const publicView = src('src/components/rollnumber/RollNumberSlipView.tsx');
const adminView = src('src/components/admin/students/RollSlipPreviewModal.tsx');
assert(!service.includes('qrPayload: `https://azmaio.com/verify?'));
assert(!service.includes('student.qrToken || `https://azmaio.com/verify?'));
assert(publicView.includes('extractSignedAttendanceToken(selectedSlip.qrPayload)'));
assert(!publicView.includes('api.qrserver.com'));
assert(adminView.includes('buildSignedAttendanceQrUrl(student.qrToken)'));
assert(!adminView.includes("type: 'AZM_SLIP'"));
assert(service.includes('qrService.verifySignedQrToken(student.qrToken)'));
assert(src('src/lib/mockApi.ts').includes('extractSignedAttendanceToken(mark.qrToken)'));
console.log('PASS: signed QR format, rejection, pixel decoding, and source-contract safeguards');

}
void main().catch(error => { console.error(error); process.exitCode = 1; });

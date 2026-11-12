/** Native scanner crops are sometimes a few pixels under the recommended 1600px.
 * This is an upload eligibility check, not a claim of optical quality. Backend
 * marker alignment, focus, grid mapping and QR validation remain authoritative.
 */
export const NATIVE_SCAN_RECOMMENDED_SHORT_SIDE=1600;
export const NATIVE_SCAN_ACCEPT_SHORT_SIDE=1536; // 4% crop tolerance.
const MAX_PIXELS=20_000_000;
export function nativeScanUploadProblem(width:number,height:number):string|null {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0)
    return 'The saved image has invalid dimensions. Please retake the sheet.';
  const shorter=Math.min(width,height);
  if(shorter<NATIVE_SCAN_ACCEPT_SHORT_SIDE)
    return 'This '+width+' × '+height+' scan is below the minimum for this scanner tester ('+NATIVE_SCAN_ACCEPT_SHORT_SIDE+' pixels on its shorter side). Retake with more resolution and all four OMR corner markers.';
  if(width*height>MAX_PIXELS)
    return 'This image exceeds 20 megapixels. Use a normal original scan; avoid screenshots or upscaling.';
  return null;
}
export function nativeScanResolutionAdvisory(width:number,height:number):string|null {
  return nativeScanUploadProblem(width,height)===null&&Math.min(width,height)<NATIVE_SCAN_RECOMMENDED_SHORT_SIDE
    ? 'Native crop is slightly below the recommended 1600-pixel short side ('+width+' × '+height+'). You may submit this original for isolated recognition; marker alignment, blur and QR remain unverified until the worker checks the sheet.'
    : null;
}

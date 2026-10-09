import jsQR from 'jsqr';

type ImageSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;
type BarcodeResult = { rawValue?: string; format?: string };
type NativeDetector = { detect(source: ImageSource): Promise<BarcodeResult[]> };
type NativeDetectorCtor = new (config: { formats: string[] }) => NativeDetector;

export type ReadQrResult = { value: string; method: 'native' | 'center' | 'full' };

function sourceDimensions(source: ImageSource): { width: number; height: number } {
  if ('videoWidth' in source) return { width: source.videoWidth, height: source.videoHeight };
  if ('naturalWidth' in source) return { width: source.naturalWidth, height: source.naturalHeight };
  return { width: source.width, height: source.height };
}

function decodeRegion(
  source: ImageSource,
  scratch: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
  maxSize: number,
): string | null {
  const size = Math.min(1, maxSize / Math.max(region.w, region.h));
  scratch.width = Math.max(1, Math.round(region.w * size));
  scratch.height = Math.max(1, Math.round(region.h * size));
  const context = scratch.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, region.x, region.y, region.w, region.h, 0, 0, scratch.width, scratch.height);
  const pixels = context.getImageData(0, 0, scratch.width, scratch.height);
  return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })?.data || null;
}

/**
 * Reuse this reader for a camera session. It first tries the browser's native
 * BarcodeDetector where available, then a high-detail center region and a
 * wider jsQR pass. A code is only *decoded*, never authenticated here:
 * the attendance endpoint still verifies the signed token + Hall membership.
 */
export class CandidateQrReader {
  private native: NativeDetector | null = null;
  private nativeDisabled = false;

  constructor() {
    const Detector = (typeof window !== 'undefined'
      ? (window as typeof window & { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector
      : undefined);
    if (!Detector) return;
    try { this.native = new Detector({ formats: ['qr_code'] }); }
    catch { this.nativeDisabled = true; }
  }

  async decode(source: ImageSource, scratch: HTMLCanvasElement): Promise<ReadQrResult | null> {
    const { width, height } = sourceDimensions(source);
    if (width < 10 || height < 10) return null;

    if (this.native && !this.nativeDisabled) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        // A driver that never completes must not freeze the entire scanning
        // loop. Fall back to local jsQR after a bounded native attempt.
        const codes = await Promise.race([
          this.native.detect(source),
          new Promise<BarcodeResult[]>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Native decoder timeout')), 450);
          }),
        ]);
        const match = codes.find(code => code.rawValue?.trim() && (!code.format || code.format === 'qr_code'));
        if (match?.rawValue?.trim()) return { value: match.rawValue.trim(), method: 'native' };
      } catch {
        // Some browsers expose BarcodeDetector but cannot process video.
        // Disable only the native path; canvas decoding remains available.
        this.nativeDisabled = true;
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    }

    // A 960px full-frame resize can shrink a distant printed code below
    // a readable module size. Preserve center-pixel detail before resizing.
    const squareSide = Math.min(width, height) * 0.82;
    const center = {
      x: (width - squareSide) / 2,
      y: (height - squareSide) / 2,
      w: squareSide, h: squareSide,
    };
    const centered = decodeRegion(source, scratch, center, 1024);
    if (centered) return { value: centered, method: 'center' };

    const whole = decodeRegion(source, scratch, { x: 0, y: 0, w: width, h: height }, 1440);
    return whole ? { value: whole, method: 'full' } : null;
  }
}

export async function decodeCandidateQrImage(
  file: File,
  reader: CandidateQrReader,
  scratch: HTMLCanvasElement,
): Promise<ReadQrResult | null> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image containing the QR.');
  }
  if (file.size === 0 || file.size > 6 * 1024 * 1024) {
    throw new Error('QR images must be between 1 byte and 6 MB.');
  }
  const temporaryUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = temporaryUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25_000_000) {
      throw new Error('The QR image is too large or could not be decoded.');
    }
    return reader.decode(image, scratch);
  } finally {
    URL.revokeObjectURL(temporaryUrl);
  }
}

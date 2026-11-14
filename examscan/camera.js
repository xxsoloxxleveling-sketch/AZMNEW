/** Camera transport; decoding never represents server-side attendance confirmation. */
export function cameraSupported() {
  return Boolean(globalThis.isSecureContext && navigator.mediaDevices?.getUserMedia && 'BarcodeDetector' in globalThis);
}

export class LiveQrCamera {
  constructor({ onCode, onError, onState } = {}) {
    this.onCode = onCode || (() => {});
    this.onError = onError || (() => {});
    this.onState = onState || (() => {});
    this.video = null;
    this.stream = null;
    this.detector = null;
    this.frame = 0;
    this.active = false;
    this.paused = false;
    this.processing = false;
    this.lastFrame = 0;
    this.lastValue = '';
    this.lastValueAt = 0;
  }

  async start(video) {
    this.stop();
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access needs HTTPS or localhost and permission to use the camera.');
    }
    if (!('BarcodeDetector' in globalThis)) {
      throw new Error('This device browser does not support QR detection. Use an updated Chrome browser on Android, or install the native Google scanner edition.');
    }
    this.video = video;
    let detector;
    try { detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] }); }
    catch { throw new Error('QR decoding is not supported on this device. Use the latest Chrome for Android.'); }
    this.detector = detector;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 }, height: { ideal: 1080 },
      } });
      this.stream = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', '');
      video.muted = true;
      await video.play();
      this.active = true;
      this.paused = false;
      this.onState('ready');
      this.loop(performance.now());
    } catch (err) {
      this.stop();
      if (err?.name === 'NotAllowedError') throw new Error('Camera permission was denied. Allow access in your browser settings.');
      if (err?.name === 'NotFoundError') throw new Error('No camera was detected on this device.');
      throw err;
    }
  }

  loop = async (time) => {
    if (!this.active) return;
    this.frame = requestAnimationFrame(this.loop);
    if (this.paused || this.processing || !this.detector || !this.video || this.video.readyState < 2 || time - this.lastFrame < 165) return;
    this.lastFrame = time;
    this.processing = true;
    try {
      const barcodes = await this.detector.detect(this.video);
      const decoded = barcodes.find(b => typeof b.rawValue === 'string' && b.rawValue.length > 0)?.rawValue;
      if (decoded && this.active && !this.paused) {
        // Avoid holding a frame on top of the lens and spamming the backend.
        if (decoded === this.lastValue && Date.now() - this.lastValueAt < 4500) return;
        this.lastValue = decoded;
        this.lastValueAt = Date.now();
        this.paused = true;
        this.onState('paused');
        Promise.resolve(this.onCode(decoded)).catch(this.onError);
      }
    } catch (err) {
      // Some Android WebViews intermittently reject one camera frame; continue scanning.
      if (err?.name === 'NotSupportedError') { this.onError(err); this.stop(); }
    } finally { this.processing = false; }
  };

  resume() { if (this.active) { this.paused = false; this.onState('ready'); } }
  pause() { if (this.active) { this.paused = true; this.onState('paused'); } }

  async setTorch(enabled) {
    const track = this.stream?.getVideoTracks?.()[0];
    if (!track) throw new Error('Camera is not active.');
    const capabilities = track.getCapabilities?.() || {};
    if (!capabilities.torch) throw new Error('Flashlight control is unavailable on this camera.');
    await track.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
    return Boolean(enabled);
  }

  stop() {
    this.active = false;
    this.paused = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.stream) for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    if (this.video) {
      try { this.video.pause(); this.video.srcObject = null; } catch {}
    }
    this.video = null;
    this.detector = null;
    this.onState('stopped');
  }
}

export async function decodeQrPhoto(file) {
  if (!('BarcodeDetector' in globalThis)) throw new Error('Image QR decoding requires a browser with BarcodeDetector support.');
  if (!file || !file.type?.startsWith('image/')) throw new Error('Choose an image containing a QR code.');
  if (file.size > 8 * 1024 * 1024) throw new Error('QR image is too large (maximum 8 MB).');
  const bitmap = await createImageBitmap(file);
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(bitmap);
    const value = codes.find(c => c.rawValue)?.rawValue;
    if (!value) throw new Error('No readable QR code was found in this photo.');
    return value;
  } finally { bitmap.close?.(); }
}

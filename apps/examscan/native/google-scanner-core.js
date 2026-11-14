/** Pure controller: allows unit tests without Google Play Services or a camera. */
export function createGoogleScannerBridge({ Capacitor, BarcodeScanner, BarcodeFormat }) {
  let preparation = null;
  function ensureAndroid() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      throw new Error('Google Code Scanner requires the installed Android app.');
    }
  }
  async function prepareNow(onProgress) {
    ensureAndroid();
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) throw new Error('This Android device does not have a supported camera.');
    const initial = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (initial.available) return { ready: true, downloading: false };
    let listener;
    try {
      listener = await BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', info => {
        if (typeof info?.progress === 'number') onProgress(info.progress);
      });
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      const check = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      return { ready: Boolean(check.available), downloading: !check.available };
    } finally {
      await listener?.remove();
    }
  }
  async function prepareGoogleScanner(onProgress = () => {}) {
    if (!preparation) preparation = prepareNow(onProgress).finally(() => { preparation = null; });
    return preparation;
  }
  async function scanWithGoogle() {
    const state = await prepareGoogleScanner();
    if (!state.ready) throw new Error('Google scanner is downloading through Play Services. Check internet and tap Open Google scanner again when installation finishes.');
    try {
      const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode], autoZoom: true });
      return result?.barcodes?.find(code => typeof code.rawValue === 'string' && code.rawValue.trim())?.rawValue || null;
    } catch (error) {
      if (['canceled', 'cancelled', 'user_canceled', 'user_cancelled'].includes(String(error?.code || '').toLowerCase()) || /cancell?ed/i.test(String(error?.message || ''))) return null;
      throw error;
    }
  }
  return { prepareGoogleScanner, scanWithGoogle };
}

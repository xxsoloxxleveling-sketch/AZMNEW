/** Capacitor bridge to Google's ready-made code scanner (Play Services, Android). */
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { createGoogleScannerBridge } from './google-scanner-core.js';

const bridge = createGoogleScannerBridge({ Capacitor, BarcodeScanner, BarcodeFormat });
export const prepareGoogleScanner = bridge.prepareGoogleScanner;
export const scanWithGoogle = bridge.scanWithGoogle;

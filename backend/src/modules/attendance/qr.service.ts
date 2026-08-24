import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../../config/env';

export class QrService {
  /**
   * Generates a tamper-proof cryptographically signed QR token.
   * Format: qr_<randomUuid>.<hmacSignature>
   */
  generateSignedQrToken(identifier?: string): string {
    const randomSeed = identifier || crypto.randomUUID();
    const payload = `${randomSeed}_${Date.now()}`;
    const hmac = crypto
      .createHmac('sha256', env.QR_SECRET)
      .update(payload)
      .digest('hex');

    return `qr_${payload}.${hmac}`;
  }

  /**
   * Verifies the authenticity and signature of a QR token.
   */
  verifySignedQrToken(token: string): boolean {
    if (!token || !token.startsWith('qr_') || !token.includes('.')) {
      return false;
    }

    const [prefixAndPayload, signature] = token.split('.');
    const payload = prefixAndPayload.replace('qr_', '');

    const expectedSignature = crypto
      .createHmac('sha256', env.QR_SECRET)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Generates a QR Code as a Data URL (base64 PNG) for frontend display and storage.
   */
  async generateQrDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 300,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
  }

  /**
   * Generates a QR Code as a binary Buffer for direct file streaming / downloads.
   */
  async generateQrBuffer(text: string): Promise<Buffer> {
    return QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 2,
      width: 300,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
  }
}

export const qrService = new QrService();

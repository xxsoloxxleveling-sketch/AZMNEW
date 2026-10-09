/**
 * Shared client-side contract for the advanced AZM Hall attendance scanner.
 *
 * This checks syntax only. Authenticity, candidate identity, frozen Hall roster
 * membership, and attendance persistence remain SERVER-side checks.
 */
const SIGNED_TOKEN_PATTERN = /^qr_[^\s.]{1,1024}\.[a-fA-F0-9]{64}$/;
const PUBLIC_ATTENDANCE_ORIGIN = 'https://azmaio.com';

export function extractSignedAttendanceToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let token = value.trim();
  if (!token || token.length > 4096) return null;

  if (!token.startsWith('qr_')) {
    let url: URL;
    try {
      url = new URL(token, PUBLIC_ATTENDANCE_ORIGIN);
    } catch {
      return null;
    }
    if (
      url.protocol !== 'https:' ||
      !['azmaio.com', 'www.azmaio.com'].includes(url.hostname) ||
      url.port || url.username || url.password ||
      url.pathname !== '/attend' || url.hash ||
      url.searchParams.getAll('token').length !== 1
    ) return null;
    token = url.searchParams.get('token') || '';
  }

  return SIGNED_TOKEN_PATTERN.test(token) ? token : null;
}

/** Embed an already-issued token without creating, changing, or signing one. */
export function buildSignedAttendanceQrUrl(storedToken: unknown): string | null {
  if (typeof storedToken !== 'string') return null;
  const token = storedToken.trim();
  if (!SIGNED_TOKEN_PATTERN.test(token)) return null;
  return `${PUBLIC_ATTENDANCE_ORIGIN}/attend?token=${encodeURIComponent(token)}`;
}

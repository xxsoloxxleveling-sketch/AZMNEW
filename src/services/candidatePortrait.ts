import { API_BASE_URL } from '../lib/apiClient';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PORTRAIT_BYTES = 6 * 1024 * 1024;

/**
 * Public roll-slip search has already verified the candidate's matching
 * CNIC/B-Form. A plain <img> request cannot attach that secret header, so
 * load the private portrait into a revocable browser object URL instead.
 *
 * The CNIC never enters a URL, localStorage, sessionStorage, DOM attribute,
 * third-party image host, or diagnostic log. This function never bypasses a
 * 401/404 response and never uses stale public R2 URLs.
 *
 * Callers own and MUST revoke a successful returned object URL.
 */
export async function fetchVerifiedCandidatePortrait(
  applicationId: string,
  verifiedCnic: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!applicationId?.trim() || !verifiedCnic?.trim()) return null;
  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(applicationId.trim())}/photo-thumbnail`,
    {
      method: 'GET',
      headers: {
        Accept: 'image/jpeg, image/png, image/webp',
        'X-Candidate-CNIC': verifiedCnic,
      },
      cache: 'no-store',
      redirect: 'error',
      signal,
    },
  );
  if (!response.ok) return null;

  const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return null;
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_PORTRAIT_BYTES) return null;

  const blob = await response.blob();
  if (blob.size < 1 || blob.size > MAX_PORTRAIT_BYTES || signal?.aborted) return null;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    if (typeof image.decode === 'function') {
      image.src = objectUrl;
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('The protected portrait is not a readable image.'));
        image.src = objectUrl;
      });
    }
    if (signal?.aborted || !image.naturalWidth || !image.naturalHeight) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
    return objectUrl;
  } catch {
    URL.revokeObjectURL(objectUrl);
    return null;
  }
}

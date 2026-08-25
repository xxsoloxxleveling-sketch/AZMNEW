import { getToken, setToken, clearToken, getRefreshToken, setRefreshToken, clearRefreshToken } from './auth';

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  ((import.meta as any).env?.PROD ? 'https://azmnew.onrender.com' : 'http://localhost:5000');

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: any;
  };
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.data?.accessToken) {
        setToken(data.data.accessToken);
        if (data.data.refreshToken) {
          setRefreshToken(data.data.refreshToken);
        }
        return data.data.accessToken as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Standard HTTP client wrapping fetch with automatic JWT Bearer token attachment,
 * JSON serialization, automatic token refresh, and backend error envelope parsing.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  let token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized by attempting automatic token refresh
  if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...options,
        headers,
      });
    } else {
      clearToken();
      clearRefreshToken();
    }
  }

  const data: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: {
      message: `HTTP error ${response.status}: ${response.statusText}`,
    },
  }));

  if (!response.ok || !data.success) {
    let errorMsg =
      data.error?.message ||
      data.message ||
      `Request failed with status ${response.status}`;

    if (data.error?.details && typeof data.error.details === 'object') {
      const detailsList = Object.entries(data.error.details)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
      if (detailsList.length > 0 && !errorMsg.includes(':')) {
        errorMsg = `${errorMsg} (${detailsList.join('; ')})`;
      }
    }

    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.code = data.error?.code;
    err.details = data.error?.details;
    throw err;
  }

  return (data.data !== undefined ? data.data : (data as any)) as T;
}

/**
 * Binary stream downloader for Puppeteer PDF endpoints.
 * Triggers a browser file download from Blob buffer.
 */
export async function apiDownloadPdf(
  endpoint: string,
  suggestedFilename: string
): Promise<void> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message ||
        `Failed to download PDF (Status ${response.status})`
    );
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = suggestedFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Fire-and-forget backend health ping to wake up sleeping Render free-tier instances
 * and warm the database connection pool.
 * - Non-blocking and silent
 * - Uses AbortController with a 15s timeout
 * - Fails silently without logging errors or blocking UI
 */
let lastPingTime = 0;
export function wakeUpBackend(minIntervalMs = 15000): void {
  const now = Date.now();
  if (minIntervalMs > 0 && now - lastPingTime < minIntervalMs) {
    return;
  }
  lastPingTime = now;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // Silently swallow abort error
      }
    }, 15000);

    fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(() => clearTimeout(timeoutId))
      .catch(() => {
        clearTimeout(timeoutId);
        // Fail silently - never throw or block
      });
  } catch {
    // Fail silently
  }
}

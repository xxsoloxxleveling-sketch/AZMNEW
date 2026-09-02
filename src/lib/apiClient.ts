import { getToken, setToken, clearToken, getRefreshToken, setRefreshToken, clearRefreshToken } from './auth';

const isLocalViteDev = window.location.hostname === "localhost" && window.location.port === "3000";

export const API_BASE_URL = isLocalViteDev
  ? "http://localhost:5000"
  : window.location.origin;

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

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  retryOnColdStart?: boolean;
}

/**
 * Standard HTTP client wrapping fetch with automatic JWT Bearer token attachment,
 * JSON serialization, automatic token refresh, configurable cold-start timeout,
 * and backend error envelope parsing.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
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

  // Set timeout: default 60 seconds; 90 seconds for registration/submit
  const timeoutMs = options.timeoutMs || (endpoint.includes('/students/register') ? 90000 : 60000);
  const retryOnColdStart = options.retryOnColdStart ?? endpoint.includes('/students/register');

  const executeFetch = async (currentSignal?: AbortSignal): Promise<Response> => {
    return fetch(url, {
      ...options,
      headers,
      signal: currentSignal || options.signal,
    });
  };

  let response: Response;

  // Set up AbortController for timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      timeoutController.abort();
    } catch {}
  }, timeoutMs);

  try {
    response = await executeFetch(timeoutController.signal);
  } catch (initialErr: any) {
    // If the error was a cold-start network refusal or transient timeout on registration, retry once after 2.5s
    const isNetworkOrAbort =
      initialErr.name === 'AbortError' ||
      initialErr.message?.includes('Failed to fetch') ||
      initialErr.message?.includes('NetworkError') ||
      initialErr.message?.includes('network');

    if (retryOnColdStart && isNetworkOrAbort) {
      console.warn(`[apiClient] Initial attempt to ${endpoint} timed out or failed (${initialErr.message}). Retrying in 2.5s while server warms...`);
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => {
        try {
          retryController.abort();
        } catch {}
      }, 75000);

      try {
        response = await executeFetch(retryController.signal);
      } catch (retryErr: any) {
        clearTimeout(retryTimeoutId);
        const err: any = new Error(
          retryErr.name === 'AbortError'
            ? 'The server took longer than 90 seconds to respond. Please check your connection and press Retry.'
            : 'Could not connect to the AZM.AIO server. Please check your internet connection and try again.'
        );
        err.isNetworkError = true;
        throw err;
      } finally {
        clearTimeout(retryTimeoutId);
      }
    } else {
      const err: any = new Error(
        initialErr.name === 'AbortError'
          ? 'Server request timed out. Please retry.'
          : initialErr.message || 'Failed to fetch from server.'
      );
      err.isNetworkError = true;
      throw err;
    }
  } finally {
    clearTimeout(timeoutId);
  }

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

  let data: any;
  try {
    data = await response.json();
  } catch {
    // If response was 200-299 but not JSON
    if (response.ok) {
      return {} as T;
    }
    data = {
      success: false,
      error: {
        message: `HTTP error ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`,
      },
    };
  }

  // Handle direct API response object without wrapper
  if (response.ok && data !== null && typeof data === 'object' && data.success === undefined) {
    return data as T;
  }

  if (!response.ok || (data && data.success === false)) {
    let errorMsg =
      data?.error?.message ||
      data?.message ||
      `Request failed with status ${response.status}`;

    if (data?.error?.details && typeof data.error.details === 'object') {
      const detailsList = Object.entries(data.error.details)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
      if (detailsList.length > 0 && !errorMsg.includes(':')) {
        errorMsg = `${errorMsg} (${detailsList.join('; ')})`;
      }
    }

    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    throw err;
  }

  return (data?.data !== undefined ? data.data : data) as T;
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

/** Opens an authorized server-generated PDF in a new tab so it can be printed. */
export async function apiOpenPdfForPrint(endpoint: string): Promise<void> {
  // Open synchronously from the button click. This avoids browsers blocking the
  // PDF tab as a popup once the authenticated request has completed.
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Please allow popups to open the PDF for printing.');
  }

  printWindow.document.title = 'Preparing registration PDF…';
  printWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Preparing the official registration PDF…</p>';

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getToken();
  const response = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    printWindow.close();
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to prepare PDF for printing (Status ${response.status})`
    );
  }

  const blobUrl = window.URL.createObjectURL(await response.blob());
  printWindow.location.replace(blobUrl);
  // Allow the PDF viewer plenty of time to take ownership of the Blob URL.
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

/** Fetches a protected binary only when a user explicitly opens it. */
export async function apiFetchProtectedObjectUrl(endpoint: string): Promise<string> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message || `Unable to load document (${response.status})`);
  }
  return window.URL.createObjectURL(await response.blob());
}

/**
 * Fire-and-forget backend health ping to wake up sleeping Render free-tier instances
 * and warm the database connection pool.
 * - Non-blocking and silent
 * - Uses AbortController with an extended 45s timeout to support Render cold starts
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
    }, 45000);

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

/**
 * Starts a recurring background heartbeat to keep the Render container awake while
 * a student is actively filling out the multi-stage application form.
 * Returns a cleanup function.
 */
export function startPeriodicHeartbeat(intervalMs = 180000): () => void {
  wakeUpBackend(0);
  const timer = setInterval(() => {
    wakeUpBackend(120000);
  }, intervalMs);

  return () => clearInterval(timer);
}

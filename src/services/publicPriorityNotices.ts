import { API_BASE_URL } from '../lib/apiClient';
import type { AlertType } from '../types';

/**
 * The public API already excludes drafts, scheduled and expired notices.
 * Only pinned or urgent live notices are eligible for the priority popup.
 * Never fall back to static/legacy messages if the configured feed is empty.
 */
export interface PublicPriorityNotice {
  id: string;
  title: string;
  subtitle?: string;
  message: string;
  badge: string;
  type: AlertType;
  isPinned: boolean;
  createdAt?: string;
}

const TYPES: AlertType[] = ['urgent', 'registration', 'exam', 'info'];

export function choosePublicPriorityNotice(data: unknown): PublicPriorityNotice | null {
  if (!Array.isArray(data)) return null;

  const candidates = data.flatMap((value: unknown): PublicPriorityNotice[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id.trim() ||
        typeof item.title !== 'string' || !item.title.trim() ||
        typeof item.message !== 'string' || !item.message.trim() ||
        typeof item.type !== 'string' || !TYPES.includes(item.type as AlertType)) {
      return [];
    }
    if (item.isPinned !== true && item.type !== 'urgent') return [];

    return [{
      id: item.id,
      title: item.title,
      subtitle: typeof item.subtitle === 'string' ? item.subtitle : undefined,
      message: item.message,
      badge: typeof item.badge === 'string' && item.badge.trim()
        ? item.badge : 'OFFICIAL NOTICE',
      type: item.type as AlertType,
      isPinned: item.isPinned === true,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
    }];
  });

  candidates.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const aTime = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
    return bTime - aTime;
  });
  return candidates[0] ?? null;
}

export async function fetchPublicPriorityNotice(signal?: AbortSignal): Promise<PublicPriorityNotice | null> {
  const response = await fetch(`${API_BASE_URL}/api/announcements`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('Unable to load the current official notices.');

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Invalid official notices response.');
  const parsed = payload as Record<string, unknown>;
  if (parsed.success !== true || !Array.isArray(parsed.data)) {
    throw new Error('Invalid official notices response.');
  }
  return choosePublicPriorityNotice(parsed.data);
}

export const priorityNoticeDismissKey = (id: string): string =>
  `AZM_DISMISS_PRIORITY_NOTICE_${id}`;
export const priorityNoticeSeenKey = (id: string): string =>
  `AZM_AUTO_SHOWN_PRIORITY_NOTICE_${id}`;

export function shouldAutoShowPriorityNotice(
  notice: PublicPriorityNotice | null,
  today: string,
  dismissedToday: string | null,
  seenThisSession: boolean,
): boolean {
  return Boolean(notice && dismissedToday !== today && !seenThisSession);
}

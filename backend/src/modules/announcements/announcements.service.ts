import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { CreateAnnouncementInput, UpdateAnnouncementInput } from './announcements.schema';

export type AlertType = 'urgent' | 'registration' | 'exam' | 'info';

export interface ManagedAnnouncement {
  id: string;
  title: string;
  subtitle?: string | null;
  message: string;
  type: AlertType;
  badge: string;
  isPinned: boolean;
  isPublished: boolean;
  publishStartAt?: string | null;
  publishEndAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAnnouncementsContainer {
  version: number;
  items: ManagedAnnouncement[];
}

export interface PublicAnnouncementItem {
  id: string;
  title: string;
  subtitle?: string | null;
  message: string;
  type: AlertType;
  badge: string;
  isPinned: boolean;
  createdAt: string;
}

interface AppError extends Error {
  statusCode?: number;
}

export class AnnouncementsService {
  private readonly SETTING_KEY = 'publicAnnouncements';

  private async getStoredContainer(): Promise<{
    exists: boolean;
    container: StoredAnnouncementsContainer;
  }> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: this.SETTING_KEY },
    });

    if (!setting) {
      return {
        exists: false,
        container: { version: 1, items: [] },
      };
    }

    try {
      const parsed = JSON.parse(setting.value);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return {
        exists: true,
        container: {
          version: typeof parsed?.version === 'number' ? parsed.version : 1,
          items,
        },
      };
    } catch {
      return {
        exists: true,
        container: { version: 1, items: [] },
      };
    }
  }

  private async saveStoredContainer(container: StoredAnnouncementsContainer): Promise<void> {
    const payload = JSON.stringify(container);
    await prisma.systemSetting.upsert({
      where: { key: this.SETTING_KEY },
      update: { value: payload },
      create: { key: this.SETTING_KEY, value: payload },
    });
  }

  /**
   * Public retrieval: Returns only visible published announcements with deterministic sorting.
   * If setting does not exist in DB: returns { configured: false, data: [] }.
   * If setting exists (even if empty): returns { configured: true, data: [...] }.
   */
  async getPublicAnnouncements(referenceDate?: Date): Promise<{
    configured: boolean;
    data: PublicAnnouncementItem[];
  }> {
    const { exists, container } = await this.getStoredContainer();

    if (!exists) {
      return {
        configured: false,
        data: [],
      };
    }

    const now = referenceDate || new Date();

    const visibleItems = container.items.filter((item) => {
      if (!item.isPublished) return false;
      if (item.publishStartAt) {
        const startDate = new Date(item.publishStartAt);
        if (now < startDate) return false;
      }
      if (item.publishEndAt) {
        const endDate = new Date(item.publishEndAt);
        if (now > endDate) return false;
      }
      return true;
    });

    // Deterministic sorting: 1. isPinned = true first; 2. newest createdAt first
    visibleItems.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const publicData: PublicAnnouncementItem[] = visibleItems.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle || null,
      message: item.message,
      type: item.type,
      badge: item.badge,
      isPinned: item.isPinned,
      createdAt: item.createdAt,
    }));

    return {
      configured: true,
      data: publicData,
    };
  }

  /**
   * Super Admin retrieval: Returns all managed announcements (draft, scheduled, live, expired).
   */
  async getAdminAnnouncements(): Promise<{
    configured: boolean;
    items: ManagedAnnouncement[];
  }> {
    const { exists, container } = await this.getStoredContainer();

    const sortedItems = [...container.items].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      configured: exists,
      items: sortedItems,
    };
  }

  /**
   * Super Admin create: Generates server-owned id, createdAt, updatedAt.
   */
  async createAnnouncement(input: CreateAnnouncementInput): Promise<ManagedAnnouncement> {
    const { container } = await this.getStoredContainer();
    const now = new Date().toISOString();

    const newItem: ManagedAnnouncement = {
      id: randomUUID(),
      title: input.title.trim(),
      subtitle: input.subtitle ? input.subtitle.trim() : null,
      message: input.message.trim(),
      type: input.type,
      badge: input.badge.trim(),
      isPinned: Boolean(input.isPinned),
      isPublished: Boolean(input.isPublished),
      publishStartAt: input.publishStartAt || null,
      publishEndAt: input.publishEndAt || null,
      createdAt: now,
      updatedAt: now,
    };

    container.items.push(newItem);
    await this.saveStoredContainer(container);
    return newItem;
  }

  /**
   * Super Admin update: Updates existing announcement fields with controlled 404.
   */
  async updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<ManagedAnnouncement> {
    const { container } = await this.getStoredContainer();
    const index = container.items.findIndex((item) => item.id === id);

    if (index === -1) {
      const error: AppError = new Error(`Announcement with ID "${id}" not found.`);
      error.statusCode = 404;
      throw error;
    }

    const existing = container.items[index];

    // Merge scheduling dates cleanly, handling null and empty string clearing
    const mergedStart =
      input.publishStartAt !== undefined
        ? input.publishStartAt || null
        : existing.publishStartAt;

    const mergedEnd =
      input.publishEndAt !== undefined
        ? input.publishEndAt || null
        : existing.publishEndAt;

    // Validate the FINAL merged scheduling values: start <= end
    if (mergedStart && mergedEnd) {
      if (new Date(mergedStart) > new Date(mergedEnd)) {
        const error: AppError = new Error('publishStartAt must be earlier than or equal to publishEndAt');
        error.statusCode = 400;
        throw error;
      }
    }

    const updatedItem: ManagedAnnouncement = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle ? input.subtitle.trim() : null } : {}),
      ...(input.message !== undefined ? { message: input.message.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.badge !== undefined ? { badge: input.badge.trim() } : {}),
      ...(input.isPinned !== undefined ? { isPinned: Boolean(input.isPinned) } : {}),
      ...(input.isPublished !== undefined ? { isPublished: Boolean(input.isPublished) } : {}),
      publishStartAt: mergedStart,
      publishEndAt: mergedEnd,
      updatedAt: new Date().toISOString(),
    };

    container.items[index] = updatedItem;
    await this.saveStoredContainer(container);
    return updatedItem;
  }

  /**
   * Super Admin delete: Deletes an announcement with controlled 404.
   */
  async deleteAnnouncement(id: string): Promise<{ success: boolean; id: string }> {
    const { container } = await this.getStoredContainer();
    const index = container.items.findIndex((item) => item.id === id);

    if (index === -1) {
      const error: AppError = new Error(`Announcement with ID "${id}" not found.`);
      error.statusCode = 404;
      throw error;
    }

    container.items.splice(index, 1);
    await this.saveStoredContainer(container);
    return { success: true, id };
  }
}

export const announcementsService = new AnnouncementsService();

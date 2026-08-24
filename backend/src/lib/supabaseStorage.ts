import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { logger } from './logger';

export type StorageBucket = 'student-photos' | 'qr-codes' | 'registration-pdfs' | 'student-documents';

class SupabaseStorageService {
  private client: SupabaseClient | null = null;

  constructor() {
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        logger.info('📦 Supabase Storage client initialized.');
      } catch (err: any) {
        logger.warn('Failed to initialize Supabase Storage client:', err.message);
      }
    } else {
      logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Storage will operate in fallback mode.');
    }
  }

  /**
   * Ensures that a storage bucket exists and is ready for uploads.
   */
  async ensureBucketExists(bucket: StorageBucket): Promise<void> {
    if (!this.client) return;
    try {
      const { data: buckets } = await this.client.storage.listBuckets();
      const found = (buckets || []).some((b) => b.name === bucket);
      if (!found) {
        await this.client.storage.createBucket(bucket, { public: true });
      }
    } catch {}
  }

  /**
   * Retrieves the direct public URL for a file in a storage bucket.
   */
  getPublicUrl(bucket: StorageBucket, path: string): string | null {
    if (!this.client) return null;
    try {
      const { data } = this.client.storage.from(bucket).getPublicUrl(path);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Uploads a file buffer or base64 data to a specified private bucket.
   */
  async uploadFile(
    bucket: StorageBucket,
    path: string,
    fileData: Buffer | Uint8Array | string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ path: string; error?: string }> {
    if (!this.client) {
      return { path };
    }

    try {
      let body: Buffer | Uint8Array;
      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const base64Data = fileData.split(',')[1];
          body = Buffer.from(base64Data, 'base64');
        } else {
          body = Buffer.from(fileData, 'utf-8');
        }
      } else {
        body = fileData;
      }

      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, body, {
          contentType,
          upsert: true,
        });

      if (error) {
        logger.warn(`Supabase Storage upload to bucket "${bucket}" failed:`, error.message);
        return { path, error: error.message };
      }

      return { path: data.path };
    } catch (err: any) {
      logger.warn(`Storage upload exception in "${bucket}":`, err.message);
      return { path, error: err.message };
    }
  }

  /**
   * Generates a temporary signed URL for a private file that expires after expiresInSeconds.
   */
  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number = 3600
  ): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return null;
      }

      return data.signedUrl;
    } catch (err: any) {
      return null;
    }
  }

  /**
   * Downloads a file buffer from a private bucket.
   */
  async downloadFile(
    bucket: StorageBucket,
    path: string
  ): Promise<Buffer | null> {
    if (!this.client) {
      return null;
    }

    try {
      const { data, error } = await this.client.storage.from(bucket).download(path);
      if (error || !data) {
        return null;
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      return null;
    }
  }

  /**
   * Deletes a file from a specified bucket.
   */
  async deleteFile(bucket: StorageBucket, paths: string[]): Promise<boolean> {
    if (!this.client) return true;

    try {
      const { error } = await this.client.storage.from(bucket).remove(paths);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Empties all files in a specified bucket.
   */
  async emptyBucket(bucket: StorageBucket): Promise<boolean> {
    if (!this.client) return true;
    try {
      const { data: files, error: listError } = await this.client.storage.from(bucket).list('', { limit: 1000 });
      if (listError || !files || files.length === 0) return true;
      const paths = files.map((f) => f.name).filter(Boolean);
      if (paths.length > 0) {
        await this.client.storage.from(bucket).remove(paths);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const supabaseStorage = new SupabaseStorageService();

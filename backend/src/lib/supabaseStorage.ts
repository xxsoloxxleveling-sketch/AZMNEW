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
   * Student photos, documents, and registration PDFs default to private for minor candidate privacy.
   */
  async ensureBucketExists(bucket: StorageBucket): Promise<void> {
    if (!this.client) return;
    try {
      const { data: buckets } = await this.client.storage.listBuckets();
      const found = (buckets || []).some((b) => b.name === bucket);
      if (!found) {
        const isPublic = bucket === 'qr-codes';
        await this.client.storage.createBucket(bucket, { public: isPublic });
      }
    } catch (err: any) {
      logger.warn(`Notice on bucket initialization (${bucket}):`, err.message);
    }
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
   * Generates a temporary signed URL for a private file that expires after expiresInSeconds.
   * Default expiry is 7 days (604,800 seconds).
   */
  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number = 604800
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
   * Returns a secure access URL for a file (signed URL for private buckets, or public URL fallback).
   */
  async getFileAccessUrl(bucket: StorageBucket, path: string, expiresInSeconds: number = 604800): Promise<string> {
    const signed = await this.getSignedUrl(bucket, path, expiresInSeconds);
    if (signed) return signed;

    const pub = this.getPublicUrl(bucket, path);
    if (pub) return pub;

    return `https://amteshciynijqkxapjwd.supabase.co/storage/v1/object/public/${bucket}/${path}`;
  }

  /**
   * Uploads a file buffer or base64 data to a specified bucket.
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
   * Downloads a file buffer from a private or public bucket.
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
   * Deletes specified files from a bucket.
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
   * Empties all files and subdirectories recursively in a specified bucket.
   */
  async emptyBucket(bucket: StorageBucket): Promise<boolean> {
    if (!this.client) return true;

    try {
      const deleteFolderRecursively = async (folderPath: string = ''): Promise<void> => {
        const { data: items, error: listError } = await this.client!.storage
          .from(bucket)
          .list(folderPath, { limit: 1000 });

        if (listError || !items || items.length === 0) return;

        const filePathsToDelete: string[] = [];

        for (const item of items) {
          const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          if (item.id === null) {
            // It's a directory / folder, traverse into it
            await deleteFolderRecursively(itemPath);
          } else {
            filePathsToDelete.push(itemPath);
          }
        }

        if (filePathsToDelete.length > 0) {
          await this.client!.storage.from(bucket).remove(filePathsToDelete);
        }
      };

      await deleteFolderRecursively('');
      return true;
    } catch (err: any) {
      logger.warn(`Failed to empty storage bucket "${bucket}":`, err.message);
      return false;
    }
  }
}

export const supabaseStorage = new SupabaseStorageService();

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl as createPresignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import { AppError } from '../middleware/error.middleware';

function createStorageError(message: string, statusCode = 502): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export type StorageBucket =
  | 'student-photos'
  | 'qr-codes'
  | 'registration-pdfs'
  | 'student-documents';

class R2StorageService {
  private client: S3Client | null = null;
  private bucketName = process.env.R2_BUCKET || '';
  private isConfigured = false;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint =
      process.env.R2_ENDPOINT ||
      (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : '');

    if (
      !this.bucketName ||
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      this.isConfigured = false;
      if (process.env.NODE_ENV === 'production') {
        logger.error(
          '🚨 CRITICAL: Cloudflare R2 storage is not configured in production! Missing required environment variables: R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
        );
      } else {
        logger.info(
          '📦 Cloudflare R2 storage not configured; operating in local storage fallback mode.'
        );
      }
      return;
    }

    try {
      this.client = new S3Client({
        region: process.env.R2_REGION || 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      logger.info(
        `📦 Cloudflare R2 storage initialized for bucket "${this.bucketName}".`
      );
    } catch (err: any) {
      this.isConfigured = false;
      this.client = null;
      logger.error('Failed to initialize Cloudflare R2 client:', err.message);
    }
  }

  public get configured(): boolean {
    return this.isConfigured;
  }

  private objectKey(bucket: StorageBucket, path: string): string {
    const clean = path.replace(/^\/+/, '');
    return `${bucket}/${clean}`;
  }

  async ensureBucketExists(_bucket: StorageBucket): Promise<void> {
    // One private physical R2 bucket is used.
    // StorageBucket values are logical prefixes inside that bucket.
    return;
  }

  getPublicUrl(_bucket: StorageBucket, _path: string): string | null {
    // AZMAIO R2 storage remains private.
    return null;
  }

  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number = 604800
  ): Promise<string | null> {
    if (!this.client || !this.isConfigured || !this.bucketName) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('R2 signed URL failed: storage is not configured in production.');
        throw createStorageError('Storage service is unavailable.');
      }
      return null;
    }

    try {
      return await createPresignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectKey(bucket, path),
        }),
        {
          expiresIn: expiresInSeconds,
        }
      );
    } catch (err: any) {
      logger.warn(`R2 signed URL failed for "${bucket}":`, err.message);
      if (process.env.NODE_ENV === 'production') {
        throw createStorageError('Failed to generate file access URL from storage service.');
      }
      return null;
    }
  }

  async getFileAccessUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number = 604800
  ): Promise<string> {
    return (
      (await this.getSignedUrl(bucket, path, expiresInSeconds)) || ''
    );
  }

  async uploadFile(
    bucket: StorageBucket,
    path: string,
    fileData: Buffer | Uint8Array | string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ path: string; error?: string }> {
    if (!this.client || !this.isConfigured || !this.bucketName) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('R2 upload failed: storage is not configured in production.');
        throw createStorageError('Cloudflare R2 storage is not configured or unavailable in production.');
      }
      // Local development fallback: do not attempt cloud upload, and do not return an error
      // so caller's local disk storage (backend/uploads) remains authoritative without 502 failure.
      return { path };
    }

    try {
      let body: Buffer | Uint8Array;

      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const base64Data = fileData.split(',')[1] || '';
          body = Buffer.from(base64Data, 'base64');
        } else {
          body = Buffer.from(fileData, 'utf8');
        }
      } else {
        body = fileData;
      }

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectKey(bucket, path),
          Body: body,
          ContentType: contentType,
        })
      );

      return { path };
    } catch (err: any) {
      logger.error(`R2 upload failed in "${bucket}": ${err.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw createStorageError('Failed to upload file to storage service.');
      }
      return {
        path,
        error: err.message || 'Upload failed',
      };
    }
  }

  async downloadFile(
    bucket: StorageBucket,
    path: string
  ): Promise<Buffer | null> {
    if (!this.client || !this.isConfigured || !this.bucketName) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('R2 download failed: storage is not configured in production.');
        throw createStorageError('Storage service is unavailable.');
      }
      return null;
    }

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectKey(bucket, path),
        })
      );

      if (!response.Body) return null;

      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err: any) {
      const isNotFound =
        err.name === 'NoSuchKey' ||
        err.name === 'NotFound' ||
        err.$metadata?.httpStatusCode === 404;

      if (isNotFound) {
        return null;
      }

      logger.error(`R2 download failed in "${bucket}": ${err.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw createStorageError('Failed to retrieve file from storage service.');
      }
      return null;
    }
  }

  async fileExists(
    bucket: StorageBucket,
    path: string
  ): Promise<boolean> {
    if (!this.client || !this.isConfigured || !this.bucketName || !path) {
      if (process.env.NODE_ENV === 'production') {
        throw createStorageError('Storage service is unavailable.');
      }
      return false;
    }

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectKey(bucket, path),
        })
      );

      return true;
    } catch (err: any) {
      const isNotFound =
        err.name === 'NoSuchKey' ||
        err.name === 'NotFound' ||
        err.$metadata?.httpStatusCode === 404;

      if (isNotFound) {
        return false;
      }

      if (process.env.NODE_ENV === 'production') {
        logger.error(`R2 fileExists check failed for "${bucket}/${path}": ${err.message}`);
        throw createStorageError('Failed to verify file existence in storage service.');
      }
      return false;
    }
  }

  async deleteFile(
    bucket: StorageBucket,
    paths: string[]
  ): Promise<boolean> {
    if (!this.client || !this.isConfigured || !this.bucketName) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('R2 delete failed: storage is not configured in production.');
        throw createStorageError('Storage service is unavailable.');
      }
      return true;
    }
    if (paths.length === 0) return true;

    try {
      for (let i = 0; i < paths.length; i += 1000) {
        const chunk = paths.slice(i, i + 1000);

        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: {
              Objects: chunk.map((path) => ({
                Key: this.objectKey(bucket, path),
              })),
              Quiet: true,
            },
          })
        );
      }

      return true;
    } catch (err: any) {
      logger.error(`R2 delete failed in "${bucket}": ${err.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw createStorageError('Failed to delete files from storage service.');
      }
      return false;
    }
  }

  async emptyBucket(bucket: StorageBucket): Promise<boolean> {
    if (!this.client || !this.isConfigured || !this.bucketName) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('R2 emptyBucket failed: storage is not configured in production.');
        throw createStorageError('Storage service is unavailable.');
      }
      return true;
    }

    try {
      const prefix = `${bucket}/`;

      while (true) {
        const result = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            MaxKeys: 1000,
          })
        );

        const objects = (result.Contents || [])
          .filter((item) => item.Key)
          .map((item) => ({
            Key: item.Key!,
          }));

        if (objects.length === 0) break;

        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: {
              Objects: objects,
              Quiet: true,
            },
          })
        );
      }

      return true;
    } catch (err: any) {
      logger.error(`Failed to empty R2 prefix "${bucket}": ${err.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw createStorageError('Failed to empty storage prefix.');
      }
      return false;
    }
  }
}

export const r2Storage = new R2StorageService();

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

export type StorageBucket =
  | 'student-photos'
  | 'qr-codes'
  | 'registration-pdfs'
  | 'student-documents';

class R2StorageService {
  private client: S3Client | null = null;
  private bucketName = process.env.R2_BUCKET || '';

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
      logger.warn(
        'Cloudflare R2 is not fully configured. Storage is unavailable.'
      );
      return;
    }

    this.client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    logger.info(`📦 Cloudflare R2 storage initialized for bucket "${this.bucketName}".`);
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
    // AZMAIO staging R2 remains private.
    return null;
  }

  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number = 604800
  ): Promise<string | null> {
    if (!this.client || !this.bucketName) return null;

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
    if (!this.client || !this.bucketName) {
      return {
        path,
        error: 'Cloudflare R2 storage is not configured',
      };
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
      logger.warn(`R2 upload failed in "${bucket}":`, err.message);
      return {
        path,
        error: err.message,
      };
    }
  }

  async downloadFile(
    bucket: StorageBucket,
    path: string
  ): Promise<Buffer | null> {
    if (!this.client || !this.bucketName) return null;

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
    } catch {
      return null;
    }
  }

  async fileExists(
    bucket: StorageBucket,
    path: string
  ): Promise<boolean> {
    if (!this.client || !this.bucketName || !path) return false;

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectKey(bucket, path),
        })
      );

      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(
    bucket: StorageBucket,
    paths: string[]
  ): Promise<boolean> {
    if (!this.client || !this.bucketName) return false;
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
      logger.warn(`R2 delete failed in "${bucket}":`, err.message);
      return false;
    }
  }

  async emptyBucket(bucket: StorageBucket): Promise<boolean> {
    if (!this.client || !this.bucketName) return false;

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
      logger.warn(`Failed to empty R2 prefix "${bucket}":`, err.message);
      return false;
    }
  }
}

export const r2Storage = new R2StorageService();

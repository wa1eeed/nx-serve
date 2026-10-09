import { type Logger, noopLogger } from './logger.js';

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

/** S3 compatible object storage behind an interface (MinIO locally, OSS in production). */
export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

/** In-memory fake storage for local dev and tests; private by default. */
export class FakeStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  constructor(private readonly logger: Logger = noopLogger) {}

  putObject(input: PutObjectInput): Promise<{ key: string }> {
    this.objects.set(input.key, { body: input.body, contentType: input.contentType });
    this.logger.debug('putObject', { key: input.key });
    return Promise.resolve({ key: input.key });
  }

  getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    if (!this.objects.has(key)) {
      return Promise.reject(new Error(`Unknown object ${key}`));
    }
    return Promise.resolve(`https://fake-storage.local/${encodeURIComponent(key)}?expires=${expiresInSeconds}`);
  }

  deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

// lib/azure.ts
import { BlobServiceClient, BlobItem } from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

export interface BlobInfo {
  etag: any;
  contentType: any;
  name: string;
  lastModified: Date | undefined;
  size: number | undefined;
  url?: string;
}

export class AzureBlobService {
  private blobServiceClient: BlobServiceClient;
  private containerClient;
  private containerId: string;

  constructor(containerId: string) {
    if (!containerId) {
      throw new Error('Container ID is required');
    }

    this.containerId = containerId;

    if (!connectionString) {
      throw new Error('Azure Storage connection string not found in environment variables');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(containerId);

    console.log(`✅ [AZURE SERVICE] Initialized for container: ${containerId}`);
  }

  /**
   * List all blobs in the container, sorted by last modified date (newest first)
   */
  async listBlobs(): Promise<BlobInfo[]> {
    try {
      console.log(`📋 [AZURE SERVICE] Listing blobs in container: ${this.containerId}`);

      const blobs: BlobInfo[] = [];

      for await (const blob of this.containerClient.listBlobsFlat({
        includeMetadata: true,
        includeSnapshots: false,
        includeTags: false,
        includeVersions: false,
      })) {
        blobs.push({
          name: blob.name,
          lastModified: blob.properties.lastModified,
          size: blob.properties.contentLength,
          url: `${this.containerClient.url}/${blob.name}`,
          etag: blob.properties.etag || '',
          contentType: blob.properties.contentType || 'application/octet-stream',
        });
      }

      console.log(`✅ [AZURE SERVICE] Found ${blobs.length} blobs in container: ${this.containerId}`);

      return blobs.sort((a, b) => {
        if (!a.lastModified || !b.lastModified) return 0;
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });
    } catch (error) {
      console.error(`❌ [AZURE SERVICE] Error listing blobs in container ${this.containerId}:`, error);
      throw new Error(`Failed to list blobs: ${error}`);
    }
  }

  /**
   * Download a specific blob as a UTF-8 string.
   * Use this for CSV / text blobs.
   */
  async downloadBlob(blobName: string): Promise<string> {
    try {
      console.log(`⬇️ [AZURE SERVICE] Downloading blob: ${blobName} from container: ${this.containerId}`);

      const blobClient = this.containerClient.getBlobClient(blobName);

      const exists = await blobClient.exists();
      if (!exists) throw new Error(`Blob ${blobName} does not exist`);

      const downloadResponse = await blobClient.download();

      if (!downloadResponse.readableStreamBody) throw new Error('No content in blob');

      const content = await this.streamToString(downloadResponse.readableStreamBody);

      console.log(`✅ [AZURE SERVICE] Downloaded ${content.length} bytes from ${blobName}`);

      return content;
    } catch (error) {
      console.error(`❌ [AZURE SERVICE] Error downloading blob ${blobName}:`, error);
      throw new Error(`Failed to download blob ${blobName}: ${error}`);
    }
  }

  /**
   * Download a specific blob as a raw Buffer.
   * Use this for binary blobs (.xlsx, .xlsm, images, etc.)
   * where UTF-8 string decoding would corrupt the bytes.
   */
  async downloadBlobAsBuffer(blobName: string): Promise<Buffer> {
    try {
      console.log(`⬇️ [AZURE SERVICE] Downloading blob as Buffer: ${blobName} from container: ${this.containerId}`);

      const blobClient = this.containerClient.getBlobClient(blobName);

      const exists = await blobClient.exists();
      if (!exists) throw new Error(`Blob ${blobName} does not exist`);

      const downloadResponse = await blobClient.download();

      if (!downloadResponse.readableStreamBody) throw new Error('No content in blob');

      const buffer = await this.streamToBuffer(downloadResponse.readableStreamBody);

      console.log(`✅ [AZURE SERVICE] Downloaded ${buffer.length} bytes (Buffer) from ${blobName}`);

      return buffer;
    } catch (error) {
      console.error(`❌ [AZURE SERVICE] Error downloading blob ${blobName} as Buffer:`, error);
      throw new Error(`Failed to download blob ${blobName} as Buffer: ${error}`);
    }
  }

  /**
   * Convert a readable stream to a UTF-8 string.
   * Only use for text-based content (CSV, JSON, etc.)
   */
  private async streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * Convert a readable stream to a raw Buffer.
   * Collects raw bytes with no encoding applied — safe for binary files.
   */
  private async streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks)); // ← no .toString() — raw bytes preserved
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * Get the most recent blob
   */
  async getLatestBlob(): Promise<BlobInfo | null> {
    const blobs = await this.listBlobs();
    return blobs.length > 0 ? blobs[0] : null;
  }

  /**
   * Get blobs within a date range
   */
  async getBlobsInDateRange(startDate: Date, endDate: Date): Promise<BlobInfo[]> {
    const allBlobs = await this.listBlobs();
    return allBlobs.filter(blob => {
      if (!blob.lastModified) return false;
      const blobDate = new Date(blob.lastModified);
      return blobDate >= startDate && blobDate <= endDate;
    });
  }

  /**
   * Test connection to Azure Storage
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.containerClient.getProperties();
      return true;
    } catch (error) {
      console.error('Azure Storage connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the container ID this service is connected to
   */
  getContainerId(): string {
    return this.containerId;
  }

  /**
   * Check if container exists
   */
  async containerExists(): Promise<boolean> {
    try {
      await this.containerClient.exists();
      return true;
    } catch (error) {
      console.error(`❌ [AZURE SERVICE] Error checking container existence for ${this.containerId}:`, error);
      return false;
    }
  }
}
// lib/azureBufferHelper.ts
import { AzureBlobService } from './azure';

/**
 * Download a blob as a raw Buffer.
 * Calls AzureBlobService.downloadBlobAsBuffer() which collects the raw
 * stream bytes without any UTF-8 string decoding — safe for binary files
 * like .xlsx that would be corrupted by the standard downloadBlob() method.
 */
export async function downloadBlobAsBuffer(
  azureService: AzureBlobService,
  blobName: string
): Promise<Buffer> {
  return azureService.downloadBlobAsBuffer(blobName);
}
// app/api/smart-hive/data/latest/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '../../../../../lib/azure';
import { downloadBlobAsBuffer } from '../../../../../lib/azureBufferHelper';
import { csvUtils, csvParser } from '../../../../../lib/csvParser';
import { normalizeSensorDataArray, detectCSVFormat } from '../../../../../lib/fieldMapping';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { fetchCalibrations, applyCalibrationToDataset } from '../../../../../lib/calibrationUtils';
import { parseXlsxBlob, isBlobXlsx } from '../../../../../lib/xlsxParser';

const prisma     = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const LOG_LEVEL  = process.env.LOG_LEVEL || 'production';
const isVerbose  = LOG_LEVEL === 'verbose' || LOG_LEVEL === 'debug';

// ─── CSV timestamp helpers ────────────────────────────────────────────────────

const isValidTimestampValue = (v: any): boolean => {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  if (['', 'nan', 'nat', 'null', 'undefined', 'none', 'n/a', 'na'].includes(s)) return false;
  return !isNaN(new Date(v).getTime());
};

const ensureISOString = (v: string | Date | undefined | null): string => {
  if (!v) return new Date().toISOString();
  return typeof v === 'string' ? v : new Date(v).toISOString();
};

const CSV_TIMESTAMP_FIELDS = [
  'time', 'Time', 'TIME',
  'timestamp', 'Timestamp', 'TIMESTAMP',
  'datetime', 'DateTime', 'DATETIME',
  'date', 'Date', 'DATE',
  'created_at', 'createdAt', 'recorded_at', 'recordedAt', 'measured_at', 'measuredAt',
];

const resolveCSVTimestamp = (
  row: any,
  blobLastModified: string,
  rowIndex: number
): { timestamp: string; source: 'csv' | 'blob'; fieldUsed: string | null } => {
  for (const field of CSV_TIMESTAMP_FIELDS) {
    if (isValidTimestampValue(row[field])) {
      const iso = new Date(row[field]).toISOString();
      if (rowIndex === 0) console.log(`✅ CSV timestamp from field "${field}":`, iso);
      return { timestamp: iso, source: 'csv', fieldUsed: field };
    }
  }
  if (rowIndex === 0) {
    const tried = CSV_TIMESTAMP_FIELDS
      .filter(f => row[f] !== undefined)
      .map(f => `${f}="${row[f]}"`)
      .join(', ');
    console.warn(tried
      ? `⚠️ All CSV timestamp candidates invalid (${tried}), using blob.lastModified`
      : '⚠️ No timestamp fields found in CSV row, using blob.lastModified');
  }
  return { timestamp: blobLastModified, source: 'blob', fieldUsed: null };
};

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  console.log('🚀 [LATEST API] Starting request');

  try {
    const searchParams = request.nextUrl.searchParams;
    const count        = parseInt(searchParams.get('count') || '1');
    const containerId  = searchParams.get('containerId');

    if (isVerbose) console.log('📊 Request params:', { count, containerId });

    if (!containerId) {
      return NextResponse.json(
        { error: 'containerId parameter is required', data: [], timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    const token =
      request.cookies.get('user-token')?.value ||
      request.cookies.get('auth-token')?.value;

    let userId: number | null = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.userId || decoded.id;
        console.log('🔐 User authenticated:', userId);
      } catch {
        console.warn('⚠️ Invalid token for calibration lookup');
      }
    }

    // ── Blob listing ────────────────────────────────────────────────────────
    const azureService = new AzureBlobService(containerId);
    const blobs        = await azureService.listBlobs();
    console.log(`📁 Found ${blobs.length} blobs in container: ${containerId}`);

    if (blobs.length === 0) {
      return NextResponse.json({
        data: [], message: `No blobs found in container: ${containerId}`,
        containerId, timestamp: new Date().toISOString(),
      });
    }

    const latestBlobs = blobs
      .filter(b => !!b.lastModified)
      .sort((a, b) => new Date(b.lastModified!).getTime() - new Date(a.lastModified!).getTime())
      .slice(0, count);

    console.log(`🔄 Processing ${latestBlobs.length} latest blob(s)`);

    const latestData: any[]           = [];
    let detectedFormat: string | null = null;

    for (const [index, blob] of latestBlobs.entries()) {
      if (isVerbose) console.log(`📄 Processing ${index + 1}/${latestBlobs.length}: ${blob.name}`);

      try {
        const blobLastModified = ensureISOString(blob.lastModified);
        const isXlsx           = isBlobXlsx(blob.name);

        let sanitizedData: any[]                   = [];
        let timestampStats: Record<string, number> = {};

        if (isXlsx) {
          // ── XLSX: download as raw Buffer so binary is never corrupted ────
          console.log(`📊 Parsing as XLSX: ${blob.name}`);
          const blobBuffer = await downloadBlobAsBuffer(azureService, blob.name);

          const xlsxRows = parseXlsxBlob(blob.name, blobBuffer, blobLastModified);

          sanitizedData = xlsxRows.map(row => ({
            ...row,
            _metadata: {
              lastModified:           blobLastModified,
              blobName:               blob.name,
              containerId,
              hasOriginalTimestamp:   row._timestampSource === 'file',
              detectedTimestampField: row._timestampSource === 'file' ? 'time (xlsx)' : 'blob.lastModified',
            },
          }));

          timestampStats = {
            fromFile: sanitizedData.filter(r => r._timestampSource === 'file').length,
            fromBlob: sanitizedData.filter(r => r._timestampSource === 'blob').length,
          };

          detectedFormat = detectedFormat ?? 'xlsx';

        } else {
          // ── CSV: existing path, string is fine ───────────────────────────
          const csvContent = await azureService.downloadBlob(blob.name) as string;

          const validation = await csvParser.validateCSV(csvContent);
          if (!validation.isValid) {
            console.warn(`❌ Invalid CSV in ${blob.name}:`, validation.errors);
            continue;
          }

          const parsedResult = await csvUtils.parseAzureCSV(csvContent);
          if (parsedResult.data.length === 0) {
            console.warn(`⚠️ Empty CSV: ${blob.name}`);
            continue;
          }

          if (!detectedFormat) {
            const fmt  = detectCSVFormat(parsedResult.data);
            detectedFormat = fmt.format;
            console.log(`📋 CSV Format detected: ${detectedFormat}`, fmt);
          }

          const transformedData = csvParser.transformForDashboard(parsedResult, {
            dateFields:    CSV_TIMESTAMP_FIELDS,
            numericFields: [
              'value','temperature','pressure','humidity',
              'temp_internal','temp_external','int_temp','ext_temp',
              'hum_internal','hum_external','int_hum','ext_hum',
              'weight','Weight','weight_kg',
              'battery','Battery','battery_level','bat','batt','voltage',
              'CO2','NH3','O2','VOCs','CO','NO2','H2S','TVOC',
              'lat','latitude','lon','longitude',
            ],
            requiredFields: [],
            defaultValues:  { containerId },
          });

          const tStats = { fromCSV: 0, fromBlob: 0 };
          const dataWithTimestamps = transformedData.map((row: any, i: number) => {
            const { timestamp, source, fieldUsed } = resolveCSVTimestamp(row, blobLastModified, i);
            tStats[source === 'csv' ? 'fromCSV' : 'fromBlob']++;
            return {
              ...row, timestamp,
              _metadata: {
                lastModified:           blobLastModified,
                blobName:               blob.name,
                containerId,
                hasOriginalTimestamp:   source === 'csv',
                detectedTimestampField: fieldUsed ?? 'blob.lastModified',
              },
            };
          });

          timestampStats = tStats;
          const normalizedData = normalizeSensorDataArray(dataWithTimestamps);
          sanitizedData        = csvParser.sanitizeData(normalizedData);
        }

        console.log(`⏰ Timestamp sources for ${blob.name}:`, timestampStats);

        // ── Calibration ───────────────────────────────────────────────────
        if (userId && containerId) {
          const calibrations = await fetchCalibrations(userId, containerId, prisma);
          if (calibrations.size > 0) {
            console.log(`🔧 Applying ${calibrations.size} calibration(s)`);
            sanitizedData = applyCalibrationToDataset(sanitizedData, calibrations);
          }
        }

        const isCalibrated = sanitizedData.some((r: any) => r._calibrated);

        latestData.push({
          blobInfo: {
            name: blob.name, lastModified: blobLastModified,
            size: blob.size, contentType: blob.contentType,
            etag: blob.etag, containerId,
            format: isXlsx ? 'xlsx' : (detectedFormat ?? 'unknown'),
          },
          csvMetadata: {
            normalized:       true,
            detectedFormat:   isXlsx ? 'xlsx' : detectedFormat,
            timestampSources: timestampStats,
            calibrated:       isCalibrated,
          },
          data:        sanitizedData,
          recordCount: sanitizedData.length,
        });

        if (isVerbose && sanitizedData[0]) {
          console.log(`✓ ${blob.name}: ${sanitizedData.length} records | sample:`, sanitizedData[0]);
        }

      } catch (err) {
        console.error(`❌ Error processing ${blob.name}:`,
          err instanceof Error ? err.message : err);
        if (isVerbose && err instanceof Error) console.error('Stack:', err.stack);
      }
    }

    // ── Response ─────────────────────────────────────────────────────────────
    const totalRecords = latestData.reduce((s, i) => s + i.recordCount, 0);
    const isCalibrated = latestData.some(i => i.csvMetadata.calibrated);

    console.log(`✅ Completed: ${latestData.length} blob(s), ${totalRecords} records ` +
      `(Format: ${detectedFormat}, Calibrated: ${isCalibrated})`);

    return NextResponse.json({
      data: latestData, containerId,
      totalBlobs: latestBlobs.length,
      timestamp:  new Date().toISOString(),
      summary: {
        totalRecords,
        latestBlobTimestamp: latestBlobs[0]?.lastModified,
        oldestBlobTimestamp: latestBlobs[latestBlobs.length - 1]?.lastModified,
        csvFormat: detectedFormat, normalized: true, calibrated: isCalibrated,
      },
    });

  } catch (error) {
    console.error('💥 Critical error:', error instanceof Error ? error.message : error);
    if (isVerbose && error instanceof Error) console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch latest data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const revalidate = 300;
// app/api/smart-hive/data/historical/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '../../../../../lib/azure';
import { downloadBlobAsBuffer } from '../../../../../lib/azureBufferHelper';
import { csvUtils, csvParser } from '../../../../../lib/csvParser';
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

const resolveCSVTimestamp = (row: any, blobLastModified: string): string => {
  for (const field of CSV_TIMESTAMP_FIELDS) {
    if (isValidTimestampValue(row[field])) return new Date(row[field]).toISOString();
  }
  return blobLastModified;
};

// nan-aware numeric parser for CSV ghost-row filter
const toNum = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase();
  if (['', 'nan', 'nat', 'null', 'undefined', 'none', 'n/a', 'na'].includes(s)) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  console.log('🚀 [HISTORICAL API] Starting request');

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit        = parseInt(searchParams.get('limit')    || '24');
    const dateFrom     = searchParams.get('dateFrom');
    const dateTo       = searchParams.get('dateTo');
    const containerId  = searchParams.get('containerId');

    if (isVerbose) console.log('📊 Request params:', { limit, dateFrom, dateTo, containerId });

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

    // Optional date-range filter
    let filteredBlobs = blobs;
    if (dateFrom || dateTo) {
      filteredBlobs = blobs.filter(blob => {
        if (!blob.lastModified) return false;
        const d    = new Date(blob.lastModified);
        const from = dateFrom ? new Date(dateFrom) : null;
        const to   = dateTo   ? new Date(dateTo)   : null;
        return (!from || d >= from) && (!to || d <= to);
      });
      console.log(`📅 Date filtered: ${blobs.length} → ${filteredBlobs.length} blobs`);
    }

    const recentBlobs = filteredBlobs.slice(0, limit);
    console.log(`🔄 Processing ${recentBlobs.length} blobs (limit: ${limit})`);

    const historicalData: any[]   = [];
    const processingErrors: any[] = [];
    let processedCount = 0;

    for (const blob of recentBlobs) {
      processedCount++;
      if (processedCount % 10 === 0 || processedCount === recentBlobs.length) {
        console.log(`⏳ Progress: ${processedCount}/${recentBlobs.length} blobs`);
      }

      try {
        const blobLastModified = ensureISOString(blob.lastModified);
        const isXlsx           = isBlobXlsx(blob.name);

        if (isXlsx) {
          // ── XLSX: download as raw Buffer ────────────────────────────────
          const blobBuffer = await downloadBlobAsBuffer(azureService, blob.name);
          const xlsxRows   = parseXlsxBlob(blob.name, blobBuffer, blobLastModified);

          // xlsxParser already ghost-filters and resolves timestamps
          const enriched = xlsxRows.map(row => ({
            ...row,
            _metadata: {
              sourceBlob:           blob.name,
              containerId,
              lastModified:         blobLastModified,
              size:                 blob.size,
              processedAt:          new Date().toISOString(),
              hasOriginalTimestamp: row._timestampSource === 'file',
            },
          }));

          if (isVerbose) console.log(`✓ XLSX ${blob.name}: ${enriched.length} records`);
          historicalData.push(...enriched);

        } else {
          // ── CSV: string is fine ─────────────────────────────────────────
          const csvContent   = await azureService.downloadBlob(blob.name) as string;
          const parsedResult = await csvUtils.parseAzureCSV(csvContent);

          if (isVerbose && parsedResult.data.length > 0) {
            console.log(`🔍 [${blob.name}] Columns:`, Object.keys(parsedResult.data[0]));
          }

          const transformedData = csvParser.transformForDashboard(parsedResult, {
            dateFields:    CSV_TIMESTAMP_FIELDS,
            numericFields: [
              'value','size','count','duration',
              'temp_internal','temp_external','int_temp','ext_temp',
              'hum_internal','hum_external','int_hum','ext_hum',
              'humidity','weight','Weight','weight_kg',
              'battery','Battery','battery_level','voltage',
              'CO2','NH3','O2','VOCs','CO','NO2',
              'lat','lon','latitude','longitude',
            ],
            requiredFields: [],
            defaultValues:  { containerId },
          });

          const enriched = transformedData
            .map((record: any) => ({
              ...record,
              timestamp: resolveCSVTimestamp(record, blobLastModified),
              _metadata: {
                sourceBlob:   blob.name,
                containerId,
                lastModified: blobLastModified,
                size:         blob.size,
                processedAt:  new Date().toISOString(),
              },
            }))
            .filter((item: any) => {
              // Ghost-row filter with nan-awareness
              const intTemp = item.int_temp  ?? item.temp_internal  ?? item.Internal_temp;
              const extTemp = item.ext_temp  ?? item.temp_external  ?? item.external_temp;
              const intHum  = item.int_hum   ?? item.hum_internal   ?? item.Internal_hum;
              const extHum  = item.ext_hum   ?? item.hum_external   ?? item.external_hum;
              const weight  = item.weight    ?? item.Weight         ?? item.weight_kg;
              const battery = item.battery   ?? item.Battery        ?? item.battery_level;
              return (
                toNum(intTemp) !== null || toNum(extTemp) !== null ||
                toNum(intHum)  !== null || toNum(extHum)  !== null ||
                toNum(weight)  !== null || toNum(battery) !== null
              );
            });

          if (isVerbose) {
            console.log(`✓ CSV ${blob.name}: ${transformedData.length} rows → ${enriched.length} valid`);
          }
          historicalData.push(...enriched);
        }

      } catch (parseError) {
        const msg = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        console.error(`❌ Error parsing ${blob.name}:`, msg);
        processingErrors.push({ blob: blob.name, containerId, error: msg });
      }
    }

    // ── Calibration ─────────────────────────────────────────────────────────
    let calibratedData = historicalData;
    if (userId && containerId) {
      const calibrations = await fetchCalibrations(userId, containerId, prisma);
      if (calibrations.size > 0) {
        console.log(`🔧 Applying ${calibrations.size} calibration(s) to historical data`);
        calibratedData = applyCalibrationToDataset(historicalData, calibrations);
      } else {
        console.log('ℹ️ No calibrations found for this user/container');
      }
    }

    // Sort newest-first
    calibratedData.sort((a, b) => {
      const tA = new Date(a.timestamp || a._metadata?.lastModified || 0).getTime();
      const tB = new Date(b.timestamp || b._metadata?.lastModified || 0).getTime();
      return tB - tA;
    });

    const responseData = {
      data:             calibratedData,
      containerId,
      totalFiles:       recentBlobs.length,
      totalRecords:     calibratedData.length,
      processingErrors,
      calibrated:       calibratedData.some(r => r._calibrated),
      metadata: {
        requestedLimit: limit,
        actualFiles:    recentBlobs.length,
        dateRange:      { from: dateFrom, to: dateTo },
        generatedAt:    new Date().toISOString(),
      },
    };

    console.log(
      `✅ Completed: ${recentBlobs.length} files, ${calibratedData.length} records, ` +
      `${processingErrors.length} errors (Calibrated: ${responseData.calibrated})`
    );

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('💥 Critical error:', error instanceof Error ? error.message : error);
    if (isVerbose && error instanceof Error) console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch historical data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const revalidate = 0;
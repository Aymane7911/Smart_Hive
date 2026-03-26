export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '@/lib/azure';
import { csvParser } from '@/lib/csvParser';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlobItem {
  name: string;
  lastModified?: string | Date;
}

interface SensorRecord {
  [key: string]: any;
  timestamp?: string;
  _metadata?: {
    lastModified: string;
    sourceBlob: string;
    containerId: string;
  };
}

// ─── Numeric fields that should be coerced from strings ──────────────────────

const NUMERIC_FIELDS = new Set([
  'int_temp', 'ext_temp', 'temp_internal', 'temp_external',
  'Internal_temp', 'tempInternal', 'temp_inte', 'temp_exte',
  'int_hum',  'ext_hum',  'hum_internal',  'hum_external',
  'Internal_hum', 'humInternal', 'inte_hum', 'exte_hum',
  'humidity_internal', 'humidity_external',
  'weight', 'Weight', 'weight_kg',
  'battery', 'Battery', 'battery_level', 'bat', 'batt',
  'lat', 'lon',
  'H2S', 'CO2', 'O2', 'NH3', 'TVOC', 'CO',
  'id', 'ID', 'hive_id', 'hiveId',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coerceRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) { out[k] = null; continue; }
    const str = typeof v === 'string' ? v.trim() : String(v);
    if (!str || ['null', 'nan', 'undefined', 'n/a', ''].includes(str.toLowerCase())) {
      out[k] = null;
      continue;
    }
    if (NUMERIC_FIELDS.has(k)) {
      const n = parseFloat(str);
      out[k] = !isNaN(n) && isFinite(n) ? n : null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isDataRow(row: Record<string, any>): boolean {
  // A row is useful if it has at least one recognised sensor field with a value
  const SENSOR_KEYS = [
    'int_temp', 'ext_temp', 'temp_internal', 'temp_external', 'Internal_temp',
    'tempInternal', 'temp_inte', 'temp_exte',
    'int_hum',  'ext_hum',  'hum_internal',  'hum_external',
    'weight', 'Weight', 'weight_kg',
    'battery', 'Battery', 'battery_level',
  ];
  return SENSOR_KEYS.some(k => row[k] != null && row[k] !== '');
}

function extractTimestamp(row: Record<string, any>, blobModified: string): string {
  const ts =
    row.timestamp   ?? row.Timestamp   ??
    row.datetime    ?? row.DateTime    ??
    row.time        ?? row.Time        ??
    row.date        ?? row.Date        ?? null;
  return ts ? String(ts) : blobModified;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseCSV(content: string): Promise<Record<string, any>[]> {
  const parsed = await csvParser.parseFromString(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return (parsed.data as Record<string, any>[]) ?? [];
}

function parseXLSX(buffer: Buffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const rows: Record<string, any>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: null,
      raw: false,         // keep dates as strings
      dateNF: 'yyyy-mm-dd hh:mm:ss',
    });
    rows.push(...sheetRows);
  }

  return rows;
}

// ─── File-type dispatcher ─────────────────────────────────────────────────────

function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) &&
    name !== 'aggregated.json'
  );
}

async function parseBlob(
  service: AzureBlobService,
  blobName: string,
  lastModified: string,
  containerName: string,
): Promise<SensorRecord[]> {
  const lower = blobName.toLowerCase();
  const records: SensorRecord[] = [];

  try {
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      // Download as binary buffer for xlsx
      const buffer = await service.downloadBlobAsBuffer(blobName);
      const rawRows = parseXLSX(buffer);

      for (const row of rawRows) {
        if (!row || Object.keys(row).length === 0) continue;
        const coerced = coerceRow(row);
        if (!isDataRow(coerced)) continue;
        records.push({
          ...coerced,
          timestamp: extractTimestamp(coerced, lastModified),
          _metadata: { lastModified, sourceBlob: blobName, containerId: containerName },
        });
      }
    } else {
      // CSV
      const content = await service.downloadBlob(blobName);
      const rawRows = await parseCSV(content);

      for (const row of rawRows) {
        if (!row || Object.keys(row).length === 0) continue;
        const coerced = coerceRow(row);
        if (!isDataRow(coerced)) continue;
        records.push({
          ...coerced,
          timestamp: extractTimestamp(coerced, lastModified),
          _metadata: { lastModified, sourceBlob: blobName, containerId: containerName },
        });
      }
    }
  } catch (err) {
    console.warn(`⚠️  Skipped ${blobName}:`, err instanceof Error ? err.message : err);
  }

  return records;
}

// ─── Core aggregation ─────────────────────────────────────────────────────────

async function runAggregation(containerName: string): Promise<object> {
  const service         = new AzureBlobService(containerName);
  const containerClient = (service as any).containerClient;

  // 1. Load existing aggregated.json (if any)
  let existingLatest:     SensorRecord[] = [];
  let existingHistorical: SensorRecord[] = [];
  let lastProcessedBlob   = '';

  try {
    const raw    = await service.downloadBlob('aggregated.json');
    const parsed = JSON.parse(raw);
    existingLatest     = parsed.latest     ?? [];
    existingHistorical = parsed.historical ?? [];
    lastProcessedBlob  = parsed.lastProcessedBlob ?? '';
    console.log(`✅  Loaded existing aggregated.json — ${existingHistorical.length} historical pts`);
  } catch {
    console.log('ℹ️  No existing aggregated.json — creating from scratch');
  }

  // 2. List blobs, keep only supported data files, sort by date
  const allBlobs: BlobItem[] = await service.listBlobs();
  const dataBlobs = allBlobs
    .filter(b => isSupportedFile(b.name))
    .sort(
      (a, b) =>
        new Date(a.lastModified!).getTime() - new Date(b.lastModified!).getTime(),
    );

  // 3. Find only new blobs since the last run
  const lastIdx  = dataBlobs.findIndex(b => b.name === lastProcessedBlob);
  const newBlobs = lastIdx === -1 ? dataBlobs : dataBlobs.slice(lastIdx + 1);

  console.log(
    `📋  ${dataBlobs.length} total data blobs, ${newBlobs.length} new to process in "${containerName}"`,
  );

  if (newBlobs.length === 0) {
    return {
      success: true,
      message: 'Nothing new to process',
      container: containerName,
      totalHistorical: existingHistorical.length,
      totalLatest: existingLatest.length,
    };
  }

  // 4. Parse all new blobs (CSV + XLSX)
  const newRecords: SensorRecord[] = [];

  for (const blob of newBlobs) {
    const lastModified = new Date(blob.lastModified!).toISOString();
    const records      = await parseBlob(service, blob.name, lastModified, containerName);
    newRecords.push(...records);
    console.log(`   ✓ ${blob.name} → ${records.length} record(s)`);
  }

  // 5. Merge with existing history (keep last 5 000 pts to avoid giant file)
  const allHistorical = [...existingHistorical, ...newRecords]
    .sort(
      (a, b) =>
        new Date(a.timestamp ?? a._metadata?.lastModified ?? 0).getTime() -
        new Date(b.timestamp ?? b._metadata?.lastModified ?? 0).getTime(),
    )
    .slice(-5000);

  // 6. Build latest map — most-recent record per hive id
  const byHive = new Map<string, SensorRecord>();

  for (const record of allHistorical) {
    const hiveKey = String(
      record.id ?? record.ID ?? record.hive_id ?? record.hiveId ?? 'unknown',
    );
    const existing   = byHive.get(hiveKey);
    const recordTs   = new Date(record.timestamp ?? record._metadata?.lastModified ?? 0).getTime();
    const existingTs = existing
      ? new Date(existing.timestamp ?? existing._metadata?.lastModified ?? 0).getTime()
      : 0;

    if (!existing || recordTs > existingTs) byHive.set(hiveKey, record);
  }

  const latest = Array.from(byHive.values());

  // 7. Write aggregated.json back to the container
  const lastBlob   = dataBlobs[dataBlobs.length - 1];
  const aggregated = JSON.stringify({
    generatedAt:       new Date().toISOString(),
    lastProcessedBlob: lastBlob?.name ?? lastProcessedBlob,
    container:         containerName,
    latest,
    historical:        allHistorical,
  });

  const blockBlobClient = containerClient.getBlockBlobClient('aggregated.json');
  await blockBlobClient.upload(
    aggregated,
    Buffer.byteLength(aggregated),
    { blobHTTPHeaders: { blobContentType: 'application/json' } },
  );

  console.log(
    `✅  ${containerName} done — ${latest.length} latest hives, ` +
    `${allHistorical.length} historical pts (${newRecords.length} new from ${newBlobs.length} blobs)`,
  );

  return {
    success:           true,
    container:         containerName,
    newRecords:        newRecords.length,
    newBlobs:          newBlobs.length,
    totalHistorical:   allHistorical.length,
    totalLatest:       latest.length,
    lastProcessedBlob: lastBlob?.name,
  };
}

// ─── GET — Azure Event Grid validation + cron/manual trigger ──────────────────

export async function GET(request: NextRequest) {
  // Azure Event Grid sends a ?validationCode=... on first subscription
  const validationCode = request.nextUrl.searchParams.get('validationCode');
  if (validationCode) {
    console.log('🔐  Event Grid GET validation handshake');
    return NextResponse.json({ validationResponse: validationCode });
  }

  // Optional secret guard (keep for manual/cron callers if you want it)
  // const secret = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret');
  // if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Forbidden' }, { status: 401 });

  const single     = request.nextUrl.searchParams.get('container');
  const containers = single
    ? [single]
    : (process.env.CONTAINER_IDS ?? '').split(',').map(c => c.trim()).filter(Boolean);

  if (containers.length === 0)
    return NextResponse.json({ error: 'No containers configured' }, { status: 500 });

  const results: Record<string, any> = {};
  for (const c of containers) {
    try   { results[c] = await runAggregation(c); }
    catch (e) { results[c] = { error: e instanceof Error ? e.message : 'Unknown error' }; }
  }

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
}

// ─── POST — Azure Event Grid BlobCreated events + manual trigger ──────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // ── Azure Event Grid payload is always an array ───────────────────────────
  if (Array.isArray(body)) {

    // Validation handshake (fired once when you create the Event Grid subscription)
    const validationEvent = body.find(
      (e: any) => e.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent',
    );
    if (validationEvent) {
      console.log('🔐  Event Grid POST validation handshake');
      return NextResponse.json({
        validationResponse: validationEvent.data.validationCode,
      });
    }

    // Real BlobCreated events
    const seen = new Set<string>(); // deduplicate containers in one batch
    const results: Record<string, any> = {};

    for (const event of body) {
      if (event.eventType !== 'Microsoft.Storage.BlobCreated') continue;

      const subject: string = event.subject ?? '';
      // subject: /blobServices/default/containers/MY-CONTAINER/blobs/file.csv
      const match         = subject.match(/\/containers\/([^/]+)\/blobs\/(.+)$/);
      const containerName = match?.[1];
      const blobName      = match?.[2];

      // Skip if not a supported data file, or it's the aggregated.json write-back
      if (!containerName || !blobName || !isSupportedFile(blobName)) continue;
      if (seen.has(containerName)) continue;
      seen.add(containerName);

      console.log(`🔔  BlobCreated event → container="${containerName}", blob="${blobName}"`);

      try   { results[containerName] = await runAggregation(containerName); }
      catch (e) {
        console.error(`❌  Aggregation failed for ${containerName}:`, e);
        results[containerName] = { error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }

    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
  }

  // ── Manual POST (curl / Postman / admin panel) ────────────────────────────
  const containerName: string =
    body.containerName ??
    body.container ??
    (process.env.CONTAINER_IDS ?? '').split(',')[0]?.trim() ?? '';

  if (!containerName)
    return NextResponse.json({ error: 'containerName is required' }, { status: 400 });

  console.log(`🔧  Manual aggregation trigger → container="${containerName}"`);

  try {
    const result = await runAggregation(containerName);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
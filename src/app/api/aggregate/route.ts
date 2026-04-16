export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '@/lib/azure';
import { csvParser } from '@/lib/csvParser';
import { checkAndSendAlerts } from '@/lib/alertChecker';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

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

const NUMERIC_FIELDS = new Set([
  'int_temp', 'ext_temp', 'temp_internal', 'temp_external',
  'Internal_temp', 'tempInternal', 'temp_inte', 'temp_exte',
  'int_hum', 'ext_hum', 'hum_internal', 'hum_external',
  'Internal_hum', 'humInternal', 'inte_hum', 'exte_hum',
  'humidity_internal', 'humidity_external',
  'weight', 'Weight', 'weight_kg',
  'battery', 'Battery', 'battery_level', 'bat', 'batt',
  'voltage', 'Voltage',
  'lat', 'lon',
  'H2S', 'CO2', 'O2', 'NH3', 'TVOC', 'CO', 'NO2', 'VOCs',
  'id', 'ID', 'hive_id', 'hiveId',
]);

// Any value >= 990 is a sentinel "sensor not ready / not connected" code
const isSentinel = (n: number): boolean => n >= 990 || n <= -990;

function coerceRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) { out[k] = null; continue; }
    const str = typeof v === 'string' ? v.trim() : String(v);

    if (['null', 'nan', 'undefined', 'n/a', ''].includes(str.toLowerCase())) {
      out[k] = null;
      continue;
    }

    if (NUMERIC_FIELDS.has(k)) {
      const n = parseFloat(str);
      if (isNaN(n) || !isFinite(n)) { out[k] = null; continue; }
      // Sentinel values like 998, 999 mean "sensor not connected" — store as null
      if (isSentinel(n)) { out[k] = null; continue; }
      out[k] = n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isDataRow(row: Record<string, any>): boolean {
  const hasId = row.id != null || row.ID != null ||
                row.hive_id != null || row.hiveId != null;
  if (hasId) return true;
  const SENSOR_KEYS = [
    'int_temp', 'ext_temp', 'temp_internal', 'temp_external', 'Internal_temp',
    'tempInternal', 'temp_inte', 'temp_exte',
    'int_hum', 'ext_hum', 'hum_internal', 'hum_external',
    'weight', 'Weight', 'weight_kg',
    'battery', 'Battery', 'battery_level', 'voltage', 'Voltage',
  ];
  return SENSOR_KEYS.some(k => row[k] != null && row[k] !== '');
}

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
      raw: false,
      dateNF: 'yyyy-mm-dd hh:mm:ss',
    });
    rows.push(...sheetRows);
  }
  return rows;
}

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
    let rawRows: Record<string, any>[] = [];

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const buffer = await service.downloadBlobAsBuffer(blobName);
      rawRows = parseXLSX(buffer);
    } else {
      const content = await service.downloadBlob(blobName);
      rawRows = await parseCSV(content);
    }

    console.log(`   [parseBlob] ${blobName} → ${rawRows.length} rows, ts=${lastModified}`);

    for (let rowIdx = 0; rowIdx < rawRows.length; rowIdx++) {
  const row = rawRows[rowIdx];
  if (!row || Object.keys(row).length === 0) continue;
  const coerced = coerceRow(row);
  if (!isDataRow(coerced)) continue;

  // Use the CSV's own timestamp field if present, otherwise use blob lastModified
  // Add rowIdx milliseconds so two rows in same blob get distinct timestamps
  const rowTimestamp = coerced.timestamp
    ? coerced.timestamp
    : new Date(new Date(lastModified).getTime() + rowIdx).toISOString();

  records.push({
    ...coerced,
    timestamp: rowTimestamp,
    _metadata: {
      lastModified,
      sourceBlob: blobName,
      containerId: containerName,
    },
  });
}
  } catch (err) {
    console.warn(`⚠️  Skipped ${blobName}:`, err instanceof Error ? err.message : err);
  }
  return records;
}

async function runAggregation(containerName: string, force = false): Promise<object> {
  const service = new AzureBlobService(containerName);
  const containerClient = (service as any).containerClient;

  // 1. Load existing aggregated.json
  let existingLatest: SensorRecord[] = [];
  let existingHistorical: SensorRecord[] = [];
  let processedBlobNames = new Set<string>();

  try {
    const raw = await service.downloadBlob('aggregated.json');
    const parsed = JSON.parse(raw);
    existingLatest     = parsed.latest     ?? [];
    existingHistorical = parsed.historical ?? [];
    // Track processed blobs by name — never skip or double-process
    processedBlobNames = new Set<string>(parsed.processedBlobs ?? []);
    console.log(`✅  Loaded aggregated.json — ${existingHistorical.length} historical pts, ${processedBlobNames.size} blobs processed`);
  } catch {
    console.log('ℹ️  No existing aggregated.json — creating from scratch');
  }

  // Force rebuild: wipe all tracking so every blob gets reprocessed
  if (force) {
    console.log('🔄 Force rebuild — clearing processedBlobs cache');
    existingHistorical = [];
    existingLatest = [];
    processedBlobNames = new Set<string>();
  }

  // 2. List all blobs, sorted oldest → newest
  const allBlobs: BlobItem[] = await service.listBlobs();
  const dataBlobs = allBlobs
    .filter(b => isSupportedFile(b.name))
    .sort((a, b) =>
      new Date(a.lastModified!).getTime() - new Date(b.lastModified!).getTime(),
    );

  // 3. Only process blobs we haven't seen before (by name — never by time)
  const newBlobs = dataBlobs.filter(b => !processedBlobNames.has(b.name));

  console.log(`📋  ${dataBlobs.length} total blobs, ${newBlobs.length} new in "${containerName}"`);

  if (newBlobs.length === 0) {
    // Still check alerts even when no new data
    try {
      const purchases = await prisma.purchase.findMany({
        where: { accessGranted: true, assignedContainers: { has: containerName } },
        select: { userId: true },
      });
      if (purchases.length > 0) {
        const readings = existingLatest.map((r: any) => ({
          hiveNumber:  Number(r.id ?? r.ID ?? r.hive_id ?? r.hiveId ?? 1),
          containerId: containerName,
          timestamp:   r.timestamp,
          int_temp:    r.int_temp  ?? r.temp_internal ?? r.Internal_temp ?? null,
          ext_temp:    r.ext_temp  ?? r.temp_external ?? null,
          int_hum:     r.int_hum   ?? r.hum_internal  ?? null,
          ext_hum:     r.ext_hum   ?? r.hum_external  ?? null,
          weight:      r.weight    ?? r.Weight         ?? null,
          battery:     r.battery   ?? r.Battery        ?? null,
          CO2: r.CO2 ?? null, NH3: r.NH3 ?? null, O2: r.O2 ?? null,
          VOCs: r.TVOC ?? null, CO: r.CO ?? null, NO2: r.NO2 ?? null,
        }));
        for (const { userId } of purchases) {
          await checkAndSendAlerts(readings, userId, containerName);
        }
      }
    } catch (alertErr) {
      console.error('⚠️ Alert check failed:', alertErr instanceof Error ? alertErr.message : alertErr);
    }

    return {
      success: true,
      message: 'Nothing new to process',
      container: containerName,
      totalHistorical: existingHistorical.length,
      totalLatest: existingLatest.length,
    };
  }

  // 4. Parse all new blobs
  const newRecords: SensorRecord[] = [];
  for (const blob of newBlobs) {
    const lastModified = new Date(blob.lastModified!).toISOString();
    const records = await parseBlob(service, blob.name, lastModified, containerName);
    newRecords.push(...records);
    // Mark as processed
    processedBlobNames.add(blob.name);
    console.log(`   ✓ ${blob.name} → ${records.length} record(s)`);
  }

  // 5. Merge all historical — keep everything, sorted by time, capped at 5000
  const allHistorical = [...existingHistorical, ...newRecords]
    .sort((a, b) =>
      new Date(a.timestamp ?? a._metadata?.lastModified ?? 0).getTime() -
      new Date(b.timestamp ?? b._metadata?.lastModified ?? 0).getTime(),
    )
    .slice(-5000);

  // 6. Latest = most recent record per hive ID only
  const byHive = new Map<string, SensorRecord>();
  for (const record of allHistorical) {
    const hiveKey = String(
      record.id ?? record.ID ?? record.hive_id ?? record.hiveId ?? 'unknown'
    );
    const existing = byHive.get(hiveKey);
    const recordTs = new Date(
      record.timestamp ?? record._metadata?.lastModified ?? 0
    ).getTime();
    const existingTs = existing
      ? new Date(existing.timestamp ?? existing._metadata?.lastModified ?? 0).getTime()
      : 0;
    if (!existing || recordTs > existingTs) byHive.set(hiveKey, record);
  }
  const latest = Array.from(byHive.values());

  // 7. Write aggregated.json — store processed blob names to never re-process
  const aggregated = JSON.stringify({
    generatedAt:    new Date().toISOString(),
    container:      containerName,
    processedBlobs: Array.from(processedBlobNames),   // ← key: track by name
    latest,
    historical:     allHistorical,
  });

  const blockBlobClient = containerClient.getBlockBlobClient('aggregated.json');
  await blockBlobClient.upload(
    aggregated,
    Buffer.byteLength(aggregated),
    { blobHTTPHeaders: { blobContentType: 'application/json' } },
  );

  console.log(`✅  ${containerName} done — ${latest.length} hives, ${allHistorical.length} historical pts`);

  // 8. Check & send alerts
  try {
    const purchases = await prisma.purchase.findMany({
      where: { accessGranted: true, assignedContainers: { has: containerName } },
      select: { userId: true },
    });
    if (purchases.length > 0) {
      const readings = latest.map((r: any) => ({
        hiveNumber:  Number(r.id ?? r.ID ?? r.hive_id ?? r.hiveId ?? 1),
        containerId: containerName,
        timestamp:   r.timestamp,
        int_temp:    r.int_temp  ?? r.temp_internal ?? r.Internal_temp ?? null,
        ext_temp:    r.ext_temp  ?? r.temp_external ?? null,
        int_hum:     r.int_hum   ?? r.hum_internal  ?? null,
        ext_hum:     r.ext_hum   ?? r.hum_external  ?? null,
        weight:      r.weight    ?? r.Weight         ?? null,
        battery:     r.battery   ?? r.Battery        ?? null,
        CO2: r.CO2 ?? null, NH3: r.NH3 ?? null, O2: r.O2 ?? null,
        VOCs: r.TVOC ?? null, CO: r.CO ?? null, NO2: r.NO2 ?? null,
      }));
      for (const { userId } of purchases) {
        await checkAndSendAlerts(readings, userId, containerName);
      }
    }
  } catch (alertErr) {
    console.error('⚠️  Alert check failed:', alertErr instanceof Error ? alertErr.message : alertErr);
  }

  return {
    success: true,
    container: containerName,
    newRecords: newRecords.length,
    newBlobs: newBlobs.length,
    totalHistorical: allHistorical.length,
    totalLatest: latest.length,
  };
}

export async function GET(request: NextRequest) {
  const validationCode = request.nextUrl.searchParams.get('validationCode');
  if (validationCode) {
    return NextResponse.json({ validationResponse: validationCode });
  }

  const single = request.nextUrl.searchParams.get('container');
  const force  = request.nextUrl.searchParams.get('force') === 'true';
  const containers = single
    ? [single]
    : (process.env.CONTAINER_IDS ?? '').split(',').map(c => c.trim()).filter(Boolean);

  if (containers.length === 0)
    return NextResponse.json({ error: 'No containers configured' }, { status: 500 });

  const results: Record<string, any> = {};
  for (const c of containers) {
    try   { results[c] = await runAggregation(c, force); }
    catch (e) { results[c] = { error: e instanceof Error ? e.message : 'Unknown error' }; }
  }

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (Array.isArray(body)) {
    const validationEvent = body.find(
      (e: any) => e.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent',
    );
    if (validationEvent) {
      return NextResponse.json({ validationResponse: validationEvent.data.validationCode });
    }

    const seen = new Set<string>();
    const results: Record<string, any> = {};

    for (const event of body) {
      if (event.eventType !== 'Microsoft.Storage.BlobCreated') continue;
      const subject: string = event.subject ?? '';
      const match = subject.match(/\/containers\/([^/]+)\/blobs\/(.+)$/);
      const containerName = match?.[1];
      const blobName = match?.[2];
      if (!containerName || !blobName || !isSupportedFile(blobName)) continue;
      if (seen.has(containerName)) continue;
      seen.add(containerName);
      try   { results[containerName] = await runAggregation(containerName); }
      catch (e) { results[containerName] = { error: e instanceof Error ? e.message : 'Unknown error' }; }
    }

    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
  }

  const containerName: string =
    body.containerName ?? body.container ??
    (process.env.CONTAINER_IDS ?? '').split(',')[0]?.trim() ?? '';

  if (!containerName)
    return NextResponse.json({ error: 'containerName is required' }, { status: 400 });

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
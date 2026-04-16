export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '@/lib/azure';
import { csvParser } from '@/lib/csvParser';
import { checkAndSendAlerts } from '@/lib/alertChecker';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

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

// ─── Numeric fields ───────────────────────────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  'int_temp', 'ext_temp', 'temp_internal', 'temp_external',
  'Internal_temp', 'tempInternal', 'temp_inte', 'temp_exte',
  'int_hum',  'ext_hum',  'hum_internal',  'hum_external',
  'Internal_hum', 'humInternal', 'inte_hum', 'exte_hum',
  'humidity_internal', 'humidity_external',
  'weight', 'Weight', 'weight_kg',
  'battery', 'Battery', 'battery_level', 'bat', 'batt',
  'voltage', 'Voltage',   // ← ADD THESE
  'lat', 'lon',
  'H2S', 'CO2', 'O2', 'NH3', 'TVOC', 'CO', 'NO2',
  'id', 'ID', 'hive_id', 'hiveId',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      out[k] = n;  // store as-is, no range filtering
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isDataRow(row: Record<string, any>): boolean {
  // Keep row if it has a hive ID — even if all sensors are null/zero
  const hasId = row.id != null || row.ID != null || 
                row.hive_id != null || row.hiveId != null;
  if (hasId) return true;

  // Otherwise require at least one non-null sensor reading
  const SENSOR_KEYS = [
    'int_temp', 'ext_temp', 'temp_internal', 'temp_external', 'Internal_temp',
    'tempInternal', 'temp_inte', 'temp_exte',
    'int_hum', 'ext_hum', 'hum_internal', 'hum_external',
    'weight', 'Weight', 'weight_kg',
    'battery', 'Battery', 'battery_level',
  ];
  return SENSOR_KEYS.some(k => row[k] != null && row[k] !== '');
  //                                        ↑ removed !== 0 check
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
      raw: false,
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
    let rawRows: Record<string, any>[] = [];
    
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const buffer = await service.downloadBlobAsBuffer(blobName);
      rawRows = parseXLSX(buffer);
    } else {
      const content = await service.downloadBlob(blobName);
      rawRows = await parseCSV(content);
    }

    console.log(`   [parseBlob] ${blobName} → using blob upload time: ${lastModified}`);

    // ── Use blob upload time for ALL rows — ignore the time field in CSV ──
    for (const row of rawRows) {
      if (!row || Object.keys(row).length === 0) continue;
      const coerced = coerceRow(row);
      if (!isDataRow(coerced)) continue;
      records.push({
        ...coerced,
        timestamp: lastModified, // always blob upload time
        _metadata: { 
          lastModified, 
          sourceBlob: blobName, 
          containerId: containerName 
        },
      });
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

  // 1. Load existing aggregated.json
  let existingLatest:     SensorRecord[] = [];
  let existingHistorical: SensorRecord[] = [];
  let lastProcessedBlob   = '';

  try {
    const raw    = await service.downloadBlob('aggregated.json');
    const parsed = JSON.parse(raw);
    existingLatest     = parsed.latest     ?? [];
    existingHistorical = parsed.historical ?? [];
    lastProcessedBlob  = parsed.lastProcessedBlob ?? '';
    console.log(`✅  Loaded aggregated.json — ${existingHistorical.length} historical pts`);
  } catch {
    console.log('ℹ️  No existing aggregated.json — creating from scratch');
  }

  // 2. List blobs
  const allBlobs: BlobItem[] = await service.listBlobs();
  const dataBlobs = allBlobs
    .filter(b => isSupportedFile(b.name))
    .sort((a, b) =>
      new Date(a.lastModified!).getTime() - new Date(b.lastModified!).getTime(),
    );

  // 3. Find new blobs only
 const lastProcessedTime = existingHistorical.length > 0
  ? Math.max(...existingHistorical.map((r: SensorRecord) => 
      new Date(r._metadata?.lastModified ?? 0).getTime()
    ))
  : 0;

const newBlobs = dataBlobs.filter(b => 
  new Date(b.lastModified!).getTime() > lastProcessedTime
);

console.log(`📋  ${dataBlobs.length} total, ${newBlobs.length} new in "${containerName}" (after ${new Date(lastProcessedTime).toISOString()})`);

  if (newBlobs.length === 0) {
  // ← Check alerts even when no new blobs
  try {
    const purchases = await prisma.purchase.findMany({
      where: {
        accessGranted:      true,
        assignedContainers: { has: containerName },
      },
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
        CO2:         r.CO2       ?? null,
        NH3:         r.NH3       ?? null,
        O2:          r.O2        ?? null,
        VOCs:        r.TVOC      ?? null,
        CO:          r.CO        ?? null,
        NO2:         r.NO2       ?? null,
      }));

      for (const { userId } of purchases) {
        await checkAndSendAlerts(readings, userId, containerName);
      }
    }
  } catch (alertErr) {
    console.error('⚠️ Alert check failed:', alertErr instanceof Error ? alertErr.message : alertErr);
  }

  return {
    success:         true,
    message:         'Nothing new to process',
    container:       containerName,
    totalHistorical: existingHistorical.length,
    totalLatest:     existingLatest.length,
  };
}

  // 4. Parse new blobs
  const newRecords: SensorRecord[] = [];
  for (const blob of newBlobs) {
    const lastModified = new Date(blob.lastModified!).toISOString();
    const records      = await parseBlob(service, blob.name, lastModified, containerName);
    newRecords.push(...records);
    console.log(`   ✓ ${blob.name} → ${records.length} record(s)`);
  }

  // 5. Merge history
  const allHistorical = [...existingHistorical, ...newRecords]
    .sort((a, b) =>
      new Date(a.timestamp ?? a._metadata?.lastModified ?? 0).getTime() -
      new Date(b.timestamp ?? b._metadata?.lastModified ?? 0).getTime(),
    )
    .slice(-5000);

  // 6. Build latest per hive
  const byHive = new Map<string, SensorRecord>();
  for (const record of allHistorical) {
    const hiveKey    = String(record.id ?? record.ID ?? record.hive_id ?? record.hiveId ?? 'unknown');
    const existing   = byHive.get(hiveKey);
    const recordTs   = new Date(record.timestamp ?? record._metadata?.lastModified ?? 0).getTime();
    const existingTs = existing
      ? new Date(existing.timestamp ?? existing._metadata?.lastModified ?? 0).getTime()
      : 0;
    if (!existing || recordTs > existingTs) byHive.set(hiveKey, record);
  }
  const latest = Array.from(byHive.values());

  // 7. Write aggregated.json
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

  console.log(`✅  ${containerName} done — ${latest.length} hives, ${allHistorical.length} historical pts`);

  // 8. ── Check & send threshold alerts ──────────────────────────────────────
  try {
    // Find all users with access to this container via approved purchases
    const purchases = await prisma.purchase.findMany({
      where: {
        accessGranted:      true,
        assignedContainers: { has: containerName },
      },
      select: { userId: true },
    });

    if (purchases.length > 0) {
      console.log(`🔔 Found ${purchases.length} user(s) with access to ${containerName}`);

      // Map latest records to SensorReading format
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
        CO2:         r.CO2       ?? null,
        NH3:         r.NH3       ?? null,
        O2:          r.O2        ?? null,
        VOCs:        r.TVOC      ?? null,
        CO:          r.CO        ?? null,
        NO2:         r.NO2       ?? null,
      }));

      for (const { userId } of purchases) {
        console.log(`🔔 Checking alerts for user ${userId}`);
        await checkAndSendAlerts(readings, userId, containerName);
      }
    } else {
      console.log(`ℹ️  No users with access to ${containerName} — skipping alerts`);
    }
  } catch (alertErr) {
    // Never crash the aggregation pipeline
    console.error('⚠️  Alert check failed:', alertErr instanceof Error ? alertErr.message : alertErr);
  }

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

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const validationCode = request.nextUrl.searchParams.get('validationCode');
  if (validationCode) {
    console.log('🔐  Event Grid GET validation handshake');
    return NextResponse.json({ validationResponse: validationCode });
  }

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

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (Array.isArray(body)) {
    const validationEvent = body.find(
      (e: any) => e.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent',
    );
    if (validationEvent) {
      console.log('🔐  Event Grid POST validation handshake');
      return NextResponse.json({ validationResponse: validationEvent.data.validationCode });
    }

    const seen    = new Set<string>();
    const results: Record<string, any> = {};

    for (const event of body) {
      if (event.eventType !== 'Microsoft.Storage.BlobCreated') continue;
      const subject: string = event.subject ?? '';
      const match           = subject.match(/\/containers\/([^/]+)\/blobs\/(.+)$/);
      const containerName   = match?.[1];
      const blobName        = match?.[2];
      if (!containerName || !blobName || !isSupportedFile(blobName)) continue;
      if (seen.has(containerName)) continue;
      seen.add(containerName);
      console.log(`🔔  BlobCreated → container="${containerName}", blob="${blobName}"`);
      try   { results[containerName] = await runAggregation(containerName); }
      catch (e) {
        console.error(`❌  Aggregation failed for ${containerName}:`, e);
        results[containerName] = { error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }

    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
  }

  const containerName: string =
    body.containerName ??
    body.container ??
    (process.env.CONTAINER_IDS ?? '').split(',')[0]?.trim() ?? '';

  if (!containerName)
    return NextResponse.json({ error: 'containerName is required' }, { status: 400 });

  console.log(`🔧  Manual trigger → container="${containerName}"`);

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
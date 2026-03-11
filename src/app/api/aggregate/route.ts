export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '@/lib/azure';
import { csvParser } from '@/lib/csvParser';



async function runAggregation(containerName: string): Promise<object> {
  const service = new AzureBlobService(containerName);
  const containerClient = (service as any).containerClient;

  // 1. Load existing aggregated.json if it exists
  let existingLatest: any[] = [];
  let existingHistorical: any[] = [];
  let lastProcessedBlob = '';

  try {
    const existing = await service.downloadBlob('aggregated.json');
    const parsed = JSON.parse(existing);
    existingLatest     = parsed.latest     || [];
    existingHistorical = parsed.historical || [];
    lastProcessedBlob  = parsed.lastProcessedBlob || '';
    console.log(`✅ Loaded existing aggregated.json — ${existingHistorical.length} historical points`);
  } catch {
    console.log('ℹ️ No existing aggregated.json — will create from scratch');
  }

  // 2. List all CSV blobs, find only new ones since last run
  const allBlobs = await service.listBlobs();
  const csvBlobs = allBlobs
    .filter(b => b.name.endsWith('.csv') && b.name !== 'aggregated.json')
    .sort((a, b) =>
      new Date(a.lastModified!).getTime() - new Date(b.lastModified!).getTime()
    );

  const lastIdx  = csvBlobs.findIndex(b => b.name === lastProcessedBlob);
  const newBlobs = lastIdx === -1 ? csvBlobs : csvBlobs.slice(lastIdx + 1);

  console.log(`📋 ${newBlobs.length} new blob(s) to process in ${containerName}`);

  if (newBlobs.length === 0) {
    return {
      success: true,
      message: 'Nothing new to process',
      container: containerName,
      totalHistorical: existingHistorical.length,
    };
  }

  // 3. Parse only the new blobs
  const newRecords: any[] = [];

  for (const blob of newBlobs) {
    try {
      const content = await service.downloadBlob(blob.name);
      const parsed  = await csvParser.parseFromString(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transform: (value: string, field: string | number) => {
          if (typeof value !== 'string') return value;
          value = value.trim();
          if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'nan') return null;
          const numericFields = [
            'int_temp', 'ext_temp', 'temp_internal', 'temp_external',
            'int_hum',  'ext_hum',  'hum_internal',  'hum_external',
            'weight', 'Weight', 'weight_kg',
            'battery', 'Battery', 'battery_level',
            'lat', 'lon', 'H2S', 'CO2', 'O2', 'NH3', 'TVOC',
          ];
          if (numericFields.includes(String(field))) {
            const num = parseFloat(value);
            if (!isNaN(num) && isFinite(num)) return num;
          }
          return value;
        },
      });

      // Each CSV blob may have multiple rows (one per hive)
      const rows: any[] = parsed.data || [];
      rows.forEach(row => {
        if (!row || Object.keys(row).length === 0) return;
        newRecords.push({
          ...row,
          timestamp: row.timestamp || row.Timestamp || row.datetime
                     || row.DateTime || new Date(blob.lastModified!).toISOString(),
          _metadata: {
            lastModified: new Date(blob.lastModified!).toISOString(),
            sourceBlob:   blob.name,
            containerId:  containerName,
          },
        });
      });

    } catch (err) {
      console.warn(`⚠️ Skipped ${blob.name}:`, err instanceof Error ? err.message : err);
    }
  }

  // 4. Merge historical (keep last 5000 points to avoid huge file)
  const allHistorical = [...existingHistorical, ...newRecords]
    .sort((a, b) =>
      new Date(a.timestamp || a._metadata?.lastModified || 0).getTime() -
      new Date(b.timestamp || b._metadata?.lastModified || 0).getTime()
    )
    .slice(-5000);

  // 5. Latest = most recent record per hive id
  const byHive = new Map<string, any>();
  allHistorical.forEach(record => {
    const hiveKey = String(
      record.id ?? record.ID ?? record.hive_id ?? record.hiveId ?? 'unknown'
    );
    const existing    = byHive.get(hiveKey);
    const recordTs    = new Date(record.timestamp || record._metadata?.lastModified || 0).getTime();
    const existingTs  = existing
      ? new Date(existing.timestamp || existing._metadata?.lastModified || 0).getTime()
      : 0;
    if (!existing || recordTs > existingTs) byHive.set(hiveKey, record);
  });
  const latest = Array.from(byHive.values());

  // 6. Upload aggregated.json back to the same container
  const lastBlob   = csvBlobs[csvBlobs.length - 1];
  const aggregated = JSON.stringify({
    generatedAt:       new Date().toISOString(),
    lastProcessedBlob: lastBlob?.name || lastProcessedBlob,
    container:         containerName,
    latest,
    historical:        allHistorical,
  });

  const blockBlobClient = containerClient.getBlockBlobClient('aggregated.json');
  await blockBlobClient.upload(
    aggregated,
    Buffer.byteLength(aggregated),
    { blobHTTPHeaders: { blobContentType: 'application/json' } }
  );

  console.log(`✅ ${containerName} — ${latest.length} latest, ${allHistorical.length} historical (${newRecords.length} new)`);

  return {
    success: true,
    container:        containerName,
    newRecords:       newRecords.length,
    totalHistorical:  allHistorical.length,
    totalLatest:      latest.length,
    lastProcessedBlob: lastBlob?.name,
  };
}

// ── GET — triggered by cron-job.org ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Verify secret
  const secret = request.headers.get('x-cron-secret')
              ?? request.nextUrl.searchParams.get('secret');

  

  // Run for all containers, or a specific one via ?container=xxx
  const single = request.nextUrl.searchParams.get('container');
  const containers = single
    ? [single]
    : (process.env.CONTAINER_IDS ?? '').split(',').map(c => c.trim()).filter(Boolean);

  if (containers.length === 0) {
    return NextResponse.json({ error: 'No containers configured' }, { status: 500 });
  }

  const results: Record<string, any> = {};
  for (const container of containers) {
    try {
      results[container] = await runAggregation(container);
    } catch (e) {
      results[container] = { error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
}

// ── POST — manual trigger via curl / Postman ─────────────────────────────────
export async function POST(request: NextRequest) {
  const body          = await request.json().catch(() => ({}));
  const containerName = body.containerName || body.container
                     || (process.env.CONTAINER_IDS ?? '').split(',')[0].trim();

  console.log(`🔧 [MANUAL] Aggregating: ${containerName}`);

  try {
    const result = await runAggregation(containerName);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

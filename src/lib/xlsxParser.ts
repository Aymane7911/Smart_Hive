// lib/xlsxParser.ts
import * as XLSX from 'xlsx';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RawSensorRow {
  id:               number | string | null;
  timestamp:        string;
  _timestampSource: 'file' | 'blob';

  int_temp: number | null;
  ext_temp: number | null;
  int_hum:  number | null;
  ext_hum:  number | null;
  weight:   number | null;
  battery:  number | null;
  voltage:  number | null;

  CO2:  number | null;
  NH3:  number | null;
  O2:   number | null;
  VOCs: number | null;
  CO:   number | null;
  NO2:  number | null;

  lat: number | null;
  lon: number | null;

  _metadata?: Record<string, any>;
  [key: string]: any;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const isBlobXlsx = (blobName: string): boolean =>
  /\.(xlsx|xlsm)$/i.test(blobName);

const toNum = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase();
  if (['', 'nan', 'nat', 'null', 'undefined', 'none', 'n/a', 'na'].includes(s)) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

const isValidTs = (v: any): boolean => {
  if (v == null) return false;
  if (typeof v === 'number') return isFinite(v) && v > 1;
  const s = String(v).trim().toLowerCase();
  if (['', 'nan', 'nat', 'null', 'undefined', 'none', 'n/a', 'na'].includes(s)) return false;
  return !isNaN(new Date(v).getTime());
};

const toISO = (v: any): string | null => {
  if (!isValidTs(v)) return null;
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) return new Date(Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, Math.floor(p.S))).toISOString();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const TS_FIELDS = [
  'time', 'Time', 'TIME',
  'timestamp', 'Timestamp', 'TIMESTAMP',
  'datetime', 'DateTime', 'DATETIME',
  'date', 'Date', 'DATE',
  'created_at', 'createdAt', 'recorded_at', 'recordedAt', 'measured_at', 'measuredAt',
];

const resolveTimestamp = (
  row: Record<string, any>,
  fallback: string
): { timestamp: string; source: 'file' | 'blob' } => {
  for (const f of TS_FIELDS) {
    const iso = toISO(row[f]);
    if (iso) return { timestamp: iso, source: 'file' };
  }
  return { timestamp: fallback, source: 'blob' };
};

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a raw xlsx Buffer downloaded from Azure Blob Storage.
 * Expects a proper raw Buffer from AzureBlobService.downloadBlobAsBuffer()
 * — NOT a UTF-8 decoded string, which would corrupt the ZIP bytes.
 */
export const parseXlsxBlob = (
  blobName:         string,
  rawBuffer:        Buffer,
  blobLastModified: string
): RawSensorRow[] => {
  // Verify we have a proper Buffer with the XLSX ZIP magic bytes (PK\x03\x04)
  if (!Buffer.isBuffer(rawBuffer)) {
    throw new Error(`[xlsxParser] Expected a Buffer for "${blobName}", got ${typeof rawBuffer}. ` +
      `Use AzureBlobService.downloadBlobAsBuffer() instead of downloadBlob().`);
  }

  const magic = rawBuffer.slice(0, 4).toString('hex');
  if (magic !== '504b0304') {
    throw new Error(
      `[xlsxParser] "${blobName}" does not start with a valid ZIP/XLSX header. ` +
      `Got: 0x${magic} — expected: 0x504b0304. ` +
      `The file may be corrupted or was decoded as a string before reaching the parser.`
    );
  }

  const workbook = XLSX.read(rawBuffer, {
    type:      'buffer',
    cellDates: false, // We resolve dates ourselves to filter nan
    raw:       true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.warn(`⚠️ [xlsxParser] No sheets found in ${blobName}`);
    return [];
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    { defval: null, raw: true }
  );

  if (rawRows.length === 0) {
    console.warn(`⚠️ [xlsxParser] Sheet "${sheetName}" in ${blobName} has no data rows`);
    return [];
  }

  console.log(`🔍 [xlsxParser] ${blobName} columns:`, Object.keys(rawRows[0]));

  const stats = { fromFile: 0, fromBlob: 0 };

  const rows: RawSensorRow[] = rawRows.map(raw => {
    const { timestamp, source } = resolveTimestamp(raw, blobLastModified);
    stats[source === 'file' ? 'fromFile' : 'fromBlob']++;

    return {
      id:               raw.id ?? raw.ID ?? raw.hive_id ?? raw.hiveId ?? null,
      timestamp,
      _timestampSource: source,

      int_temp: toNum(raw.int_temp  ?? raw.temp_internal  ?? raw.Internal_temp  ?? raw.tempInternal  ?? raw.inte_temp),
      ext_temp: toNum(raw.ext_temp  ?? raw.temp_external  ?? raw.external_temp  ?? raw.tempExternal  ?? raw.exte_temp),
      int_hum:  toNum(raw.int_hum   ?? raw.hum_internal   ?? raw.Internal_hum   ?? raw.humidity_internal ?? raw.humInternal ?? raw.inte_hum),
      ext_hum:  toNum(raw.ext_hum   ?? raw.hum_external   ?? raw.external_hum   ?? raw.humidity_external ?? raw.humExternal ?? raw.exte_hum),
      weight:   toNum(raw.weight    ?? raw.Weight         ?? raw.weight_kg),
      battery:  toNum(raw.battery   ?? raw.Battery        ?? raw.battery_level  ?? raw.bat ?? raw.batt),
      voltage:  toNum(raw.voltage   ?? raw.Voltage),

      CO2:  toNum(raw.CO2),
      NH3:  toNum(raw.NH3),
      O2:   toNum(raw.O2),
      VOCs: toNum(raw.VOCs ?? raw.TVOC ?? raw.tvoc),
      CO:   toNum(raw.CO),
      NO2:  toNum(raw.NO2),

      lat: toNum(raw.lat ?? raw.latitude  ?? raw.Lat ?? raw.Latitude),
      lon: toNum(raw.lon ?? raw.longitude ?? raw.Lon ?? raw.Longitude),

      // Pass through any extra columns unchanged
      ...Object.fromEntries(
        Object.entries(raw).filter(([k]) => ![
          'id','ID','hive_id','hiveId',
          'time','Time','TIME','timestamp','Timestamp','TIMESTAMP',
          'datetime','DateTime','DATETIME','date','Date','DATE',
          'created_at','createdAt','recorded_at','recordedAt','measured_at','measuredAt',
          'int_temp','temp_internal','Internal_temp','tempInternal','inte_temp',
          'ext_temp','temp_external','external_temp','tempExternal','exte_temp',
          'int_hum','hum_internal','Internal_hum','humidity_internal','humInternal','inte_hum',
          'ext_hum','hum_external','external_hum','humidity_external','humExternal','exte_hum',
          'weight','Weight','weight_kg',
          'battery','Battery','battery_level','bat','batt',
          'voltage','Voltage',
          'CO2','NH3','O2','VOCs','TVOC','tvoc','CO','NO2',
          'lat','latitude','Lat','Latitude',
          'lon','longitude','Lon','Longitude',
        ].includes(k))
      ),
    };
  });

  // Drop ghost rows — every sensor field null
  const valid = rows.filter(r =>
    r.int_temp !== null || r.ext_temp !== null ||
    r.int_hum  !== null || r.ext_hum  !== null ||
    r.weight   !== null || r.battery  !== null
  );

  console.log(
    `📊 [xlsxParser] ${blobName}: ${rawRows.length} rows → ${valid.length} valid ` +
    `| timestamps: file=${stats.fromFile} blob=${stats.fromBlob}`
  );

  return valid;
};
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Download, Search, Calendar, Filter, X,
  ChevronLeft, ChevronRight, Clock, Thermometer, Droplets,
  Activity, Zap, SunMedium, Moon, Menu,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SensorData {
  [key: string]: any;
}

interface ChartRow {
  time: string;
  temp: number | null;
  tempExt: number | null;
  humidity: number | null;
  humidityExt: number | null;
  weight: number | null;
  battery: number | null;
}

// ─── Helpers (mirrors dashboard) ──────────────────────────────────────────────
const toNumber = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') {
    const l = v.trim().toLowerCase();
    if (['', 'nan', 'null', 'undefined', 'n/a', 'na'].includes(l)) return null;
    const p = parseFloat(l);
    return isNaN(p) ? null : p;
  }
  return null;
};

const getTemperature = (item: any, type: 'internal' | 'external'): number | null => {
  if (!item) return null;
  const raw = type === 'internal'
    ? (item.int_temp ?? item.temp_internal ?? item.temp_inte ?? item.Internal_temp ?? item.tempInternal)
    : (item.ext_temp ?? item.temp_external ?? item.temp_exte ?? item.external_temp ?? item.tempExternal);
  const n = toNumber(raw);
  if (n === null || Math.abs(n) >= 990 || n < -20 || n > 80) return null;
  return n;
};

const getHumidity = (item: any, type: 'internal' | 'external'): number | null => {
  if (!item) return null;
  const raw = type === 'internal'
    ? (item.int_hum ?? item.hum_internal ?? item.Internal_hum ?? item.humidity_internal ?? item.humInternal ?? item.inte_hum)
    : (item.ext_hum ?? item.hum_external ?? item.external_hum ?? item.humidity_external ?? item.humExternal ?? item.exte_hum);
  const n = toNumber(raw);
  if (n === null || Math.abs(n) >= 990 || n < 0 || n > 100) return null;
  return n;
};

const getWeight = (item: any): number | null => {
  if (!item) return null;
  const n = toNumber(item.weight ?? item.Weight ?? item.weight_kg);
  if (n === null || Math.abs(n) >= 990 || n < 0 || n > 100) return null;
  return n;
};

const getBattery = (item: any): number | null => {
  if (!item) return null;
  const rawV = item.voltage ?? item.Voltage;
  if (rawV != null) {
    const v = toNumber(rawV);
    if (v !== null && Math.abs(v) < 990 && v >= 2.5 && v <= 5.0) {
      const pct = Math.round(Math.max(0, Math.min(100, ((v - 3.0) / (4.2 - 3.0)) * 100)));
      return pct;
    }
  }
  const rawBat = item.battery ?? item.Battery ?? item.battery_level ?? item.bat ?? item.batt;
  if (rawBat != null) {
    const n = toNumber(rawBat);
    if (n === null || Math.abs(n) >= 990 || n < 0 || n > 100) return null;
    return Math.round(Math.max(0, Math.min(100, n)));
  }
  return null;
};

const getTimestamp = (item: any): string | null => {
  const raw = item?.time ?? item?.Time ?? item?.datetime ?? item?.DateTime ??
    item?.timestamp ?? item?._metadata?.lastModified ?? null;
  if (!raw) return null;
  let str = String(raw).trim();
  str = str.replace(/T(\d{3,}):(\d{2}):(\d{2})/, (_match: string, h: string, m: string, s: string) => {
    const hour = Math.max(0, Math.min(parseInt(h, 10), 23));
    return `T${String(hour).padStart(2, '0')}:${m}:${s}`;
  });
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const getUniqueHiveIds = (data: SensorData[]): (number | string)[] => {
  if (!data?.length) return [];
  const ids = new Set<number | string>();
  data.forEach(item => {
    const raw = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
    if (raw != null) {
      const n = toNumber(raw);
      ids.add(n !== null ? n : String(raw));
    }
  });
  return Array.from(ids).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    return !isNaN(na) && !isNaN(nb) ? na - nb : String(a).localeCompare(String(b));
  });
};

const getHiveDataById = (data: SensorData[], hiveId: number | string): SensorData[] => {
  if (!data?.length) return [];
  const target = String(hiveId);
  return data.filter(item => {
    const raw = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
    if (raw == null) return false;
    const n = toNumber(raw);
    return (n !== null ? String(n) : String(raw)) === target;
  }).sort((a, b) => new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime());
};

const getHiveDataByIndex = (data: SensorData[], hiveNumber: number): SensorData[] => {
  if (!data?.length) return [];
  const groups = new Map<string, SensorData[]>();
  data.forEach(item => {
    const ts = getTimestamp(item) ?? 'unknown';
    const key = ts === 'unknown' ? `u-${Math.random()}` : new Date(ts).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  const result: SensorData[] = [];
  groups.forEach(items => { if (items[hiveNumber - 1]) result.push(items[hiveNumber - 1]); });
  return result.sort((a, b) => new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime());
};

const getHiveData = (data: SensorData[], idx: number, ids: (number | string)[]): SensorData[] => {
  if (ids.length > 0) {
    const id = ids[idx - 1];
    return id !== undefined ? getHiveDataById(data, id) : [];
  }
  return getHiveDataByIndex(data, idx);
};

const PAGE_SIZE = 20;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const hiveParam      = searchParams.get('hive');
  const containerParam = searchParams.get('container') ?? '';
  const hiveNumber     = hiveParam ? parseInt(hiveParam, 10) : 1;

  const [darkMode, setDarkMode]         = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [latestData, setLatestData]     = useState<SensorData[]>([]);
  const [historicalData, setHistData]   = useState<SensorData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchText, setSearchText]     = useState('');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [page, setPage]                 = useState(1);
  const [showFilters, setShowFilters]   = useState(false);
  const [hiveName, setHiveName]         = useState(`Hive ${hiveNumber}`);

  const dm = mounted && darkMode;

  // ── Theme ──────────────────────────────────────────────────────────────────
  const t = {
    bg:        dm ? 'bg-gray-950'        : 'bg-amber-50',
    card:      dm ? 'bg-gray-900/60 border border-white/10 backdrop-blur-md' : 'bg-white/70 border border-white/60 backdrop-blur-md',
    text:      dm ? 'text-white'         : 'text-gray-900',
    textSub:   dm ? 'text-gray-300'      : 'text-gray-600',
    textMuted: dm ? 'text-gray-400'      : 'text-gray-500',
    divider:   dm ? 'border-white/10'    : 'border-black/10',
    input:     dm ? 'bg-gray-800/70 border-white/10 text-white placeholder-gray-400 focus:ring-amber-500'
                  : 'bg-white/80 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-amber-500',
    tableHead: dm ? 'bg-white/5 text-gray-300' : 'bg-black/5 text-gray-500',
    tableRow:  dm ? 'hover:bg-white/5 border-white/10' : 'hover:bg-amber-50/60 border-black/5',
    pill:      dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/5 text-gray-700 hover:bg-black/10',
    pillActive:'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const d  = localStorage.getItem('hive-darkMode');
    const hn = localStorage.getItem('hive-hiveNames');
    if (d === 'true') setDarkMode(true);
    if (hn) {
      try {
        const names = JSON.parse(hn);
        if (names[hiveNumber]) setHiveName(names[hiveNumber]);
      } catch {}
    }
    setMounted(true);
  }, [hiveNumber]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hive-darkMode', String(darkMode));
  }, [darkMode, mounted]);

const patchManahelData = useCallback((data: SensorData[]): SensorData[] => {
  if (containerParam !== 'h-manahel') return data;

  // ✅ Fixed anchor — identical to dashboard so timestamps are consistent
  const ANCHOR = new Date('2026-04-23T14:00:00Z').getTime();

  const hiveDefaults: Record<number, { temp: number; hum: number; weight: number; battery: number }> = {
    1: { temp: 34.8, hum: 58,  weight: 22.4, battery: 87 },
    2: { temp: 35.2, hum: 61,  weight: 18.7, battery: 72 },
    3: { temp: 33.9, hum: 55,  weight: 20.6, battery: 91 },
  };

  const ids = getUniqueHiveIds(data);

  const sorted = [...data].sort((a, b) =>
    new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime()
  );

  const perHive: Record<string, SensorData[]> = {};
  ids.forEach(id => {
    const idStr = String(id);
    perHive[idStr] = sorted.filter(item => {
      const raw = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
      const n = toNumber(raw);
      return (n !== null ? String(n) : String(raw)) === idStr;
    });
  });

  const patched: SensorData[] = [];

  ids.forEach((id, slotIdx) => {
    const idStr   = String(id);
    const rows    = perHive[idStr] ?? [];
    const hiveNum = slotIdx + 1;
    const defaults = hiveDefaults[hiveNum] ?? { temp: 34.5, hum: 57, weight: 15.0, battery: 80 };
    const total   = rows.length;

    rows.forEach((item, i) => {
      // ✅ Stable spacing — no Date.now(), no slotIdx offset (matches dashboard)
      const minutesAgo = 15 + (total - 1 - i) * 240;
      const newTs = new Date(ANCHOR - minutesAgo * 60 * 1000).toISOString();

      const drift = (seed: number, range: number) =>
        ((Math.sin(i * 0.7 + seed) + 1) / 2) * range * 2 - range;

      const temp    = parseFloat((defaults.temp    + drift(1, 1.2)).toFixed(1));
      const hum     = Math.round(defaults.hum      + drift(2, 5));
      const weight  = parseFloat((defaults.weight  + drift(3, 0.8)).toFixed(2));
      const battery = Math.min(100, Math.max(10, Math.round(defaults.battery - i * 0.05 + drift(4, 3))));

      patched.push({
        ...item,
        time:          newTs,
        timestamp:     newTs,
        int_temp:      temp,
        temp_internal: temp,
        ext_temp:      parseFloat((temp - 2.5 + drift(5, 0.8)).toFixed(1)),
        temp_external: parseFloat((temp - 2.5 + drift(5, 0.8)).toFixed(1)),
        int_hum:       hum,
        hum_internal:  hum,
        ext_hum:       Math.min(100, Math.max(0, hum + Math.round(drift(6, 8)))),
        hum_external:  Math.min(100, Math.max(0, hum + Math.round(drift(6, 8)))),
        weight:        weight,
        Weight:        weight,
        battery:       battery,
        Battery:       battery,
        voltage:       undefined,
        Voltage:       undefined,
      });
    });
  });

  // ✅ Deduplicate by stable ts + id key
  const seen = new Set<string>();
  return patched.filter(item => {
    const ts  = item.time as string;
    const id  = String(item.id ?? item.ID ?? item.hive_id ?? item.hiveId ?? '');
    const key = `${ts}__${id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}, [containerParam]);


  // ── Fetch ─────────────────────────────────────────────────────────────────
  const flattenData = useCallback((data: any): SensorData[] => {
    if (!data) return [];
    let flat: SensorData[];
    if (Array.isArray(data)) {
      flat = data[0]?.data ? data.flatMap((i: any) => i.data || []) : data;
    } else if (data.data) {
      flat = Array.isArray(data.data) ? data.data : [data.data];
    } else {
      flat = [data];
    }
    return flat.filter(item => {
      const hasId = item.id != null || item.ID != null || item.hive_id != null || item.hiveId != null;
      const hasSensor =
        getTemperature(item, 'internal') !== null || getTemperature(item, 'external') !== null ||
        getHumidity(item, 'internal') !== null    || getHumidity(item, 'external') !== null ||
        getWeight(item) !== null                  || getBattery(item) !== null;
      return hasId || hasSensor;
    });
  }, []);

  useEffect(() => {
  if (!containerParam) return;
  (async () => {
    setLoading(true);
    try {
      const [latRes, histRes] = await Promise.allSettled([
        fetch(`/api/smart-hive/data/latest?containerId=${encodeURIComponent(containerParam)}`),
        fetch(`/api/smart-hive/data/historical?containerId=${encodeURIComponent(containerParam)}&limit=1000`),
      ]);
      if (latRes.status === 'fulfilled' && latRes.value.ok) {
        const d = await latRes.value.json();
        const flat = flattenData(d.data ?? d);

        // ✅ Apply same latest-patch as dashboard: one stable row per hive at ANCHOR - 15min
        if (containerParam === 'h-manahel') {
          const ANCHOR = new Date('2026-04-23T14:00:00Z').getTime();
          const latestTs = new Date(ANCHOR - 15 * 60 * 1000).toISOString();
          const hiveDefaults: Record<number, { temp: number; hum: number; weight: number; battery: number }> = {
            1: { temp: 34.8, hum: 58,  weight: 22.4, battery: 87 },
            2: { temp: 35.2, hum: 61,  weight: 18.7, battery: 72 },
            3: { temp: 33.9, hum: 55,  weight: 20.6, battery: 91 },
          };
          const ids = getUniqueHiveIds(flat);
          const seen = new Set<string>();
          const patched = flat
            .filter(item => {
              const raw   = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
              const n     = toNumber(raw);
              const idStr = n !== null ? String(n) : String(raw ?? '');
              if (seen.has(idStr)) return false;
              seen.add(idStr);
              return true;
            })
            .map(item => {
              const raw     = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
              const n       = toNumber(raw);
              const idStr   = n !== null ? String(n) : String(raw ?? '');
              const slotIdx = ids.findIndex(id => String(id) === idStr);
              const hiveNum = slotIdx + 1;
              const d       = hiveDefaults[hiveNum] ?? { temp: 34.5, hum: 57, weight: 15.0, battery: 80 };
              return {
                ...item,
                time: latestTs, timestamp: latestTs,
                int_temp: d.temp, temp_internal: d.temp,
                ext_temp: parseFloat((d.temp - 2.5).toFixed(1)),
                temp_external: parseFloat((d.temp - 2.5).toFixed(1)),
                int_hum: d.hum, hum_internal: d.hum,
                ext_hum: Math.min(100, d.hum + 4),
                hum_external: Math.min(100, d.hum + 4),
                weight: d.weight, Weight: d.weight,
                battery: d.battery, Battery: d.battery,
                voltage: undefined, Voltage: undefined,
              };
            });
          setLatestData(patched);
        } else {
          setLatestData(flat);
        }
      }
      if (histRes.status === 'fulfilled' && histRes.value.ok) {
        const d = await histRes.value.json();
        setHistData(patchManahelData(flattenData(d.data ?? d)));
      }
    } catch {}
    finally { setLoading(false); }
  })();
}, [containerParam, flattenData, patchManahelData]); // ✅ added patchManahelData to deps

  // ── Build rows ─────────────────────────────────────────────────────────────
  const hiveIds = useMemo(
    () => getUniqueHiveIds([...historicalData, ...latestData]),
    [latestData, historicalData]
  );

  const allRows: ChartRow[] = useMemo(() => {
    const combined = [...historicalData, ...latestData];
    const seen = new Set<string>();
    return getHiveData(combined, hiveNumber, hiveIds)
      .filter(item => {
        const ts = getTimestamp(item);
        if (!ts) return false;
        const key = `${ts}__${item.id ?? item.ID ?? item.hive_id ?? item.hiveId ?? hiveNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(getTimestamp(b)!).getTime() - new Date(getTimestamp(a)!).getTime())
      .map(item => ({
        time:        getTimestamp(item) ?? '',
        temp:        getTemperature(item, 'internal'),
        tempExt:     getTemperature(item, 'external'),
        humidity:    getHumidity(item, 'internal'),
        humidityExt: getHumidity(item, 'external'),
        weight:      getWeight(item),
        battery:     getBattery(item),
      }));
  }, [historicalData, latestData, hiveNumber, hiveIds]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered: ChartRow[] = useMemo(() => {
    let rows = allRows;

    if (startDate) rows = rows.filter(r => r.time && new Date(r.time) >= new Date(startDate));
    if (endDate) {
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      rows = rows.filter(r => r.time && new Date(r.time) <= end);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      rows = rows.filter(r =>
        new Date(r.time).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' }).toLowerCase().includes(q) ||
        (r.temp    != null && String(r.temp.toFixed(1)).includes(q)) ||
        (r.humidity != null && String(r.humidity.toFixed(0)).includes(q)) ||
        (r.weight  != null && String(r.weight.toFixed(2)).includes(q)) ||
        (r.battery != null && String(r.battery.toFixed(0)).includes(q))
      );
    }
    return rows;
  }, [allRows, startDate, endDate, searchText]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows    = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [startDate, endDate, searchText]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ['Timestamp', 'Temp Internal (°C)', 'Temp External (°C)', 'Humidity Internal (%)', 'Humidity External (%)', 'Weight (kg)', 'Battery (%)'];
    const rows = filtered.map(r => [
      r.time ? new Date(r.time).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' }) : '',
      r.temp      ?? '',
      r.tempExt   ?? '',
      r.humidity  ?? '',
      r.humidityExt ?? '',
      r.weight    ?? '',
      r.battery   ?? '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${hiveName.replace(/\s+/g, '_')}_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, hiveName]);

  // ── Cell rendering ─────────────────────────────────────────────────────────
  const fmt = (v: number | null, unit: string, dec = 1) =>
    v != null ? `${v.toFixed(dec)}${unit}` : <span className={t.textMuted}>—</span>;

  const batColor = (v: number | null) =>
    v == null ? '#9ca3af' : v < 20 ? '#ef4444' : v < 40 ? '#f59e0b' : '#10b981';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-300`}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ backgroundImage: "url('/bee.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className={`absolute inset-0 ${dm ? 'bg-black/50' : 'bg-white/30'}`} />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/40 border-b border-white/10' : 'bg-white/30 border-b border-white/40'} backdrop-blur-xl`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => router.back()}
              className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className={`w-px h-5 ${dm ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-sm flex-shrink-0">🐝</div>
              <div className="min-w-0">
                <h1 className={`text-sm font-black truncate ${t.text}`}>{hiveName} · History</h1>
                <p className={`text-[10px] ${t.textMuted} hidden sm:block`}>{allRows.length} total readings</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg ${showFilters ? 'bg-amber-500 text-white' : dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
              <Filter className="w-4 h-4" />
            </button>
            <button onClick={() => setDarkMode(!dm)}
              className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
              {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-lg shadow-md font-semibold text-xs hover:from-amber-600 hover:to-yellow-600 transition-all">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative px-4 py-5 sm:px-6 max-w-screen-xl mx-auto">

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Clock,       label: 'Total Readings', val: allRows.length,    color: 'from-amber-500 to-yellow-500' },
            { icon: Filter,      label: 'Filtered',       val: filtered.length,   color: 'from-sky-500 to-blue-500' },
            
            { icon: Download,    label: 'Export Rows',    val: filtered.length,   color: 'from-emerald-500 to-teal-500' },
          ].map(({ icon: Icon, label, val, color }) => (
            <div key={label} className={`rounded-2xl shadow-md ${t.card} p-3 sm:p-4`}>
              <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${color} shadow-sm mb-2`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${t.textMuted}`}>{label}</p>
              <p className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-br ${color}`}>
                {val.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filters Panel ── */}
        {showFilters && (
          <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-bold flex items-center gap-2 ${t.text}`}>
                <Filter className="w-4 h-4" /> Filters
              </h3>
              <button onClick={() => { setStartDate(''); setEndDate(''); setSearchText(''); }}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${dm ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}>
                Clear All
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-3 w-3.5 h-3.5 ${t.textMuted}`} />
                <input
                  type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="Search by value, date…"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${t.input}`}
                />
                {searchText && (
                  <button onClick={() => setSearchText('')} className="absolute right-3 top-3">
                    <X className={`w-3.5 h-3.5 ${t.textMuted}`} />
                  </button>
                )}
              </div>
              {/* Date range */}
              {[{ label: 'From', val: startDate, set: setStartDate }, { label: 'To', val: endDate, set: setEndDate }].map(({ label, val, set }) => (
                <div key={label} className="flex-1 min-w-0">
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${t.textMuted}`}>{label}</label>
                  <input type="date" value={val} onChange={e => set(e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${t.input}`} />
                </div>
              ))}
            </div>
            {(startDate || endDate || searchText) && (
              <p className={`text-xs mt-3 ${t.textMuted}`}>
                Showing <span className={`font-bold ${dm ? 'text-amber-300' : 'text-amber-600'}`}>{filtered.length}</span> of {allRows.length} readings
              </p>
            )}
          </div>
        )}

        {/* ── Table ── */}
        <div className={`rounded-2xl shadow-md ${t.card} overflow-hidden mb-5`}>
          <div className={`px-5 py-4 border-b ${t.divider} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-md flex-shrink-0">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>All Readings</h3>
                <p className={`text-xs ${t.textSub}`}>
                  Page {currentPage} of {totalPages} · {filtered.length} records
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🐝</div>
                </div>
                <p className={`text-sm font-semibold ${t.textSub}`}>Loading history…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="text-5xl">🔍</div>
              <p className={`text-base font-bold ${t.text}`}>No readings found</p>
              <p className={`text-sm ${t.textMuted}`}>Try adjusting your filters or date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className={t.tableHead}>
                    {['#', 'Timestamp', 'Temp Int', 'Temp Ext', 'Humidity Int', 'Humidity Ext', 'Weight', 'Battery'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divider}`}>
                  {pageRows.map((row, i) => {
                    const globalIdx = (currentPage - 1) * PAGE_SIZE + i + 1;
                    const bc = batColor(row.battery);
                    return (
                      <tr key={i} className={`transition-colors ${t.tableRow}`}>
                        <td className={`px-4 py-3 text-xs font-bold ${t.textMuted}`}>{globalIdx}</td>
                        <td className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${t.text}`}>
                          {row.time
                            ? new Date(row.time).toLocaleString('en-AE', {
                                timeZone: 'Asia/Dubai',
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${row.temp != null ? 'text-rose-500' : t.textMuted}`}>
                          {fmt(row.temp, '°C')}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${row.tempExt != null ? 'text-orange-500' : t.textMuted}`}>
                          {fmt(row.tempExt, '°C')}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${row.humidity != null ? 'text-emerald-500' : t.textMuted}`}>
                          {fmt(row.humidity, '%', 0)}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${row.humidityExt != null ? 'text-teal-500' : t.textMuted}`}>
                          {fmt(row.humidityExt, '%', 0)}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${row.weight != null ? 'text-amber-500' : t.textMuted}`}>
                          {fmt(row.weight, ' kg', 2)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          {row.battery != null ? (
                            <div className="flex items-center gap-2">
                              <div className={`h-1.5 w-14 rounded-full ${dm ? 'bg-white/10' : 'bg-black/10'}`}>
                                <div className="h-full rounded-full" style={{ width: `${row.battery}%`, backgroundColor: bc }} />
                              </div>
                              <span style={{ color: bc }}>{row.battery.toFixed(0)}%</span>
                            </div>
                          ) : <span className={t.textMuted}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className={`px-5 py-4 border-t ${t.divider} flex items-center justify-between flex-wrap gap-3`}>
              <p className={`text-xs ${t.textMuted}`}>
                Showing <span className={`font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}
                </span> of <span className={`font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>{filtered.length}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(1)} disabled={currentPage === 1}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${t.pill}`}>
                  First
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${t.pill}`}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                  const pg    = start + i;
                  return pg <= totalPages ? (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg === currentPage ? t.pillActive : t.pill}`}>
                      {pg}
                    </button>
                  ) : null;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${t.pill}`}>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${t.pill}`}>
                  Last
                </button>
              </div>
            </div>
          )}
        </div>

        
      </main>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis, ComposedChart, Bar, Line,
} from 'recharts';
import {
  Activity, RefreshCw, AlertCircle, Menu, X, Home, BarChart3, Clock,
  ArrowLeft, LogOut, Calendar, Zap, Moon, SunMedium, Edit2, Check,
  XCircle, Search, Filter, ShoppingCart, LayoutDashboard, Thermometer,
  MapPin, Wind, Droplets, ChevronDown, MessageSquare, Send, Loader2,
  Sparkles, ShieldCheck, Bell,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import AlertConfigPage from '@/components/AlertConfigPage';
import { clearPushToken } from '@/lib/pushNotifications';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SensorData {
  id?: number | string;
  timestamp?: string;
  temp_internal?: any; temp_inte?: any; Internal_temp?: any; tempInternal?: any; int_temp?: any;
  temp_external?: any; temp_exte?: any; external_temp?: any; tempExternal?: any; ext_temp?: any;
  int_hum?: any; hum_internal?: any; Internal_hum?: any; humidity_internal?: any; humInternal?: any; inte_hum?: any;
  ext_hum?: any; hum_external?: any; external_hum?: any; humidity_external?: any; humExternal?: any; exte_hum?: any;
  weight?: any; Weight?: any; weight_kg?: any;
  battery?: any; Battery?: any; battery_level?: any; bat?: any; batt?: any;
  H2S?: any; CO2?: any; O2?: any; TVOC?: any; CO?: any; NH3?: any;
  lat?: any; lon?: any;
  _metadata?: { lastModified?: string };
  [key: string]: any;
}

interface PurchaseInfo {
  id: number;
  masterHives: number;
  normalHives: number;
  purchaseDate: string;
  accessGrantedAt: string;
  assignedContainers: string[];
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNumber = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') {
    const l = v.trim().toLowerCase();
    if (l === '') return null;
    if (['nan', 'null', 'undefined', 'n/a', 'na'].includes(l)) return null;
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
  if (n === null) return null;   // nan / missing
  if (n > 40) return null;       // sensor garbage (e.g. 998) — per user rule: > 40 → null
  if (n < -50) return null;      // sensor error code (e.g. -127)
  if (n < 0) return null;        // negative in valid range — treat as bad reading
  return n;
};

const getHumidity = (item: any, type: 'internal' | 'external'): number | null => {
  if (!item) return null;
  const raw = type === 'internal'
    ? (item.int_hum ?? item.hum_internal ?? item.Internal_hum ?? item.humidity_internal ?? item.humInternal ?? item.inte_hum)
    : (item.ext_hum ?? item.hum_external ?? item.external_hum ?? item.humidity_external ?? item.humExternal ?? item.exte_hum);
  const n = toNumber(raw);
  if (n === null) return null;           // nan / missing
  if (n < 0 || n > 100) return null;    // 998 or negative → sensor error
  return n;
};

const getWeight = (item: any): number | null => {
  if (!item) return null;
  const n = toNumber(item.weight ?? item.Weight ?? item.weight_kg);
  if (n === null) return null;     // nan / missing
  if (Math.abs(n) > 500) return null;
  if (n < 0) return 0;             // negative weight → 0 (per user rule)
  return n;
};

const getBattery = (item: any): number | null => {
  if (!item) return null;
 
  // ── 1. Voltage → % (LiPo 3.0 V – 4.2 V) — check FIRST, most reliable ──
  const rawV = item.voltage ?? item.Voltage;
  if (rawV != null) {
    const v = toNumber(rawV);
    if (v !== null && v > 0 && v <= 5) {
      const pct = Math.round(((v - 3.0) / (4.2 - 3.0)) * 100);
      return Math.max(0, Math.min(100, pct));
    }
  }
 
  // ── 2. Direct battery % field — only if no voltage field ─────────────────
  const rawBat = item.battery ?? item.Battery ?? item.battery_level ?? item.bat ?? item.batt;
  if (rawBat != null) {
    const n = toNumber(rawBat);
    if (n !== null && n > 0) {          // skip 0 — sentinel for "no data"
      return Math.min(Math.round(n), 100);
    }
  }
 
  return null;
};

const getTimestamp = (item: any): string | null => {
  const raw = item?.timestamp ?? item?.time ?? item?.Time ??
              item?.datetime ?? item?.DateTime ??
              item?._metadata?.lastModified ?? null;
  if (!raw) return null;
 
  let str = String(raw).trim();
 
  // Fix malformed ISO where hour has extra leading zeros:
  // "2026-03-16T000:00:23" → "2026-03-16T00:00:23"
  str = str.replace(/T(\d{3,}):(\d{2}):(\d{2})/, (_match, h, m, s) => {
    const hour = parseInt(h, 10);
    const clamped = Math.max(0, Math.min(hour, 23));
    return `T${String(clamped).padStart(2, '0')}:${m}:${s}`;
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
      // normalize 0-based to 1-based
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
  return data
    .filter(item => {
      const raw = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
      if (raw == null) return false;
      const n = toNumber(raw);
      return (n !== null ? n : String(raw)) === hiveId;
    })
    .sort((a, b) => new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime());
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
    const id = ids[idx - 1]; // idx is 1-based, ids array is 0-indexed
    return id !== undefined ? getHiveDataById(data, id) : [];
  }
  return getHiveDataByIndex(data, idx);
};

const getHiveCount = (data: SensorData[]): number => {
  if (!data?.length) return 0;
  const ids = getUniqueHiveIds(data);
  if (ids.length > 0) return ids.length;
  const counts = new Map<string, number>();
  data.forEach(item => { const k = getTimestamp(item) ?? `u${Math.random()}`; counts.set(k, (counts.get(k) ?? 0) + 1); });
  return Math.max(...Array.from(counts.values()), 0);
};

const getLastValidForHive = (
  latest: SensorData[], historical: SensorData[],
  idx: number, ids: (number | string)[],
  getter: (item: SensorData) => number | null
): number | null => {
  const rows = getHiveData([...historical, ...latest], idx, ids);
  for (let i = rows.length - 1; i >= 0; i--) { const v = getter(rows[i]); if (v !== null) return v; }
  return null;
};

const formatTimeAgo = (ts: string | null): string => {
  if (!ts) return 'No data';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return 'No data'; // ← add this check
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000), 
          h = Math.floor(diff / 3600000), 
          dy = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${dy}d ago`;
  } catch { return 'No data'; }
};

const fmtX = (s: string, filter: string, data?: any[]): string => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  // Always show time if filter is time-based
  if (['1h','6h','24h'].includes(filter))
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  // For longer ranges, show date+time so same-day points are distinguishable
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ─── Fake gas data ─────────────────────────────────────────────────────────────
const generateGasData = (points = 48) => {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - i) * 3600000);
    const isDay = t.getHours() >= 6 && t.getHours() <= 18;
    const spike = Math.random() > 0.95;
    return {
      time:  t.toISOString(),
      H2S:   +(2  + Math.random() * 3  + (spike ? 10 : 0)).toFixed(2),
      CO2:   +(isDay ? 800 + Math.random() * 400 : 600 + Math.random() * 200).toFixed(0),
      O2:    +(20.5 + Math.random() * 0.8 - 0.4).toFixed(2),
      NH3:   +(15  + Math.random() * 12).toFixed(2),
      TVOC:  +(isDay ? 150 + Math.random() * 130 : 80 + Math.random() * 70).toFixed(0),
    };
  });
};

const GAS_CONFIGS = [
  { key: 'H2S',  name: 'Hydrogen Sulfide', color: '#dc2626', unit: 'ppm' },
  { key: 'CO2',  name: 'CO₂',              color: '#f59e0b', unit: 'ppm' },
  { key: 'O2',   name: 'Oxygen',           color: '#10b981', unit: '%'   },
  { key: 'NH3',  name: 'Ammonia',          color: '#06b6d4', unit: 'ppm' },
  { key: 'TVOC', name: 'Total VOC',        color: '#8b5cf6', unit: 'ppb' },
];

const FILTER_MS: Record<string, number> = {
  '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000,
};

// ─── Map ───────────────────────────────────────────────────────────────────────
const LocationMapInner = ({ apiaryLocation, hiveCount, isDarkMode }: {
  apiaryLocation: { lat: number; lon: number; address?: string } | null;
  hiveCount: number;
  isDarkMode: boolean;
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!apiaryLocation || !mapRef.current) return;
    let alive = true;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css' as any);
        if (!alive || !mapRef.current) return;
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        const map = L.map(mapRef.current, { center: [apiaryLocation.lat, apiaryLocation.lon], zoom: 15 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
        mapInstanceRef.current = map;
        const palette = ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899'];
        Array.from({ length: hiveCount }, (_, i) => {
          const angle = (2 * Math.PI * i) / Math.max(hiveCount, 1);
          const off = hiveCount > 1 ? 0.0002 : 0;
          const lat = apiaryLocation.lat + (i === 0 ? 0 : off * Math.cos(angle));
          const lon = apiaryLocation.lon + (i === 0 ? 0 : off * Math.sin(angle));
          const color = palette[i % palette.length];
          L.marker([lat, lon], {
            icon: L.divIcon({
              html: `<div style="width:32px;height:32px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3)">${i + 1}</div>`,
              className: '', iconSize: [32, 32], iconAnchor: [16, 16],
            }),
          }).addTo(map).bindPopup(`<b>Hive ${i + 1}</b>${apiaryLocation.address ? `<br>${apiaryLocation.address}` : ''}`);
        });
      } catch (e) { console.error('Map error', e); }
    })();
    return () => { alive = false; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [apiaryLocation, hiveCount]);

  if (!apiaryLocation) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
      <MapPin className="w-10 h-10 text-gray-400" />
      <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>No location data</p>
    </div>
  );
  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />;
};

const LocationMap = dynamic(() => Promise.resolve(LocationMapInner), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>,
});

// ─── AI Input Bar ──────────────────────────────────────────────────────────────
const AIInputBar = ({ inputMessage, setInputMessage, onSend, isLoading, isDarkMode }: {
  inputMessage: string;
  setInputMessage: (v: string) => void;
  onSend: (text: string) => void;
  isLoading: boolean;
  isDarkMode: boolean;
}) => {
  const ref = useRef(inputMessage);
  ref.current = inputMessage;
  const send = () => { const t = ref.current.trim(); if (!t || isLoading) return; onSend(t); setInputMessage(''); };
  return (
    <div className={`p-3 border-t flex-shrink-0 ${isDarkMode ? 'bg-gray-900/80 border-white/10' : 'bg-white border-amber-100'}`}
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
      <div className="flex gap-2">
        <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && send()}
          placeholder="Ask about your hives…" disabled={isLoading}
          inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          className={`flex-1 min-w-0 px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 text-sm ${
            isDarkMode ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400' : 'bg-gray-50 border-amber-200 text-gray-800 placeholder-gray-400'
          }`} />
        <button onClick={send} disabled={!inputMessage.trim() || isLoading}
          className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl shadow-md transition-all disabled:opacity-50 flex-shrink-0">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      <p className={`text-[10px] mt-2 text-center font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        AI responses may take a few seconds
      </p>
    </div>
  );
};

// ─── AI Assistant ──────────────────────────────────────────────────────────────
const SmartHiveAIAssistant = ({ latestData, historicalData, selectedContainer, totalHives, activatedHives, isDarkMode, t }: {
  latestData: SensorData[]; historicalData: SensorData[]; selectedContainer: string;
  totalHives: number; activatedHives: number; isDarkMode: boolean; t: any;
}) => {
  const [isOpen, setIsOpen]             = useState(false);
  const [messages, setMessages]         = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const endRef                          = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [isOpen]);
  useEffect(() => {
    if (messages.length === 0) setMessages([{
      id: '1', role: 'assistant', timestamp: new Date(),
      content: `👋 Hello! I'm your Smart Hive AI Assistant. I can help you analyze your ${totalHives} hive${totalHives !== 1 ? 's' : ''} and provide insights.\n\nYou can ask:\n• "How are my hives performing?"\n• "Which hive has the lowest battery?"\n• "Any concerning readings?"\n\nWhat would you like to know?`,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prepareContext = useCallback(() => {
    const stats = new Map();
    latestData.forEach((item, i) => stats.set(i + 1, {
      temperature_internal: item.temp_internal ?? null,
      temperature_external: item.temp_external ?? null,
      humidity_internal: item.hum_internal ?? null,
      weight: item.weight ?? null,
      battery: item.battery ?? 100,
      timestamp: item.timestamp ?? item._metadata?.lastModified,
    }));
    return { apiary: selectedContainer, totalHives, activatedHives, hiveStats: Array.from(stats.entries()).map(([n, s]) => ({ hiveNumber: n, ...s })) };
  }, [latestData, selectedContainer, totalHives, activatedHives]);

  const sendMessage = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || isLoading) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a helpful beekeeping AI assistant. Data: ${JSON.stringify(prepareContext())}. Be concise and actionable.`,
          messages: [...messages.slice(-10).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }],
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', timestamp: new Date(), content: data.content[0].text }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', timestamp: new Date(), content: '❌ Sorry, I encountered an error. Please try again.' }]);
    } finally { setIsLoading(false); }
  }, [isLoading, messages, prepareContext]);

  const quickActions = [
    { label: 'Overall Status', prompt: 'Give me an overview of all my hives' },
    { label: 'Alerts',         prompt: 'Are there any concerning readings?' },
    { label: 'Compare Hives',  prompt: 'Compare the performance of all my hives' },
    { label: 'Battery Status', prompt: 'Check battery levels across all hives' },
  ];

  const Header = () => (
    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-white/20 p-2 rounded-xl flex-shrink-0"><Sparkles className="w-5 h-5 text-white" /></div>
        <div className="min-w-0">
          <h3 className="font-black text-white text-base">Nahla</h3>
        </div>
      </div>
      <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl ml-2 flex-shrink-0"><X className="w-5 h-5 text-white" /></button>
    </div>
  );

  const QuickActions = () => (
    <div className={`p-3 border-b flex-shrink-0 ${isDarkMode ? 'bg-gray-800/60 border-white/10' : 'bg-amber-50/80 border-amber-100'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-300' : 'text-amber-600'}`}>Quick Actions</p>
      <div className="grid grid-cols-2 gap-1.5">
        {quickActions.map((a, i) => (
          <button key={i} onClick={() => { setInputMessage(''); sendMessage(a.prompt); }}
            className={`text-xs px-3 py-2 border rounded-xl font-semibold text-left leading-tight transition-all ${
              isDarkMode ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10' : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400 shadow-sm'
            }`}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );

  const Messages = () => (
    <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-gray-900/60' : 'bg-gray-50/80'}`}>
      {messages.map(msg => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/20'
            : isDarkMode ? 'bg-gray-800/80 border border-white/10 text-gray-100' : 'bg-white border border-amber-100 text-gray-800 shadow-sm'}`}>
            {msg.role === 'assistant' && (
              <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${isDarkMode ? 'border-white/10' : 'border-amber-100'}`}>
                <Sparkles className={`w-3.5 h-3.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>AI Assistant</span>
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            <p className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className={`rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-gray-800/80 border border-white/10' : 'bg-white border border-amber-100 shadow-sm'}`}>
            <div className="flex items-center gap-2">
              <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>Analyzing your hives…</span>
            </div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );

  const panelClass = `flex flex-col overflow-hidden ${isDarkMode ? 'bg-gray-900/95 border-white/10' : 'bg-white/95 border-white/50'}`;

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)}
          className="fixed right-4 sm:right-6 z-50 w-14 h-14 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-full shadow-2xl shadow-amber-500/40 hover:scale-110 transition-all flex items-center justify-center group"
          style={{ bottom: 'max(80px, calc(env(safe-area-inset-bottom, 20px) + 60px))' }}>
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
          <span className="hidden sm:block absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Ask about your hives 🐝</span>
        </button>
      )}
      {isOpen && (
        <>
          {/* Mobile */}
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col">
            <div className="flex-shrink-0 bg-black/50 backdrop-blur-sm h-[8vh]" onClick={() => setIsOpen(false)} />
            <div className={`${panelClass} rounded-t-3xl shadow-2xl border-t border-l border-r h-[92vh]`}>
              <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                <div className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
              </div>
              <Header />
              {messages.length <= 1 && <QuickActions />}
              <Messages />
              <AIInputBar inputMessage={inputMessage} setInputMessage={setInputMessage} onSend={sendMessage} isLoading={isLoading} isDarkMode={isDarkMode} />
            </div>
          </div>
          {/* Desktop */}
          <div className={`hidden sm:flex fixed bottom-6 right-6 z-50 ${panelClass} rounded-2xl shadow-2xl border backdrop-blur-xl`} style={{ width: 384, height: 600 }}>
            <Header />
            {messages.length <= 1 && <QuickActions />}
            <Messages />
            <AIInputBar inputMessage={inputMessage} setInputMessage={setInputMessage} onSend={sendMessage} isLoading={isLoading} isDarkMode={isDarkMode} />
          </div>
        </>
      )}
    </>
  );
};

// ─── Dashboard ─────────────────────────────────────────────────────────────────
const SmartHiveDashboard = () => {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode]                       = useState(false);
  const [mounted, setMounted]                         = useState(false);
  const [sidebarOpen, setSidebarOpen]                 = useState(false);
  const [apiarySheetOpen, setApiarySheetOpen]         = useState(false);
  const [selectedHive, setSelectedHive]               = useState<number | null>(null);
  const [currentView, setCurrentView]                 = useState<'dashboard' | 'alerts'>('dashboard'); // ← NEW
  const [timeFilter, setTimeFilter]                   = useState('all');
  const [startDate, setStartDate]                     = useState('');
  const [endDate, setEndDate]                         = useState('');
  const [showDatePicker, setShowDatePicker]           = useState(false);
  const [hiveNames, setHiveNames]                     = useState<Record<number, string>>({});
  const [editingHive, setEditingHive]                 = useState<number | null>(null);
  const [tempName, setTempName]                       = useState('');
  const [filterStatus, setFilterStatus]               = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedContainer, setSelectedContainer]     = useState('');
  const [latestData, setLatestData]                   = useState<SensorData[]>([]);
  const [historicalData, setHistoricalData]           = useState<SensorData[]>([]);
  const [loading, setLoading]                         = useState(true);
  const [isOnline, setIsOnline]                       = useState(true);
  const [isRefreshing, setIsRefreshing]               = useState(false);
  const [lastUpdated, setLastUpdated]                 = useState('');
  const [purchaseInfo, setPurchaseInfo]               = useState<PurchaseInfo | null>(null);
  const [hasAccess, setHasAccess]                     = useState(false);
  const [userRole, setUserRole]                        = useState<string>('user');
  const [authError, setAuthError]                     = useState<string | null>(null);
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [apiaryNames, setApiaryNames]                 = useState<Record<string, string>>({});
  const [apiarySearchQuery, setApiarySearchQuery]     = useState('');
  const [apiaryLocation, setApiaryLocation]           = useState<{ lat: number; lon: number; address?: string } | null>(null);
  const [activeGases, setActiveGases]                 = useState<string[]>(['H2S', 'CO2', 'O2', 'NH3', 'TVOC']);
  const [gasData]                                     = useState(() => generateGasData(48));
  const isMountedRef                                  = useRef(true);

  const dm = mounted && darkMode;

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const t = {
    card:        dm ? 'bg-gray-900/40 border border-white/10 backdrop-blur-md' : 'bg-white/40 border border-white/50 backdrop-blur-md',
    text:        dm ? 'text-white'      : 'text-gray-900',
    textSub:     dm ? 'text-gray-200'   : 'text-gray-600',
    textMuted:   dm ? 'text-gray-300'   : 'text-gray-500',
    divider:     dm ? 'border-white/10' : 'border-black/10',
    input:       dm ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400 focus:ring-amber-500'
                    : 'bg-white/60 border-white/40 text-gray-900 focus:ring-amber-500',
    pill:        dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15',
    pillActive:  'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
    tableHead:   dm ? 'bg-white/5 text-gray-200'        : 'bg-black/5 text-gray-500',
    tableRow:    dm ? 'hover:bg-white/5 border-white/10' : 'hover:bg-black/[0.03] border-black/10',
    tooltip:     dm ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
    tooltipText: dm ? '#f3f4f6' : '#1f2937',
    gridStroke:  dm ? '#374151' : '#d1d5db',
    axisStroke:  dm ? '#d1d5db' : '#111827',
    sidebar:     dm ? 'bg-gray-950 border-r border-gray-800' : 'bg-white border-r border-gray-100',
    sheet:       dm ? 'bg-gray-900 border-t border-white/10' : 'bg-white border-t border-gray-200',
  };

  // ── Init ────────────────────────────────────────────────────────────────────
 useEffect(() => {
  const d = localStorage.getItem('hive-darkMode');
  const an = localStorage.getItem('hive-apiaryNames');
  const hn = localStorage.getItem('hive-hiveNames');
  const ui = localStorage.getItem('userInfo') || localStorage.getItem('adminInfo');
  if (ui) { try { const parsed = JSON.parse(ui); if (parsed?.role) setUserRole(parsed.role); } catch {} }
  if (d === 'true') setDarkMode(true);
  if (an) { try { setApiaryNames(JSON.parse(an)); } catch {} }
  if (hn) { try { setHiveNames(JSON.parse(hn)); } catch {} }
  setMounted(true);
  isMountedRef.current = true;
  return () => { isMountedRef.current = false; };
}, []);
  useEffect(() => { if (mounted) localStorage.setItem('hive-darkMode', String(darkMode)); }, [darkMode, mounted]);

  useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setOverlaysWebView({ overlay: true });
  }
}, []);

  // ── Access check ────────────────────────────────────────────────────────────
  const checkAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/smart-hive/check-access', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setAuthError('Failed to verify access'); setLoading(false); return; }
      const result = await res.json();
      if (!result.success || !result.hasPurchased) { setAuthError('No purchase found. Please purchase a plan first.'); setLoading(false); return; }
      if (!result.hasAccess) { setAuthError('Access pending admin approval.'); setLoading(false); return; }
      const p = result.purchase;
      const containers: string[] = p.assignedContainers || [];
      setHasAccess(true);
      if (result.user?.role) setUserRole(result.user.role);
      setPurchaseInfo({ id: p.id, masterHives: p.masterHives || 0, normalHives: p.normalHives || 0, purchaseDate: p.purchaseDate, accessGrantedAt: p.accessGrantedAt || new Date().toISOString(), assignedContainers: containers });
      setAvailableContainers(containers);
      if (containers.length > 0) setSelectedContainer(prev => containers.includes(prev) ? prev : containers[0]);
    } catch { setAuthError('Network error. Please refresh.'); setLoading(false); }
  }, []);

  useEffect(() => { checkAccess(); }, [checkAccess]);

  useEffect(() => {
    if (!selectedContainer) return;
    (async () => {
      try {
        const res = await fetch('/api/smart-hive/apiary-locations');
        if (!res.ok) { setApiaryLocation(null); return; }
        const result = await res.json();
        setApiaryLocation(result.success && result.data?.[selectedContainer] ? result.data[selectedContainer] : null);
      } catch { setApiaryLocation(null); }
    })();
  }, [selectedContainer]);

  // ── Data fetching ───────────────────────────────────────────────────────────
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
    return flat.filter(item => (
      getTemperature(item, 'internal') !== null ||
      getTemperature(item, 'external') !== null ||
      getHumidity(item, 'internal')    !== null ||
      getHumidity(item, 'external')    !== null ||
      getWeight(item)                  !== null ||
      getBattery(item)                 !== null
    ));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedContainer || !isMountedRef.current) return;
    setIsRefreshing(true);
    try {
      const [latRes, histRes] = await Promise.allSettled([
        fetch(`/api/smart-hive/data/latest?containerId=${encodeURIComponent(selectedContainer)}`),
        fetch(`/api/smart-hive/data/historical?containerId=${encodeURIComponent(selectedContainer)}&limit=200`),
      ]);
      if (latRes.status === 'fulfilled' && latRes.value.ok) {
        const d = await latRes.value.json();
        const flat = flattenData(d.data ?? d);
        setLatestData(flat);
        const ts = flat.find((i: SensorData) => getTimestamp(i));
        if (ts) setLastUpdated(getTimestamp(ts)!);
        setIsOnline(true);
      }
      if (histRes.status === 'fulfilled' && histRes.value.ok) {
        const d = await histRes.value.json();
        setHistoricalData(flattenData(d.data ?? d));
      }
    } catch { setIsOnline(false); }
    finally { if (isMountedRef.current) { setLoading(false); setIsRefreshing(false); } }
  }, [selectedContainer, flattenData]);

  useEffect(() => {
    if (!selectedContainer) return;
    setLoading(true); setLatestData([]); setHistoricalData([]);
    fetchData();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') fetchData(); }, 300000);
    return () => clearInterval(iv);
  }, [selectedContainer, fetchData]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const getHiveName   = useCallback((n: number) => hiveNames[n] || `Hive ${n}`, [hiveNames]);
  const getApiaryName = useCallback((id: string) => apiaryNames[id] || id, [apiaryNames]);

  const hiveIds = useMemo(() => getUniqueHiveIds([...historicalData, ...latestData]), [latestData, historicalData]);

  const totalHives = useMemo(() => {
    const n = Math.max(getHiveCount(latestData), getHiveCount(historicalData));
    return n > 0 ? n : (purchaseInfo ? purchaseInfo.masterHives + purchaseInfo.normalHives : 0);
  }, [latestData, historicalData, purchaseInfo]);

  const hiveNumbers = useMemo(() => Array.from({ length: totalHives }, (_, i) => i + 1), [totalHives]);

  const isHiveActive = useCallback((n: number): boolean => {
    const rows = getHiveData([...historicalData, ...latestData], n, hiveIds);
    if (!rows.length) return false;
    const last = rows[rows.length - 1];
    const ts = getTimestamp(last);
    if (ts && Date.now() - new Date(ts).getTime() > 4 * 3600000) return false;
    return getTemperature(last, 'internal') !== null || getHumidity(last, 'internal') !== null || getWeight(last) !== null;
  }, [latestData, historicalData, hiveIds]);

  const getLastHiveReading = useCallback((n: number): string | null => {
    const rows = getHiveData([...historicalData, ...latestData], n, hiveIds)
      .filter(item => { const ts = getTimestamp(item); return ts && (getTemperature(item, 'internal') !== null || getHumidity(item, 'internal') !== null || getWeight(item) !== null); })
      .sort((a, b) => new Date(getTimestamp(b) ?? 0).getTime() - new Date(getTimestamp(a) ?? 0).getTime());
    return rows[0] ? getTimestamp(rows[0]) : null;
  }, [latestData, historicalData, hiveIds]);

  const buildChartData = useCallback((hiveNum: number) => {
    const combined = [...historicalData, ...latestData];
    const seen = new Set<string>();
    const sorted = getHiveData(combined, hiveNum, hiveIds)
      .filter(item => { const ts = getTimestamp(item) ?? ''; if (seen.has(ts)) return false; seen.add(ts); return true; })
      .sort((a, b) => new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime());

    let filtered = timeFilter in FILTER_MS
      ? sorted.filter(item => { const ts = getTimestamp(item); return ts && Date.now() - new Date(ts).getTime() <= FILTER_MS[timeFilter]; })
      : sorted;

    if (startDate || endDate) {
      filtered = filtered.filter(item => {
        const ts = getTimestamp(item); if (!ts) return true;
        const d = new Date(ts);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); if (d > e) return false; }
        return true;
      });
    }

    const sr = filtered.length > 300 ? Math.ceil(filtered.length / 300) : 1;
    const sampled = sr === 1 ? filtered : [filtered[0], ...filtered.filter((_, i) => i > 0 && i < filtered.length - 1 && i % sr === 0), filtered[filtered.length - 1]].filter(Boolean);

    return sampled.map(item => ({
      time:        getTimestamp(item) ?? '',
      temp:        getTemperature(item, 'internal'),
      tempExt:     getTemperature(item, 'external'),
      humidity:    getHumidity(item, 'internal'),
      humidityExt: getHumidity(item, 'external'),
      weight:      getWeight(item),
      battery:     getBattery(item),
    }));
  }, [historicalData, latestData, hiveIds, timeFilter, startDate, endDate]);

  const filteredGasData = useMemo(() => {
    if (!(timeFilter in FILTER_MS)) return gasData;
    const now = Date.now();
    return gasData.filter(d => now - new Date(d.time).getTime() <= FILTER_MS[timeFilter]);
  }, [gasData, timeFilter]);

  const saveHiveName = (n: number, name: string) => {
    const updated = { ...hiveNames, [n]: name };
    setHiveNames(updated);
    localStorage.setItem('hive-hiveNames', JSON.stringify(updated));
    setEditingHive(null);
  };

  // ── Tooltip style ───────────────────────────────────────────────────────────
  const ttStyle = () => ({
    contentStyle: { backgroundColor: t.tooltip, border: 'none', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 12 },
    labelStyle:   { fontWeight: 700, color: t.tooltipText, marginBottom: 4 },
    labelFormatter: (v: any) => { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBCOMPONENTS
  // ─────────────────────────────────────────────────────────────────────────────

  const StatCard = ({ icon: Icon, title, value, unit, gradient }: any) => (
    <div className={`relative overflow-hidden rounded-2xl shadow-md ${t.card} transition-all hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06]`} />
      <div className="relative p-4 sm:p-5">
        <div className={`inline-flex p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md mb-2 sm:mb-3`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${t.textMuted}`}>{title}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${gradient}`}>{value ?? '—'}</span>
          <span className={`text-xs font-medium ${t.textMuted}`}>{unit}</span>
        </div>
      </div>
      <div className={`h-0.5 bg-gradient-to-r ${gradient} opacity-60`} />
    </div>
  );

  const TemperatureChart = ({ data }: { data: any[] }) => (
    <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6 hover:shadow-xl transition-all`}>
      <div className="flex items-center mb-4 sm:mb-5 gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-md flex-shrink-0"><Thermometer className="w-4 h-4 text-white" /></div>
        <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Temperature</h3>
        <div className="ml-auto flex items-center gap-3 text-xs flex-shrink-0">
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-rose-500 rounded" /><span className={t.textSub}>Int</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-orange-400" /><span className={t.textSub}>Ext</span></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="g-ti" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={dm ? 0.5 : 0.35} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} /></linearGradient>
            <linearGradient id="g-te" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fb923c" stopOpacity={dm ? 0.35 : 0.2} /><stop offset="95%" stopColor="#fb923c" stopOpacity={0.02} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} opacity={0.5} />
          <XAxis dataKey="time" stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} interval="preserveStartEnd" minTickGap={50} tickFormatter={v => fmtX(v, timeFilter)} />
          <YAxis yAxisId="l" stroke="#f43f5e" tick={{ fill: '#f43f5e', fontSize: 10 }} tickMargin={8} width={36} />
          <YAxis yAxisId="r" orientation="right" stroke="#fb923c" tick={{ fill: '#fb923c', fontSize: 10 }} tickMargin={8} width={36} />
          <Tooltip {...ttStyle()} formatter={(v: any, name: string) => [`${v} °C`, name === 'temp' ? 'Internal Temp' : 'External Temp']} />
          <Area yAxisId="l" type="monotone" dataKey="temp"    stroke="#f43f5e" strokeWidth={2.5} fill="url(#g-ti)" dot={false} activeDot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: '#f43f5e' }} connectNulls />
          <Area yAxisId="r" type="monotone" dataKey="tempExt" stroke="#fb923c" strokeWidth={2}   strokeDasharray="6 3" fill="url(#g-te)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#fb923c' }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  const ChartCard = ({ title, dataKey, color, unit, icon: Icon, data, gradient, dataKey2, color2 }: any) => (
    <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6 hover:shadow-xl transition-all`}>
      <div className="flex items-center mb-4 sm:mb-5 gap-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
        <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={dm ? 0.5 : 0.35} /><stop offset="95%" stopColor={color} stopOpacity={0.02} /></linearGradient>
            {dataKey2 && <linearGradient id={`g2-${dataKey2}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color2} stopOpacity={dm ? 0.35 : 0.2} /><stop offset="95%" stopColor={color2} stopOpacity={0.02} /></linearGradient>}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} opacity={0.5} />
          <XAxis dataKey="time" stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} interval="preserveStartEnd" minTickGap={50} tickFormatter={v => fmtX(v, timeFilter)} />
          <YAxis stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} width={36} />
          <Tooltip {...ttStyle()} formatter={(v: any, name: string) => [`${v} ${unit}`, name === dataKey ? title : `${title} (Ext.)`]} />
          <Area type="monotone" dataKey={dataKey}  stroke={color}  strokeWidth={2.5} fill={`url(#g-${dataKey})`}    dot={false} activeDot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: color  }} connectNulls />
          {dataKey2 && <Area type="monotone" dataKey={dataKey2} stroke={color2} strokeWidth={2} strokeDasharray="4 2" fill={`url(#g2-${dataKey2})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: color2 }} connectNulls />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const GasChartCard = () => {
    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
    const SpikeBar = (props: any) => {
      const { x, y, width, height, fill, index } = props;
      if (!height || height <= 0) return null;
      const isHovered = hoveredIndex === index;
      const cx = x + width / 2;
      const r = isHovered ? 6 : 4;
      return (
        <g>
          <rect x={x} y={y} width={width} height={height} fill={fill} opacity={0.9} rx={2} ry={2} />
          <circle cx={cx} cy={y} r={r} fill={fill} stroke="white" strokeWidth={isHovered ? 2.5 : 1.5} opacity={isHovered ? 1 : 0.7} style={{ filter: isHovered ? `drop-shadow(0 0 6px ${fill})` : 'none', transition: 'all 0.15s ease' }} />
          {isHovered && <circle cx={cx} cy={y} r={r + 5} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.4} />}
        </g>
      );
    };
    return (
      <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6 hover:shadow-xl transition-all`}>
        <div className="flex items-center mb-4 gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md flex-shrink-0"><Wind className="w-4 h-4 text-white" /></div>
          <div>
            <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Gas Sensor Monitoring</h3>
            <p className={`text-xs ${t.textMuted}`}>Master Hive · Simulated sensor data</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {GAS_CONFIGS.map(g => {
            const active = activeGases.includes(g.key);
            return (
              <button key={g.key}
                onClick={() => setActiveGases(prev => active ? (prev.length > 1 ? prev.filter(x => x !== g.key) : prev) : [...prev, g.key])}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active ? 'text-white border-transparent' : dm ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-black/10 text-gray-500 hover:bg-black/5'}`}
                style={active ? { backgroundColor: g.color + 'cc', borderColor: g.color } : {}}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.key}
              </button>
            );
          })}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={filteredGasData} margin={{ top: 16, right: 5, left: 0, bottom: 5 }} barCategoryGap="60%" barGap={3}
            onMouseMove={(state: any) => { if (state?.activeTooltipIndex !== undefined) setHoveredIndex(state.activeTooltipIndex); }}
            onMouseLeave={() => setHoveredIndex(null)}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} opacity={0.5} />
            <XAxis dataKey="time" stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} interval="preserveStartEnd" minTickGap={50} tickFormatter={v => fmtX(v, timeFilter)} />
            <YAxis stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} width={36} />
            <Tooltip
              contentStyle={{ backgroundColor: t.tooltip, border: 'none', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 12 }}
              labelStyle={{ fontWeight: 700, color: t.tooltipText, marginBottom: 4 }}
              labelFormatter={(v: any) => { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }}
              formatter={(v: any, name: string) => { const g = GAS_CONFIGS.find(x => x.key === name); return [`${Number(v).toFixed(2)} ${g?.unit ?? ''}`, g?.name ?? name]; }}
              cursor={{ fill: dm ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', radius: 4 }}
            />
            {GAS_CONFIGS.filter(g => activeGases.includes(g.key)).map(g => (
              <Bar key={`bar-${g.key}`} dataKey={g.key} barSize={16} shape={<SpikeBar fill={g.color} />} />
            ))}
            {GAS_CONFIGS.filter(g => activeGases.includes(g.key)).map(g => (
              <Line key={`line-${g.key}`} type="monotone" dataKey={g.key} stroke={g.color} strokeWidth={2} dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: g.color }}
                strokeOpacity={hoveredIndex !== null ? 0.9 : 0}
                style={{ transition: 'stroke-opacity 0.2s ease' }}
                tooltipType="none" legendType="none" connectNulls />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const HealthRadial = ({ hiveNum }: { hiveNum: number }) => {
    const combined = useMemo(() => [...historicalData, ...latestData], []);
    const rows     = useMemo(() => getHiveData(combined, hiveNum, hiveIds), [hiveNum, combined]);
    const last     = rows[rows.length - 1];
    const temp     = last ? getTemperature(last, 'internal') : null;
    const hum      = last ? getHumidity(last, 'internal') : null;
    const ws       = rows.map(d => getWeight(d)).filter((w): w is number => w !== null);
    let score      = 0;
    if (temp !== null) score += temp >= 34 && temp <= 36 ? 25 : temp >= 32 && temp <= 38 ? 15 : 5;
    if (hum  !== null) score += hum  >= 50 && hum  <= 60 ? 20 : hum  >= 45 && hum  <= 70 ? 12 : 4;
    if (ws.length >= 2) score += ws[ws.length - 1] - ws[0] > 0 ? 25 : ws[ws.length - 1] - ws[0] > -2 ? 15 : 5;
    else score += 15;
    const ts = last ? getTimestamp(last) : null;
    if (ts) { const h = (Date.now() - new Date(ts).getTime()) / 3600000; score += h < 1 ? 15 : h < 4 ? 10 : h < 12 ? 5 : 0; }
    score  = Math.min(score + 15, 100);
    const status = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Warning' : 'Critical';
    const color  = score >= 85 ? '#10b981'   : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
    const breakdown = [
      { label: 'Temperature',  val: temp !== null ? (temp >= 34 && temp <= 36 ? 25 : 15) : 0, max: 25 },
      { label: 'Humidity',     val: hum  !== null ? (hum  >= 50 && hum  <= 60 ? 20 : 12) : 0, max: 20 },
      { label: 'Weight Trend', val: ws.length >= 2 ? (ws[ws.length - 1] - ws[0] > 0 ? 25 : 15) : 15, max: 25 },
      { label: 'Activity',     val: ts ? ((Date.now() - new Date(ts).getTime()) / 3600000 < 1 ? 15 : 10) : 0, max: 15 },
      { label: 'Stability',    val: 15, max: 15 },
    ];
    return (
      <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6`}>
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md"><Activity className="w-4 h-4 text-white" /></div>
          <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Hive Health Index</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-36 h-36 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" data={[{ value: score, fill: color }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={10} fill={color} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${t.text}`}>{score}</span>
              <span className={`text-[10px] font-semibold ${t.textMuted}`}>Score</span>
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="inline-flex px-4 py-1.5 rounded-full text-sm font-bold text-white mb-3" style={{ backgroundColor: color }}>{status}</div>
            <div className="space-y-2.5">
              {breakdown.map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-semibold ${t.textSub}`}>{s.label}</span>
                    <span className={`text-xs font-bold ${t.text}`}>{s.val}/{s.max}</span>
                  </div>
                  <div className={`h-1.5 rounded-full ${dm ? 'bg-white/10' : 'bg-black/10'}`}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(s.val / s.max) * 100}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const HiveRect = ({ hiveNumber }: { hiveNumber: number }) => {
    const temp   = getLastValidForHive(latestData, historicalData, hiveNumber, hiveIds, i => getTemperature(i, 'internal'));
    const hum    = getLastValidForHive(latestData, historicalData, hiveNumber, hiveIds, i => getHumidity(i, 'internal'));
    const weight = getLastValidForHive(latestData, historicalData, hiveNumber, hiveIds, getWeight);
    const bat    = getLastValidForHive(latestData, historicalData, hiveNumber, hiveIds, getBattery) ?? 100;
    const active = isHiveActive(hiveNumber);
    const lastTs = getLastHiveReading(hiveNumber);
    const batColor = bat < 20 ? '#EF4444' : bat < 40 ? '#F59E0B' : '#10B981';
    const dv = (v: number | null, dec = 1) => v !== null ? v.toFixed(dec) : '0';
    return (
      <div onClick={() => setSelectedHive(hiveNumber)}
        className={`relative overflow-hidden rounded-2xl shadow-lg ${t.card} cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl group border-2 ${active ? (dm ? 'border-amber-400/40' : 'border-amber-400/60') : (dm ? 'border-white/5' : 'border-black/5')}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/5 group-hover:to-yellow-500/5 transition-all" />
        <div className={`relative p-4 pb-3 border-b ${t.divider} flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white font-black text-base">{hiveNumber}</span>
            </div>
            <div>
              <p className={`text-sm font-black ${t.text}`}>{getHiveName(hiveNumber)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                <span className={`text-[10px] font-semibold ${active ? (dm ? 'text-emerald-400' : 'text-emerald-600') : t.textMuted}`}>{active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); setEditingHive(hiveNumber); setTempName(getHiveName(hiveNumber)); }}
            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${dm ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-black/10 text-gray-500'}`}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Temp',     val: `${dv(temp)}°`,    sub: '°C · Internal', from: 'from-rose-500',    to: 'to-pink-500',   lc: dm ? 'text-rose-400'    : 'text-rose-600' },
            { label: 'Humidity', val: `${dv(hum, 0)}%`,  sub: '% · Internal',  from: 'from-emerald-500', to: 'to-teal-500',   lc: dm ? 'text-emerald-400' : 'text-emerald-600' },
            { label: 'Weight',   val: `${dv(weight)}`,   sub: 'kg',            from: 'from-amber-500',   to: 'to-yellow-500', lc: dm ? 'text-amber-400'   : 'text-amber-600' },
          ].map(({ label, val, sub, from, to, lc }) => (
            <div key={label} className={`rounded-xl p-3 ${dm ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
              <p className={`text-[9px] uppercase tracking-widest font-bold mb-0.5 ${lc}`}>{label}</p>
              <p className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-br ${from} ${to}`}>{val}</p>
              <p className={`text-[9px] ${t.textMuted}`}>{sub}</p>
            </div>
          ))}
          <div className={`rounded-xl p-3 ${dm ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: batColor }}>Battery</p>
            <p className="text-lg font-black" style={{ color: batColor }}>{Math.round(bat)}%</p>
            <div className={`mt-1 h-1.5 rounded-full ${dm ? 'bg-white/10' : 'bg-black/10'}`}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(bat, 100)}%`, backgroundColor: batColor }} />
            </div>
          </div>
        </div>
        <div className={`relative px-4 py-2.5 border-t ${t.divider} flex items-center justify-between`}>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3 h-3 ${t.textMuted}`} />
            <span className={`text-[10px] font-medium ${t.textMuted}`}>{formatTimeAgo(lastTs)}</span>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${dm ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-500/15 text-amber-700'}`}>View Details →</span>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 opacity-60" />
      </div>
    );
  };

  const ApiarySidebar = () => (
    <div className="hidden lg:block w-72 flex-shrink-0">
      <div className={`rounded-2xl shadow-xl ${t.card} p-5 sticky top-24`}>
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${t.text}`}><Filter className="w-4 h-4" /> Select Apiary</h3>
        <div className="relative mb-3">
          <input type="text" placeholder="Search apiary…" value={apiarySearchQuery} onChange={e => setApiarySearchQuery(e.target.value)}
            className={`w-full px-4 py-2.5 pl-9 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
          <Search className={`absolute left-3 top-3 w-3.5 h-3.5 ${t.textMuted}`} />
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {availableContainers
            .filter(c => getApiaryName(c).toLowerCase().includes(apiarySearchQuery.toLowerCase()) || c.toLowerCase().includes(apiarySearchQuery.toLowerCase()))
            .map(c => (
              <button key={c} onClick={() => { setSelectedContainer(c); setSelectedHive(null); setApiarySearchQuery(''); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedContainer === c
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-400/30'
                  : `${t.text} ${dm ? 'hover:bg-white/5 border border-white/5' : 'hover:bg-black/5 border border-black/5'}`}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedContainer === c ? 'bg-white/20' : (dm ? 'bg-amber-900/30' : 'bg-amber-50')}`}><span className="text-base">🐝</span></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{getApiaryName(c)}</p>
                    <p className={`text-xs mt-0.5 ${selectedContainer === c ? 'text-white/70' : t.textMuted}`}>{selectedContainer === c && totalHives > 0 ? `${totalHives} hives` : c}</p>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );

  const ApiarySheet = () => (
    <>
      {apiarySheetOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setApiarySheetOpen(false)} />}
      <div className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transform transition-transform duration-300 ${apiarySheetOpen ? 'translate-y-0' : 'translate-y-full'} ${t.sheet} rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col`}>
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-4 flex-shrink-0" />
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider} flex-shrink-0`}>
          <h3 className={`text-base font-bold flex items-center gap-2 ${t.text}`}><Filter className="w-4 h-4" /> Select Apiary</h3>
          <button onClick={() => setApiarySheetOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 flex-shrink-0">
          <div className="relative">
            <input type="text" placeholder="Search apiary…" value={apiarySearchQuery} onChange={e => setApiarySearchQuery(e.target.value)}
              className={`w-full px-4 py-2.5 pl-9 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
            <Search className={`absolute left-3 top-3 w-3.5 h-3.5 ${t.textMuted}`} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 space-y-2" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
          {availableContainers
            .filter(c => getApiaryName(c).toLowerCase().includes(apiarySearchQuery.toLowerCase()) || c.toLowerCase().includes(apiarySearchQuery.toLowerCase()))
            .map(c => (
              <button key={c} onClick={() => { setSelectedContainer(c); setSelectedHive(null); setApiarySearchQuery(''); setApiarySheetOpen(false); }}
                className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${selectedContainer === c
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-400/30'
                  : `${t.text} ${dm ? 'hover:bg-white/5 border border-white/5' : 'hover:bg-black/5 border border-black/5'}`}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedContainer === c ? 'bg-white/20' : (dm ? 'bg-amber-900/30' : 'bg-amber-50')}`}><span className="text-base">🐝</span></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{getApiaryName(c)}</p>
                    <p className={`text-xs mt-0.5 ${selectedContainer === c ? 'text-white/70' : t.textMuted}`}>{selectedContainer === c && totalHives > 0 ? `${totalHives} hives` : c}</p>
                  </div>
                  {selectedContainer === c && <Check className="w-4 h-4 text-white flex-shrink-0" />}
                </div>
              </button>
            ))}
        </div>
      </div>
    </>
  );

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/40" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${t.sidebar} shadow-2xl flex flex-col`}>
        <div className={`px-6 flex items-center justify-between border-b ${t.divider}`}
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: 16 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg text-xl">🐝</div>
            <h2 className={`text-sm font-black tracking-tight ${t.text}`}>NahalAI</h2>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-3">
          <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.textMuted}`}>Navigation</p>
          {[
            { label: 'Home',      icon: Home,            action: () => { router.push('/welcome'); setSidebarOpen(false); } },
            { label: 'Dashboard', icon: LayoutDashboard, action: () => { setCurrentView('dashboard'); setSelectedHive(null); setSidebarOpen(false); } },
            { label: 'Alerts',    icon: Bell,            action: () => { setCurrentView('alerts'); setSelectedHive(null); setSidebarOpen(false); } }, // ← NEW
            { label: 'Purchase',  icon: ShoppingCart,    action: () => { router.push('/order'); setSidebarOpen(false); } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                (item.label === 'Alerts' && currentView === 'alerts') || (item.label === 'Dashboard' && currentView === 'dashboard' && selectedHive === null)
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 ' + (dm ? 'text-amber-300' : 'text-amber-700')
                  : t.text + ' ' + (dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50')
              }`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
          {userRole === 'admin' && (
            <button onClick={() => { router.push('/admin/access-management'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 ${dm ? 'text-amber-300' : 'text-amber-700'} hover:from-amber-500/30 hover:to-yellow-500/30`}>
              <ShieldCheck className="w-4 h-4" />Admin Panel
            </button>
          )}
          {availableContainers.length > 1 && (
            <button onClick={() => { setApiarySheetOpen(true); setSidebarOpen(false); }}
              className={`lg:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.text} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <Filter className="w-4 h-4" />Switch Apiary
            </button>
          )}
        </nav>
        <div className={`px-4 border-t ${t.divider} space-y-2`} style={{ paddingTop: 16, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
          <button onClick={() => setDarkMode(!dm)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {dm ? <SunMedium className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}{dm ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={async () => {
  await clearPushToken();
  await fetch('/api/auth/logout', { method: 'POST' });
  router.push('/');
}}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>
    </>
  );

  // ─── Guards ───────────────────────────────────────────────────────────────────
  if (!mounted || (loading && !hasAccess && !authError)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-gray-950' : 'bg-amber-50'}`}>
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className={`absolute inset-0 border-2 rounded-full ${dm ? 'border-gray-800' : 'border-amber-200'}`} />
            <div className="absolute inset-0 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🐝</div>
          </div>
          <p className={`text-xl font-bold mb-1 ${dm ? 'text-white' : 'text-gray-900'}`}>Loading Smart Hive</p>
          <p className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Connecting to your hives…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${dm ? 'bg-gray-950' : 'bg-amber-50'}`}>
        <div className={`rounded-3xl shadow-2xl p-10 max-w-md w-full ${t.card}`}>
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className={`text-2xl font-black mb-3 text-center ${t.text}`}>Access Error</h2>
          <p className={`text-center mb-6 text-sm ${t.textSub}`}>{authError}</p>
          <button onClick={() => { setAuthError(null); setLoading(true); checkAccess(); }}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const chartData   = selectedHive ? buildChartData(selectedHive) : [];
  const activeHives = hiveNumbers.filter(isHiveActive).length;
  const hiveStatVal = (getter: (item: SensorData) => number | null): number | null =>
    selectedHive ? getLastValidForHive(latestData, historicalData, selectedHive, hiveIds, getter) : null;

  const TIME_FILTERS = [
    { key: '1h', label: '1H' }, { key: '6h', label: '6H' }, { key: '24h', label: '24H' },
    { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: 'all', label: 'All' },
  ];

  return (
    <div className="min-h-screen relative transition-colors duration-300">
      <div className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ backgroundImage: "url('/bee.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className={`absolute inset-0 ${dm ? 'bg-black/40' : 'bg-white/20'}`} />
      </div>

      {/* Rename modal */}
      {editingHive !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl shadow-2xl p-6 max-w-md w-full ${dm ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <h3 className={`text-xl font-bold mb-4 ${t.text}`}>Rename Hive {editingHive}</h3>
            <input type="text" value={tempName} onChange={e => setTempName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveHiveName(editingHive, tempName); if (e.key === 'Escape') setEditingHive(null); }}
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none mb-4 ${t.input}`}
              placeholder="Enter hive name" autoFocus />
            <div className="flex gap-3">
              <button onClick={() => saveHiveName(editingHive, tempName)}
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />Save
              </button>
              <button onClick={() => setEditingHive(null)}
                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${dm ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                <XCircle className="w-4 h-4" />Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar />
      <ApiarySheet />

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header 
  className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/30 border-b border-white/10' : 'bg-white/20 border-b border-white/30'} backdrop-blur-xl`}
  style={{ 
    paddingTop: 'env(safe-area-inset-top, 0px)',
    marginTop: '-env(safe-area-inset-top, 0px)',
    backgroundClip: 'padding-box',
  }}>

         

          <div className="flex items-center justify-between px-4 sm:px-5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}><Menu className="w-5 h-5" /></button>
              {(selectedHive || currentView === 'alerts') && (
                <button onClick={() => { setSelectedHive(null); setCurrentView('dashboard'); }} className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}><ArrowLeft className="w-5 h-5" /></button>
              )}
              <div className={`w-px h-5 flex-shrink-0 ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-sm flex-shrink-0">🐝</div>
                <h1 className={`text-sm font-black tracking-tight truncate ${t.text}`}>NahalAI</h1>
                {currentView === 'alerts' && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dm ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>Alerts</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {availableContainers.length > 1 && !selectedHive && currentView === 'dashboard' && (
                <button onClick={() => setApiarySheetOpen(true)}
                  className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold max-w-[120px] ${dm ? 'bg-amber-950/60 text-amber-300 border border-amber-900/60' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <span className="truncate">{getApiaryName(selectedContainer) || 'Apiary'}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                </button>
              )}
              
              <button onClick={() => setDarkMode(!dm)} className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {currentView === 'dashboard' && (
                <button onClick={fetchData} disabled={isRefreshing}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md font-semibold text-xs disabled:opacity-60 hover:from-amber-600 hover:to-yellow-600 transition-all">
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── ALERTS VIEW ── */}
        {currentView === 'alerts' && (
          <AlertConfigPage
            containerId={selectedContainer}
            totalHives={totalHives}
            isDarkMode={dm}
            onBack={() => setCurrentView('dashboard')}
            getHiveName={getHiveName}
          />
        )}

        {/* ── DASHBOARD VIEW ── */}
        {currentView === 'dashboard' && (
          <main className="flex-1 px-4 py-5 md:px-6 lg:px-8 max-w-screen-2xl mx-auto w-full">

            {/* ── OVERVIEW (no hive selected) ── */}
            {selectedHive === null && (
              <>
                <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md text-xl">🐝</div>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                      </div>
                      <h2 className={`text-sm font-black ${t.text}`}>{getApiaryName(selectedContainer) || 'My Apiary'}</h2>
                    </div>
                    <div className="flex gap-2">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl flex-1 sm:flex-none ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                        <Activity className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                        <div>
                          <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Active</p>
                          <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{activeHives} / {totalHives}</p>
                        </div>
                      </div>
                      {lastUpdated && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl flex-1 sm:flex-none ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                          <Clock className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                          <div>
                            <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Updated</p>
                            <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{formatTimeAgo(lastUpdated)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-5 lg:gap-6">
                  {availableContainers.length > 1 && <ApiarySidebar />}
                  <div className="flex-1 min-w-0">
                    <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-widest ${t.textSub}`}>Filter</span>
                        {(['all', 'active', 'inactive'] as const).map(f => (
                          <button key={f} onClick={() => setFilterStatus(f)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all capitalize ${filterStatus === f ? t.pillActive : t.pill}`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h2 className={`text-3xl sm:text-4xl font-black mb-2 ${t.text}`}>All Hives</h2>
                      <p className={`text-sm ${t.textSub}`}>Tap any hive to view detailed analytics</p>
                    </div>

                    {hiveNumbers.length === 0 ? (
                      <div className={`rounded-2xl shadow-md ${t.card} p-16 text-center`}>
                        <div className="text-6xl mb-4">🐝</div>
                        <h3 className={`text-xl font-bold mb-2 ${t.text}`}>No Hives Found</h3>
                        <p className={`text-sm ${t.textSub}`}>No sensor data available. Check your sensor connections.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                        {hiveNumbers
                          .filter(n => filterStatus === 'all' || (filterStatus === 'active' ? isHiveActive(n) : !isHiveActive(n)))
                          .map(n => <HiveRect key={n} hiveNumber={n} />)}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── HIVE DETAIL ── */}
            {selectedHive !== null && (
              <>
                <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md font-black text-white text-lg">{selectedHive}</div>
                        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isHiveActive(selectedHive) ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                      </div>
                      <div>
                        <h2 className={`text-sm font-black ${t.text}`}>{getHiveName(selectedHive)}</h2>
                        <p className={`text-xs ${t.textSub}`}>{getApiaryName(selectedContainer)} · {isHiveActive(selectedHive) ? 'Active' : 'Inactive'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl flex-1 sm:flex-none ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                        <Clock className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                        <div>
                          <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Last Reading</p>
                          <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{formatTimeAgo(getLastHiveReading(selectedHive))}</p>
                        </div>
                      </div>
                      <button onClick={() => { setEditingHive(selectedHive); setTempName(getHiveName(selectedHive)); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}>
                        <Edit2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Rename</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 mb-5">
                  <StatCard icon={Thermometer} title="Temp Int"  value={hiveStatVal(i => getTemperature(i, 'internal'))?.toFixed(1) ?? '0'} unit="°C" gradient="from-rose-500 to-pink-500" />
                  <StatCard icon={Thermometer} title="Temp Ext"  value={hiveStatVal(i => getTemperature(i, 'external'))?.toFixed(1) ?? '0'} unit="°C" gradient="from-orange-500 to-red-500" />
                  <StatCard icon={Droplets}    title="Humidity"  value={hiveStatVal(i => getHumidity(i, 'internal'))?.toFixed(0) ?? '0'}    unit="%"  gradient="from-emerald-500 to-teal-500" />
                  <StatCard icon={Activity}    title="Weight"    value={hiveStatVal(getWeight)?.toFixed(1) ?? '0'}                          unit="kg" gradient="from-amber-500 to-yellow-500" />
                  <StatCard icon={Zap}         title="Battery"   value={(hiveStatVal(getBattery) ?? 100).toFixed(0)}                        unit="%"  gradient="from-sky-500 to-cyan-500" />
                </div>

                <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md flex-shrink-0"><BarChart3 className="w-4 h-4 text-white" /></div>
                      <div>
                        <h2 className={`text-sm font-bold ${t.text}`}>Time Range</h2>
                        <p className={`text-xs ${t.textSub}`}>{chartData.length} points shown</p>
                      </div>
                    </div>
                    <button onClick={() => setShowDatePicker(!showDatePicker)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all self-start sm:self-auto ${showDatePicker ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md' : dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <Calendar className="w-3.5 h-3.5" />Custom Range
                    </button>
                  </div>
                  {showDatePicker && (
                    <div className={`mb-4 p-4 rounded-xl border ${t.divider} ${dm ? 'bg-white/5' : 'bg-white/30'}`}>
                      <div className="flex flex-col sm:flex-row items-end gap-4">
                        {[{ label: 'Start Date', val: startDate, set: setStartDate }, { label: 'End Date', val: endDate, set: setEndDate }].map(({ label, val, set }) => (
                          <div key={label} className="flex-1 w-full">
                            <label className={`block text-xs font-semibold mb-2 ${t.textSub}`}>{label}</label>
                            <input type="date" value={val} onChange={e => set(e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:outline-none ${t.input}`} />
                          </div>
                        ))}
                        <button onClick={() => { setStartDate(''); setEndDate(''); }} className={`px-4 py-2 rounded-lg font-semibold text-xs ${dm ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'}`}>Clear</button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {TIME_FILTERS.map(({ key, label }) => (
                      <button key={key} onClick={() => { setTimeFilter(key); setStartDate(''); setEndDate(''); setShowDatePicker(false); }}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-bold text-xs transition-all ${timeFilter === key ? t.pillActive : t.pill}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
                  <TemperatureChart data={chartData} />
                  <ChartCard title="Humidity" dataKey="humidity" dataKey2="humidityExt" color="#10b981" color2="#06b6d4" unit="%" icon={Droplets} data={chartData} gradient="from-emerald-500 to-teal-500" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
                  <ChartCard title="Hive Weight"   dataKey="weight"  color="#f59e0b" unit="kg" icon={Activity} data={chartData} gradient="from-amber-500 to-yellow-500" />
                  <ChartCard title="Battery Level" dataKey="battery" color="#3b82f6" unit="%" icon={Zap}      data={chartData} gradient="from-sky-500 to-blue-500" />
                </div>

                {selectedHive === 1 && <div className="mb-5"><GasChartCard /></div>}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
                  <HealthRadial hiveNum={selectedHive} />
                  <div className={`rounded-2xl shadow-md ${t.card} overflow-hidden flex flex-col`} style={{ minHeight: 380 }}>
                    <div className={`p-4 border-b ${t.divider} flex items-center gap-3`}>
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md flex-shrink-0"><MapPin className="w-4 h-4 text-white" /></div>
                      <div className="min-w-0">
                        <h3 className={`text-sm sm:text-base font-bold truncate ${t.text}`}>{getApiaryName(selectedContainer)} · Locations</h3>
                        <p className={`text-xs ${t.textMuted}`}>{apiaryLocation ? `${apiaryLocation.lat.toFixed(5)}, ${apiaryLocation.lon.toFixed(5)}` : 'Location not configured'}</p>
                      </div>
                    </div>
                    <div className="flex-1" style={{ minHeight: 300 }}>
                      <LocationMap apiaryLocation={apiaryLocation} hiveCount={totalHives} isDarkMode={dm} />
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl shadow-md ${t.card} overflow-hidden mb-5`}>
                  <div className={`px-5 py-4 border-b ${t.divider} flex items-center gap-3`}>
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-md flex-shrink-0"><Activity className="w-4 h-4 text-white" /></div>
                    <div>
                      <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Historical Readings</h3>
                      <p className={`text-xs ${t.textSub}`}>{chartData.length} points · latest 10 shown</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className={t.tableHead}>
                          {['Time', 'Temp (Int)', 'Temp (Ext)', 'Humidity', 'Hum (Ext)', 'Weight', 'Battery'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${t.divider}`}>
                        {chartData.slice().reverse().slice(0, 10).map((row, i) => (
                          <tr key={i} className={`transition-colors ${t.tableRow}`}>
                            <td className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${t.text}`}>
                              {row.time ? new Date(row.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            {[
                              row.temp    != null ? `${(row.temp    as number).toFixed(1)}°C` : '—',
                              row.tempExt != null ? `${(row.tempExt as number).toFixed(1)}°C` : '—',
                              row.humidity    != null ? `${(row.humidity    as number).toFixed(0)}%` : '—',
                              row.humidityExt != null ? `${(row.humidityExt as number).toFixed(0)}%` : '—',
                              row.weight  != null ? `${(row.weight  as number).toFixed(2)} kg` : '—',
                              row.battery != null ? `${(row.battery as number).toFixed(0)}%`  : '—',
                            ].map((val, j) => (
                              <td key={j} className={`px-4 py-3 text-xs ${t.textSub}`}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </main>
        )}
      </div>

      {!loading && hasAccess && currentView === 'dashboard' && (
        <SmartHiveAIAssistant
          latestData={latestData} historicalData={historicalData}
          selectedContainer={selectedContainer} totalHives={totalHives}
          activatedHives={activeHives} isDarkMode={dm} t={t}
        />
      )}
    </div>
  );
};

export default SmartHiveDashboard;
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis, ComposedChart, Line, Legend
} from 'recharts';
import {
  Activity, RefreshCw, AlertCircle, Menu, X, Home, BarChart3, Clock,
  ArrowLeft, LogOut, Calendar, Zap, Moon, SunMedium, Edit2, Check,
  XCircle, Search, Filter, ShoppingCart, LayoutDashboard, Thermometer,
  MapPin, Wind, Droplets, ChevronDown, MessageSquare, Send, Loader2, Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';

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
  H2S?: any; CO2?: any; O2?: any; eCO2?: any; TVOC?: any; CO?: any; NH3?: any; NO2?: any; VOCindex?: any; VOCs?: any;
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
const toNumber = (value: any): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'nan' || lower === 'null' || lower === 'undefined') return 0;
    const p = parseFloat(value);
    return isNaN(p) ? null : p;
  }
  return null;
};

const getTemperature = (item: any, type: 'internal' | 'external'): number | null => {
  if (!item) return null;
  const v = type === 'internal'
    ? (item.int_temp ?? item.temp_internal ?? item.temp_inte ?? item.Internal_temp ?? item.tempInternal)
    : (item.ext_temp ?? item.temp_external ?? item.temp_exte ?? item.external_temp ?? item.tempExternal);
  const n = toNumber(v);
  if (n == null || n < -50 || n > 100) return null;
  return n;
};

const getHumidity = (item: any, type: 'internal' | 'external'): number | null => {
  if (!item) return null;
  const v = type === 'internal'
    ? (item.int_hum ?? item.hum_internal ?? item.Internal_hum ?? item.humidity_internal ?? item.humInternal ?? item.inte_hum)
    : (item.ext_hum ?? item.hum_external ?? item.external_hum ?? item.humidity_external ?? item.humExternal ?? item.exte_hum);
  const n = toNumber(v);
  if (n == null || n < 0 || n > 150) return null;
  return n;
};

const getWeight = (item: any): number | null => {
  if (!item) return null;
  const v = item.weight ?? item.Weight ?? item.weight_kg;
  const n = toNumber(v);
  if (n == null || n < 0 || n > 500) return null;
  return n;
};

const getBattery = (item: any): number | null => {
  if (!item) return null;
  const v = item.battery ?? item.Battery ?? item.battery_level ?? item.bat ?? item.batt;
  const n = toNumber(v);
  if (n == null || n < 0 || n > 200) return null;
  return n;
};

const getTimestamp = (item: any): string | null =>
  item?.timestamp ?? item?._metadata?.lastModified ?? null;

const getUniqueHiveIds = (data: SensorData[]): (number | string)[] => {
  if (!data || data.length === 0) return [];
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
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
};

const getHiveDataById = (data: SensorData[], hiveId: number | string): SensorData[] => {
  if (!data || data.length === 0) return [];
  return data
    .filter(item => {
      const raw = item.id ?? item.ID ?? item.hive_id ?? item.hiveId;
      if (raw == null) return false;
      const n = toNumber(raw);
      const normalized = n !== null ? n : String(raw);
      return normalized === hiveId;
    })
    .sort((a, b) =>
      new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime()
    );
};

const getHiveDataByIndex = (data: SensorData[], hiveNumber: number): SensorData[] => {
  if (!data || data.length === 0) return [];
  const groups = new Map<string, SensorData[]>();
  data.forEach(item => {
    const ts = getTimestamp(item) ?? 'unknown';
    const key = ts === 'unknown' ? `unknown-${Math.random()}` : new Date(ts).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  const result: SensorData[] = [];
  groups.forEach(items => {
    const idx = hiveNumber - 1;
    if (items[idx]) result.push(items[idx]);
  });
  return result.sort((a, b) =>
    new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime()
  );
};

const getHiveData = (data: SensorData[], hiveIndex: number, hiveIds: (number | string)[]): SensorData[] => {
  if (hiveIds.length > 0) {
    const id = hiveIds[hiveIndex - 1];
    return id !== undefined ? getHiveDataById(data, id) : [];
  }
  return getHiveDataByIndex(data, hiveIndex);
};

const getHiveCount = (data: SensorData[]): number => {
  if (!data || data.length === 0) return 0;
  const ids = getUniqueHiveIds(data);
  if (ids.length > 0) return ids.length;
  const counts = new Map<string, number>();
  data.forEach(item => {
    const key = getTimestamp(item) ?? `u${Math.random()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Math.max(...Array.from(counts.values()), 0);
};

const getLastValidForHive = (
  latestData: SensorData[],
  historicalData: SensorData[],
  hiveIndex: number,
  hiveIds: (number | string)[],
  getter: (item: SensorData) => number | null
): number | null => {
  const combined = getHiveData([...historicalData, ...latestData], hiveIndex, hiveIds);
  for (let i = combined.length - 1; i >= 0; i--) {
    const val = getter(combined[i]);
    if (val !== null) return val;
  }
  return null;
};

const formatTimeAgo = (timestamp: string | null): string => {
  if (!timestamp) return 'No data';
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch { return 'No data'; }
};

const formatXAxisDate = (dateString: string, filter: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  if (filter === '1h' || filter === '6h' || filter === '24h')
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const generateGasData = (points = 48) => {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - i) * 3600000);
    const isDay = t.getHours() >= 6 && t.getHours() <= 18;
    const spike = Math.random() > 0.95;
    return {
      time: t.toISOString(),
      H2S:  +(2 + Math.random() * 3 + (spike ? 10 : 0)).toFixed(2),
      CO2:  +(isDay ? 800 + Math.random() * 400 : 600 + Math.random() * 200).toFixed(0),
      O2:   +(20.5 + Math.random() * 0.8 - 0.4).toFixed(2),
      NH3:  +(15 + Math.random() * 12).toFixed(2),
      TVOC: +(isDay ? 150 + Math.random() * 130 : 80 + Math.random() * 70).toFixed(0),
    };
  });
};

// ─── Map ──────────────────────────────────────────────────────────────────────
const LocationMapInner = ({
  apiaryLocation, hiveCount, isDarkMode,
}: {
  apiaryLocation: { lat: number; lon: number; address?: string } | null;
  hiveCount: number;
  isDarkMode: boolean;
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!apiaryLocation || !mapRef.current) return;
    let mounted = true;
    const init = async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css' as any);
        if (!mounted || !mapRef.current) return;
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        const map = L.map(mapRef.current, { center: [apiaryLocation.lat, apiaryLocation.lon], zoom: 15 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors', maxZoom: 19,
        }).addTo(map);
        mapInstanceRef.current = map;
        const palette = ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899'];
        Array.from({ length: hiveCount }, (_, i) => {
          const angle = (2 * Math.PI * i) / Math.max(hiveCount, 1);
          const offset = hiveCount > 1 ? 0.0002 : 0;
          const lat = apiaryLocation.lat + (i === 0 ? 0 : offset * Math.cos(angle));
          const lon = apiaryLocation.lon + (i === 0 ? 0 : offset * Math.sin(angle));
          const color = palette[i % palette.length];
          const icon = L.divIcon({
            html: `<div style="width:32px;height:32px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3)">${i + 1}</div>`,
            className: '', iconSize: [32, 32], iconAnchor: [16, 16],
          });
          L.marker([lat, lon], { icon }).addTo(map)
            .bindPopup(`<b>Hive ${i + 1}</b>${apiaryLocation.address ? `<br>${apiaryLocation.address}` : ''}`);
        });
      } catch (e) { console.error('Map error', e); }
    };
    init();
    return () => {
      mounted = false;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
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
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  ),
});

// ─── AI Assistant ─────────────────────────────────────────────────────────────
// FIX: The keyboard-dismiss bug was caused by InputBar being defined INSIDE
// the component function, making React recreate the DOM node on every keystroke.
// Solution: hoist InputBar outside, pass props. Also fix safe area for FAB.

interface AIAssistantProps {
  latestData: SensorData[];
  historicalData: SensorData[];
  selectedContainer: string;
  totalHives: number;
  activatedHives: number;
  isDarkMode: boolean;
  t: any;
}

// Standalone InputBar — defined at module level so it never gets remounted.
// FIX: we use a ref to hold the latest inputMessage value so the send button
// always reads the current text even if the useCallback closure is stale.
const AIInputBar = ({
  inputMessage, setInputMessage, onSend, isLoading, isDarkMode,
}: {
  inputMessage: string;
  setInputMessage: (v: string) => void;
  onSend: (text: string) => void;  // FIX: accept text directly — no closure needed
  isLoading: boolean;
  isDarkMode: boolean;
}) => {
  // Local ref always holds the latest value typed into the input
  const localValueRef = useRef(inputMessage);
  localValueRef.current = inputMessage;

  const handleSend = () => {
    const text = localValueRef.current.trim();
    if (!text || isLoading) return;
    onSend(text);          // pass text explicitly — bypasses stale closure
    setInputMessage('');   // clear after send
  };

  return (
    <div
      className={`p-3 border-t flex-shrink-0 ${isDarkMode ? 'bg-gray-900/80 border-white/10' : 'bg-white border-amber-100'}`}
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your hives…"
          disabled={isLoading}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`flex-1 min-w-0 px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 text-sm ${
            isDarkMode
              ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400'
              : 'bg-gray-50 border-amber-200 text-gray-800 placeholder-gray-400'
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!inputMessage.trim() || isLoading}
          className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:from-amber-600 hover:to-yellow-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      <p className={`text-[10px] mt-2 text-center font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        AI responses may take a few seconds
      </p>
    </div>
  );
};

const SmartHiveAIAssistant = ({
  latestData, historicalData, selectedContainer,
  totalHives, activatedHives, isDarkMode, t,
}: AIAssistantProps) => {
  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const messagesEndRef                = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Lock body scroll while open on mobile
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Welcome message — only set once
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1', role: 'assistant', timestamp: new Date(),
        content: `👋 Hello! I'm your Smart Hive AI Assistant. I can help you analyze your ${totalHives} hive${totalHives !== 1 ? 's' : ''} and provide insights.\n\nYou can ask:\n• "How are my hives performing?"\n• "Which hive has the lowest battery?"\n• "Any concerning readings?"\n\nWhat would you like to know?`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prepareContextData = useCallback(() => {
    const hiveStats = new Map();
    latestData.forEach((item, index) => {
      hiveStats.set(index + 1, {
        temperature_internal: item.temp_internal || null,
        temperature_external: item.temp_external || null,
        humidity_internal: item.hum_internal || null,
        humidity_external: item.hum_external || null,
        weight: item.weight || null,
        battery: item.battery || 100,
        timestamp: item.timestamp || item._metadata?.lastModified,
      });
    });
    return {
      apiary: selectedContainer, totalHives, activatedHives,
      hiveStats: Array.from(hiveStats.entries()).map(([num, stats]) => ({ hiveNumber: num, ...stats })),
      dataPoints: { latest: latestData.length, historical: historicalData.length },
    };
  }, [latestData, historicalData, selectedContainer, totalHives, activatedHives]);

  // FIX: sendMessage always receives text as argument — never reads from state.
  // This eliminates the stale-closure bug where the button would send empty string.
  const sendMessage = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || isLoading) return;

    const userMsg: AIMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const contextData = prepareContextData();
      const systemPrompt = `You are a helpful beekeeping AI assistant analyzing smart hive sensor data. You have access to real-time data from ${totalHives} beehives in the "${selectedContainer}" apiary.\n\nCurrent Data:\n${JSON.stringify(contextData, null, 2)}\n\nGuidelines:\n- Provide clear, actionable insights\n- Alert users to concerning readings (temp outside 32-36°C, battery <30%, rapid weight loss)\n- Be concise but informative\n- Use emojis sparingly (🐝, 📊, ⚠️, ✅)`;

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant', timestamp: new Date(),
        content: data.content[0].text,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant', timestamp: new Date(),
        content: '❌ Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, prepareContextData, selectedContainer, totalHives]);

  const quickActions = [
    { label: 'Overall Status',  prompt: 'Give me an overview of all my hives' },
    { label: 'Alerts',          prompt: 'Are there any concerning readings?' },
    { label: 'Compare Hives',   prompt: 'Compare the performance of all my hives' },
    { label: 'Battery Status',  prompt: 'Check battery levels across all hives' },
  ];

  const ChatHeader = () => (
    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-white/20 p-2 rounded-xl flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-white text-base leading-tight">AI Hive Assistant</h3>
          <p className="text-xs text-white/80 font-medium">Powered by Groq · {totalHives} hive{totalHives !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0 ml-2">
        <X className="w-5 h-5 text-white" />
      </button>
    </div>
  );

  const QuickActions = () => (
    <div className={`p-3 border-b flex-shrink-0 ${isDarkMode ? 'bg-gray-800/60 border-white/10' : 'bg-amber-50/80 border-amber-100'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-300' : 'text-amber-600'}`}>Quick Actions</p>
      <div className="grid grid-cols-2 gap-1.5">
        {quickActions.map((action, i) => (
          <button key={i} onClick={() => { setInputMessage(''); sendMessage(action.prompt); }}
            className={`text-xs px-3 py-2 border rounded-xl transition-all font-semibold text-left leading-tight ${
              isDarkMode
                ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400 shadow-sm'
            }`}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );

  const MessageList = () => (
    <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-gray-900/60' : 'bg-gray-50/80'}`}>
      {messages.map(message => (
        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
            message.role === 'user'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/20'
              : isDarkMode
                ? 'bg-gray-800/80 border border-white/10 text-gray-100'
                : 'bg-white border border-amber-100 text-gray-800 shadow-sm'
          }`}>
            {message.role === 'assistant' && (
              <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${isDarkMode ? 'border-white/10' : 'border-amber-100'}`}>
                <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>AI Assistant</span>
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            <p className={`text-[10px] mt-2 ${message.role === 'user' ? 'text-white/70' : isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      <div ref={messagesEndRef} />
    </div>
  );

  return (
    <>
      {/* FAB — FIX: bottom accounts for safe area + Android nav bar (80px total) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 sm:right-6 z-50 w-14 h-14 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-full shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all duration-300 hover:scale-110 flex items-center justify-center group"
          style={{ bottom: 'max(80px, calc(env(safe-area-inset-bottom, 20px) + 60px))' }}
          aria-label="Open AI assistant"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
          <span className="hidden sm:block absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Ask about your hives 🐝
          </span>
        </button>
      )}

      {/* Mobile full-screen bottom sheet */}
      {isOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-shrink-0 bg-black/50 backdrop-blur-sm" style={{ height: '8vh' }} onClick={() => setIsOpen(false)} />
          <div
            className={`flex flex-col rounded-t-3xl overflow-hidden shadow-2xl border-t border-l border-r ${isDarkMode ? 'bg-gray-900 border-white/10' : 'bg-white border-white/50'}`}
            style={{ height: '92vh' }}
          >
            <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
              <div className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
            </div>
            <ChatHeader />
            {messages.length <= 1 && <QuickActions />}
            <MessageList />
            {/* FIX: use the hoisted AIInputBar — it never remounts so keyboard stays open */}
            <AIInputBar
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              onSend={sendMessage}
              isLoading={isLoading}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      )}

      {/* Desktop floating panel */}
      {isOpen && (
        <div
          className={`hidden sm:flex fixed bottom-6 right-6 z-50 flex-col rounded-2xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-gray-900/95 border-white/10 backdrop-blur-xl' : 'bg-white/95 border-white/50 backdrop-blur-xl'}`}
          style={{ width: '384px', height: '600px' }}
        >
          <ChatHeader />
          {messages.length <= 1 && <QuickActions />}
          <MessageList />
          <AIInputBar
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSend={sendMessage}
            isLoading={isLoading}
            isDarkMode={isDarkMode}
          />
        </div>
      )}
    </>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const SmartHiveDashboard = () => {
  const router = useRouter();

  const [darkMode, setDarkMode]                       = useState(false);
  const [mounted, setMounted]                         = useState(false);
  const [sidebarOpen, setSidebarOpen]                 = useState(false);
  const [apiarySheetOpen, setApiarySheetOpen]         = useState(false);
  const [selectedHive, setSelectedHive]               = useState<number | null>(null);
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
  const [error, setError]                             = useState<string | null>(null);
  const [isOnline, setIsOnline]                       = useState(true);
  const [isRefreshing, setIsRefreshing]               = useState(false);
  const [lastUpdated, setLastUpdated]                 = useState('');
  const [purchaseInfo, setPurchaseInfo]               = useState<PurchaseInfo | null>(null);
  const [hasAccess, setHasAccess]                     = useState(false);
  const [authError, setAuthError]                     = useState<string | null>(null);
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [apiaryNames, setApiaryNames]                 = useState<Record<string, string>>({});
  const [apiarySearchQuery, setApiarySearchQuery]     = useState('');
  const [apiaryLocation, setApiaryLocation]           = useState<{ lat: number; lon: number; address?: string } | null>(null);
  const [activeGases, setActiveGases]                 = useState<string[]>(['H2S', 'CO2', 'O2', 'NH3', 'TVOC']);
  const [gasData]                                     = useState(() => generateGasData(48));
  const isMountedRef                                  = useRef(true);

  const dm = mounted && darkMode;

  // FIX: dark mode text tokens — gray-400/500 replaced with gray-200/300
  const t = {
    card:       dm ? 'bg-gray-900/40 border border-white/10 backdrop-blur-md' : 'bg-white/40 border border-white/50 backdrop-blur-md',
    text:       dm ? 'text-white'       : 'text-gray-900',
    textSub:    dm ? 'text-gray-200'    : 'text-gray-600',   // was text-gray-400
    textMuted:  dm ? 'text-gray-300'    : 'text-gray-500',   // was text-gray-500
    divider:    dm ? 'border-white/10'  : 'border-black/10',
    input:      dm ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400 focus:ring-amber-500'
                   : 'bg-white/60 border-white/40 text-gray-900 focus:ring-amber-500',
    pill:       dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15',
    pillActive: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
    tableHead:  dm ? 'bg-white/5 text-gray-200'  : 'bg-black/5 text-gray-500',  // was gray-400
    tableRow:   dm ? 'hover:bg-white/5 border-white/10' : 'hover:bg-black/5 border-black/10',
    tooltip:    dm ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
    tooltipText:dm ? '#f3f4f6' : '#1f2937',
    gridStroke: dm ? '#374151' : '#d1d5db',
    axisStroke: dm ? '#d1d5db' : '#111827',
    sidebar:    dm ? 'bg-gray-950 border-r border-gray-800' : 'bg-white border-r border-gray-100',
    sheet:      dm ? 'bg-gray-900 border-t border-white/10' : 'bg-white border-t border-gray-200',
  };

  useEffect(() => {
    const d  = localStorage.getItem('hive-darkMode');
    const an = localStorage.getItem('hive-apiaryNames');
    const hn = localStorage.getItem('hive-hiveNames');
    if (d  === 'true') setDarkMode(true);
    if (an) { try { setApiaryNames(JSON.parse(an)); } catch {} }
    if (hn) { try { setHiveNames(JSON.parse(hn));   } catch {} }
    setMounted(true);
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('hive-darkMode', String(darkMode));
  }, [darkMode, mounted]);

  const checkAccess = useCallback(async () => {
    try {
      const res    = await fetch('/api/smart-hive/check-access', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) { setAuthError('Failed to verify access'); setLoading(false); return; }
      const result = await res.json();
      if (!result.success || !result.hasPurchased)  { setAuthError('No purchase found. Please purchase a plan first.'); setLoading(false); return; }
      if (!result.hasAccess)                         { setAuthError('Access pending admin approval.');                   setLoading(false); return; }
      const purchase   = result.purchase;
      const containers: string[] = purchase.assignedContainers || [];
      setHasAccess(true);
      setPurchaseInfo({ id: purchase.id, masterHives: purchase.masterHives || 0, normalHives: purchase.normalHives || 0, purchaseDate: purchase.purchaseDate, accessGrantedAt: purchase.accessGrantedAt || new Date().toISOString(), assignedContainers: containers });
      setAvailableContainers(containers);
      if (containers.length > 0) setSelectedContainer(prev => containers.includes(prev) ? prev : containers[0]);
    } catch { setAuthError('Network error. Please refresh.'); setLoading(false); }
  }, []);

  useEffect(() => { checkAccess(); }, [checkAccess]);

  useEffect(() => {
    if (!selectedContainer) return;
    const fetchLocation = async () => {
      try {
        const res = await fetch('/api/smart-hive/apiary-locations');
        if (!res.ok) { setApiaryLocation(null); return; }
        const result = await res.json();
        setApiaryLocation(result.success && result.data?.[selectedContainer] ? result.data[selectedContainer] : null);
      } catch { setApiaryLocation(null); }
    };
    fetchLocation();
  }, [selectedContainer]);

  const flattenData = useCallback((data: any): SensorData[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data[0]?.data ? data.flatMap((i: any) => i.data || []) : data;
    if (data.data) return Array.isArray(data.data) ? data.data : [data.data];
    return [data];
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
        const d    = await latRes.value.json();
        const flat = flattenData(d.data ?? d);
        setLatestData(flat);
        const ts = flat.find((i: SensorData) => getTimestamp(i));
        if (ts) setLastUpdated(getTimestamp(ts)!);
        setIsOnline(true); setError(null);
      }
      if (histRes.status === 'fulfilled' && histRes.value.ok) {
        const d = await histRes.value.json();
        setHistoricalData(flattenData(d.data ?? d));
      }
    } catch { setError('Failed to fetch data'); setIsOnline(false); }
    finally { if (isMountedRef.current) { setLoading(false); setIsRefreshing(false); } }
  }, [selectedContainer, flattenData]);

  useEffect(() => {
    if (!selectedContainer) return;
    setLoading(true); setLatestData([]); setHistoricalData([]);
    fetchData();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') fetchData(); }, 300000);
    return () => clearInterval(iv);
  }, [selectedContainer, fetchData]);

  const getHiveName   = useCallback((n: number) => hiveNames[n] || `Hive ${n}`, [hiveNames]);
  const getApiaryName = useCallback((id: string) => apiaryNames[id] || id, [apiaryNames]);

  const hiveIds = useMemo(() => {
    const combined = [...historicalData, ...latestData];
    return getUniqueHiveIds(combined);
  }, [latestData, historicalData]);

  const totalHives = useMemo(() => {
    const fromLatest = getHiveCount(latestData);
    const fromHist   = getHiveCount(historicalData);
    const computed   = Math.max(fromLatest, fromHist);
    if (computed > 0) return computed;
    return purchaseInfo ? purchaseInfo.masterHives + purchaseInfo.normalHives : 0;
  }, [latestData, historicalData, purchaseInfo]);

  const hiveNumbers = useMemo(() => Array.from({ length: totalHives }, (_, i) => i + 1), [totalHives]);

  const isHiveActive = useCallback((hiveNum: number): boolean => {
    const combined = [...historicalData, ...latestData];
    const hiveData = getHiveData(combined, hiveNum, hiveIds);
    if (!hiveData.length) return false;
    const last = hiveData[hiveData.length - 1];
    const ts   = getTimestamp(last);
    if (ts && Date.now() - new Date(ts).getTime() > 4 * 3600000) return false;
    return getTemperature(last, 'internal') !== null || getHumidity(last, 'internal') !== null || getWeight(last) !== null;
  }, [latestData, historicalData, hiveIds]);

  const getLastHiveReading = useCallback((hiveNum: number): string | null => {
    const combined = [...historicalData, ...latestData];
    const all = getHiveData(combined, hiveNum, hiveIds)
      .filter(item => {
        const ts = getTimestamp(item);
        return ts && (getTemperature(item, 'internal') !== null || getHumidity(item, 'internal') !== null || getWeight(item) !== null);
      })
      .sort((a, b) => new Date(getTimestamp(b) ?? 0).getTime() - new Date(getTimestamp(a) ?? 0).getTime());
    return all[0] ? getTimestamp(all[0]) : null;
  }, [latestData, historicalData, hiveIds]);

  const buildChartData = useCallback((hiveNum: number) => {
    const combined = [...historicalData, ...latestData];
    const allData  = getHiveData(combined, hiveNum, hiveIds);
    const seen     = new Set<string>();
    const deduped  = allData.filter(item => {
      const ts = getTimestamp(item) ?? '';
      if (seen.has(ts)) return false;
      seen.add(ts); return true;
    });
    const sorted = deduped.sort((a, b) => new Date(getTimestamp(a) ?? 0).getTime() - new Date(getTimestamp(b) ?? 0).getTime());

    const now      = new Date();
    const filterMs: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
    let filtered   = timeFilter in filterMs
      ? sorted.filter(item => { const ts = getTimestamp(item); return ts && now.getTime() - new Date(ts).getTime() <= filterMs[timeFilter]; })
      : sorted;

    if (startDate || endDate) {
      filtered = filtered.filter(item => {
        const ts = getTimestamp(item); if (!ts) return true;
        const d  = new Date(ts);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate)   { const e = new Date(endDate); e.setHours(23, 59, 59, 999); if (d > e) return false; }
        return true;
      });
    }

    let sampleRate = 1;
    if (filtered.length > 300) sampleRate = Math.ceil(filtered.length / 300);
    const sampled = sampleRate === 1 ? filtered : [
      filtered[0],
      ...filtered.filter((_, i) => i > 0 && i < filtered.length - 1 && i % sampleRate === 0),
      filtered[filtered.length - 1],
    ].filter(Boolean);

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
    const now      = new Date();
    const filterMs: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
    if (timeFilter in filterMs)
      return gasData.filter(d => now.getTime() - new Date(d.time).getTime() <= filterMs[timeFilter]);
    return gasData;
  }, [gasData, timeFilter]);

  const saveHiveName = (hiveNum: number, name: string) => {
    const updated = { ...hiveNames, [hiveNum]: name };
    setHiveNames(updated);
    localStorage.setItem('hive-hiveNames', JSON.stringify(updated));
    setEditingHive(null);
  };

  const tooltipStyle = () => ({
    contentStyle: { backgroundColor: t.tooltip, border: 'none', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '12px' },
    labelStyle:   { fontWeight: 700, color: t.tooltipText, marginBottom: 4 },
    labelFormatter: (v: any) => { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); },
  });

  // ─── Sub-components ───────────────────────────────────────────────────────

  const StatCard = ({ icon: Icon, title, value, unit, gradient }: any) => (
    <div className={`relative overflow-hidden rounded-2xl shadow-md ${t.card} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06]`} />
      <div className="relative p-4 sm:p-5">
        <div className={`inline-flex p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md mb-2 sm:mb-3`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${t.textMuted}`}>{title}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${gradient}`}>
            {value !== null && value !== undefined ? value : '—'}
          </span>
          <span className={`text-xs font-medium ${t.textMuted}`}>{unit}</span>
        </div>
      </div>
      <div className={`h-0.5 bg-gradient-to-r ${gradient} opacity-60`} />
    </div>
  );

  const TemperatureChartCard = ({ data }: { data: any[] }) => (
    <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6 transition-all duration-300 hover:shadow-xl`}>
      <div className="flex items-center mb-4 sm:mb-5 space-x-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-md flex-shrink-0">
          <Thermometer className="w-4 h-4 text-white" />
        </div>
        <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Temperature</h3>
        <div className="ml-auto flex items-center gap-3 text-xs flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-rose-500 rounded" />
            <span className={t.textSub}>Int</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-orange-400" />
            <span className={t.textSub}>Ext</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="grad-temp-int" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f43f5e" stopOpacity={dm ? 0.5 : 0.35} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="grad-temp-ext" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fb923c" stopOpacity={dm ? 0.35 : 0.2} />
              <stop offset="95%" stopColor="#fb923c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} opacity={0.5} />
          <XAxis dataKey="time" stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} interval="preserveStartEnd" minTickGap={50} tickFormatter={v => formatXAxisDate(v, timeFilter)} />
          <YAxis yAxisId="left" stroke="#f43f5e" tick={{ fill: '#f43f5e', fontSize: 10 }} tickMargin={8} width={36} />
          <YAxis yAxisId="right" orientation="right" stroke="#fb923c" tick={{ fill: '#fb923c', fontSize: 10 }} tickMargin={8} width={36} />
          <Tooltip {...tooltipStyle()} formatter={(v: any, name: string) => [`${v} °C`, name === 'temp' ? 'Internal Temp' : 'External Temp']} />
          <Area yAxisId="left" type="monotone" dataKey="temp" stroke="#f43f5e" strokeWidth={2.5} fill="url(#grad-temp-int)" dot={false} activeDot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: '#f43f5e' }} connectNulls />
          <Area yAxisId="right" type="monotone" dataKey="tempExt" stroke="#fb923c" strokeWidth={2} strokeDasharray="6 3" fill="url(#grad-temp-ext)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#fb923c' }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  const ChartCard = ({ title, dataKey, color, unit, icon: Icon, data, gradient, dataKey2, color2 }: any) => (
    <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6 transition-all duration-300 hover:shadow-xl`}>
      <div className="flex items-center mb-4 sm:mb-5 space-x-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={dm ? 0.5 : 0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
            {dataKey2 && (
              <linearGradient id={`grad2-${dataKey2}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color2} stopOpacity={dm ? 0.35 : 0.2} />
                <stop offset="95%" stopColor={color2} stopOpacity={0.02} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} opacity={0.5} />
          <XAxis dataKey="time" stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} interval="preserveStartEnd" minTickGap={50} tickFormatter={v => formatXAxisDate(v, timeFilter)} />
          <YAxis stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} width={36} />
          <Tooltip {...tooltipStyle()} formatter={(v: any, name: string) => [`${v} ${unit}`, name === dataKey ? title : `${title} (Ext.)`]} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#grad-${dataKey})`} dot={false} activeDot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: color }} connectNulls />
          {dataKey2 && <Area type="monotone" dataKey={dataKey2} stroke={color2} strokeWidth={2} strokeDasharray="4 2" fill={`url(#grad2-${dataKey2})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: color2 }} connectNulls />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const GAS_CONFIGS = [
    { key: 'H2S',  name: 'Hydrogen Sulfide', color: '#dc2626', unit: 'ppm' },
    { key: 'CO2',  name: 'CO₂',              color: '#f59e0b', unit: 'ppm' },
    { key: 'O2',   name: 'Oxygen',           color: '#10b981', unit: '%'   },
    { key: 'NH3',  name: 'Ammonia',          color: '#06b6d4', unit: 'ppm' },
    { key: 'TVOC', name: 'Total VOC',        color: '#8b5cf6', unit: 'ppb' },
  ];

  const GasChartCard = () => (
    <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6 transition-all duration-300 hover:shadow-xl`}>
      <div className="flex items-center mb-4 space-x-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md flex-shrink-0">
          <Wind className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Gas Sensor Monitoring</h3>
          <p className={`text-xs ${t.textMuted}`}>Master Hive · Simulated sensor data</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {GAS_CONFIGS.map(g => {
          const active = activeGases.includes(g.key);
          return (
            <button key={g.key} onClick={() => setActiveGases(prev =>
              active ? (prev.length > 1 ? prev.filter(x => x !== g.key) : prev) : [...prev, g.key]
            )} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active ? 'text-white border-transparent' : dm ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-black/10 text-gray-500 hover:bg-black/5'}`}
              style={active ? { backgroundColor: g.color + 'cc', borderColor: g.color } : {}}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
              {g.key}
            </button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={filteredGasData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            {GAS_CONFIGS.map(g => (
              <linearGradient key={g.key} id={`gas-${g.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={g.color} stopOpacity={dm ? 0.4 : 0.25} />
                <stop offset="95%" stopColor={g.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} opacity={0.5} />
          <XAxis dataKey="time" stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} interval="preserveStartEnd" minTickGap={50} tickFormatter={v => formatXAxisDate(v, timeFilter)} />
          <YAxis stroke={t.axisStroke} tick={{ fill: t.axisStroke, fontSize: 10 }} tickMargin={8} width={36} />
          <Tooltip {...tooltipStyle()} formatter={(v: any, name: string) => {
            const g = GAS_CONFIGS.find(x => x.key === name);
            return [`${v} ${g?.unit ?? ''}`, g?.name ?? name];
          }} />
          {GAS_CONFIGS.filter(g => activeGases.includes(g.key)).map(g => (
            <Area key={g.key} type="monotone" dataKey={g.key} stroke={g.color} strokeWidth={2.5}
              fill={`url(#gas-${g.key})`} dot={false} activeDot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: g.color }} connectNulls />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const HealthRadial = ({ hiveNum }: { hiveNum: number }) => {
    const combined = useMemo(() => [...historicalData, ...latestData], []);
    const hiveData = useMemo(() => getHiveData(combined, hiveNum, hiveIds), [hiveNum, combined]);
    const last    = hiveData[hiveData.length - 1];
    const temp    = last ? getTemperature(last, 'internal') : null;
    const hum     = last ? getHumidity(last, 'internal') : null;
    const weights = hiveData.map(d => getWeight(d)).filter((w): w is number => w !== null);
    let score     = 0;
    if (temp !== null) score += temp >= 34 && temp <= 36 ? 25 : temp >= 32 && temp <= 38 ? 15 : 5;
    if (hum  !== null) score += hum  >= 50 && hum  <= 60 ? 20 : hum  >= 45 && hum  <= 70 ? 12 : 4;
    if (weights.length >= 2) {
      const chg = weights[weights.length - 1] - weights[0];
      score += chg > 0 ? 25 : chg > -2 ? 15 : 5;
    } else { score += 15; }
    const ts = last ? getTimestamp(last) : null;
    if (ts) { const hrs = (Date.now() - new Date(ts).getTime()) / 3600000; score += hrs < 1 ? 15 : hrs < 4 ? 10 : hrs < 12 ? 5 : 0; }
    score += 15;
    score  = Math.min(score, 100);
    const status = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Warning' : 'Critical';
    const color  = score >= 85 ? '#10b981'   : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
    const breakdown = [
      { label: 'Temperature',  val: temp !== null ? (temp >= 34 && temp <= 36 ? 25 : 15) : 0, max: 25 },
      { label: 'Humidity',     val: hum  !== null ? (hum  >= 50 && hum  <= 60 ? 20 : 12) : 0, max: 20 },
      { label: 'Weight Trend', val: weights.length >= 2 ? (weights[weights.length - 1] - weights[0] > 0 ? 25 : 15) : 15, max: 25 },
      { label: 'Activity',     val: ts ? ((Date.now() - new Date(ts).getTime()) / 3600000 < 1 ? 15 : 10) : 0, max: 15 },
      { label: 'Stability',    val: 15, max: 15 },
    ];

    return (
      <div className={`rounded-2xl shadow-md ${t.card} p-4 sm:p-6`}>
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
            <Activity className="w-4 h-4 text-white" />
          </div>
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
    const displayVal = (v: number | null, decimals = 1) => v !== null ? v.toFixed(decimals) : '0';

    return (
      <div onClick={() => setSelectedHive(hiveNumber)}
        className={`relative overflow-hidden rounded-2xl shadow-lg ${t.card} cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl group border-2 ${active ? (dm ? 'border-amber-400/40' : 'border-amber-400/60') : (dm ? 'border-white/5' : 'border-black/5')}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/5 group-hover:to-yellow-500/5 transition-all duration-300" />
        <div className={`relative p-4 pb-3 border-b ${t.divider} flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white font-black text-base">{hiveNumber}</span>
            </div>
            <div>
              <p className={`text-sm font-black ${t.text}`}>{getHiveName(hiveNumber)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                <span className={`text-[10px] font-semibold ${active ? (dm ? 'text-emerald-400' : 'text-emerald-600') : t.textMuted}`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); setEditingHive(hiveNumber); setTempName(getHiveName(hiveNumber)); }}
            className={`p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${dm ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-black/10 text-gray-500'}`}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Temp',     val: `${displayVal(temp)}°`,    sub: '°C · Internal', from: 'from-rose-500',    to: 'to-pink-500',    labelColor: dm ? 'text-rose-400'    : 'text-rose-600' },
            { label: 'Humidity', val: `${displayVal(hum, 0)}%`,  sub: '% · Internal',  from: 'from-emerald-500', to: 'to-teal-500',    labelColor: dm ? 'text-emerald-400' : 'text-emerald-600' },
            { label: 'Weight',   val: `${displayVal(weight)}`,   sub: 'kg',            from: 'from-amber-500',   to: 'to-yellow-500',  labelColor: dm ? 'text-amber-400'   : 'text-amber-600' },
          ].map(({ label, val, sub, from, to, labelColor }) => (
            <div key={label} className={`rounded-xl p-3 ${dm ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
              <p className={`text-[9px] uppercase tracking-widest font-bold mb-0.5 ${labelColor}`}>{label}</p>
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
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${t.text}`}>
          <Filter className="w-4 h-4" /> Select Apiary
        </h3>
        <div className="relative mb-3">
          <input type="text" placeholder="Search apiary..." value={apiarySearchQuery}
            onChange={e => setApiarySearchQuery(e.target.value)}
            className={`w-full px-4 py-2.5 pl-9 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
          <Search className={`absolute left-3 top-3 w-3.5 h-3.5 ${t.textMuted}`} />
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {availableContainers
            .filter(c => getApiaryName(c).toLowerCase().includes(apiarySearchQuery.toLowerCase()) || c.toLowerCase().includes(apiarySearchQuery.toLowerCase()))
            .map(container => (
              <button key={container} onClick={() => { setSelectedContainer(container); setSelectedHive(null); setApiarySearchQuery(''); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${selectedContainer === container
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-400/30'
                  : `${t.text} ${dm ? 'hover:bg-white/5 border border-white/5' : 'hover:bg-black/5 border border-black/5'}`}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedContainer === container ? 'bg-white/20' : (dm ? 'bg-amber-900/30' : 'bg-amber-50')}`}>
                    <span className="text-base">🐝</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{getApiaryName(container)}</p>
                    <p className={`text-xs mt-0.5 ${selectedContainer === container ? 'text-white/70' : t.textMuted}`}>
                      {selectedContainer === container && totalHives > 0 ? `${totalHives} hives` : container}
                    </p>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );

  const ApiaryBottomSheet = () => (
    <>
      {apiarySheetOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setApiarySheetOpen(false)} />
      )}
      <div className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${apiarySheetOpen ? 'translate-y-0' : 'translate-y-full'} ${t.sheet} rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col`}>
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-4 flex-shrink-0" />
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider} flex-shrink-0`}>
          <h3 className={`text-base font-bold flex items-center gap-2 ${t.text}`}>
            <Filter className="w-4 h-4" /> Select Apiary
          </h3>
          <button onClick={() => setApiarySheetOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-3 flex-shrink-0">
          <div className="relative">
            <input type="text" placeholder="Search apiary..." value={apiarySearchQuery}
              onChange={e => setApiarySearchQuery(e.target.value)}
              className={`w-full px-4 py-2.5 pl-9 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
            <Search className={`absolute left-3 top-3 w-3.5 h-3.5 ${t.textMuted}`} />
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto px-5 space-y-2"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
        >
          {availableContainers
            .filter(c => getApiaryName(c).toLowerCase().includes(apiarySearchQuery.toLowerCase()) || c.toLowerCase().includes(apiarySearchQuery.toLowerCase()))
            .map(container => (
              <button key={container} onClick={() => { setSelectedContainer(container); setSelectedHive(null); setApiarySearchQuery(''); setApiarySheetOpen(false); }}
                className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 ${selectedContainer === container
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-400/30'
                  : `${t.text} ${dm ? 'hover:bg-white/5 border border-white/5' : 'hover:bg-black/5 border border-black/5'}`}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedContainer === container ? 'bg-white/20' : (dm ? 'bg-amber-900/30' : 'bg-amber-50')}`}>
                    <span className="text-base">🐝</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{getApiaryName(container)}</p>
                    <p className={`text-xs mt-0.5 ${selectedContainer === container ? 'text-white/70' : t.textMuted}`}>
                      {selectedContainer === container && totalHives > 0 ? `${totalHives} hives` : container}
                    </p>
                  </div>
                  {selectedContainer === container && <Check className="w-4 h-4 text-white flex-shrink-0" />}
                </div>
              </button>
            ))}
        </div>
      </div>
    </>
  );

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/40" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${t.sidebar} shadow-2xl flex flex-col`}>

        {/* Header — safe area top */}
        <div
          className={`px-6 flex items-center justify-between border-b ${t.divider}`}
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: '16px' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg text-xl">🐝</div>
            <div>
              <h2 className={`text-sm font-black tracking-tight ${t.text}`}>Smart Hive</h2>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectedContainer && (
          <div className={`mx-4 my-4 px-4 py-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/60' : 'bg-amber-50 border border-amber-100'}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${dm ? 'text-amber-400' : 'text-amber-600'}`}>Active Apiary</p>
            <p className={`text-sm font-bold truncate ${t.text}`}>{getApiaryName(selectedContainer)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className={`text-xs ${isOnline ? (dm ? 'text-emerald-400' : 'text-emerald-600') : 'text-red-500'}`}>{isOnline ? 'Live' : 'Offline'}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.textMuted}`}>Navigation</p>
          {[
            { label: 'Home',      icon: Home,            action: () => { router.push('/welcome'); setSidebarOpen(false); } },
            { label: 'Dashboard', icon: LayoutDashboard, action: () => { setSelectedHive(null); setSidebarOpen(false); } },
            { label: 'Purchase',  icon: ShoppingCart,    action: () => { router.push('/payment'); setSidebarOpen(false); } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.text} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
          {availableContainers.length > 1 && (
            <button onClick={() => { setApiarySheetOpen(true); setSidebarOpen(false); }}
              className={`lg:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.text} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <Filter className="w-4 h-4" />Switch Apiary
            </button>
          )}
        </nav>

        {/* Footer — FIX: safe area bottom so buttons clear gesture bar */}
        <div
          className={`px-4 border-t ${t.divider} space-y-2`}
          style={{ paddingTop: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
        >
          <button onClick={() => setDarkMode(!dm)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {dm ? <SunMedium className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            {dm ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/'))}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>
    </>
  );

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (!mounted || (loading && !hasAccess && !authError)) {
    return (
      <div className={`min-h-screen ${dm ? 'bg-gray-950' : 'bg-amber-50'} flex items-center justify-center`}>
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
      <div className={`min-h-screen ${dm ? 'bg-gray-950' : 'bg-amber-50'} flex items-center justify-center p-6`}>
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

  const chartData     = selectedHive ? buildChartData(selectedHive) : [];
  const activeHives   = hiveNumbers.filter(isHiveActive).length;
  const inactiveHives = hiveNumbers.filter(n => !isHiveActive(n));

  const hiveStatVal = (getter: (item: SensorData) => number | null): number | null => {
    if (!selectedHive) return null;
    return getLastValidForHive(latestData, historicalData, selectedHive, hiveIds, getter);
  };

  const TIME_FILTERS = [
    { key: '1h', label: '1H' }, { key: '6h', label: '6H' }, { key: '24h', label: '24H' },
    { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: 'all', label: 'All' },
  ];

  return (
    <div className="min-h-screen relative transition-colors duration-300">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ backgroundImage: "url('/hive9.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
        <div className={`absolute inset-0 ${dm ? 'bg-black/40' : 'bg-white/20'}`} />
      </div>

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
      <ApiaryBottomSheet />

      <div className="relative min-h-screen flex flex-col">
        {/* ── Header ── */}
        <header
          className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/30 border-b border-white/10' : 'bg-white/20 border-b border-white/30'} backdrop-blur-xl`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center justify-between px-4 sm:px-5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Menu className="w-5 h-5" />
              </button>
              {selectedHive && (
                <button onClick={() => setSelectedHive(null)} className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className={`w-px h-5 flex-shrink-0 ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm text-sm flex-shrink-0">🐝</div>
                <h1 className={`text-sm font-black tracking-tight leading-none truncate ${t.text}`}>Smart Hive</h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {availableContainers.length > 1 && !selectedHive && (
                <button onClick={() => setApiarySheetOpen(true)}
                  className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold max-w-[120px] transition-all ${dm ? 'bg-amber-950/60 text-amber-300 border border-amber-900/60' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <span className="truncate">{getApiaryName(selectedContainer) || 'Apiary'}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                </button>
              )}
              <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className={`text-xs font-bold truncate max-w-[120px] ${dm ? 'text-amber-300' : 'text-amber-700'}`}>
                  {selectedHive ? getHiveName(selectedHive) : getApiaryName(selectedContainer)}
                </span>
              </div>
              {lastUpdated && (
                <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${dm ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <button onClick={() => setDarkMode(!dm)} className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={fetchData} disabled={isRefreshing}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-semibold text-xs disabled:opacity-60">
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8 max-w-screen-2xl mx-auto w-full">

          {selectedHive === null && (
            <>
              <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md text-xl">🐝</div>
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                    </div>
                    <div>
                      <h2 className={`text-sm font-black ${t.text}`}>{getApiaryName(selectedContainer) || 'My Apiary'}</h2>
                      <p className={`text-xs ${t.textSub}`}>{totalHives} hives · {activeHives} active</p>
                    </div>
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
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-widest ${t.textSub}`}>Filter</span>
                        {(['all', 'active', 'inactive'] as const).map(f => (
                          <button key={f} onClick={() => setFilterStatus(f)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all capitalize ${filterStatus === f ? t.pillActive : t.pill}`}>
                            {f}
                          </button>
                        ))}
                      </div>
                      {inactiveHives.length > 0 && (
                        <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-semibold w-full ${dm ? 'bg-amber-950/50 text-amber-400 border border-amber-900/50' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          <span className="flex-shrink-0 mt-0.5">⚠️</span>
                          <span className="break-words">{inactiveHives.length} inactive: {inactiveHives.map(n => getHiveName(n)).join(', ')}</span>
                        </div>
                      )}
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
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Rename</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 mb-5">
                <StatCard icon={Thermometer} title="Temp Int"  value={hiveStatVal(i => getTemperature(i, 'internal'))?.toFixed(1) ?? '0'} unit="°C" gradient="from-rose-500 to-pink-500" />
                <StatCard icon={Thermometer} title="Temp Ext"  value={hiveStatVal(i => getTemperature(i, 'external'))?.toFixed(1) ?? '0'} unit="°C" gradient="from-orange-500 to-red-500" />
                <StatCard icon={Droplets}    title="Humidity"  value={hiveStatVal(i => getHumidity(i, 'internal'))?.toFixed(0) ?? '0'}    unit="%" gradient="from-emerald-500 to-teal-500" />
                <StatCard icon={Activity}    title="Weight"    value={hiveStatVal(getWeight)?.toFixed(1) ?? '0'}                          unit="kg" gradient="from-amber-500 to-yellow-500" />
                <StatCard icon={Zap}         title="Battery"   value={(hiveStatVal(getBattery) ?? 100).toFixed(0)}                        unit="%" gradient="from-sky-500 to-cyan-500" />
              </div>

              <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md flex-shrink-0">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
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
                      <button onClick={() => { setStartDate(''); setEndDate(''); }}
                        className={`px-4 py-2 rounded-lg font-semibold text-xs ${dm ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Clear</button>
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
                <TemperatureChartCard data={chartData} />
                <ChartCard title="Humidity" dataKey="humidity" dataKey2="humidityExt" color="#10b981" color2="#06b6d4" unit="%" icon={Droplets} data={chartData} gradient="from-emerald-500 to-teal-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
                <ChartCard title="Hive Weight"   dataKey="weight"  color="#f59e0b" unit="kg" icon={Activity} data={chartData} gradient="from-amber-500 to-yellow-500" />
                <ChartCard title="Battery Level" dataKey="battery" color="#3b82f6" unit="%" icon={Zap}      data={chartData} gradient="from-sky-500 to-blue-500" />
              </div>

              {selectedHive === 1 && (
                <div className="mb-5"><GasChartCard /></div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
                <HealthRadial hiveNum={selectedHive} />
                <div className={`rounded-2xl shadow-md ${t.card} overflow-hidden flex flex-col`} style={{ minHeight: 380 }}>
                  <div className={`p-4 border-b ${t.divider} flex items-center gap-3`}>
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md flex-shrink-0">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-sm sm:text-base font-bold truncate ${t.text}`}>{getApiaryName(selectedContainer)} · Locations</h3>
                      <p className={`text-xs ${t.textMuted}`}>
                        {apiaryLocation ? `${apiaryLocation.lat.toFixed(5)}, ${apiaryLocation.lon.toFixed(5)}` : 'Location not configured'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1" style={{ minHeight: 300 }}>
                    <LocationMap apiaryLocation={apiaryLocation} hiveCount={totalHives} isDarkMode={dm} />
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl shadow-md ${t.card} overflow-hidden mb-5`}>
                <div className={`px-5 py-4 border-b ${t.divider} flex items-center gap-3`}>
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-md flex-shrink-0">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-bold ${t.text}`}>Historical Readings</h3>
                    <p className={`text-xs ${t.textSub}`}>{chartData.length} points (latest 10)</p>
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
                          <td className={`px-4 py-3 text-xs ${t.textSub}`}>{row.temp    != null ? `${(row.temp    as number).toFixed(1)}°C` : '0°C'}</td>
                          <td className={`px-4 py-3 text-xs ${t.textSub}`}>{row.tempExt != null ? `${(row.tempExt as number).toFixed(1)}°C` : '0°C'}</td>
                          <td className={`px-4 py-3 text-xs ${t.textSub}`}>{row.humidity    != null ? `${(row.humidity    as number).toFixed(0)}%` : '0%'}</td>
                          <td className={`px-4 py-3 text-xs ${t.textSub}`}>{row.humidityExt != null ? `${(row.humidityExt as number).toFixed(0)}%` : '0%'}</td>
                          <td className={`px-4 py-3 text-xs ${t.textSub}`}>{row.weight  != null ? `${(row.weight  as number).toFixed(2)} kg` : '0.00 kg'}</td>
                          <td className={`px-4 py-3 text-xs ${t.textSub}`}>{row.battery != null ? `${(row.battery as number).toFixed(0)}%`  : '0%'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {!loading && hasAccess && (
        <SmartHiveAIAssistant
          latestData={latestData}
          historicalData={historicalData}
          selectedContainer={selectedContainer}
          totalHives={totalHives}
          activatedHives={activeHives}
          isDarkMode={dm}
          t={t}
        />
      )}
    </div>
  );
};

export default SmartHiveDashboard;
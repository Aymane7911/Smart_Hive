'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellOff, Save, Trash2, AlertTriangle, Thermometer,
  Droplets, Activity, Wind, ChevronDown, CheckCircle, XCircle,
  Loader2, ArrowLeft, RefreshCw, Clock, Send, Smartphone,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AlertConfig {
  id?:             number;
  hiveNumber:      number;
  isEnabled:       boolean;
  cooldownMinutes: number;
  tempInternalMin: number | null;
  tempInternalMax: number | null;
  tempExternalMin: number | null;
  tempExternalMax: number | null;
  humidityMin:     number | null;
  humidityMax:     number | null;
  weightMin:       number | null;
  weightMax:       number | null;
  batteryMin:      number | null;
  co2Max:          number | null;
  nh3Max:          number | null;
  o2Min:           number | null;
  vocsMax:         number | null;
  coMax:           number | null;
  no2Max:          number | null;
  lastAlertAt?:    string | null;
}

type NumericKey =
  | 'tempInternalMin' | 'tempInternalMax'
  | 'tempExternalMin' | 'tempExternalMax'
  | 'humidityMin'     | 'humidityMax'
  | 'weightMin'       | 'weightMax'
  | 'batteryMin'
  | 'co2Max' | 'nh3Max' | 'o2Min' | 'vocsMax' | 'coMax' | 'no2Max';

interface Props {
  containerId:  string;
  totalHives:   number;
  isDarkMode:   boolean;
  onBack?:      () => void;
  getHiveName?: (n: number) => string;
}

// ─── Static config ─────────────────────────────────────────────────────────────

const GROUPS: {
  id:          string;
  label:       string;
  icon:        React.ElementType;
  gradient:    string;
  color:       string;
  masterOnly?: boolean;
  params: { key: NumericKey; label: string; unit: string; dir: 'MIN' | 'MAX'; hint: string }[];
}[] = [
  {
    id: 'temp', label: 'Temperature', icon: Thermometer,
    gradient: 'from-rose-500 to-pink-600', color: '#f43f5e',
    params: [
      { key: 'tempInternalMin', label: 'Internal Min', unit: '°C', dir: 'MIN', hint: 'Alert below, e.g. 32' },
      { key: 'tempInternalMax', label: 'Internal Max', unit: '°C', dir: 'MAX', hint: 'Alert above, e.g. 38' },
      { key: 'tempExternalMin', label: 'External Min', unit: '°C', dir: 'MIN', hint: 'e.g. 5'  },
      { key: 'tempExternalMax', label: 'External Max', unit: '°C', dir: 'MAX', hint: 'e.g. 45' },
    ],
  },
  {
    id: 'hum', label: 'Humidity', icon: Droplets,
    gradient: 'from-emerald-500 to-teal-600', color: '#10b981',
    params: [
      { key: 'humidityMin', label: 'Humidity Min', unit: '%', dir: 'MIN', hint: 'e.g. 40' },
      { key: 'humidityMax', label: 'Humidity Max', unit: '%', dir: 'MAX', hint: 'e.g. 85' },
    ],
  },
  {
    id: 'weight', label: 'Weight & Battery', icon: Activity,
    gradient: 'from-amber-500 to-yellow-600', color: '#f59e0b',
    params: [
      { key: 'weightMin',  label: 'Weight Min',  unit: 'kg', dir: 'MIN', hint: 'e.g. 10' },
      { key: 'weightMax',  label: 'Weight Max',  unit: 'kg', dir: 'MAX', hint: 'e.g. 80' },
      { key: 'batteryMin', label: 'Battery Low', unit: '%',  dir: 'MIN', hint: 'e.g. 20' },
    ],
  },
  {
    id: 'gas', label: 'Gas Sensors', icon: Wind,
    gradient: 'from-violet-500 to-purple-600', color: '#8b5cf6',
    masterOnly: true,
    params: [
      { key: 'co2Max',  label: 'CO₂ Max',  unit: 'ppm', dir: 'MAX', hint: 'e.g. 2000' },
      { key: 'nh3Max',  label: 'NH₃ Max',  unit: 'ppm', dir: 'MAX', hint: 'e.g. 50'   },
      { key: 'o2Min',   label: 'O₂ Min',   unit: '%',   dir: 'MIN', hint: 'e.g. 19.5' },
      { key: 'vocsMax', label: 'VOCs Max', unit: 'ppb', dir: 'MAX', hint: 'e.g. 500'  },
      { key: 'coMax',   label: 'CO Max',   unit: 'ppm', dir: 'MAX', hint: 'e.g. 35'   },
      { key: 'no2Max',  label: 'NO₂ Max',  unit: 'ppm', dir: 'MAX', hint: 'e.g. 0.1'  },
    ],
  },
];

const COOLDOWNS = [
  { value: 15,   label: '15 min'   },
  { value: 30,   label: '30 min'   },
  { value: 60,   label: '1 hour'   },
  { value: 120,  label: '2 hours'  },
  { value: 360,  label: '6 hours'  },
  { value: 1440, label: '24 hours' },
];

const makeEmpty = (hiveNumber: number): AlertConfig => ({
  hiveNumber,
  isEnabled: true, cooldownMinutes: 60,
  tempInternalMin: null, tempInternalMax: null,
  tempExternalMin: null, tempExternalMax: null,
  humidityMin: null, humidityMax: null,
  weightMin: null, weightMax: null, batteryMin: null,
  co2Max: null, nh3Max: null, o2Min: null,
  vocsMax: null, coMax: null, no2Max: null,
});

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AlertConfigPage({
  containerId, totalHives, isDarkMode, onBack, getHiveName,
}: Props) {
  const dm = isDarkMode;

  const [configs,  setConfigs]  = useState<Record<number, AlertConfig>>({});
  const [hive,     setHive]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [open,     setOpen]     = useState<Record<string, boolean>>({
    temp: true, hum: true, weight: true, gas: false,
  });

  // ── Theme ──────────────────────────────────────────────────────────────────
  const card    = dm ? 'bg-gray-900/50 border border-white/10 backdrop-blur-md shadow-xl'
                     : 'bg-white/70 border border-white/60 backdrop-blur-md shadow-lg';
  const text    = dm ? 'text-white'    : 'text-gray-900';
  const sub     = dm ? 'text-gray-300' : 'text-gray-600';
  const muted   = dm ? 'text-gray-400' : 'text-gray-500';
  const divider = dm ? 'border-white/10' : 'border-black/8';
  const inp     = dm
    ? 'bg-gray-800/70 border-white/10 text-white placeholder-gray-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30'
    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30';
  const pill    = dm ? 'bg-white/8 text-gray-200 hover:bg-white/14 border border-white/10'
                     : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200';
  const pillOn  = 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/25 border border-transparent';

  // ── Toast ──────────────────────────────────────────────────────────────────
  const flash = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(
        `/api/smart-hive/alerts?containerId=${encodeURIComponent(containerId)}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (data.success) {
        const map: Record<number, AlertConfig> = {};
        (data.data as AlertConfig[]).forEach(c => { map[c.hiveNumber] = c; });
        setConfigs(map);
      }
    } catch { flash('Failed to load configs', false); }
    finally  { setLoading(false); }
  }, [containerId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const cfg      = configs[hive] ?? makeEmpty(hive);
  const saved    = !!configs[hive]?.id;
  const hives    = Array.from({ length: totalHives }, (_, i) => i + 1);
  const hiveName = (n: number) => getHiveName ? getHiveName(n) : `Hive ${n}`;

  const setNum  = (key: NumericKey, val: number | null) =>
    setConfigs(p => ({ ...p, [hive]: { ...(p[hive] ?? makeEmpty(hive)), [key]: val } }));
  const setBool = (key: 'isEnabled', val: boolean) =>
    setConfigs(p => ({ ...p, [hive]: { ...(p[hive] ?? makeEmpty(hive)), [key]: val } }));
  const setInt  = (key: 'cooldownMinutes', val: number) =>
    setConfigs(p => ({ ...p, [hive]: { ...(p[hive] ?? makeEmpty(hive)), [key]: val } }));

  const activeCount = (groupId: string): number => {
    const g = GROUPS.find(g => g.id === groupId);
    if (!g) return 0;
    return g.params.filter(p => cfg[p.key] != null).length;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      const res  = await fetch('/api/smart-hive/alerts', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ ...cfg, containerId }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(p => ({ ...p, [hive]: data.data as AlertConfig }));
        flash('Config saved ✓');
      } else {
        flash(data.error || 'Save failed', false);
      }
    } catch { flash('Network error', false); }
    finally  { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const del = async () => {
    if (!saved) { flash('Nothing to delete', false); return; }
    if (!confirm(`Delete alert config for ${hiveName(hive)}?`)) return;
    setDeleting(true);
    try {
      await fetch(
        `/api/smart-hive/alerts?containerId=${encodeURIComponent(containerId)}&hiveNumber=${hive}`,
        { method: 'DELETE', credentials: 'include' },
      );
      setConfigs(p => { const n = { ...p }; delete n[hive]; return n; });
      flash('Config deleted');
    } catch { flash('Delete failed', false); }
    finally  { setDeleting(false); }
  };

  // ── Test ───────────────────────────────────────────────────────────────────
  const testAlert = async () => {
    setTesting(true);
    try {
      const res  = await fetch('/api/smart-hive/alerts/test', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ containerId, hiveNumber: hive }),
      });
      const data = await res.json();
      flash(
        data.success
          ? 'Test notification sent ✓ — check your phone!'
          : (data.error || 'Test failed — make sure the app is installed on your phone'),
        !!data.success,
      );
    } catch { flash('Test failed', false); }
    finally  { setTesting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen relative ${dm ? 'bg-gray-950' : 'bg-amber-50/40'}`}>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ backgroundImage: "url('/bee.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className={`absolute inset-0 ${dm ? 'bg-black/55' : 'bg-white/35'}`} />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold ${
          toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-20">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {onBack && (
            <button onClick={onBack}
              className={`p-2 rounded-xl transition-all ${dm ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/8 text-gray-500'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-lg sm:text-xl font-black tracking-tight ${text}`}>Alert Thresholds</h1>
            <p className={`text-xs truncate ${muted}`}>{containerId} · Push notifications</p>
          </div>
          <button onClick={fetchConfigs}
            className={`p-2 rounded-xl transition-all flex-shrink-0 ${dm ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/8 text-gray-500'}`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        

        {/* Hive selector */}
        <div className={`rounded-2xl ${card} p-4 mb-4`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${muted}`}>
            Select Hive to Configure
          </p>
          <div className="flex flex-wrap gap-2">
            {hives.map(n => (
              <button key={n} onClick={() => setHive(n)}
                className={`relative px-4 py-2 rounded-xl font-bold text-xs transition-all ${hive === n ? pillOn : pill}`}>
                {hiveName(n)}
                {configs[n]?.id && (
                  <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 ${
                    dm ? 'border-gray-900' : 'border-white'
                  } ${configs[n].isEnabled ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={`rounded-2xl ${card} p-16 flex flex-col items-center justify-center gap-3`}>
            <Loader2 className={`w-8 h-8 animate-spin ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
            <p className={`text-sm ${muted}`}>Loading configs…</p>
          </div>
        ) : (
          <>
            {/* Alert settings */}
            <div className={`rounded-2xl ${card} p-5 mb-4`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-md flex-shrink-0">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${text}`}>Notification Settings</p>
                  <p className={`text-xs ${muted}`}>{hiveName(hive)}</p>
                </div>
                <button
                  onClick={() => setBool('isEnabled', !cfg.isEnabled)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex-shrink-0 ${
                    cfg.isEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/25'
                      : dm
                        ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {cfg.isEnabled
                    ? <><Bell    className="w-3.5 h-3.5" /> Enabled</>
                    : <><BellOff className="w-3.5 h-3.5" /> Disabled</>}
                </button>
              </div>

              {/* Cooldown */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${sub}`}>
                  Repeat Alert Cooldown
                </label>
                <div className="relative max-w-xs">
                  <Clock className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${muted}`} />
                  <select
                    value={cfg.cooldownMinutes}
                    onChange={e => setInt('cooldownMinutes', parseInt(e.target.value))}
                    className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm focus:outline-none appearance-none transition-all ${inp}`}>
                    {COOLDOWNS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${muted}`} />
                </div>
              </div>

              {cfg.lastAlertAt && (
                <div className={`flex items-center gap-2 mt-4 pt-4 border-t ${divider}`}>
                  <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                  <p className={`text-xs ${muted}`}>
                    Last alert: {new Date(cfg.lastAlertAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Threshold groups */}
            {GROUPS.map(group => {
              if (group.masterOnly && hive !== 1) return null;
              const Icon   = group.icon;
              const isOpen = open[group.id] ?? false;
              const count  = activeCount(group.id);

              return (
                <div key={group.id} className={`rounded-2xl ${card} mb-4 overflow-hidden`}>
                  <button
                    onClick={() => setOpen(p => ({ ...p, [group.id]: !isOpen }))}
                    className={`w-full flex items-center gap-3 p-4 sm:p-5 transition-all ${
                      dm ? 'hover:bg-white/5' : 'hover:bg-black/[0.02]'
                    } ${isOpen ? `border-b ${divider}` : ''}`}>
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${group.gradient} shadow-md flex-shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={`text-sm font-bold ${text}`}>{group.label}</p>
                      {group.masterOnly && <p className={`text-[10px] ${muted}`}>Master Hive only</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {count > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dm ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {count} active
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${muted}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.params.map(param => {
                        const rawVal   = cfg[param.key];
                        const active   = rawVal != null;
                        const inputVal: string | number = rawVal != null ? rawVal : '';

                        return (
                          <div key={param.key}>
                            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${sub}`}>
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white"
                                style={{ backgroundColor: group.color + (active ? 'ee' : '88') }}>
                                {param.dir === 'MAX' ? '▲' : '▼'} {param.dir}
                              </span>
                              <span className={active ? text : ''}>{param.label}</span>
                              <span className={muted}>({param.unit})</span>
                            </label>
                            <input
                              type="number" step="any"
                              value={inputVal}
                              onChange={e => setNum(param.key, e.target.value === '' ? null : parseFloat(e.target.value))}
                              placeholder={param.hint}
                              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all ${inp} ${
                                active
                                  ? dm ? 'border-amber-500/50 bg-amber-950/30' : 'border-amber-300 bg-amber-50/60'
                                  : ''
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Action bar */}
            <div className={`rounded-2xl ${card} p-4 sm:p-5`}>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={save} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-60 transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Config'}
                </button>

               {/* <button onClick={testAlert} disabled={testing}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${
                    dm ? 'bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25'
                       : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  } disabled:opacity-50`}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? 'Sending…' : 'Send Test Notification'}
                </button>*/}

                {saved && (
                  <button onClick={del} disabled={deleting}
                    className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 border ${
                      dm ? 'bg-red-950/40 border-red-900/40 text-red-400 hover:bg-red-950/70'
                         : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    }`}>
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
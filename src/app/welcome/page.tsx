'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, ShoppingCart, LayoutDashboard, LogOut, Plus, ChevronRight,
  AlertCircle, RefreshCw, Menu, X, Moon, SunMedium, Activity, Clock,
  MapPin, Zap, User, Mail, Phone, Edit2, Check, Loader2, Search,
  ShieldCheck,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PurchaseInfo {
  id: number;
  masterHives: number;
  normalHives: number;
  totalAmount?: number;
  purchaseDate: string;
  status: string;
  accessGranted: boolean;
  accessGrantedAt: string | null;
  assignedContainers: string[];
}

interface ApiaryCard {
  id: string;           // containerId
  name: string;
  containerId: string;
  color: string;
  hiveCount: number;
  isActive: boolean;
  lat?: number;
  lon?: number;
  address?: string;
  lastUpdated?: string;
}

// ─── Color palettes ─────────────────────────────────────────────────────────────
const COLOR_GRADIENTS = [
  'from-amber-500 to-yellow-500',
  'from-emerald-500 to-teal-500',
  'from-sky-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-rose-500 to-pink-500',
  'from-orange-500 to-amber-500',
  'from-cyan-500 to-sky-500',
  'from-indigo-500 to-violet-500',
];

const COLOR_ACCENTS = [
  '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
  '#f43f5e', '#f97316', '#06b6d4', '#6366f1',
];

export default function WelcomePage() {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(true);
  const [apiaries, setApiaries]         = useState<ApiaryCard[]>([]);
  const [userData, setUserData]         = useState<any>(null);
  const [error, setError]               = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [darkMode, setDarkMode]         = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [hoveredId, setHoveredId]       = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editName, setEditName]         = useState('');
  const [isAdmin, setIsAdmin]           = useState(false);
  const [pendingPurchases, setPending]  = useState<PurchaseInfo[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapRef                          = useRef<HTMLDivElement>(null);
  const mapInstanceRef                  = useRef<any>(null);

  const dm = mounted && darkMode;

  // ── Theme ────────────────────────────────────────────────────────────────────
  const t = {
    card:      dm ? 'bg-gray-900/40 border border-white/10 backdrop-blur-md' : 'bg-white/40 border border-white/50 backdrop-blur-md',
    text:      dm ? 'text-white'      : 'text-gray-900',
    textSub:   dm ? 'text-gray-200'   : 'text-gray-600',
    textMuted: dm ? 'text-gray-300'   : 'text-gray-500',
    divider:   dm ? 'border-white/10' : 'border-black/10',
    input:     dm ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400 focus:ring-amber-500'
                  : 'bg-white/60 border-white/40 text-gray-900 focus:ring-amber-500',
    sidebar:   dm ? 'bg-gray-950 border-r border-gray-800' : 'bg-white border-r border-gray-100',
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('hive-darkMode');
    if (saved === 'true') setDarkMode(true);
    setMounted(true);
    fetchData();
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('hive-darkMode', String(darkMode));
  }, [darkMode, mounted]);

  // ── Load Leaflet ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    } else if ((window as any).L) {
      setLeafletReady(true);
    }
  }, []);

  // ── Build / rebuild map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapRef.current || apiaries.length === 0) return;
    const L = (window as any).L;
    if (!L) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const withCoords = apiaries.filter(a => a.lat && a.lon);
    if (withCoords.length === 0) return;

    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = dm
        ? 'invert(1) hue-rotate(180deg) brightness(0.85) saturate(0.8)'
        : 'none';
    }

    const bounds: [number, number][] = [];
    withCoords.forEach((apiary, i) => {
      const color = COLOR_ACCENTS[i % COLOR_ACCENTS.length];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:44px;height:44px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;">🐝</div>`,
        iconSize: [44, 44], iconAnchor: [22, 22],
      });
      const marker = L.marker([apiary.lat!, apiary.lon!], { icon }).addTo(map);
      bounds.push([apiary.lat!, apiary.lon!]);
      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:160px;padding:4px">
          <div style="font-weight:800;font-size:14px;margin-bottom:4px">${apiary.name}</div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${apiary.containerId}</div>
          <div style="font-size:11px;margin-bottom:10px">🐝 ${apiary.hiveCount} hive${apiary.hiveCount !== 1 ? 's' : ''}</div>
          <a href="/smart-hive?container=${apiary.containerId}" style="display:block;text-align:center;background:${color};color:white;padding:6px 12px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none">Open Dashboard →</a>
        </div>`, { maxWidth: 220 });
    });

    if (bounds.length === 1) map.setView(bounds[0], 13);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
  }, [leafletReady, apiaries, dm]);

  // Dark mode tile filter without rebuilding map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const tilePane = mapInstanceRef.current.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = dm
        ? 'invert(1) hue-rotate(180deg) brightness(0.85) saturate(0.8)'
        : 'none';
    }
  }, [dm]);

  // ── Fetch data ────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      // 1. Check access + get user info
      const accessRes = await fetch('/api/smart-hive/check-access', {
        credentials: 'include', cache: 'no-store',
      });
      if (accessRes.status === 401) { router.push('/login'); return; }
      const accessData = await accessRes.json();
      if (!accessData.success) { router.push('/login'); return; }

      const user = accessData.user;
      setUserData(user);
      setIsAdmin(user?.role === 'admin');

      // Also check localStorage for role
      try {
        const ui = localStorage.getItem('userInfo');
        if (ui) { const p = JSON.parse(ui); if (p?.role === 'admin') setIsAdmin(true); }
      } catch {}

      // 2. Fetch purchases
      const purchasesRes = await fetch('/api/user/purchases', { credentials: 'include', cache: 'no-store' });
      if (!purchasesRes.ok) { setError('Failed to load purchases.'); setLoading(false); return; }
      const purchasesData = await purchasesRes.json();
      const purchases: PurchaseInfo[] = purchasesData.success ? (purchasesData.purchases || []) : [];

      const active  = purchases.filter(p => p.status === 'approved' && p.accessGranted && p.assignedContainers?.length > 0);
      const pending = purchases.filter(p => p.status === 'pending' || (p.status === 'approved' && !p.accessGranted));
      setPending(pending);

      // 3. Fetch apiary locations
      let locations: Record<string, { lat?: number; lon?: number; address?: string }> = {};
      try {
        const locRes = await fetch('/api/smart-hive/apiary-locations');
        if (locRes.ok) {
          const locData = await locRes.json();
          if (locData.success) locations = locData.data || {};
        }
      } catch {}

      // 4. Build apiary cards
      const cards: ApiaryCard[] = [];
      active.forEach((purchase, pi) => {
        purchase.assignedContainers.forEach((containerId, ci) => {
          const savedName = localStorage.getItem(`apiary_name_${containerId}`);
          const loc = locations[containerId] || {};
          cards.push({
            id:          containerId,
            name:        savedName || containerId,
            containerId: containerId,
            color:       COLOR_GRADIENTS[(pi * 4 + ci) % COLOR_GRADIENTS.length],
            hiveCount:   purchase.masterHives + purchase.normalHives,
            isActive:    true,
            lat:         loc.lat,
            lon:         loc.lon,
            address:     loc.address,
          });
        });
      });

      setApiaries(cards);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); }
    finally { localStorage.clear(); router.push('/login'); }
  };

  const handleApiaryClick = (apiary: ApiaryCard) => {
    if (editingId) return;
    router.push(`/smart-hive?container=${encodeURIComponent(apiary.containerId)}`);
  };

  const handleEditSave = (id: string) => {
    setApiaries(prev => prev.map(a => a.id === id ? { ...a, name: editName } : a));
    localStorage.setItem(`apiary_name_${id}`, editName);
    setEditingId(null); setEditName('');
  };

  const filtered = apiaries.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.containerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (!mounted || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-gray-950' : 'bg-amber-50'}`}>
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className={`absolute inset-0 border-2 rounded-full ${dm ? 'border-gray-800' : 'border-amber-200'}`} />
            <div className="absolute inset-0 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🐝</div>
          </div>
          <p className={`text-xl font-bold mb-1 ${dm ? 'text-white' : 'text-gray-900'}`}>Loading Smart Hive</p>
          <p className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Connecting to your apiaries…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${dm ? 'bg-gray-950' : 'bg-amber-50'}`}>
        <div className={`rounded-3xl shadow-2xl p-10 max-w-md w-full ${t.card}`}>
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className={`text-2xl font-black mb-3 text-center ${t.text}`}>Something went wrong</h2>
          <p className={`text-center mb-6 text-sm ${t.textSub}`}>{error}</p>
          <button onClick={fetchData}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative transition-colors duration-300">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        style={{ backgroundImage: "url('/bee.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className={`absolute inset-0 ${dm ? 'bg-black/50' : 'bg-white/30'}`} />
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${t.sidebar} shadow-2xl flex flex-col`}>
        <div className={`px-6 flex items-center justify-between border-b ${t.divider}`}
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: 16 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg text-xl">🐝</div>
            <div>
              <h2 className={`text-sm font-black tracking-tight ${t.text}`}>Smart Hive</h2>
              <p className={`text-xs ${t.textMuted}`}>Colony Monitoring</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)}
            className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {userData && (
          <div className={`mx-4 my-4 px-4 py-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/60' : 'bg-amber-50 border border-amber-100'}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${dm ? 'text-amber-400' : 'text-amber-600'}`}>Signed in as</p>
            <p className={`text-sm font-bold truncate ${t.text}`}>{userData.firstname} {userData.lastname}</p>
            <p className={`text-xs truncate mt-0.5 ${t.textMuted}`}>{userData.email}</p>
          </div>
        )}

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.textMuted}`}>Navigation</p>
          {[
            { label: 'Home',     icon: Home,            action: () => { router.push('/welcome'); setSidebarOpen(false); } },
            { label: 'Purchase', icon: ShoppingCart,    action: () => { router.push('/payment'); setSidebarOpen(false); } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.text} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}

          {isAdmin && (
            <>
              <div className={`my-3 border-t ${t.divider}`} />
              <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.textMuted}`}>Administration</p>
              <button onClick={() => { router.push('/admin/access-management'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 ${dm ? 'text-amber-300 hover:from-amber-500/30' : 'text-amber-700 hover:from-amber-500/30'}`}>
                <ShieldCheck className="w-4 h-4" />Admin Panel
              </button>
            </>
          )}
        </nav>

        <div className={`px-4 border-t ${t.divider} space-y-2`}
          style={{ paddingTop: 16, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
          <button onClick={() => setDarkMode(!dm)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {dm ? <SunMedium className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            {dm ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>

      {/* Page */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Header */}
        <header className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/30 border-b border-white/10' : 'bg-white/20 border-b border-white/30'} backdrop-blur-xl`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)}
                className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Menu className="w-5 h-5" />
              </button>
              <div className={`w-px h-5 ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-sm">🐝</div>
                <div>
                  <h1 className={`text-sm font-black tracking-tight leading-none ${t.text}`}>Smart Hive</h1>
                  <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Apiary Selection</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${dm ? 'text-emerald-400 bg-emerald-950/60 border-emerald-900/60' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                {apiaries.length} Active
              </span>
              {userData && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${dm ? 'text-amber-400 bg-amber-950/60 border-amber-900/60' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                  {userData.firstname} {userData.lastname}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setDarkMode(!dm)}
                className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={fetchData}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-bold text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={handleLogout}
                className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
                <LogOut className="w-3.5 h-3.5" />Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Search bar */}
        <div className="flex justify-center px-5 py-4">
          <div className="relative w-full max-w-md">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${t.textMuted}`} />
            <input type="text" placeholder="Search apiaries…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 text-sm backdrop-blur-md transition-all ${t.input}`} />
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-4">

          {/* Heading */}
          <div className="text-center mb-10">
            <h2 className={`text-3xl font-black tracking-tight mb-2 ${t.text}`}>
              Welcome back{userData ? `, ${userData.firstname}` : ''}!
            </h2>
            <p className={`text-sm ${t.textSub}`}>Choose an apiary below to open its monitoring dashboard</p>
          </div>

          {/* Pending purchases banner */}
          {pendingPurchases.length > 0 && (
            <div className={`w-full max-w-5xl mb-8 rounded-2xl shadow-md ${t.card} p-5`}>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md flex-shrink-0">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className={`text-sm font-black mb-1 ${t.text}`}>
                    {pendingPurchases.length} Purchase{pendingPurchases.length > 1 ? 's' : ''} Pending Approval
                  </h3>
                  <p className={`text-xs ${t.textSub}`}>
                    Your order{pendingPurchases.length > 1 ? 's are' : ' is'} awaiting admin approval. You'll get access once approved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Apiary cards grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🐝</div>
              <h3 className={`text-lg font-bold mb-2 ${t.text}`}>
                {apiaries.length === 0 ? 'No Apiaries Yet' : 'No results found'}
              </h3>
              <p className={`text-sm mb-6 ${t.textSub}`}>
                {apiaries.length === 0
                  ? "You don't have any active apiaries. Purchase your first Smart Hive to get started!"
                  : 'Try adjusting your search query'}
              </p>
              {apiaries.length === 0 && (
                <button onClick={() => router.push('/payment')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-bold text-sm shadow-lg hover:from-amber-600 hover:to-yellow-600 transition-all hover:-translate-y-0.5">
                  <Plus className="w-4 h-4" />Purchase Smart Hive
                </button>
              )}
            </div>
          ) : (
            <div className="w-full max-w-5xl mx-auto flex flex-wrap gap-6 justify-center items-stretch mb-12">
              {filtered.map((apiary, i) => {
                const isHovered  = hoveredId === apiary.id;
                const isEditing  = editingId === apiary.id;
                const accentColor = COLOR_ACCENTS[i % COLOR_ACCENTS.length];

                return (
                  <div key={apiary.id} className="relative w-[220px] flex-shrink-0 flex flex-col"
                    onMouseEnter={() => setHoveredId(apiary.id)}
                    onMouseLeave={() => setHoveredId(null)}>

                    {/* Glow */}
                    <div className="absolute inset-0 rounded-2xl blur-xl pointer-events-none -z-10"
                      style={{ background: `radial-gradient(circle, ${accentColor}35, transparent 70%)`, opacity: isHovered ? 0.6 : 0, transform: 'scale(1.1)', transition: 'opacity 0.3s' }} />

                    {/* Card */}
                    <div onClick={() => handleApiaryClick(apiary)}
                      className={`relative rounded-2xl shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col flex-1 ${t.card} ${isEditing ? 'ring-2 ring-amber-500' : ''} ${isHovered ? 'shadow-xl -translate-y-1.5' : ''}`}
                      style={isHovered ? { boxShadow: `0 20px 60px ${accentColor}30, 0 8px 24px rgba(0,0,0,0.12)` } : {}}>

                      {/* Top color bar */}
                      <div className={`h-1 w-full bg-gradient-to-r ${apiary.color}`} />

                      <div className="p-6 flex flex-col flex-1">

                        {/* Status badge */}
                        <div className="flex items-center justify-between mb-5">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            apiary.isActive
                              ? dm ? 'bg-emerald-950/60 border border-emerald-900/60 text-emerald-400' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                              : dm ? 'bg-gray-800 border border-gray-700 text-gray-500' : 'bg-gray-100 border border-gray-200 text-gray-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${apiary.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                            {apiary.isActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>

                        {/* Hive icon */}
                        <div className={`w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br ${apiary.color} flex items-center justify-center shadow-lg text-4xl transition-all duration-300 ${isHovered ? 'scale-110 rotate-3' : 'scale-100'}`}
                          style={isHovered ? { boxShadow: `0 12px 32px ${accentColor}50` } : {}}>
                          🐝
                        </div>

                        {/* Name — editable */}
                        {isEditing ? (
                          <div className="mb-4">
                            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                              onClick={e => e.stopPropagation()} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(apiary.id); if (e.key === 'Escape') { setEditingId(null); } }}
                              className={`w-full px-3 py-2 text-center text-sm font-bold rounded-lg border-2 border-amber-500 focus:outline-none ${dm ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`} />
                            <div className="flex gap-2 mt-3 justify-center">
                              <button onClick={e => { e.stopPropagation(); handleEditSave(apiary.id); }}
                                className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); setEditingId(null); setEditName(''); }}
                                className={`p-2 rounded-lg transition-colors ${dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-4 relative group/name flex flex-col items-center">
                            <h3 className={`text-sm font-black text-center leading-tight ${t.text}`}>{apiary.name}</h3>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingId(apiary.id); setEditName(apiary.name); }}
                              className={`absolute right-0 top-0 p-1 rounded-lg opacity-0 group-hover/name:opacity-100 transition-opacity ${dm ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Hive count + location */}
                        <div className={`text-xs border-t border-b py-4 my-2 space-y-2 ${t.divider}`}>
                          <div className="flex items-center justify-between">
                            <span className={t.textMuted}>Hives</span>
                            <span className={`font-bold ${t.text}`}>{apiary.hiveCount}</span>
                          </div>
                          {apiary.address && (
                            <div className="flex items-center justify-between gap-2">
                              <span className={t.textMuted}>Location</span>
                              <span className={`font-semibold truncate max-w-[110px] text-right ${t.textSub}`}>{apiary.address}</span>
                            </div>
                          )}
                          {!apiary.address && apiary.lat && (
                            <div className="flex items-center justify-between">
                              <span className={t.textMuted}>GPS</span>
                              <span className={`font-semibold ${t.textSub}`}>{apiary.lat.toFixed(3)}, {apiary.lon!.toFixed(3)}</span>
                            </div>
                          )}
                        </div>

                        {/* CTA */}
                        <div className="mt-auto pt-3">
                          <div className={`text-center text-xs font-bold bg-gradient-to-r ${apiary.color} bg-clip-text text-transparent transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-60'}`}>
                            Open Dashboard →
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Map section */}
        <section className="px-4 sm:px-6 lg:px-8 pb-12 max-w-5xl mx-auto w-full">
          <div className="text-center mb-6">
            <h2 className={`text-2xl font-black tracking-tight mb-1 ${t.text}`}>Apiary Locations</h2>
            <p className={`text-sm ${t.textSub}`}>Click a marker to open the apiary dashboard</p>
          </div>

          {apiaries.some(a => a.lat && a.lon) ? (
            <div className={`rounded-2xl overflow-hidden shadow-lg ${t.card}`}>
              <div ref={mapRef} style={{ height: 400, width: '100%' }} />
            </div>
          ) : (
            <div className={`rounded-2xl p-10 text-center ${t.card}`}>
              <div className="text-4xl mb-3">📍</div>
              <h3 className={`text-base font-bold mb-1 ${t.text}`}>No locations set</h3>
              <p className={`text-sm ${t.textSub}`}>
                Set apiary coordinates in the Admin Panel → Access tab → Locations to display them on the map
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
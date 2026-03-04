'use client'
import React, { useState, useEffect } from 'react';
import {
  Search, Check, X, UserCheck, UserX, Package, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, LogOut, MapPin, Menu, Home, ShoppingCart,
  LayoutDashboard, Settings, Moon, SunMedium, Activity, Zap, Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface User {
  id: number; email: string; firstname: string; lastname: string; role: string; createdAt: string;
}
interface Purchase {
  id: number; userId: number; user: User; masterHives: number; normalHives: number;
  totalAmount: number; status: string; accessGranted: boolean; assignedContainers: string[];
  purchaseDate: string; email: string; fullName: string; phone: string;
  address: string; city: string; country: string; adminNotes?: string;
}
interface Container {
  name: string; lastModified?: string; blobCount?: number;
}
interface ApiaryLocation {
  containerId: string; lat: number; lon: number; address?: string;
}

export default function AdminAccessManagement() {
  const [purchases, setPurchases]                   = useState<Purchase[]>([]);
  const [containers, setContainers]                 = useState<Container[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [error, setError]                           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]               = useState('');
  const [filterStatus, setFilterStatus]             = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedPurchase, setSelectedPurchase]     = useState<Purchase | null>(null);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [tempContainers, setTempContainers]         = useState<string[]>([]);
  const [adminNotes, setAdminNotes]                 = useState('');
  const [expandedRows, setExpandedRows]             = useState<Set<number>>(new Set());
  const [processing, setProcessing]                 = useState<number | null>(null);
  const [adminInfo, setAdminInfo]                   = useState<any>(null);
  const [sidebarOpen, setSidebarOpen]               = useState(false);
  const [darkMode, setDarkMode]                     = useState(false);
  const [mounted, setMounted]                       = useState(false);
  const [showLocationModal, setShowLocationModal]   = useState(false);
  const [selectedLocationContainer, setSelectedLocationContainer] = useState<string | null>(null);
  const [locationForm, setLocationForm]             = useState({ lat: '', lon: '', address: '' });
  const [apiaryLocations, setApiaryLocations]       = useState<Record<string, ApiaryLocation>>({});
  const [showLocationsPanel, setShowLocationsPanel] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('hive-darkMode');
    if (saved === 'true') setDarkMode(true);
    const stored = localStorage.getItem('adminInfo');
    if (stored) setAdminInfo(JSON.parse(stored));
    setMounted(true);
    fetchData();
    loadApiaryLocations();
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('hive-darkMode', String(darkMode));
  }, [darkMode, mounted]);

  const dm = mounted && darkMode;

  // ── Theme tokens ──
  // FIX: dark mode sub/muted text changed from gray-400/500 to gray-200/300
  // so it's actually readable on dark backgrounds
  const t = {
    card:       dm ? 'bg-gray-900/40 border border-white/10 backdrop-blur-md' : 'bg-white/40 border border-white/50 backdrop-blur-md',
    text:       dm ? 'text-white'        : 'text-gray-900',
    textSub:    dm ? 'text-gray-200'     : 'text-gray-600',   // was text-gray-400 — now visible
    textMuted:  dm ? 'text-gray-300'     : 'text-gray-500',   // was text-gray-500 — now visible
    divider:    dm ? 'border-white/10'   : 'border-black/10',
    input:      dm ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400 focus:ring-amber-500'
                   : 'bg-white/60 border-white/40 text-gray-900 placeholder-gray-400 focus:ring-amber-500',
    pill:       dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15',
    pillActive: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
    tableHead:  dm ? 'bg-white/5 text-gray-300'   : 'bg-black/5 text-gray-500',  // was gray-400
    tableRow:   dm ? 'hover:bg-white/5 border-white/10' : 'hover:bg-black/[0.03] border-black/10',
    sidebar:    dm ? 'bg-gray-950 border-r border-gray-800' : 'bg-white border-r border-gray-100',
    modalBg:    dm ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200',
    innerCard:  dm ? 'bg-white/5' : 'bg-black/[0.04]',
    mobileCard: dm ? 'bg-gray-900/50 border border-white/10' : 'bg-white/60 border border-black/10',
    sidebarText: dm ? 'text-white'    : 'text-gray-900',
    sidebarSub:  dm ? 'text-gray-200' : 'text-gray-600',   // was gray-400
    sidebarMuted:dm ? 'text-gray-300' : 'text-gray-500',   // was gray-500
  };

  const loadApiaryLocations = async () => {
    try {
      const res = await fetch('/api/smart-hive/apiary-locations');
      const result = await res.json();
      if (result.success) setApiaryLocations(result.data);
    } catch {}
  };

  const saveApiaryLocation = async (location: ApiaryLocation) => {
    try {
      const res = await fetch('/api/smart-hive/apiary-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
      });
      const result = await res.json();
      return result.success;
    } catch { return false; }
  };

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const purchasesRes  = await fetch('/api/admin/purchases', { credentials: 'include' });
      const purchasesData = await purchasesRes.json();
      if (!purchasesData.success) throw new Error(purchasesData.error || 'Failed to fetch purchases');
      setPurchases(purchasesData.data || []);
      const containersRes  = await fetch('/api/smart-hive/containers', { credentials: 'include' });
      const containersData = await containersRes.json();
      if (containersData.success) setContainers(containersData.data || []);
      else setError('Failed to load containers: ' + containersData.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetLocationClick = (containerName: string) => {
    setSelectedLocationContainer(containerName);
    const existing = apiaryLocations[containerName];
    setLocationForm(existing
      ? { lat: existing.lat.toString(), lon: existing.lon.toString(), address: existing.address || '' }
      : { lat: '', lon: '', address: '' }
    );
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!selectedLocationContainer) return;
    const lat = parseFloat(locationForm.lat);
    const lon = parseFloat(locationForm.lon);
    if (isNaN(lat) || isNaN(lon)) { alert('Please enter valid latitude and longitude values'); return; }
    if (lat < -90 || lat > 90)    { alert('Latitude must be between -90 and 90'); return; }
    if (lon < -180 || lon > 180)  { alert('Longitude must be between -180 and 180'); return; }
    const newLocation: ApiaryLocation = { containerId: selectedLocationContainer, lat, lon, address: locationForm.address.trim() || undefined };
    const saved = await saveApiaryLocation(newLocation);
    if (saved) {
      setApiaryLocations(prev => ({ ...prev, [selectedLocationContainer]: newLocation }));
      setShowLocationModal(false); setSelectedLocationContainer(null); setLocationForm({ lat: '', lon: '', address: '' });
      await loadApiaryLocations();
    } else { alert('Failed to save location. Please try again.'); }
  };

  const handleGrantAccess = async (purchaseId: number) => {
    if (!confirm('Grant access to this user?')) return;
    setProcessing(purchaseId);
    try {
      const res = await fetch(`/api/admin/purchases/${purchaseId}/grant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      const result = await res.json();
      if (result.success) { await fetchData(); } else { alert(result.error || 'Failed to grant access'); }
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setProcessing(null); }
  };

  const handleRevokeAccess = async (purchaseId: number) => {
    if (!confirm('Revoke access for this user?')) return;
    setProcessing(purchaseId);
    try {
      const res = await fetch(`/api/admin/purchases/${purchaseId}/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      const result = await res.json();
      if (result.success) { await fetchData(); } else { alert(result.error || 'Failed to revoke access'); }
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setProcessing(null); }
  };

  const handleOpenContainerModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase); setTempContainers(purchase.assignedContainers || []); setAdminNotes(purchase.adminNotes || ''); setShowContainerModal(true);
  };

  const handleToggleContainer = (name: string) => {
    setTempContainers(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  };

  const handleSaveContainers = async () => {
    if (!selectedPurchase) return;
    try {
      const res = await fetch(`/api/admin/purchases/${selectedPurchase.id}/containers`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ containers: tempContainers, adminNotes }),
      });
      const result = await res.json();
      if (result.success) { await fetchData(); setShowContainerModal(false); }
      else { alert(result.error || 'Failed to update containers'); }
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const toggleRowExpansion = (id: number) => {
    setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const filteredPurchases = purchases.filter(p =>
    (p.user.email.toLowerCase().includes(searchQuery.toLowerCase()) || p.fullName.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (filterStatus === 'all' || p.status === filterStatus)
  );

  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => p.status === 'pending').length,
    approved: purchases.filter(p => p.status === 'approved').length,
    active: purchases.filter(p => p.accessGranted).length,
    locationsSet: Object.keys(apiaryLocations).length,
    totalContainers: containers.length,
  };

  if (!mounted || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-gray-950' : 'bg-amber-50'}`}>
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className={`absolute inset-0 border-2 rounded-full ${dm ? 'border-gray-800' : 'border-amber-200'}`} />
            <div className="absolute inset-0 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🐝</div>
          </div>
          <p className={`text-xl font-bold mb-1 ${dm ? 'text-white' : 'text-gray-900'}`}>Loading Admin Panel</p>
          <p className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Fetching purchases & containers…</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, title, value, gradient }: any) => (
    <div className={`relative overflow-hidden rounded-2xl shadow-md ${t.card} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06]`} />
      <div className="relative p-4 sm:p-5">
        <div className={`inline-flex p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md mb-2 sm:mb-3`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${t.textMuted}`}>{title}</p>
        <span className={`text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br ${gradient}`}>{value}</span>
      </div>
      <div className={`h-0.5 bg-gradient-to-r ${gradient} opacity-60`} />
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg: Record<string, string> = {
      approved: 'from-emerald-500 to-teal-500',
      pending:  'from-amber-500 to-yellow-500',
      rejected: 'from-red-500 to-rose-500',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${cfg[status] || 'from-gray-500 to-gray-600'} capitalize`}>
        {status}
      </span>
    );
  };

  const MobilePurchaseCard = ({ purchase }: { purchase: Purchase }) => {
    const isExpanded = expandedRows.has(purchase.id);
    return (
      <div className={`rounded-2xl shadow-sm ${t.mobileCard} overflow-hidden mb-3`}>
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold truncate ${t.text}`}>{purchase.fullName}</p>
              <p className={`text-xs mt-0.5 truncate ${t.textMuted}`}>{purchase.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
              <StatusBadge status={purchase.status} />
              {purchase.accessGranted && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-sky-500 to-blue-500">
                  Access Active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                <span className={`text-xs ${t.textSub}`}>Master: <span className="font-bold">{purchase.masterHives}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className={`text-xs ${t.textSub}`}>Normal: <span className="font-bold">{purchase.normalHives}</span></span>
              </div>
            </div>
            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-500 to-yellow-500">
              ${purchase.totalAmount}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleOpenContainerModal(purchase)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-1 justify-center transition-all ${dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15'}`}>
              <Package className="w-3.5 h-3.5" />
              {purchase.assignedContainers?.length || 0} containers
            </button>
            {!purchase.accessGranted ? (
              <button onClick={() => handleGrantAccess(purchase.id)} disabled={processing === purchase.id}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-bold flex-1 justify-center shadow-md hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:pointer-events-none">
                <UserCheck className="w-3.5 h-3.5" />Grant Access
              </button>
            ) : (
              <button onClick={() => handleRevokeAccess(purchase.id)} disabled={processing === purchase.id}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-xs font-bold flex-1 justify-center shadow-md hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:pointer-events-none">
                <UserX className="w-3.5 h-3.5" />Revoke
              </button>
            )}
            <button onClick={() => toggleRowExpansion(purchase.id)}
              className={`p-2 rounded-xl transition-all ${dm ? 'hover:bg-white/10 text-gray-300 bg-white/5' : 'hover:bg-black/10 text-gray-500 bg-black/5'}`}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className={`px-4 pb-4 border-t ${t.divider} pt-4`}>
            <div className="grid grid-cols-1 gap-3">
              <div className={`rounded-xl p-3 ${t.innerCard}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${t.textMuted}`}>Contact Info</p>
                <div className={`space-y-1 text-xs ${t.textSub}`}>
                  <p><span className="font-semibold">Phone:</span> {purchase.phone}</p>
                  <p><span className="font-semibold">Address:</span> {purchase.address}</p>
                  <p><span className="font-semibold">City:</span> {purchase.city}, {purchase.country}</p>
                </div>
              </div>
              <div className={`rounded-xl p-3 ${t.innerCard}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${t.textMuted}`}>Purchase Details</p>
                <div className={`space-y-1 text-xs ${t.textSub}`}>
                  <p><span className="font-semibold">Date:</span> {new Date(purchase.purchaseDate).toLocaleDateString()}</p>
                  {purchase.adminNotes && (
                    <div className={`mt-2 p-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/40' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className={`font-bold mb-1 ${dm ? 'text-amber-400' : 'text-amber-700'}`}>Admin Notes</p>
                      <p className={dm ? 'text-amber-300' : 'text-amber-700'}>{purchase.adminNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen relative transition-colors duration-300">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute inset-0 ${dm ? 'bg-gradient-to-br from-gray-950 via-amber-950/20 to-gray-950' : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50'}`} />
        <div className={`absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-3xl opacity-20 ${dm ? 'bg-amber-700' : 'bg-amber-300'} animate-pulse`} />
        <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-15 ${dm ? 'bg-yellow-700' : 'bg-yellow-300'} animate-pulse`} style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Sidebar backdrop */}
      {sidebarOpen && <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/40" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ──
          FIX: bottom section uses paddingBottom with safe-area-inset-bottom
          so Dark Mode and Sign Out buttons never hide behind the gesture bar */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${t.sidebar} shadow-2xl flex flex-col`}>

        {/* Sidebar header — also safe area aware for top */}
        <div
          className={`px-6 flex items-center justify-between border-b ${t.divider}`}
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: '16px' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg text-xl">🐝</div>
            <div>
              <h2 className={`text-sm font-black tracking-tight ${t.sidebarText}`}>Smart Hive</h2>
              <p className={`text-xs ${t.sidebarMuted}`}>Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access level badge */}
        <div className={`mx-4 my-4 px-4 py-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/60' : 'bg-amber-50 border border-amber-100'}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${dm ? 'text-amber-400' : 'text-amber-600'}`}>Access Level</p>
          <p className={`text-sm font-bold ${t.sidebarText}`}>Administrator</p>
          <p className={`text-xs truncate mt-0.5 ${t.sidebarMuted}`}>{adminInfo?.email || 'admin'}</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.sidebarMuted}`}>Navigation</p>
          {[
            { label: 'Home',        icon: Home,            action: () => router.push('/welcome') },
            { label: 'Smart Hive',  icon: LayoutDashboard, action: () => router.push('/smart-hive') },
            { label: 'Calibration', icon: Settings,        action: () => router.push('/admin/correction') },
            { label: 'Purchase',    icon: ShoppingCart,    action: () => router.push('/purchase') },
          ].map(item => (
            <button key={item.label} onClick={() => { item.action(); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.sidebarText} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border ${dm ? 'border-amber-500/30 text-amber-300' : 'border-amber-500/30 text-amber-700'}`}>
            <UserCheck className="w-4 h-4" />Access Management
          </div>

          {/* Mobile-only quick actions */}
          <div className={`md:hidden pt-2 border-t ${t.divider} space-y-1`}>
            <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.sidebarMuted}`}>Quick Actions</p>
            <button onClick={() => { setShowLocationsPanel(!showLocationsPanel); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${showLocationsPanel ? 'bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-500' : `${t.sidebarText} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}`}>
              <MapPin className="w-4 h-4" />Locations
            </button>
            <button onClick={() => { router.push('/admin/correction'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.sidebarText} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <Settings className="w-4 h-4" />Calibration
            </button>
            <button onClick={() => { fetchData(); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.sidebarText} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <RefreshCw className="w-4 h-4" />Refresh Data
            </button>
          </div>
        </nav>

        {/* ── Sidebar footer — FIX: safe area bottom padding ──
            This pushes Dark Mode and Sign Out above the phone's gesture/nav bar */}
        <div
          className={`px-4 border-t ${t.divider} space-y-2`}
          style={{
            paddingTop: '16px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          }}
        >
          <button onClick={() => setDarkMode(!dm)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {dm ? <SunMedium className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            {dm ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={() => { localStorage.removeItem('adminInfo'); router.push('/login'); }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>

      <div className="relative min-h-screen flex flex-col">

        {/* ── Header ── 
            FIX: safe area top padding so header clears status bar properly */}
        <header
          className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/30 border-b border-white/10' : 'bg-white/20 border-b border-white/30'} backdrop-blur-xl`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center justify-between px-4 sm:px-5 py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Menu className="w-5 h-5" />
              </button>
              <div className={`w-px h-5 flex-shrink-0 ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm text-sm flex-shrink-0">🐝</div>
                <div className="min-w-0">
                  <h1 className={`text-sm font-black tracking-tight leading-none truncate ${t.text}`}>Access Management</h1>
                  <p className={`text-[10px] mt-0.5 truncate ${t.textMuted}`}>{adminInfo?.email || 'Administrator'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>Admin</span>
              </div>
              <button onClick={() => router.push('/smart-hive')}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-semibold text-xs">
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Smart Hive</span>
              </button>
              <button onClick={() => setShowLocationsPanel(!showLocationsPanel)}
                className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all shadow-md ${showLocationsPanel ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white' : dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <MapPin className="w-3.5 h-3.5" /><span>Locations</span>
              </button>
              <button onClick={() => router.push('/admin/correction')}
                className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Settings className="w-3.5 h-3.5" /><span>Calibration</span>
              </button>
              <button onClick={fetchData}
                className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-semibold text-xs">
                <RefreshCw className="w-3.5 h-3.5" /><span>Refresh</span>
              </button>
              <button onClick={() => setDarkMode(!dm)} className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => { localStorage.removeItem('adminInfo'); router.push('/login'); }}
                className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
                <LogOut className="w-3.5 h-3.5" /><span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8 max-w-screen-2xl mx-auto w-full">

          {error && (
            <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5 flex items-start gap-3`}>
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-bold ${t.text}`}>Error</p>
                <p className={`text-xs mt-0.5 ${t.textSub}`}>{error}</p>
              </div>
            </div>
          )}

          {/* Status banner */}
          <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                    <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                </div>
                <div>
                  <h2 className={`text-sm font-black ${t.text}`}>Access Management</h2>
                  <p className={`text-xs ${t.textSub}`}>{stats.total} purchases · {stats.pending} pending · {stats.active} active</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl flex-1 sm:flex-none ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                  <Clock className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                  <div>
                    <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Pending</p>
                    <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{stats.pending}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl flex-1 sm:flex-none ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                  <Activity className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                  <div>
                    <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Active</p>
                    <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{stats.active}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-5">
            <StatCard icon={Package}   title="Total"      value={stats.total}           gradient="from-sky-500 to-blue-500" />
            <StatCard icon={Clock}     title="Pending"    value={stats.pending}         gradient="from-amber-500 to-yellow-500" />
            <StatCard icon={Check}     title="Approved"   value={stats.approved}        gradient="from-emerald-500 to-teal-500" />
            <StatCard icon={UserCheck} title="Active"     value={stats.active}          gradient="from-violet-500 to-purple-600" />
            <StatCard icon={Zap}       title="Containers" value={stats.totalContainers} gradient="from-rose-500 to-pink-500" />
            <StatCard icon={MapPin}    title="Locations"  value={stats.locationsSet}    gradient="from-orange-500 to-amber-500" />
          </div>

          {/* Locations panel */}
          {showLocationsPanel && (
            <div className={`rounded-2xl shadow-md ${t.card} p-5 mb-5`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md flex-shrink-0">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className={`text-base font-black ${t.text}`}>Apiary Locations</h2>
                  <p className={`text-xs ${t.textSub}`}>Set GPS coordinates for each container</p>
                </div>
                <button onClick={() => setShowLocationsPanel(false)} className={`p-1.5 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {containers.map(container => {
                  const location = apiaryLocations[container.name];
                  return (
                    <div key={container.name} className={`rounded-2xl p-4 border-2 transition-all ${location ? (dm ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-300/60 bg-emerald-50/60') : (dm ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/[0.02]')}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate ${t.text}`}>{container.name}</p>
                          {location?.address && <p className={`text-[10px] mt-0.5 truncate ${t.textMuted}`}>{location.address}</p>}
                        </div>
                        <span className={`flex-shrink-0 ml-2 w-2.5 h-2.5 rounded-full mt-1 ${location ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                      </div>
                      {location ? (
                        <p className={`text-xs font-mono mb-3 ${t.textSub}`}>{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</p>
                      ) : (
                        <p className={`text-xs mb-3 ${t.textMuted}`}>No location set</p>
                      )}
                      <button onClick={() => handleSetLocationClick(container.name)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${location
                          ? (dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15')
                          : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-yellow-600'}`}>
                        {location ? 'Edit Location' : 'Set Location'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className={`absolute left-3.5 top-3 w-4 h-4 ${t.textMuted}`} />
                <input type="text" placeholder="Search by name or email…" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
              </div>
              <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-2 rounded-lg font-bold text-xs transition-all capitalize flex-1 ${filterStatus === s ? t.pillActive : t.pill}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Purchase list */}
          {filteredPurchases.length > 0 ? (
            <>
              {/* Mobile cards */}
              <div className="md:hidden">
                {filteredPurchases.map(purchase => (
                  <MobilePurchaseCard key={purchase.id} purchase={purchase} />
                ))}
              </div>

              {/* Desktop table */}
              <div className={`hidden md:block rounded-2xl shadow-md ${t.card} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className={t.tableHead}>
                        {['User', 'Hives', 'Amount', 'Status', 'Containers', 'Actions', ''].map(h => (
                          <th key={h} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${t.divider}`}>
                      {filteredPurchases.map(purchase => (
                        <React.Fragment key={purchase.id}>
                          <tr className={`transition-colors ${t.tableRow}`}>
                            <td className="px-5 py-4">
                              <p className={`text-sm font-bold ${t.text}`}>{purchase.fullName}</p>
                              <p className={`text-xs mt-0.5 ${t.textMuted}`}>{purchase.email}</p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                  <span className={`text-xs ${t.textSub}`}>Master: <span className="font-bold">{purchase.masterHives}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  <span className={`text-xs ${t.textSub}`}>Normal: <span className="font-bold">{purchase.normalHives}</span></span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-base font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-500 to-yellow-500">${purchase.totalAmount}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1.5">
                                <StatusBadge status={purchase.status} />
                                {purchase.accessGranted && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-sky-500 to-blue-500">
                                    Access Active
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <button onClick={() => handleOpenContainerModal(purchase)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 ${dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15'}`}>
                                <Package className="w-3.5 h-3.5" />
                                {purchase.assignedContainers?.length || 0} assigned
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              {!purchase.accessGranted ? (
                                <button onClick={() => handleGrantAccess(purchase.id)} disabled={processing === purchase.id}
                                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-emerald-600 hover:to-teal-600 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none">
                                  <UserCheck className="w-3.5 h-3.5" />Grant
                                </button>
                              ) : (
                                <button onClick={() => handleRevokeAccess(purchase.id)} disabled={processing === purchase.id}
                                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-red-600 hover:to-rose-600 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none">
                                  <UserX className="w-3.5 h-3.5" />Revoke
                                </button>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <button onClick={() => toggleRowExpansion(purchase.id)}
                                className={`p-1.5 rounded-lg transition-all ${dm ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-black/10 text-gray-500'}`}>
                                {expandedRows.has(purchase.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                          {expandedRows.has(purchase.id) && (
                            <tr>
                              <td colSpan={7} className={`px-5 py-5 ${dm ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className={`rounded-2xl p-4 ${t.innerCard}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
                                        <UserCheck className="w-3.5 h-3.5 text-white" />
                                      </div>
                                      <p className={`text-xs font-black uppercase tracking-widest ${t.textSub}`}>Contact</p>
                                    </div>
                                    <div className={`space-y-1.5 text-xs ${t.textSub}`}>
                                      <p><span className="font-semibold">Phone:</span> {purchase.phone}</p>
                                      <p><span className="font-semibold">Address:</span> {purchase.address}</p>
                                      <p><span className="font-semibold">City:</span> {purchase.city}, {purchase.country}</p>
                                    </div>
                                  </div>
                                  <div className={`rounded-2xl p-4 ${t.innerCard}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                                        <Package className="w-3.5 h-3.5 text-white" />
                                      </div>
                                      <p className={`text-xs font-black uppercase tracking-widest ${t.textSub}`}>Purchase Details</p>
                                    </div>
                                    <div className={`space-y-1.5 text-xs ${t.textSub}`}>
                                      <p><span className="font-semibold">Date:</span> {new Date(purchase.purchaseDate).toLocaleDateString()}</p>
                                      {purchase.adminNotes && (
                                        <div className={`mt-2 p-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/40' : 'bg-amber-50 border border-amber-200'}`}>
                                          <p className={`font-bold mb-1 ${dm ? 'text-amber-400' : 'text-amber-700'}`}>Admin Notes</p>
                                          <p className={dm ? 'text-amber-300' : 'text-amber-700'}>{purchase.adminNotes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className={`rounded-2xl shadow-md ${t.card} p-16 text-center`}>
              <div className="text-6xl mb-4">🐝</div>
              <h3 className={`text-lg font-bold mb-2 ${t.text}`}>No Purchases Found</h3>
              <p className={`text-sm ${t.textSub}`}>Try adjusting your search or filter.</p>
            </div>
          )}
        </main>
      </div>

      {/* ── Location Modal ── */}
      {showLocationModal && selectedLocationContainer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6 ${t.modalBg} max-h-[90vh] overflow-y-auto`}
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5 sm:hidden" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md flex-shrink-0">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={`text-base font-black ${t.text}`}>Set Apiary Location</h3>
                <p className={`text-xs ${t.textMuted}`}>{selectedLocationContainer}</p>
              </div>
            </div>
            <div className="space-y-4 mb-5">
              {[
                { label: 'Latitude *',  key: 'lat',     placeholder: 'e.g., 24.453884', hint: 'Range: -90 to 90' },
                { label: 'Longitude *', key: 'lon',     placeholder: 'e.g., 54.377344', hint: 'Range: -180 to 180' },
                { label: 'Address',     key: 'address', placeholder: 'e.g., Abu Dhabi, UAE', hint: 'Human-readable name (optional)' },
              ].map(({ label, key, placeholder, hint }) => (
                <div key={key}>
                  <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>{label}</label>
                  <input type={key === 'address' ? 'text' : 'number'} step="any"
                    placeholder={placeholder}
                    value={(locationForm as any)[key]}
                    onChange={e => setLocationForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
                  <p className={`text-[10px] mt-1 ${t.textMuted}`}>{hint}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-xl p-4 mb-5 ${dm ? 'bg-amber-950/60 border border-amber-900/40' : 'bg-amber-50 border border-amber-100'}`}>
              <p className={`text-xs font-bold mb-2 ${dm ? 'text-amber-400' : 'text-amber-700'}`}>💡 How to get coordinates</p>
              <ol className={`text-xs space-y-1 list-decimal list-inside ${dm ? 'text-amber-300' : 'text-amber-700'}`}>
                <li>Open Google Maps</li>
                <li>Right-click on your apiary location</li>
                <li>Click the coordinates to copy them</li>
                <li>Paste latitude and longitude here</li>
              </ol>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowLocationModal(false); setSelectedLocationContainer(null); setLocationForm({ lat: '', lon: '', address: '' }); }}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Cancel
              </button>
              <button onClick={handleSaveLocation}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-yellow-600 transition-all">
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Container Modal ── */}
      {showContainerModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${t.modalBg}`}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-4 sm:hidden" />
            <div className={`px-6 py-5 border-b ${t.divider} flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md flex-shrink-0">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={`text-base font-black ${t.text}`}>Assign Containers</h2>
                <p className={`text-xs truncate ${t.textMuted}`}>{selectedPurchase.fullName} · {selectedPurchase.email}</p>
              </div>
              <button onClick={() => setShowContainerModal(false)} className={`p-1.5 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {containers.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">📦</div>
                  <p className={`text-sm font-bold ${t.text}`}>No containers available</p>
                </div>
              ) : (
                <div className="space-y-2 mb-5">
                  <p className={`text-xs font-bold mb-3 ${t.textSub}`}>{containers.length} containers available</p>
                  {containers.map(container => {
                    const location   = apiaryLocations[container.name];
                    const isSelected = tempContainers.includes(container.name);
                    return (
                      <label key={container.name}
                        className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${isSelected
                          ? (dm ? 'border-amber-400/50 bg-amber-500/10' : 'border-amber-400/60 bg-amber-50')
                          : (dm ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-black/10 bg-black/[0.02] hover:bg-black/[0.04]')}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => handleToggleContainer(container.name)}
                          className="w-4 h-4 accent-amber-500 rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-bold ${t.text}`}>{container.name}</p>
                            {location && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${dm ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                <MapPin className="w-2.5 h-2.5" />Located
                              </span>
                            )}
                          </div>
                          {location && (
                            <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                              {location.lat.toFixed(4)}, {location.lon.toFixed(4)}{location.address ? ` · ${location.address}` : ''}
                            </p>
                          )}
                          {container.lastModified && (
                            <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Modified: {new Date(container.lastModified).toLocaleDateString()}</p>
                          )}
                        </div>
                        {container.blobCount !== undefined && (
                          <span className={`text-xs font-semibold flex-shrink-0 ${t.textMuted}`}>{container.blobCount} files</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>Admin Notes</label>
                <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this assignment…"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none resize-none transition-all ${t.input}`} rows={3} />
              </div>
            </div>
            <div
              className={`px-5 border-t ${t.divider} flex gap-3`}
              style={{ paddingTop: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
            >
              <button onClick={() => setShowContainerModal(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Cancel
              </button>
              <button onClick={handleSaveContainers}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-yellow-600 transition-all">
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
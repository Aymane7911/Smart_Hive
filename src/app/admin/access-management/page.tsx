'use client'
// app/admin/access-management/page.tsx
//
// Three tabs:
//   📦 Orders   — inquiry forms submitted from /order (new flow)
//   🔐 Access   — registered users awaiting / granted dashboard access
//   📡 Devices  — physical SmartHive boxes (serial ↔ Azure container)

import React, { useState, useEffect } from 'react';
import {
  Search, Check, X, UserCheck, UserX, Package, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, LogOut, MapPin, Menu, Home, ShoppingCart,
  LayoutDashboard, Settings, Moon, SunMedium, Activity, Zap, Clock,
  Cpu, Plus, Trash2, Hash, Database, CheckCircle, XCircle,
  Mail, Phone, Globe, MessageSquare, Send, Eye,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Order {
  id: number; fullName: string; email: string; phone?: string;
  masterHives: number; normalHives: number; country?: string; city?: string;
  message?: string; status: string; adminNotes?: string; shippedAt?: string;
  createdAt: string;
}
interface User {
  id: number; email: string; firstname: string; lastname: string; role: string; createdAt: string;
}
interface Purchase {
  id: number; userId: number; user: User; masterHives: number; normalHives: number;
  totalAmount: number; status: string; accessGranted: boolean; assignedContainers: string[];
  purchaseDate: string; email: string; fullName: string; phone: string;
  address: string; city: string; country: string; adminNotes?: string;
}
interface Container { name: string; lastModified?: string; blobCount?: number; }
interface ApiaryLocation { containerId: string; lat: number; lon: number; address?: string; }
interface Device {
  id: number; serialNumber: string; azureContainerId: string; hiveCount: number;
  model: string; status: 'unclaimed' | 'claimed' | 'suspended';
  ownerId?: number; claimedAt?: string; createdAt: string;
  purchases?: { user: { email: string; firstname: string; lastname: string } }[];
}

type ActiveTab = 'orders' | 'access' | 'devices';
const ORDER_STATUSES = ['new', 'reviewed', 'shipped', 'rejected'] as const;

export default function AdminAccessManagement() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [purchases,  setPurchases]  = useState<Purchase[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [devices,    setDevices]    = useState<Device[]>([]);
  const [apiaryLocations, setApiaryLocations] = useState<Record<string, ApiaryLocation>>({});

  // ── Loading / error ─────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [ordersLoading,  setOrdersLoading]  = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('orders');
  const [adminInfo,    setAdminInfo]    = useState<any>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [darkMode,     setDarkMode]     = useState(false);
  const [mounted,      setMounted]      = useState(false);

  // ── Orders tab state ────────────────────────────────────────────────────────
  const [orderSearch,   setOrderSearch]   = useState('');
  const [orderFilter,   setOrderFilter]   = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<number | null>(null);
  const [orderNoteEdit, setOrderNoteEdit] = useState<{ id: number; note: string } | null>(null);

  // ── Access tab state ────────────────────────────────────────────────────────
  const [searchQuery,        setSearchQuery]        = useState('');
  const [filterStatus,       setFilterStatus]       = useState('all');
  const [selectedPurchase,   setSelectedPurchase]   = useState<Purchase | null>(null);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [tempContainers,     setTempContainers]     = useState<string[]>([]);
  const [adminNotes,         setAdminNotes]         = useState('');
  const [expandedRows,       setExpandedRows]       = useState<Set<number>>(new Set());
  const [processing,         setProcessing]         = useState<number | null>(null);
  const [showLocationsPanel, setShowLocationsPanel] = useState(false);
  const [showLocationModal,  setShowLocationModal]  = useState(false);
  const [selectedLocationContainer, setSelectedLocationContainer] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({ lat: '', lon: '', address: '' });

  // ── Devices tab state ───────────────────────────────────────────────────────
  const [deviceSearch,      setDeviceSearch]      = useState('');
  const [deviceFilter,      setDeviceFilter]      = useState('all');
  const [showAddDevice,     setShowAddDevice]     = useState(false);
  const [addingDevice,      setAddingDevice]      = useState(false);
  const [deviceForm,        setDeviceForm]        = useState({ serialNumber: '', azureContainerId: '', hiveCount: '1', model: 'STANDARD' });
  const [deviceFormError,   setDeviceFormError]   = useState('');
  const [deviceFormSuccess, setDeviceFormSuccess] = useState('');

  const router = useRouter();

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('hive-darkMode');
    if (saved === 'true') setDarkMode(true);
    const stored = localStorage.getItem('adminInfo');
    if (stored) setAdminInfo(JSON.parse(stored));
    setMounted(true);
    fetchAll();
    loadApiaryLocations();
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('hive-darkMode', String(darkMode));
  }, [darkMode, mounted]);

  const dm = mounted && darkMode;

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const t = {
    card:        dm ? 'bg-gray-900/40 border border-white/10 backdrop-blur-md' : 'bg-white/40 border border-white/50 backdrop-blur-md',
    text:        dm ? 'text-white'      : 'text-gray-900',
    textSub:     dm ? 'text-gray-200'   : 'text-gray-600',
    textMuted:   dm ? 'text-gray-300'   : 'text-gray-500',
    divider:     dm ? 'border-white/10' : 'border-black/10',
    input:       dm ? 'bg-gray-800/60 border-white/10 text-white placeholder-gray-400 focus:ring-amber-500'
                    : 'bg-white/60 border-white/40 text-gray-900 placeholder-gray-400 focus:ring-amber-500',
    pill:        dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15',
    pillActive:  'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
    tableHead:   dm ? 'bg-white/5 text-gray-300'  : 'bg-black/5 text-gray-500',
    tableRow:    dm ? 'hover:bg-white/5 border-white/10' : 'hover:bg-black/[0.03] border-black/10',
    sidebar:     dm ? 'bg-gray-950 border-r border-gray-800' : 'bg-white border-r border-gray-100',
    modalBg:     dm ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200',
    innerCard:   dm ? 'bg-white/5' : 'bg-black/[0.04]',
    mobileCard:  dm ? 'bg-gray-900/50 border border-white/10' : 'bg-white/60 border border-black/10',
    sidebarText: dm ? 'text-white'    : 'text-gray-900',
    sidebarMuted:dm ? 'text-gray-300' : 'text-gray-500',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true); setError(null);
    await Promise.all([fetchOrders(), fetchAccess(), fetchDevices()]);
    setLoading(false);
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res  = await fetch('/api/orders', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } catch {}
    finally { setOrdersLoading(false); }
  };

  const fetchAccess = async () => {
    try {
      const [pr, cr] = await Promise.all([
        fetch('/api/admin/purchases', { credentials: 'include' }),
        fetch('/api/smart-hive/containers', { credentials: 'include' }),
      ]);
      const pd = await pr.json(); if (pd.success) setPurchases(pd.data || []);
      const cd = await cr.json(); if (cd.success) setContainers(cd.data || []);
    } catch {}
  };

  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const res  = await fetch('/api/admin/devices', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDevices(data.data || []);
    } catch {}
    finally { setDevicesLoading(false); }
  };

  const loadApiaryLocations = async () => {
    try {
      const res    = await fetch('/api/smart-hive/apiary-locations');
      const result = await res.json();
      if (result.success) setApiaryLocations(result.data);
    } catch {}
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ORDERS HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  const updateOrderStatus = async (id: number, status: string, notes?: string) => {
    setUpdatingOrder(id);
    try {
      const res  = await fetch(`/api/orders/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status, ...(notes !== undefined && { adminNotes: notes }) }),
      });
      const data = await res.json();
      if (data.success) { await fetchOrders(); setOrderNoteEdit(null); }
      else alert(data.error || 'Failed to update order');
    } catch { alert('Network error'); }
    finally { setUpdatingOrder(null); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCESS HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGrantAccess = async (id: number) => {
    if (!confirm('Grant dashboard access to this user?')) return;
    setProcessing(id);
    try {
      const res  = await fetch(`/api/admin/purchases/${id}/grant`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) await fetchAccess(); else alert(data.error || 'Failed');
    } catch {} finally { setProcessing(null); }
  };

  const handleRevokeAccess = async (id: number) => {
    if (!confirm('Revoke dashboard access?')) return;
    setProcessing(id);
    try {
      const res  = await fetch(`/api/admin/purchases/${id}/revoke`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) await fetchAccess(); else alert(data.error || 'Failed');
    } catch {} finally { setProcessing(null); }
  };

  const handleOpenContainerModal = (p: Purchase) => {
    setSelectedPurchase(p); setTempContainers(p.assignedContainers || []);
    setAdminNotes(p.adminNotes || ''); setShowContainerModal(true);
  };

  const handleSaveContainers = async () => {
    if (!selectedPurchase) return;
    const res  = await fetch(`/api/admin/purchases/${selectedPurchase.id}/containers`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ containers: tempContainers, adminNotes }),
    });
    const data = await res.json();
    if (data.success) { await fetchAccess(); setShowContainerModal(false); }
    else alert(data.error || 'Failed');
  };

  // Location
  const handleSetLocationClick = (name: string) => {
    setSelectedLocationContainer(name);
    const ex = apiaryLocations[name];
    setLocationForm(ex ? { lat: ex.lat.toString(), lon: ex.lon.toString(), address: ex.address || '' } : { lat: '', lon: '', address: '' });
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!selectedLocationContainer) return;
    const lat = parseFloat(locationForm.lat), lon = parseFloat(locationForm.lon);
    if (isNaN(lat) || isNaN(lon)) { alert('Valid coordinates required'); return; }
    const loc: ApiaryLocation = { containerId: selectedLocationContainer, lat, lon, address: locationForm.address.trim() || undefined };
    const res = await fetch('/api/smart-hive/apiary-locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loc) });
    const data = await res.json();
    if (data.success) {
      setApiaryLocations(prev => ({ ...prev, [selectedLocationContainer]: loc }));
      setShowLocationModal(false); setSelectedLocationContainer(null);
    } else alert('Failed to save location');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DEVICES HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAddDevice = async () => {
    setDeviceFormError(''); setDeviceFormSuccess('');
    if (!deviceForm.serialNumber.trim())    { setDeviceFormError('Serial number is required'); return; }
    if (!deviceForm.azureContainerId.trim()){ setDeviceFormError('Azure Container ID is required'); return; }
    const hc = parseInt(deviceForm.hiveCount);
    if (isNaN(hc) || hc < 1 || hc > 50)   { setDeviceFormError('Hive count must be 1–50'); return; }
    setAddingDevice(true);
    try {
      const res  = await fetch('/api/admin/devices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ serialNumber: deviceForm.serialNumber.trim().toUpperCase(), azureContainerId: deviceForm.azureContainerId.trim(), hiveCount: hc, model: deviceForm.model }),
      });
      const data = await res.json();
      if (data.success) {
        setDeviceFormSuccess(`Device "${deviceForm.serialNumber.toUpperCase()}" registered!`);
        setDeviceForm({ serialNumber: '', azureContainerId: '', hiveCount: '1', model: 'STANDARD' });
        await fetchDevices();
        setTimeout(() => { setShowAddDevice(false); setDeviceFormSuccess(''); }, 2000);
      } else { setDeviceFormError(data.error || 'Failed to add device'); }
    } catch { setDeviceFormError('Network error'); }
    finally { setAddingDevice(false); }
  };

  const handleDeleteDevice = async (d: Device) => {
    if (d.status === 'claimed') { alert('Cannot delete a claimed device. Suspend it instead.'); return; }
    if (!confirm(`Delete "${d.serialNumber}"? This cannot be undone.`)) return;
    const res  = await fetch(`/api/admin/devices/${d.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) await fetchDevices(); else alert(data.error || 'Failed');
  };

  const handleSuspendDevice = async (d: Device) => {
    const newStatus = d.status === 'suspended' ? 'claimed' : 'suspended';
    if (!confirm(`${newStatus === 'suspended' ? 'Suspend' : 'Restore'} "${d.serialNumber}"?`)) return;
    const res  = await fetch(`/api/admin/devices/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (data.success) await fetchDevices(); else alert(data.error || 'Failed');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────────────────────────────────────────
  const stats = {
    newOrders:        orders.filter(o => o.status === 'new').length,
    shippedOrders:    orders.filter(o => o.status === 'shipped').length,
    reviewedOrders:   orders.filter(o => o.status === 'reviewed').length,
    totalOrders:      orders.length,
    pendingAccess:    purchases.filter(p => !p.accessGranted).length,
    activeAccess:     purchases.filter(p => p.accessGranted).length,
    totalContainers:  containers.length,
    totalDevices:     devices.length,
    unclaimedDevices: devices.filter(d => d.status === 'unclaimed').length,
    claimedDevices:   devices.filter(d => d.status === 'claimed').length,
  };

  const filteredOrders = orders.filter(o =>
    (o.fullName.toLowerCase().includes(orderSearch.toLowerCase()) || o.email.toLowerCase().includes(orderSearch.toLowerCase())) &&
    (orderFilter === 'all' || o.status === orderFilter)
  );

  const filteredPurchases = purchases.filter(p =>
    (p.user.email.toLowerCase().includes(searchQuery.toLowerCase()) || (p.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
    (filterStatus === 'all' || (filterStatus === 'granted' ? p.accessGranted : !p.accessGranted))
  );

  const filteredDevices = devices.filter(d =>
    (d.serialNumber.toLowerCase().includes(deviceSearch.toLowerCase()) || d.azureContainerId.toLowerCase().includes(deviceSearch.toLowerCase())) &&
    (deviceFilter === 'all' || d.status === deviceFilter)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SHARED SUB-COMPONENTS
  // ─────────────────────────────────────────────────────────────────────────────
  const StatCard = ({ icon: Icon, title, value, gradient, badge = 0 }: any) => (
    <div className={`relative overflow-hidden rounded-2xl shadow-md ${t.card} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06]`} />
      <div className="relative p-4 sm:p-5">
        <div className={`inline-flex p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md mb-2 sm:mb-3`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${t.textMuted}`}>{title}</p>
        <div className="flex items-center gap-2">
          <span className={`text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br ${gradient}`}>{value}</span>
          {badge > 0 && <span className="text-[10px] font-black text-white bg-red-500 rounded-full px-1.5 py-0.5 animate-pulse">{badge} new</span>}
        </div>
      </div>
      <div className={`h-0.5 bg-gradient-to-r ${gradient} opacity-60`} />
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg: Record<string, string> = {
      new:       'from-sky-500 to-blue-500',
      reviewed:  'from-amber-500 to-yellow-500',
      shipped:   'from-violet-500 to-purple-600',
      rejected:  'from-red-500 to-rose-500',
      pending:   'from-amber-500 to-yellow-500',
      approved:  'from-emerald-500 to-teal-500',
      unclaimed: 'from-sky-500 to-blue-500',
      claimed:   'from-emerald-500 to-teal-500',
      suspended: 'from-red-500 to-rose-500',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${cfg[status] || 'from-gray-500 to-gray-600'} capitalize`}>
        {status}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
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
          <p className={`text-sm ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Fetching data…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: ORDERS
  // ─────────────────────────────────────────────────────────────────────────────
  const OrdersTab = () => (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <StatCard icon={Package}      title="Total Orders"  value={stats.totalOrders}    gradient="from-sky-500 to-blue-500" badge={stats.newOrders} />
        <StatCard icon={Clock}        title="New"           value={stats.newOrders}      gradient="from-amber-500 to-yellow-500" />
        <StatCard icon={Send}         title="Shipped"       value={stats.shippedOrders}  gradient="from-violet-500 to-purple-600" />
        <StatCard icon={Eye}          title="Reviewed"      value={stats.reviewedOrders} gradient="from-emerald-500 to-teal-500" />
      </div>

      {/* Filters */}
      <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
        <div className="relative mb-3">
          <Search className={`absolute left-3.5 top-3 w-4 h-4 ${t.textMuted}`} />
          <input type="text" placeholder="Search by name or email…" value={orderSearch}
            onChange={e => setOrderSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
        </div>
        <div className="flex gap-2">
          {['all', ...ORDER_STATUSES].map(s => (
            <button key={s} onClick={() => setOrderFilter(s)}
              className={`px-3 py-2 rounded-lg font-bold text-xs transition-all capitalize flex-1 ${orderFilter === s ? t.pillActive : t.pill}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      {ordersLoading ? (
        <div className={`rounded-2xl ${t.card} p-16 text-center`}>
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={`rounded-2xl ${t.card} p-16 text-center`}>
          <div className="text-6xl mb-4">📬</div>
          <h3 className={`text-lg font-bold mb-2 ${t.text}`}>No Orders Yet</h3>
          <p className={`text-sm ${t.textSub}`}>Inquiries submitted from /order will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div key={order.id} className={`rounded-2xl shadow-sm ${t.card} overflow-hidden`}>
              {/* Row header */}
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className={`text-sm font-black ${t.text}`}>{order.fullName}</p>
                    <StatusBadge status={order.status} />
                    {order.status === 'new' && (
                      <span className="text-[10px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>
                    )}
                  </div>
                  <div className={`flex flex-wrap gap-x-4 gap-y-0.5 text-xs ${t.textMuted} mb-2`}>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{order.email}</span>
                    {order.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{order.phone}</span>}
                    {order.country && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{order.city ? `${order.city}, ` : ''}{order.country}</span>}
                  </div>
                  <div className={`flex items-center gap-4 text-xs ${t.textSub}`}>
                    <span>🔷 {order.masterHives} Master</span>
                    <span>🔶 {order.normalHives} Normal</span>
                    <span className="text-amber-400 font-bold">${order.masterHives * 299 + order.normalHives * 199}</span>
                    <span className={t.textMuted}>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-black/10 text-gray-500'}`}>
                  {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded actions */}
              {expandedOrder === order.id && (
                <div className={`px-4 pb-4 pt-3 border-t ${t.divider}`}>
                  {order.message && (
                    <div className={`rounded-xl p-3 mb-4 ${t.innerCard}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>Customer Message</p>
                      <p className={`text-sm ${t.text}`}>{order.message}</p>
                    </div>
                  )}
                  {order.adminNotes && !orderNoteEdit && (
                    <div className={`rounded-xl p-3 mb-4 ${dm ? 'bg-amber-950/60 border border-amber-900/40' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${dm ? 'text-amber-400' : 'text-amber-600'}`}>Admin Notes</p>
                      <p className={`text-xs ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{order.adminNotes}</p>
                    </div>
                  )}
                  <div className="mb-4">
                    <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>
                      {orderNoteEdit?.id === order.id ? 'Edit Admin Notes' : 'Add Notes'}
                    </label>
                    <textarea
                      value={orderNoteEdit?.id === order.id ? orderNoteEdit.note : ''}
                      onChange={e => setOrderNoteEdit({ id: order.id, note: e.target.value })}
                      onFocus={() => { if (!orderNoteEdit || orderNoteEdit.id !== order.id) setOrderNoteEdit({ id: order.id, note: order.adminNotes || '' }); }}
                      placeholder="Internal notes about this order…"
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:outline-none resize-none transition-all ${t.input}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_STATUSES.filter(s => s !== order.status).map(s => (
                      <button key={s}
                        onClick={() => updateOrderStatus(order.id, s, orderNoteEdit?.id === order.id ? orderNoteEdit.note : undefined)}
                        disabled={updatingOrder === order.id}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                          s === 'shipped'  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md hover:from-violet-600 hover:to-purple-700' :
                          s === 'reviewed' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md hover:from-amber-600 hover:to-yellow-600' :
                          s === 'rejected' ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md hover:from-red-600 hover:to-rose-600' :
                          t.pill
                        }`}>
                        {updatingOrder === order.id ? <RefreshCw className="w-3 h-3 animate-spin" /> :
                          s === 'shipped' ? <Send className="w-3 h-3" /> :
                          s === 'reviewed' ? <Eye className="w-3 h-3" /> :
                          s === 'rejected' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                        Mark as {s}
                      </button>
                    ))}
                    {orderNoteEdit?.id === order.id && (
                      <button
                        onClick={() => updateOrderStatus(order.id, order.status, orderNoteEdit.note)}
                        disabled={updatingOrder === order.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50">
                        <Check className="w-3 h-3" /> Save Notes
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: ACCESS
  // ─────────────────────────────────────────────────────────────────────────────
  const AccessTab = () => (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 mb-5">
        <StatCard icon={UserX}    title="Pending"    value={stats.pendingAccess}   gradient="from-amber-500 to-yellow-500" />
        <StatCard icon={UserCheck} title="Active"    value={stats.activeAccess}    gradient="from-emerald-500 to-teal-500" />
        <StatCard icon={Package}  title="Total"      value={purchases.length}      gradient="from-sky-500 to-blue-500" />
        <StatCard icon={Zap}      title="Containers" value={stats.totalContainers} gradient="from-rose-500 to-pink-500" />
        <StatCard icon={Cpu}      title="Devices"    value={stats.totalDevices}    gradient="from-violet-500 to-purple-600" />
      </div>

      {/* Apiary locations panel */}
      {showLocationsPanel && (
        <div className={`rounded-2xl shadow-md ${t.card} p-5 mb-5`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md flex-shrink-0">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`text-base font-black ${t.text}`}>Apiary Locations</h2>
              <p className={`text-xs ${t.textSub}`}>Set GPS coordinates for each container</p>
            </div>
            <button onClick={() => setShowLocationsPanel(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {containers.map(c => {
              const loc = apiaryLocations[c.name];
              return (
                <div key={c.name} className={`rounded-2xl p-4 border-2 transition-all ${loc
                  ? (dm ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-300/60 bg-emerald-50/60')
                  : (dm ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/[0.02]')}`}>
                  <div className="flex items-start justify-between mb-2">
                    <p className={`text-sm font-bold truncate flex-1 ${t.text}`}>{c.name}</p>
                    <span className={`w-2.5 h-2.5 rounded-full ml-2 mt-1 flex-shrink-0 ${loc ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                  </div>
                  {loc
                    ? <p className={`text-xs font-mono mb-3 ${t.textSub}`}>{loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}</p>
                    : <p className={`text-xs mb-3 ${t.textMuted}`}>No location set</p>}
                  <button onClick={() => handleSetLocationClick(c.name)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${loc
                      ? (dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15')
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md hover:from-amber-600 hover:to-yellow-600'}`}>
                    {loc ? 'Edit Location' : 'Set Location'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3.5 top-3 w-4 h-4 ${t.textMuted}`} />
            <input type="text" placeholder="Search by name or email…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
          </div>
          <button onClick={() => setShowLocationsPanel(!showLocationsPanel)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all flex-shrink-0 ${showLocationsPanel ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white' : dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <MapPin className="w-3.5 h-3.5" /><span className="hidden sm:inline">Locations</span>
          </button>
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'All' }, { v: 'pending', l: 'Pending' }, { v: 'granted', l: 'Granted' }].map(({ v, l }) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-2 rounded-lg font-bold text-xs transition-all flex-1 ${filterStatus === v ? t.pillActive : t.pill}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filteredPurchases.length === 0 ? (
        <div className={`rounded-2xl ${t.card} p-16 text-center`}>
          <div className="text-6xl mb-4">🔐</div>
          <h3 className={`text-lg font-bold mb-2 ${t.text}`}>No Registered Users</h3>
          <p className={`text-sm ${t.textSub}`}>Users who register with a serial number appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`hidden md:block rounded-2xl shadow-md ${t.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className={t.tableHead}>
                    {['User', 'Device / Container', 'Registered', 'Status', 'Containers', 'Actions', ''].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divider}`}>
                  {filteredPurchases.map(p => (
                    <React.Fragment key={p.id}>
                      <tr className={`transition-colors ${t.tableRow}`}>
                        <td className="px-5 py-4">
                          <p className={`text-sm font-bold ${t.text}`}>{p.user.firstname} {p.user.lastname}</p>
                          <p className={`text-xs mt-0.5 ${t.textMuted}`}>{p.user.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className={`text-xs font-mono font-semibold ${t.text}`}>{p.assignedContainers?.[0] || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs ${t.textMuted}`}>{new Date(p.purchaseDate).toLocaleDateString()}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            {p.accessGranted
                              ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500">Access Active</span>
                              : <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-yellow-500">Pending</span>
                            }
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => handleOpenContainerModal(p)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 ${dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15'}`}>
                            <Package className="w-3.5 h-3.5" />{p.assignedContainers?.length || 0} assigned
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          {!p.accessGranted ? (
                            <button onClick={() => handleGrantAccess(p.id)} disabled={processing === p.id}
                              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-emerald-600 hover:to-teal-600 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                              <UserCheck className="w-3.5 h-3.5" />Grant Access
                            </button>
                          ) : (
                            <button onClick={() => handleRevokeAccess(p.id)} disabled={processing === p.id}
                              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-red-600 hover:to-rose-600 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                              <UserX className="w-3.5 h-3.5" />Revoke
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => setExpandedRows(prev => { const s = new Set(prev); s.has(p.id) ? s.delete(p.id) : s.add(p.id); return s; })}
                            className={`p-1.5 rounded-lg ${dm ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-black/10 text-gray-500'}`}>
                            {expandedRows.has(p.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {expandedRows.has(p.id) && (
                        <tr>
                          <td colSpan={7} className={`px-5 py-5 ${dm ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`}>
                            <div className="grid grid-cols-2 gap-4">
                              <div className={`rounded-2xl p-4 ${t.innerCard}`}>
                                <p className={`text-xs font-black uppercase tracking-widest mb-3 ${t.textSub}`}>Contact</p>
                                <div className={`space-y-1.5 text-xs ${t.textSub}`}>
                                  {p.phone   && <p><span className="font-semibold">Phone:</span> {p.phone}</p>}
                                  {p.address && <p><span className="font-semibold">Address:</span> {p.address}</p>}
                                  {p.city    && <p><span className="font-semibold">City:</span> {p.city}{p.country ? `, ${p.country}` : ''}</p>}
                                </div>
                              </div>
                              <div className={`rounded-2xl p-4 ${t.innerCard}`}>
                                <p className={`text-xs font-black uppercase tracking-widest mb-3 ${t.textSub}`}>Details</p>
                                <div className={`space-y-1.5 text-xs ${t.textSub}`}>
                                  <p><span className="font-semibold">Registered:</span> {new Date(p.user.createdAt).toLocaleDateString()}</p>
                                  {p.adminNotes && (
                                    <div className={`mt-2 p-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/40' : 'bg-amber-50 border border-amber-200'}`}>
                                      <p className={`font-bold mb-1 text-[10px] uppercase tracking-widest ${dm ? 'text-amber-400' : 'text-amber-700'}`}>Admin Notes</p>
                                      <p className={dm ? 'text-amber-300' : 'text-amber-700'}>{p.adminNotes}</p>
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredPurchases.map(p => (
              <div key={p.id} className={`rounded-2xl shadow-sm ${t.mobileCard} p-4`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className={`text-sm font-bold ${t.text}`}>{p.user.firstname} {p.user.lastname}</p>
                    <p className={`text-xs ${t.textMuted}`}>{p.user.email}</p>
                  </div>
                  {p.accessGranted
                    ? <span className="text-[10px] font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 rounded-full">Active</span>
                    : <span className="text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-1 rounded-full">Pending</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleOpenContainerModal(p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold ${t.pill}`}>
                    📦 {p.assignedContainers?.length || 0} containers
                  </button>
                  {!p.accessGranted
                    ? <button onClick={() => handleGrantAccess(p.id)} disabled={processing === p.id}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50">
                        Grant Access
                      </button>
                    : <button onClick={() => handleRevokeAccess(p.id)} disabled={processing === p.id}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white disabled:opacity-50">
                        Revoke
                      </button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: DEVICES
  // ─────────────────────────────────────────────────────────────────────────────
  const DevicesTab = () => (
    <>
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <StatCard icon={Cpu}       title="Total"     value={stats.totalDevices}    gradient="from-violet-500 to-purple-600" />
        <StatCard icon={Package}   title="Unclaimed" value={stats.unclaimedDevices} gradient="from-sky-500 to-blue-500" />
        <StatCard icon={UserCheck} title="Claimed"   value={stats.claimedDevices}  gradient="from-emerald-500 to-teal-500" />
      </div>

      <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-5`}>
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3.5 top-3 w-4 h-4 ${t.textMuted}`} />
            <input type="text" placeholder="Search serial or container…" value={deviceSearch}
              onChange={e => setDeviceSearch(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
          </div>
          <button onClick={() => { setShowAddDevice(true); setDeviceFormError(''); setDeviceFormSuccess(''); }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:from-amber-600 hover:to-yellow-600 transition-all hover:-translate-y-0.5 flex-shrink-0">
            <Plus className="w-4 h-4" />Add Device
          </button>
        </div>
        <div className="flex gap-2">
          {['all', 'unclaimed', 'claimed', 'suspended'].map(s => (
            <button key={s} onClick={() => setDeviceFilter(s)}
              className={`px-3 py-2 rounded-lg font-bold text-xs transition-all capitalize flex-1 ${deviceFilter === s ? t.pillActive : t.pill}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {devicesLoading ? (
        <div className={`rounded-2xl ${t.card} p-16 text-center`}>
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className={`rounded-2xl ${t.card} p-16 text-center`}>
          <div className="text-6xl mb-4">📦</div>
          <h3 className={`text-lg font-bold mb-2 ${t.text}`}>No Devices Found</h3>
          <p className={`text-sm ${t.textSub} mb-5`}>{devices.length === 0 ? 'Register your first device to get started.' : 'No devices match your search.'}</p>
          {devices.length === 0 && (
            <button onClick={() => setShowAddDevice(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md">
              <Plus className="w-4 h-4" />Register First Device
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredDevices.map(d => (
              <div key={d.id} className={`rounded-2xl shadow-sm ${t.mobileCard} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-sm font-black font-mono ${t.text}`}>{d.serialNumber}</p>
                    <p className={`text-xs mt-0.5 ${t.textMuted}`}>{d.azureContainerId}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <div className="flex gap-2 mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${t.innerCard} ${t.textSub}`}>{d.hiveCount} hive{d.hiveCount !== 1 ? 's' : ''}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${t.innerCard} ${t.textSub}`}>{d.model}</span>
                </div>
                {d.status === 'claimed' && d.purchases?.[0]?.user && (
                  <p className={`text-xs mb-3 ${t.textMuted}`}>Owner: {d.purchases[0].user.firstname} {d.purchases[0].user.lastname} · {d.purchases[0].user.email}</p>
                )}
                <div className="flex gap-2">
                  {d.status !== 'unclaimed' && (
                    <button onClick={() => handleSuspendDevice(d)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${d.status === 'suspended' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : dm ? 'bg-white/10 text-gray-200' : 'bg-black/10 text-gray-700'}`}>
                      {d.status === 'suspended' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {d.status === 'suspended' ? 'Restore' : 'Suspend'}
                    </button>
                  )}
                  {d.status === 'unclaimed' && (
                    <button onClick={() => handleDeleteDevice(d)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-xs font-bold">
                      <Trash2 className="w-3.5 h-3.5" />Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className={`hidden md:block rounded-2xl shadow-md ${t.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className={t.tableHead}>
                    {['Serial Number', 'Azure Container', 'Hives', 'Model', 'Status', 'Owner', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divider}`}>
                  {filteredDevices.map(d => (
                    <tr key={d.id} className={`transition-colors ${t.tableRow}`}>
                      <td className="px-5 py-4"><span className={`text-sm font-black font-mono ${t.text}`}>{d.serialNumber}</span></td>
                      <td className="px-5 py-4"><span className={`text-xs font-mono ${t.textSub}`}>{d.azureContainerId}</span></td>
                      <td className="px-5 py-4"><span className={`text-sm font-bold ${t.text}`}>{d.hiveCount}</span></td>
                      <td className="px-5 py-4"><span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${t.innerCard} ${t.textSub}`}>{d.model}</span></td>
                      <td className="px-5 py-4"><StatusBadge status={d.status} /></td>
                      <td className="px-5 py-4">
                        {d.status === 'claimed' && d.purchases?.[0]?.user ? (
                          <div>
                            <p className={`text-xs font-semibold ${t.text}`}>{d.purchases[0].user.firstname} {d.purchases[0].user.lastname}</p>
                            <p className={`text-[10px] ${t.textMuted}`}>{d.purchases[0].user.email}</p>
                          </div>
                        ) : <span className={`text-xs ${t.textMuted}`}>—</span>}
                      </td>
                      <td className="px-5 py-4"><span className={`text-xs ${t.textMuted}`}>{new Date(d.createdAt).toLocaleDateString()}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {d.status !== 'unclaimed' && (
                            <button onClick={() => handleSuspendDevice(d)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 ${d.status === 'suspended' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' : dm ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15'}`}>
                              {d.status === 'suspended' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              {d.status === 'suspended' ? 'Restore' : 'Suspend'}
                            </button>
                          )}
                          {d.status === 'unclaimed' && (
                            <button onClick={() => handleDeleteDevice(d)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-red-600 hover:to-rose-600 transition-all hover:-translate-y-0.5">
                              <Trash2 className="w-3.5 h-3.5" />Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative transition-colors duration-300">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ backgroundImage: "url('/bee.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
        <div className={`absolute inset-0 ${dm ? 'bg-black/40' : 'bg-white/20'}`} />
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${t.sidebar} shadow-2xl flex flex-col`}>
        <div className={`px-6 flex items-center justify-between border-b ${t.divider}`}
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: '16px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg text-xl">🐝</div>
            <div>
              <h2 className={`text-sm font-black tracking-tight ${t.sidebarText}`}>NahalAI</h2>
              <p className={`text-xs ${t.sidebarMuted}`}>Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {adminInfo && (
          <div className={`mx-4 my-4 px-4 py-3 rounded-xl ${dm ? 'bg-amber-950/60 border border-amber-900/60' : 'bg-amber-50 border border-amber-100'}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${dm ? 'text-amber-400' : 'text-amber-600'}`}>Access Level</p>
            <p className={`text-sm font-bold ${t.sidebarText}`}>Administrator</p>
            <p className={`text-xs truncate mt-0.5 ${t.sidebarMuted}`}>{adminInfo.email}</p>
          </div>
        )}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className={`text-xs font-semibold uppercase tracking-widest px-2 py-2 ${t.sidebarMuted}`}>Navigation</p>
          {[
            { label: 'Home',        icon: Home,            path: '/welcome' },
            { label: 'Dashboard',  icon: LayoutDashboard, path: '/smart-hive' },
            { label: 'Calibration', icon: Settings,        path: '/admin/correction' },
            { label: 'Purchase',    icon: ShoppingCart,    path: '/order' },
          ].map(item => (
            <button key={item.label} onClick={() => { router.push(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.sidebarText} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border ${dm ? 'border-amber-500/30 text-amber-300' : 'border-amber-500/30 text-amber-700'}`}>
            <UserCheck className="w-4 h-4" />Admin Panel
          </div>
        </nav>
        <div className={`px-4 border-t ${t.divider} space-y-2`}
          style={{ paddingTop: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
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

      {/* Main */}
      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/30 border-b border-white/10' : 'bg-white/20 border-b border-white/30'} backdrop-blur-xl`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Menu className="w-5 h-5" />
              </button>
              <div className={`w-px h-5 ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-sm">🐝</div>
                <h1 className={`text-sm font-black tracking-tight ${t.text}`}>Admin Panel</h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button onClick={() => router.push('/smart-hive')}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-semibold text-xs">
                <LayoutDashboard className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dashboard</span>
              </button>
              <button onClick={fetchAll}
                className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-semibold text-xs">
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </button>
              <button onClick={() => setDarkMode(!dm)} className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => { localStorage.removeItem('adminInfo'); router.push('/login'); }}
                className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
                <LogOut className="w-3.5 h-3.5" />Sign Out
              </button>
            </div>
          </div>

          {/* Tab bar — 3 tabs */}
          <div className={`flex px-4 sm:px-5 border-t ${t.divider} gap-1`}>
            {([
              { key: 'orders',  label: 'Orders',  icon: Package,   count: stats.totalOrders,  badge: stats.newOrders },
              { key: 'access',  label: 'Access',  icon: UserCheck, count: purchases.length,   badge: stats.pendingAccess },
              { key: 'devices', label: 'Devices', icon: Cpu,       count: stats.totalDevices, badge: 0 },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all -mb-px ${
                  activeTab === tab.key
                    ? (dm ? 'border-amber-400 text-amber-400' : 'border-amber-500 text-amber-600')
                    : `border-transparent ${t.textMuted}`
                }`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.key ? 'bg-amber-500/20 text-amber-500' : (dm ? 'bg-white/10 text-gray-300' : 'bg-black/10 text-gray-500')}`}>
                  {tab.count}
                </span>
                {tab.badge > 0 && <span className="absolute top-2 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8 max-w-screen-2xl mx-auto w-full">
          {error && (
            <div className={`rounded-2xl ${t.card} p-4 mb-5 flex items-start gap-3`}>
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className={`text-sm ${t.text}`}>{error}</p>
            </div>
          )}
          {activeTab === 'orders'  && <OrdersTab />}
          {activeTab === 'access'  && <AccessTab />}
          {activeTab === 'devices' && <DevicesTab />}
        </main>
      </div>

      {/* ── MODAL: Add Device ── */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6 ${t.modalBg}`}
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5 sm:hidden" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md flex-shrink-0">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={`text-base font-black ${t.text}`}>Register New Device</h3>
                <p className={`text-xs ${t.textMuted}`}>Link a serial number to an Azure container</p>
              </div>
              <button onClick={() => { setShowAddDevice(false); setDeviceFormError(''); setDeviceFormSuccess(''); }}
                className={`ml-auto p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {deviceFormError && (
              <div className="bg-red-500/15 border border-red-400/40 rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs">{deviceFormError}</p>
              </div>
            )}
            {deviceFormSuccess && (
              <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-xl p-3 mb-4 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-emerald-300 text-xs">{deviceFormSuccess}</p>
              </div>
            )}
            <div className="space-y-4 mb-6">
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>Serial Number <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Hash className={`absolute left-3 top-3 w-4 h-4 ${t.textMuted}`} />
                  <input type="text" placeholder="e.g. SH-2024-001234" value={deviceForm.serialNumber}
                    onChange={e => setDeviceForm(p => ({ ...p, serialNumber: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all uppercase ${t.input}`} />
                </div>
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>Printed on the sticker inside the physical box</p>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>Azure Container ID <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Database className={`absolute left-3 top-3 w-4 h-4 ${t.textMuted}`} />
                  <input type="text" placeholder="e.g. apiary-container-001234" value={deviceForm.azureContainerId}
                    onChange={e => setDeviceForm(p => ({ ...p, azureContainerId: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
                </div>
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>Exact container name in Azure Blob Storage</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>Hive Count</label>
                  <input type="number" min="1" max="50" value={deviceForm.hiveCount}
                    onChange={e => setDeviceForm(p => ({ ...p, hiveCount: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>Model</label>
                  <select value={deviceForm.model} onChange={e => setDeviceForm(p => ({ ...p, model: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`}>
                    <option value="STANDARD">STANDARD</option>
                    <option value="MASTER">MASTER</option>
                    <option value="PRO">PRO</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={`rounded-xl p-4 mb-5 ${dm ? 'bg-amber-950/60 border border-amber-900/40' : 'bg-amber-50 border border-amber-100'}`}>
              <p className={`text-xs font-bold mb-1 ${dm ? 'text-amber-400' : 'text-amber-700'}`}>💡 How this works</p>
              <p className={`text-xs ${dm ? 'text-amber-300' : 'text-amber-700'}`}>
                The customer enters this serial number at /register. Their account is automatically linked to the Azure container — they never see the container name.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAddDevice(false); setDeviceFormError(''); setDeviceFormSuccess(''); }}
                className={`flex-1 py-3 rounded-xl text-sm font-bold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Cancel
              </button>
              <button onClick={handleAddDevice} disabled={addingDevice}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-yellow-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {addingDevice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {addingDevice ? 'Saving…' : 'Register Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Set Location ── */}
      {showLocationModal && selectedLocationContainer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6 ${t.modalBg}`}
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
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
                { label: 'Latitude *',  key: 'lat',     placeholder: 'e.g., 24.453884' },
                { label: 'Longitude *', key: 'lon',     placeholder: 'e.g., 54.377344' },
                { label: 'Address',     key: 'address', placeholder: 'e.g., Abu Dhabi, UAE' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>{label}</label>
                  <input type={key === 'address' ? 'text' : 'number'} step="any" placeholder={placeholder}
                    value={(locationForm as any)[key]}
                    onChange={e => setLocationForm(p => ({ ...p, [key]: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${t.input}`} />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowLocationModal(false); setSelectedLocationContainer(null); }}
                className={`flex-1 py-3 rounded-xl text-sm font-bold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Cancel
              </button>
              <button onClick={handleSaveLocation}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg hover:from-amber-600 hover:to-yellow-600 transition-all">
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Assign Containers ── */}
      {showContainerModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${t.modalBg}`}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-4 sm:hidden" />
            <div className={`px-6 py-5 border-b ${t.divider} flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md flex-shrink-0">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`text-base font-black ${t.text}`}>Assign Containers</h2>
                <p className={`text-xs truncate ${t.textMuted}`}>{selectedPurchase.user.firstname} {selectedPurchase.user.lastname} · {selectedPurchase.user.email}</p>
              </div>
              <button onClick={() => setShowContainerModal(false)} className={`p-1.5 rounded-lg flex-shrink-0 ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2 mb-5">
                {containers.map(c => {
                  const selected = tempContainers.includes(c.name);
                  return (
                    <label key={c.name}
                      className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${selected
                        ? (dm ? 'border-amber-400/50 bg-amber-500/10' : 'border-amber-400/60 bg-amber-50')
                        : (dm ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-black/10 bg-black/[0.02] hover:bg-black/[0.04]')}`}>
                      <input type="checkbox" checked={selected}
                        onChange={() => setTempContainers(prev => selected ? prev.filter(x => x !== c.name) : [...prev, c.name])}
                        className="w-4 h-4 accent-amber-500 rounded flex-shrink-0" />
                      <p className={`text-sm font-bold flex-1 ${t.text}`}>{c.name}</p>
                    </label>
                  );
                })}
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${t.textSub}`}>Admin Notes</label>
                <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this user's access…"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:outline-none resize-none transition-all ${t.input}`} rows={3} />
              </div>
            </div>
            <div className={`px-5 border-t ${t.divider} flex gap-3`}
              style={{ paddingTop: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
              <button onClick={() => setShowContainerModal(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold ${dm ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Cancel
              </button>
              <button onClick={handleSaveContainers}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg hover:from-amber-600 hover:to-yellow-600 transition-all">
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
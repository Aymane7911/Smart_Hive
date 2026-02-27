'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, ShoppingCart, LayoutDashboard, LogOut, Plus, ChevronRight,
  AlertCircle, RefreshCw, Menu, X, Moon, SunMedium, Activity, Clock,
  MapPin, Zap, User, Mail, Phone
} from 'lucide-react';

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

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseInfo[]>([]);
  const [userData, setUserData]         = useState<any>(null);
  const [error, setError]               = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [darkMode, setDarkMode]         = useState(false);
  const [mounted, setMounted]           = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('hive-darkMode');
    if (saved === 'true') setDarkMode(true);
    setMounted(true);
    fetchUserData();
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('hive-darkMode', String(darkMode));
  }, [darkMode, mounted]);

  const dm = mounted && darkMode;

  // ── Theme tokens (mirrors SmartHiveDashboard) ──────────────────────────────
  const t = {
    card:       dm ? 'bg-gray-900/40 border border-white/10 backdrop-blur-md' : 'bg-white/40 border border-white/50 backdrop-blur-md',
    text:       dm ? 'text-gray-100'  : 'text-gray-900',
    textSub:    dm ? 'text-gray-400'  : 'text-gray-600',
    textMuted:  dm ? 'text-gray-500'  : 'text-gray-500',
    divider:    dm ? 'border-white/10' : 'border-black/10',
    input:      dm ? 'bg-gray-800/60 border-white/10 text-gray-100' : 'bg-white/60 border-white/40 text-gray-900',
    pill:       dm ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-black/10 text-gray-700 hover:bg-black/15',
    pillActive: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
    sidebar:    dm ? 'bg-gray-950 border-r border-gray-800' : 'bg-white border-r border-gray-100',
    tooltip:    dm ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
  };

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/smart-hive/check-access', {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      if (response.status === 401) { router.push('/login'); return; }
      if (!response.ok) { setError('Failed to load your information. Please try again.'); setLoading(false); return; }
      const result = await response.json();
      if (!result.success) { router.push('/login'); return; }
      setUserData(result.user);

      const purchasesResponse = await fetch('/api/user/purchases', {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      if (purchasesResponse.ok) {
        const purchasesResult = await purchasesResponse.json();
        if (purchasesResult.success && purchasesResult.purchases) {
          setPurchaseInfo(purchasesResult.purchases);
        } else {
          setPurchaseInfo([]);
        }
      } else {
        setError('Failed to load purchases. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      localStorage.clear();
      router.push('/login');
    }
  };

  const handleAccessContainer = (containerId: string) => {
    router.push(`/smart-hive?container=${encodeURIComponent(containerId)}`);
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const activePurchases = purchaseInfo.filter(p =>
    p.status === 'approved' && p.accessGranted === true &&
    p.assignedContainers && p.assignedContainers.length > 0
  );
  const pendingPurchases = purchaseInfo.filter(p =>
    p.status === 'pending' || (p.status === 'approved' && !p.accessGranted)
  );
  const totalHives      = purchaseInfo.reduce((sum, p) => sum + p.masterHives + p.normalHives, 0);
  const totalContainers = activePurchases.reduce((sum, p) => sum + p.assignedContainers.length, 0);

  // ── Loading screen ─────────────────────────────────────────────────────────
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
          <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-600'}`}>Connecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 backdrop-blur-sm bg-black/40" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${t.sidebar} shadow-2xl flex flex-col`}>
        <div className={`px-6 py-5 flex items-center justify-between border-b ${t.divider}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg text-xl">🐝</div>
            <div>
              <h2 className={`text-sm font-black tracking-tight ${t.text}`}>Smart Hive</h2>
              <p className={`text-xs ${t.textMuted}`}>Colony Monitoring</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={`p-1.5 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
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
            { label: 'Home',             icon: Home,          action: () => { router.push('/welcome'); setSidebarOpen(false); } },
            { label: 'Purchase',         icon: ShoppingCart,  action: () => { router.push('/payment'); setSidebarOpen(false); } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${t.text} ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
        </nav>

        <div className={`px-4 py-4 border-t ${t.divider} space-y-2`}>
          <button onClick={() => setDarkMode(!dm)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${dm ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {dm ? <SunMedium className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            {dm ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>
    </>
  );

  // ── Stat card (mirrors SmartHiveDashboard StatCard) ────────────────────────
  const StatCard = ({ icon: Icon, title, value, sub, gradient }: any) => (
    <div className={`relative overflow-hidden rounded-2xl shadow-md ${t.card} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06]`} />
      <div className="relative p-5">
        <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-md mb-3`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${t.textSub}`}>{title}</p>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br ${gradient}`}>{value}</span>
        </div>
        <p className={`text-xs mt-1 ${t.textMuted}`}>{sub}</p>
      </div>
      <div className={`h-0.5 bg-gradient-to-r ${gradient} opacity-60`} />
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative transition-colors duration-300">

      {/* ── Background blobs (identical to SmartHiveDashboard) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute inset-0 ${dm ? 'bg-gradient-to-br from-gray-950 via-amber-950/20 to-gray-950' : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50'}`} />
        <div className={`absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-3xl opacity-20 ${dm ? 'bg-amber-700' : 'bg-amber-300'} animate-pulse`} />
        <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-15 ${dm ? 'bg-yellow-700' : 'bg-yellow-300'} animate-pulse`} style={{ animationDelay: '1.5s' }} />
      </div>

      <Sidebar />

      <div className="relative min-h-screen flex flex-col">

        {/* ── Header (mirrors SmartHiveDashboard header) ── */}
        <header className={`sticky top-0 z-30 ${dm ? 'bg-gray-900/30 border-b border-white/10' : 'bg-white/20 border-b border-white/30'} backdrop-blur-xl`}>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Menu className="w-5 h-5" />
              </button>
              <div className={`w-px h-5 ${dm ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm text-sm">🐝</div>
                <div>
                  <h1 className={`text-sm font-black tracking-tight leading-none ${t.text}`}>Smart Hive</h1>
                  
                </div>
              </div>
            </div>

            {userData && (
              <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>
                  {userData.firstname} {userData.lastname}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={fetchUserData}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md font-semibold text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={() => setDarkMode(!dm)}
                className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {dm ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={handleLogout}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${dm ? 'bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-950' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto w-full">

          {/* Error */}
          {error && (
            <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-6 flex items-start gap-3 border-red-500/30`}>
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-bold ${t.text}`}>Something went wrong</p>
                <p className={`text-xs mt-0.5 ${t.textSub}`}>{error}</p>
              </div>
            </div>
          )}

          {/* ── Status banner ── */}
          <div className={`rounded-2xl shadow-md ${t.card} p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md text-xl">🐝</div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div>
                <h2 className={`text-sm font-black ${t.text}`}>
                  Welcome back{userData ? `, ${userData.firstname}` : ''}!
                </h2>
                <p className={`text-xs ${t.textSub}`}>{totalContainers} active {totalContainers === 1 ? 'apiary' : 'apiaries'} · {totalHives} total hives</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                <Activity className={`w-4 h-4 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                <div>
                  <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Active Apiaries</p>
                  <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{totalContainers}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${dm ? 'bg-white/10' : 'bg-white/50'} border ${t.divider}`}>
                <Zap className={`w-4 h-4 ${dm ? 'text-amber-400' : 'text-amber-500'}`} />
                <div>
                  <p className={`text-[10px] uppercase tracking-widest font-semibold ${t.textMuted}`}>Total Hives</p>
                  <p className={`text-xs font-bold ${dm ? 'text-amber-300' : 'text-amber-700'}`}>{totalHives}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard icon={LayoutDashboard} title="Active Apiaries"   value={totalContainers}        sub="Total container access"  gradient="from-amber-500 to-yellow-500" />
            <StatCard icon={Activity}        title="Total Hives"       value={totalHives}              sub="Across all apiaries"     gradient="from-emerald-500 to-teal-500" />
            <StatCard icon={ShoppingCart}    title="Active Purchases"  value={activePurchases.length}  sub="Approved orders"         gradient="from-sky-500 to-blue-500" />
          </div>

          {/* ── Pending purchases alert ── */}
          {pendingPurchases.length > 0 && (
            <div className={`rounded-2xl shadow-md ${t.card} p-5 mb-6 border-amber-500/30`}>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md flex-shrink-0">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-black mb-1 ${t.text}`}>
                    {pendingPurchases.length} Purchase{pendingPurchases.length > 1 ? 's' : ''} Pending Approval
                  </h3>
                  <p className={`text-xs mb-4 ${t.textSub}`}>
                    Your recent order{pendingPurchases.length > 1 ? 's are' : ' is'} awaiting admin approval.
                    You'll receive access once approved.
                  </p>
                  <div className="space-y-2">
                    {pendingPurchases.map((purchase) => (
                      <div key={purchase.id} className={`rounded-xl px-4 py-3 flex items-center justify-between ${dm ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
                        <div>
                          <p className={`text-xs font-bold ${t.text}`}>
                            {purchase.masterHives} Master + {purchase.normalHives} Normal Hives
                          </p>
                          <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                            Ordered: {new Date(purchase.purchaseDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${dm ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-500/15 text-amber-700'}`}>
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Two-column: Apiaries + Account ── */}
          <div className="flex gap-6 flex-col lg:flex-row">

            {/* ── Apiaries list ── */}
            <div className="flex-1 min-w-0">
              <div className={`rounded-2xl shadow-md ${t.card} p-6`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className={`text-base font-black ${t.text}`}>Your Apiaries</h2>
                    <p className={`text-xs ${t.textSub}`}>Select an apiary to open the monitoring dashboard</p>
                  </div>
                </div>

                {activePurchases.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">🐝</div>
                    <h3 className={`text-lg font-bold mb-2 ${t.text}`}>No Apiaries Yet</h3>
                    <p className={`text-sm mb-6 ${t.textSub}`}>
                      You don't have any active apiaries. Purchase your first Smart Hive to get started!
                    </p>
                    <button onClick={() => router.push('/payment')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-yellow-600 transition-all hover:-translate-y-0.5">
                      <Plus className="w-4 h-4" />
                      Purchase Smart Hive
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePurchases.map((purchase) =>
                      purchase.assignedContainers.map((containerId) => (
                        <button key={containerId} onClick={() => handleAccessContainer(containerId)}
                          className={`w-full text-left relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group
                            ${dm ? 'border-amber-400/20 hover:border-amber-400/50 bg-white/5 hover:bg-white/10' : 'border-amber-400/30 hover:border-amber-400/60 bg-white/30 hover:bg-white/60'}`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/5 group-hover:to-yellow-500/5 transition-all duration-300" />
                          <div className="relative p-5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md text-2xl flex-shrink-0">
                                🐝
                              </div>
                              <div>
                                <h3 className={`text-sm font-black mb-1 ${t.text}`}>{containerId}</h3>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className={`text-[10px] font-semibold ${dm ? 'text-emerald-400' : 'text-emerald-600'}`}>Active</span>
                                  </div>
                                  <span className={`text-[10px] ${t.textMuted}`}>·</span>
                                  <span className={`text-[10px] font-semibold ${t.textSub}`}>{purchase.masterHives + purchase.normalHives} hives</span>
                                  {purchase.masterHives > 0 && (
                                    <>
                                      <span className={`text-[10px] ${t.textMuted}`}>·</span>
                                      <span className={`text-[10px] font-semibold ${dm ? 'text-amber-400' : 'text-amber-600'}`}>{purchase.masterHives} master</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full hidden sm:block ${dm ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-500/15 text-amber-700'}`}>
                                Open Dashboard →
                              </span>
                              <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${dm ? 'text-gray-500 group-hover:text-amber-400' : 'text-gray-400 group-hover:text-amber-600'}`} />
                            </div>
                          </div>
                          <div className="h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-4">

              {/* Purchase more */}
              <div className={`relative overflow-hidden rounded-2xl shadow-md ${t.card}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10" />
                <div className="relative p-6">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-md inline-flex mb-3">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <h3 className={`text-base font-black mb-1 ${t.text}`}>Expand Your Operation</h3>
                  <p className={`text-xs mb-4 ${t.textSub}`}>Purchase additional Smart Hives to monitor more apiaries</p>
                  <button onClick={() => router.push('/payment')}
                    className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-yellow-600 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5">
                    <ShoppingCart className="w-4 h-4" />
                    Purchase Smart Hive
                  </button>
                </div>
                <div className="h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 opacity-60" />
              </div>

              {/* Account info */}
              {userData && (
                <div className={`rounded-2xl shadow-md ${t.card} p-6`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <h3 className={`text-base font-black ${t.text}`}>Account</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: User,  label: 'Name',  value: `${userData.firstname} ${userData.lastname}` },
                      { icon: Mail,  label: 'Email', value: userData.email },
                      ...(userData.phone ? [{ icon: Phone, label: 'Phone', value: userData.phone }] : []),
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${dm ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
                        <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${dm ? 'text-amber-400' : 'text-amber-600'}`} />
                        <div className="min-w-0">
                          <p className={`text-[9px] uppercase tracking-widest font-bold mb-0.5 ${t.textMuted}`}>{label}</p>
                          <p className={`text-xs font-semibold truncate ${t.text}`}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
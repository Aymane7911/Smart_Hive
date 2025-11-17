'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Home, ShoppingCart, LayoutDashboard, LogOut, Plus, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseInfo[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
  setLoading(true);
  setError(null);

  try {
    console.log('🔐 Fetching user access data...');
    
    const response = await fetch('/api/smart-hive/check-access', {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (response.status === 401) {
      console.log('❌ Unauthorized - redirecting to login');
      router.push('/login');
      return;
    }

    if (!response.ok) {
      setError('Failed to load your information. Please try again.');
      setLoading(false);
      return;
    }

    const result = await response.json();
    console.log('📊 Access check result:', result);

    if (!result.success) {
      console.log('❌ Access check failed');
      router.push('/login');
      return;
    }

    setUserData(result.user);

    // Fetch all purchases for this user
    console.log('📦 Fetching user purchases...');
    const purchasesResponse = await fetch('/api/user/purchases', {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (purchasesResponse.ok) {
      const purchasesResult = await purchasesResponse.json();
      console.log('📦 Purchases result:', purchasesResult);
      
      if (purchasesResult.success && purchasesResult.purchases) {
        console.log(`✅ Found ${purchasesResult.purchases.length} purchases`);
        
        // Log each purchase details
        purchasesResult.purchases.forEach((p: PurchaseInfo, idx: number) => {
          console.log(`\n📦 Purchase ${idx + 1}:`);
          console.log(`   Status: ${p.status}`);
          console.log(`   Access Granted: ${p.accessGranted}`);
          console.log(`   Containers: ${p.assignedContainers?.length || 0}`);
          if (p.assignedContainers?.length > 0) {
            console.log(`   Container IDs: ${p.assignedContainers.join(', ')}`);
          }
        });
        
        setPurchaseInfo(purchasesResult.purchases);
      } else {
        console.log('⚠️ No purchases found or invalid response');
        setPurchaseInfo([]);
      }
    } else {
      console.log('❌ Failed to fetch purchases:', purchasesResponse.status);
      setError('Failed to load purchases. Please try again.');
    }

  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    setError('Network error. Please check your connection.');
  } finally {
    setLoading(false);
  }
};

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        localStorage.clear();
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.clear();
      router.push('/login');
    }
  };

  const handleAccessContainer = (containerId: string) => {
    // Store selected container and navigate to dashboard
    router.push(`/smart-hive?container=${encodeURIComponent(containerId)}`);
  };

  const handlePurchaseMore = () => {
    router.push('/payment');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-100 via-purple-100 to-pink-100"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-300/40 via-indigo-300/30 via-purple-300/40 to-pink-200/30 animate-pulse"></div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          </div>
          <p className="text-xl text-indigo-900 font-semibold mb-2">Loading Your Dashboard</p>
          <p className="text-indigo-700/80 text-sm">Please wait...</p>
        </div>
      </div>
    );
  }

  // Filter purchases correctly
const activePurchases = purchaseInfo.filter(p => 
  p.status === 'approved' && 
  p.accessGranted === true && 
  p.assignedContainers && 
  p.assignedContainers.length > 0
);

const pendingPurchases = purchaseInfo.filter(p => 
  p.status === 'pending' || 
  (p.status === 'approved' && !p.accessGranted)
);

const totalHives = purchaseInfo.reduce((sum, p) => sum + p.masterHives + p.normalHives, 0);
const totalContainers = activePurchases.reduce((sum, p) => sum + p.assignedContainers.length, 0);

// Debug logging
console.log('📊 Dashboard Stats:', {
  totalPurchases: purchaseInfo.length,
  activePurchases: activePurchases.length,
  pendingPurchases: pendingPurchases.length,
  totalHives,
  totalContainers
});

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out shadow-2xl`}>
        <div className="h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Smart Hive
                </h2>
                <p className="text-sm text-slate-400 mt-1">Monitoring System</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <button
              onClick={() => router.push('/welcome')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg shadow-blue-500/20"
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">Home</span>
            </button>

            <button
              onClick={() => router.push('/payment')}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Purchase Smart Hive</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-700/50 space-y-3">
            {userData && (
              <div className="px-4 py-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Welcome back</p>
                <p className="text-sm font-semibold text-white truncate">
                  {userData.firstname} {userData.lastname}
                </p>
                <p className="text-xs text-slate-400 truncate mt-1">{userData.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 group"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
        />
      )}

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="relative bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-white/50 text-black overflow-hidden mx-4 mt-4">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5"></div>
          
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-4 p-2.5 rounded-xl hover:bg-blue-100/50 transition-all duration-300 hover:scale-110"
              >
                <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center">
                <div className="mr-3 bg-gradient-to-br from-blue-500 to-indigo-500 p-2.5 rounded-xl shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                    <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="white" strokeWidth="2"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    Smart Hive Dashboard
                  </h1>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Select an apiary to monitor your hives
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={fetchUserData}
                className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg transform transition-all duration-500 flex items-center bg-gradient-to-r from-blue-600 to-indigo-500 text-white hover:from-blue-500 hover:to-indigo-400 hover:scale-105 active:scale-95"
              >
                <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-300" />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleLogout}
                className="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl font-medium text-sm shadow-lg transform transition-all duration-500 hover:scale-105 active:scale-95 flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <LayoutDashboard className="w-6 h-6" />
                  </div>
                  <span className="text-3xl font-bold">{totalContainers}</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">Active Apiaries</h3>
                <p className="text-blue-100 text-sm">Total container access</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                      <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <span className="text-3xl font-bold">{totalHives}</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">Total Hives</h3>
                <p className="text-indigo-100 text-sm">Across all apiaries</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <span className="text-3xl font-bold">{activePurchases.length}</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">Active Purchases</h3>
                <p className="text-purple-100 text-sm">Approved orders</p>
              </div>
            </div>

            {/* Pending Purchases Alert */}
            {pendingPurchases.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-8">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-yellow-800 mb-2">
                      {pendingPurchases.length} Purchase{pendingPurchases.length > 1 ? 's' : ''} Pending Approval
                    </h3>
                    <p className="text-yellow-700 text-sm mb-3">
                      Your recent order{pendingPurchases.length > 1 ? 's are' : ' is'} awaiting admin approval. You'll receive access once approved.
                    </p>
                    {pendingPurchases.map((purchase) => (
                      <div key={purchase.id} className="bg-yellow-100 rounded-lg p-3 mb-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-semibold text-yellow-900">
                              {purchase.masterHives} Master + {purchase.normalHives} Normal Hives
                            </p>
                            <p className="text-xs text-yellow-700">
                              Ordered: {new Date(purchase.purchaseDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded-full">
                            Pending
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Apiaries List */}
              <div className="lg:col-span-2">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <LayoutDashboard className="w-6 h-6 text-blue-600" />
                    Your Apiaries
                  </h2>

                  {activePurchases.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LayoutDashboard className="w-10 h-10 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Apiaries Yet</h3>
                      <p className="text-gray-500 mb-6">
                        You don't have any active apiaries. Purchase your first Smart Hive to get started!
                      </p>
                      <button
                        onClick={handlePurchaseMore}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                      >
                        <Plus className="w-5 h-5" />
                        Purchase Smart Hive
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activePurchases.map((purchase) => (
                        <div key={purchase.id}>
                          {purchase.assignedContainers.map((containerId) => (
                            <button
                              key={containerId}
                              onClick={() => handleAccessContainer(containerId)}
                              className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                                      <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                                      {containerId}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                      <span>{purchase.masterHives + purchase.normalHives} Hives</span>
                                      <span className="text-gray-400">•</span>
                                      <span className="text-green-600 font-medium">Active</span>
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-6">
                {/* Purchase More */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                      <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Expand Your Operation</h3>
                    <p className="text-green-50 text-sm">
                      Purchase additional Smart Hives to monitor more apiaries
                    </p>
                  </div>
                  <button
                    onClick={handlePurchaseMore}
                    className="w-full bg-white text-green-600 hover:bg-green-50 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Purchase Smart Hive
                  </button>
                </div>

                {/* Account Info */}
                {userData && (
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Account Information</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Name</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {userData.firstname} {userData.lastname}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="text-sm font-semibold text-gray-800">{userData.email}</p>
                      </div>
                      {userData.phone && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Phone</p>
                          <p className="text-sm font-semibold text-gray-800">{userData.phone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
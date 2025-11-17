'use client'
import React from 'react';
import { useState, useEffect } from 'react';
import { Search, Check, X, Edit2, UserCheck, UserX, Package, AlertCircle, RefreshCw, ChevronDown, ChevronUp, LogOut, MapPin, Menu, Home, ShoppingCart, LayoutDashboard, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  createdAt: string;
}

interface Purchase {
  id: number;
  userId: number;
  user: User;
  masterHives: number;
  normalHives: number;
  totalAmount: number;
  status: string;
  accessGranted: boolean;
  assignedContainers: string[];
  purchaseDate: string;
  email: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  adminNotes?: string;
}

interface Container {
  name: string;
  lastModified?: string;
  blobCount?: number;
}

interface ApiaryLocation {
  containerId: string;
  lat: number;
  lon: number;
  address?: string;
}

export default function AdminAccessManagement() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [tempContainers, setTempContainers] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState<number | null>(null);
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  
  // Location management states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocationContainer, setSelectedLocationContainer] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({ lat: '', lon: '', address: '' });
  const [apiaryLocations, setApiaryLocations] = useState<Record<string, ApiaryLocation>>({});
  const [showLocationsPanel, setShowLocationsPanel] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('adminInfo');
    if (stored) {
      setAdminInfo(JSON.parse(stored));
    }
    fetchData();
    loadApiaryLocations();
  }, []);

  // Load apiary locations
  const loadApiaryLocations = async () => {
    try {
      const response = await fetch('/api/smart-hive/apiary-locations');
      const result = await response.json();
      if (result.success) {
        setApiaryLocations(result.data);
      }
    } catch (error) {
      console.error('Failed to load apiary locations:', error);
    }
  };

  // Save apiary location
  const saveApiaryLocation = async (location: ApiaryLocation) => {
    try {
      const response = await fetch('/api/smart-hive/apiary-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(location),
      });

      const result = await response.json();
      
      if (result.success) {
        return true;
      } else {
        console.error('Failed to save location:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to save location:', error);
      return false;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const purchasesRes = await fetch('/api/admin/purchases', {
        credentials: 'include'
      });
      const purchasesData = await purchasesRes.json();
      
      if (!purchasesData.success) {
        throw new Error(purchasesData.error || 'Failed to fetch purchases');
      }
      
      setPurchases(purchasesData.data || []);

      const containersRes = await fetch('/api/smart-hive/containers', {
        credentials: 'include'
      });
      const containersData = await containersRes.json();
      
      if (containersData.success) {
        setContainers(containersData.data || []);
      } else {
        setError('Failed to load containers: ' + containersData.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetLocationClick = (containerName: string) => {
    setSelectedLocationContainer(containerName);
    
    const existingLocation = apiaryLocations[containerName];
    if (existingLocation) {
      setLocationForm({
        lat: existingLocation.lat.toString(),
        lon: existingLocation.lon.toString(),
        address: existingLocation.address || ''
      });
    } else {
      setLocationForm({ lat: '', lon: '', address: '' });
    }
    
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!selectedLocationContainer) return;

    const lat = parseFloat(locationForm.lat);
    const lon = parseFloat(locationForm.lon);

    if (isNaN(lat) || isNaN(lon)) {
      alert('Please enter valid latitude and longitude values');
      return;
    }

    if (lat < -90 || lat > 90) {
      alert('Latitude must be between -90 and 90');
      return;
    }

    if (lon < -180 || lon > 180) {
      alert('Longitude must be between -180 and 180');
      return;
    }

    const newLocation: ApiaryLocation = {
      containerId: selectedLocationContainer,
      lat,
      lon,
      address: locationForm.address.trim() || undefined
    };

    const saved = await saveApiaryLocation(newLocation);

    if (saved) {
      const updatedLocations = {
        ...apiaryLocations,
        [selectedLocationContainer]: newLocation
      };
      setApiaryLocations(updatedLocations);

      alert('Location saved successfully!');
      setShowLocationModal(false);
      setSelectedLocationContainer(null);
      setLocationForm({ lat: '', lon: '', address: '' });
      
      await loadApiaryLocations();
    } else {
      alert('Failed to save location. Please try again.');
    }
  };

  const handleGrantAccess = async (purchaseId: number) => {
    if (!confirm('Grant access to this user?')) return;
    
    setProcessing(purchaseId);
    try {
      const response = await fetch(`/api/admin/purchases/${purchaseId}/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchData();
        alert('Access granted successfully!');
      } else {
        alert(result.error || 'Failed to grant access');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRevokeAccess = async (purchaseId: number) => {
    if (!confirm('Revoke access for this user?')) return;
    
    setProcessing(purchaseId);
    try {
      const response = await fetch(`/api/admin/purchases/${purchaseId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchData();
        alert('Access revoked successfully!');
      } else {
        alert(result.error || 'Failed to revoke access');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleOpenContainerModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setTempContainers(purchase.assignedContainers || []);
    setAdminNotes(purchase.adminNotes || '');
    setShowContainerModal(true);
  };

  const handleToggleContainer = (containerName: string) => {
    setTempContainers(prev => 
      prev.includes(containerName)
        ? prev.filter(c => c !== containerName)
        : [...prev, containerName]
    );
  };

  const handleSaveContainers = async () => {
    if (!selectedPurchase) return;
    
    try {
      const response = await fetch(`/api/admin/purchases/${selectedPurchase.id}/containers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          containers: tempContainers,
          adminNotes: adminNotes
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchData();
        setShowContainerModal(false);
        alert('Containers updated successfully!');
      } else {
        alert(result.error || 'Failed to update containers');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const toggleRowExpansion = (purchaseId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(purchaseId)) {
        newSet.delete(purchaseId);
      } else {
        newSet.add(purchaseId);
      }
      return newSet;
    });
  };

  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch = 
      purchase.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' || purchase.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => p.status === 'pending').length,
    approved: purchases.filter(p => p.status === 'approved').length,
    active: purchases.filter(p => p.accessGranted).length,
    locationsSet: Object.keys(apiaryLocations).length,
    totalContainers: containers.length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 via-pink-100 to-rose-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading management dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-100 via-pink-100 to-rose-100">
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out shadow-2xl`}>
        <div className="h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent">
                  Smart Hive
                </h2>
                <p className="text-sm text-slate-400 mt-1">Admin Panel</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <button 
              onClick={() => router.push('/welcome')}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <Home className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="font-medium">Home</span>
            </button>

            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <LayoutDashboard className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Dashboard</span>
            </button>

            <button className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg shadow-lg shadow-emerald-500/20">
              <UserCheck className="w-5 h-5" />
              <span className="font-medium">Access Management</span>
            </button>

            <button 
              onClick={() => router.push('/admin/correction')}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <Settings className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Calibration</span>
            </button>

            <button 
              onClick={() => router.push('/purchase')}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Purchase Smart Hive</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-700/50 space-y-2">
            <div className="px-4 py-3 bg-slate-800/50 rounded-lg mb-2">
              <p className="text-xs text-slate-400 mb-1">Access Level</p>
              <p className="text-lg font-bold text-emerald-400">
                Administrator
              </p>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem('adminInfo');
                router.push('/login');
              }}
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
        <header className="relative bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/20 text-black overflow-hidden mx-4 mt-4">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-green-500/5"></div>
          
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-4 p-2 rounded-lg hover:bg-emerald-100/50 transition-all duration-300 hover:scale-110"
              >
                <Menu className="h-5 w-5 text-gray-700" />
              </button>
              <div className="flex items-center">
                <div className="mr-3 bg-gradient-to-br from-emerald-500 to-green-500 p-2 rounded-xl shadow-lg">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    Access Management
                  </h1>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Admin: {adminInfo?.email || 'Administrator'}
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                localStorage.removeItem('adminInfo');
                router.push('/login');
              }}
              className="group relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-lg font-medium text-sm shadow-lg transform transition-all duration-500 hover:scale-105 active:scale-95 flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mb-8 flex gap-3 flex-wrap">
              <button
                onClick={() => router.push('/admin/correction')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Edit2 className="w-4 h-4" />
                Calibration
              </button>
              <button
                onClick={() => setShowLocationsPanel(!showLocationsPanel)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <MapPin className="w-4 h-4" />
                Manage Locations
              </button>
            </div>

            {/* Location Management Panel */}
            {showLocationsPanel && (
              <div className="mb-8 bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                      <MapPin className="w-8 h-8 text-blue-600" />
                      Apiary Locations
                    </h2>
                    <p className="text-gray-600 mt-2 text-lg">Set GPS coordinates for each container</p>
                  </div>
                  <button
                    onClick={() => setShowLocationsPanel(false)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {containers.map((container) => {
                    const location = apiaryLocations[container.name];
                    const hasLocation = !!location;
                    
                    return (
                      <div 
                        key={container.name}
                        className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-800 truncate">{container.name}</h3>
                            {hasLocation && location.address && (
                              <p className="text-xs text-gray-500 mt-1 truncate">{location.address}</p>
                            )}
                          </div>
                          <div className={`flex-shrink-0 ml-2 w-3 h-3 rounded-full ${hasLocation ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        </div>
                        
                        {hasLocation ? (
                          <div className="mb-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span className="font-mono">{location.lat.toFixed(6)}, {location.lon.toFixed(6)}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 mb-3">No location set</p>
                        )}
                        
                        <button
                          onClick={() => handleSetLocationClick(container.name)}
                          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            hasLocation
                              ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {hasLocation ? 'Edit Location' : 'Set Location'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-5 border border-blue-200 hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Total</p>
                  <Package className="w-5 h-5 text-blue-500 opacity-60" />
                </div>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-lg p-5 border border-yellow-200 hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Pending</p>
                  <AlertCircle className="w-5 h-5 text-yellow-500 opacity-60" />
                </div>
                <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-lg p-5 border border-green-200 hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Approved</p>
                  <Check className="w-5 h-5 text-green-500 opacity-60" />
                </div>
                <p className="text-3xl font-bold text-green-900">{stats.approved}</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl shadow-lg p-5 border border-indigo-200 hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Active</p>
                  <UserCheck className="w-5 h-5 text-indigo-500 opacity-60" />
                </div>
                <p className="text-3xl font-bold text-indigo-900">{stats.active}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-lg p-5 border border-purple-200 hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Containers</p>
                  <Package className="w-5 h-5 text-purple-500 opacity-60" />
                </div>
                <p className="text-3xl font-bold text-purple-900">{stats.totalContainers}</p>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl shadow-lg p-5 border border-pink-200 hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-pink-700 uppercase tracking-wide">Locations</p>
                  <MapPin className="w-5 h-5 text-pink-500 opacity-60" />
                </div>
                <p className="text-3xl font-bold text-pink-900">{stats.locationsSet}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-5 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                        filterStatus === status
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={fetchData}
                  className="px-5 py-2.5 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl transition-all flex items-center gap-2 font-semibold text-gray-700 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Purchases Table */}
            {filteredPurchases.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Hives</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Containers</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                     {filteredPurchases.map(purchase => (
                        <React.Fragment key={purchase.id}>
                          <tr className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all">
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-semibold text-gray-900">{purchase.fullName}</p>
                                <p className="text-sm text-gray-500">{purchase.email}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm space-y-1">
                                <p className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                  <span className="font-medium">Master:</span> {purchase.masterHives}
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  <span className="font-medium">Normal:</span> {purchase.normalHives}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-lg text-gray-900">${purchase.totalAmount}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                                  purchase.status === 'approved' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' :
                                  purchase.status === 'pending' ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white' :
                                  'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                                }`}>
                                  {purchase.status}
                                </span>
                                {purchase.accessGranted && (
                                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
                                    Access Granted
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleOpenContainerModal(purchase)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 hover:from-indigo-200 hover:to-purple-200 text-indigo-700 rounded-xl transition-all font-semibold text-sm shadow-sm hover:shadow-md transform hover:scale-105"
                              >
                                <Package className="w-4 h-4" />
                                {purchase.assignedContainers?.length || 0} assigned
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                {!purchase.accessGranted ? (
                                  <button
                                    onClick={() => handleGrantAccess(purchase.id)}
                                    disabled={processing === purchase.id}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl transition-all font-semibold text-sm shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                    Grant
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRevokeAccess(purchase.id)}
                                    disabled={processing === purchase.id}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl transition-all font-semibold text-sm shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
                                  >
                                    <UserX className="w-4 h-4" />
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => toggleRowExpansion(purchase.id)}
                                className="p-2 hover:bg-blue-100 rounded-xl transition-all transform hover:scale-110"
                              >
                                {expandedRows.has(purchase.id) ? (
                                  <ChevronUp className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-600" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {expandedRows.has(purchase.id) && (
                            <tr>
                              <td colSpan={7} className="px-6 py-6 bg-gradient-to-r from-gray-50 to-blue-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                    <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                      <UserCheck className="w-5 h-5 text-blue-600" />
                                      Contact Information
                                    </p>
                                    <div className="space-y-2 text-gray-600">
                                      <p><span className="font-semibold">Phone:</span> {purchase.phone}</p>
                                      <p><span className="font-semibold">Address:</span> {purchase.address}</p>
                                      <p><span className="font-semibold">City:</span> {purchase.city}, {purchase.country}</p>
                                    </div>
                                  </div>
                                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                    <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                      <Package className="w-5 h-5 text-indigo-600" />
                                      Purchase Details
                                    </p>
                                    <div className="space-y-2 text-gray-600">
                                      <p><span className="font-semibold">Date:</span> {new Date(purchase.purchaseDate).toLocaleDateString()}</p>
                                      {purchase.adminNotes && (
                                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                          <p className="font-semibold text-blue-800 mb-1">Admin Notes:</p>
                                          <p className="text-blue-700">{purchase.adminNotes}</p>
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
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl shadow-xl border border-gray-100">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium">No purchases found</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
              </div>
            )}

            {/* Location Modal */}
            {showLocationModal && selectedLocationContainer && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    Set Apiary Location
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Configure GPS coordinates for <span className="font-semibold text-blue-600">{selectedLocationContainer}</span>
                  </p>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Latitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g., 24.453884"
                        value={locationForm.lat}
                        onChange={(e) => setLocationForm({ ...locationForm, lat: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Range: -90 to 90</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Longitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g., 54.377344"
                        value={locationForm.lon}
                        onChange={(e) => setLocationForm({ ...locationForm, lon: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Range: -180 to 180</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Address (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Abu Dhabi, UAE"
                        value={locationForm.address}
                        onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Human-readable location name</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 How to get coordinates:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Open Google Maps</li>
                      <li>Right-click on your apiary location</li>
                      <li>Click on the coordinates to copy them</li>
                      <li>Paste here (format: latitude, longitude)</li>
                    </ol>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowLocationModal(false);
                        setSelectedLocationContainer(null);
                        setLocationForm({ lat: '', lon: '', address: '' });
                      }}
                      className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveLocation}
                      className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all"
                    >
                      Save Location
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Container Assignment Modal */}
            {showContainerModal && selectedPurchase && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-800">Assign Containers</h2>
                    <p className="text-gray-600 mt-1">
                      User: {selectedPurchase.fullName} ({selectedPurchase.email})
                    </p>
                  </div>
                  
                  <div className="p-6 overflow-y-auto max-h-96">
                    <p className="text-sm text-gray-600 mb-4">
                      Available Containers: {containers.length}
                    </p>
                    
                    {containers.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No containers available</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {containers.map(container => {
                          const location = apiaryLocations[container.name];
                          const isSelected = tempContainers.includes(container.name);
                          
                          return (
                            <label
                              key={container.name}
                              className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border-2 ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-500' 
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleContainer(container.name)}
                                  className="w-5 h-5 text-blue-600 rounded"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{container.name}</p>
                                    {location && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                        <MapPin className="w-3 h-3" />
                                        Located
                                      </span>
                                    )}
                                  </div>
                                  {location && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      📍 {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                                      {location.address && ` • ${location.address}`}
                                    </p>
                                  )}
                                  {container.lastModified && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Last modified: {new Date(container.lastModified).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {container.blobCount !== undefined && (
                                <span className="text-sm text-gray-500 ml-2">
                                  {container.blobCount} files
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Notes
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes about this assignment..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                  </div>
                  
                  <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowContainerModal(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveContainers}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Save Assignments
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
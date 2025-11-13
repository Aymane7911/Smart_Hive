'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Purchase {
  id: number;
  userId: number;
  masterHives: number;
  normalHives: number;
  totalAmount: number;
  purchaseDate: string;
  hasAccess: boolean;
  accessGrantedAt: string | null;
  assignedContainers: string[] | null;
  user: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
  };
}

interface AzureContainer {
  name: string;
  lastModified?: Date;
  blobCount?: number;
}

interface ApiaryLocation {
  containerId: string;
  lat: number;
  lon: number;
  address?: string;
}

export default function SmartHiveAccessManagement() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [containers, setContainers] = useState<AzureContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [selectedContainers, setSelectedContainers] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocationContainer, setSelectedLocationContainer] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({ lat: '', lon: '', address: '' });
  const [apiaryLocations, setApiaryLocations] = useState<Record<string, ApiaryLocation>>({});

  // Helper function to decode JWT
  const decodeJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  };

  // Load apiary locations from storage
  const loadApiaryLocations = async () => {
  const response = await fetch('/api/admin/smart-hive/apiary-locations');
  const result = await response.json();
  if (result.success) {
    setApiaryLocations(result.data);
  }
};

  // Save apiary locations to storage
  const saveApiaryLocations = async (location: ApiaryLocation) => {
    try {
      console.log('💾 Saving location to database:', location);
      
      const response = await fetch('/api/admin/smart-hive/apiary-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(location),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Location saved to database');
        return true;
      } else {
        console.error('❌ Failed to save location:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to save location:', error);
      return false;
    }
  };

  // Check owner access on mount
  useEffect(() => {
    const checkOwnerAccess = () => {
      const token = localStorage.getItem('token');
      const adminInfo = localStorage.getItem('adminInfo');

      console.log('🔒 Checking owner access...');

      if (!token || !adminInfo) {
        console.log('❌ No token or admin info found');
        router.push('/admin/login');
        return;
      }

      try {
        const decoded = decodeJWT(token);
        const admin = JSON.parse(adminInfo);

        console.log('👤 Admin info:', {
          email: admin.email,
          role: admin.role,
          isOwner: admin.isOwner,
          decodedIsOwner: decoded?.isOwner
        });

        // Check if user is the platform owner
        if (!decoded?.isOwner && !admin?.isOwner) {
          console.log('⛔ Access denied - not owner');
          alert('⛔ Access Denied: This page is only accessible to the platform owner.');
          router.push('/welcome');
          return;
        }

        console.log('✅ Owner access verified');
        setAuthorized(true);
        
        // Load data
        loadApiaryLocations();
        fetchPurchases();
        fetchContainers();
      } catch (error) {
        console.error('❌ Authorization check failed:', error);
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkOwnerAccess();
  }, [router]);

  const fetchPurchases = async () => {
    try {
      console.log('📊 Fetching purchases...');
      const response = await fetch('/api/admin/smart-hive/manage-access');
      const result = await response.json();

      if (response.status === 403) {
        alert('Access denied. Owner privileges required.');
        router.push('/admin/dashboard');
        return;
      }

      if (result.success) {
        console.log('✅ Fetched purchases:', result.data.length);
        setPurchases(result.data);
      } else {
        console.error('❌ Failed to fetch purchases:', result.error);
      }
    } catch (error) {
      console.error('❌ Failed to fetch purchases:', error);
    }
  };

  const fetchContainers = async () => {
    try {
      console.log('📦 Fetching containers...');
      const response = await fetch('/api/admin/smart-hive/containers');
      const result = await response.json();

      if (response.status === 403) {
        alert('Access denied. Owner privileges required.');
        router.push('/admin/dashboard');
        return;
      }

      if (result.success) {
        console.log('✅ Fetched containers:', result.data.length);
        setContainers(result.data);
      } else {
        console.error('❌ Failed to fetch containers:', result.error);
      }
    } catch (error) {
      console.error('❌ Failed to fetch containers:', error);
    }
  };

  const handleGrantAccessClick = (purchase: Purchase) => {
    console.log('\n' + '='.repeat(50));
    console.log('🎯 Grant/Edit access clicked');
    console.log('User:', purchase.user.email);
    console.log('Current assigned containers:', purchase.assignedContainers);
    console.log('='.repeat(50));
    
    setSelectedPurchase(purchase);
    setActionType('grant');
    
    // Ensure we handle the containers properly
    let currentContainers: string[] = [];
    
    if (purchase.assignedContainers) {
      if (Array.isArray(purchase.assignedContainers)) {
        currentContainers = purchase.assignedContainers;
      } else if (typeof purchase.assignedContainers === 'string') {
        try {
          const parsed = JSON.parse(purchase.assignedContainers);
          currentContainers = Array.isArray(parsed) ? parsed : [];
        } catch {
          currentContainers = [];
        }
      }
    }
    
    console.log('✅ Initialized selectedContainers:', currentContainers);
    setSelectedContainers(currentContainers);
    setShowContainerModal(true);
  };

  const handleRevokeAccessClick = (purchase: Purchase) => {
    console.log('🚫 Revoke access clicked for:', purchase.user.email);
    setSelectedPurchase(purchase);
    setActionType('revoke');
    setSelectedContainers([]);
    setShowConfirmModal(true);
  };

  const toggleContainer = (containerName: string) => {
    setSelectedContainers(prev => {
      const newContainers = prev.includes(containerName)
        ? prev.filter(c => c !== containerName)
        : [...prev, containerName];
      
      console.log('🔄 Container selection updated:', newContainers);
      return newContainers;
    });
  };

  const handleAccessChange = async () => {
    if (!selectedPurchase) {
      console.error('❌ No purchase selected');
      alert('Error: No purchase selected');
      return;
    }

    if (actionType === 'grant' && selectedContainers.length === 0) {
      alert('Please select at least one container');
      return;
    }

    const requestData = {
      userId: selectedPurchase.userId,
      action: actionType,
      containers: actionType === 'grant' ? selectedContainers : []
    };

    console.log('\n' + '='.repeat(50));
    console.log('🚀 SENDING ACCESS CHANGE REQUEST');
    console.log('Request data:', JSON.stringify(requestData, null, 2));
    console.log('='.repeat(50));

    setProcessing(true);
    
    try {
      const response = await fetch('/api/admin/smart-hive/manage-access', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      console.log('📡 Response status:', response.status);

      if (response.status === 403) {
        alert('Access denied. Owner privileges required.');
        router.push('/admin/dashboard');
        return;
      }
      
      const result = await response.json();
      console.log('📡 Response data:', JSON.stringify(result, null, 2));

      if (result.success) {
        console.log('✅ SUCCESS!');
        alert(`Access ${actionType === 'grant' ? 'granted' : 'revoked'} successfully!`);
        
        await fetchPurchases();
        
        setShowConfirmModal(false);
        setShowContainerModal(false);
        setSelectedPurchase(null);
        setSelectedContainers([]);
        setActionType('');
      } else {
        console.error('❌ Failed:', result.error);
        alert('Failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('❌ Error changing access:', error);
      alert('An error occurred: ' + error.message);
    } finally {
      setProcessing(false);
      console.log('='.repeat(50) + '\n');
    }
  };

  // Handle opening location modal
  const handleSetLocationClick = (containerName: string) => {
    setSelectedLocationContainer(containerName);
    
    // Load existing location if available
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

  // Save location
 // Fixed handleSaveLocation function
// Replace the existing handleSaveLocation in your component with this

const handleSaveLocation = async () => {
  if (!selectedLocationContainer) return;

  const lat = parseFloat(locationForm.lat);
  const lon = parseFloat(locationForm.lon);

  // Validate coordinates
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

  console.log('💾 Saving location for:', selectedLocationContainer);
  console.log('📍 Location data:', newLocation);

  // Save single location to database (not the whole locations object)
  const saved = await saveApiaryLocations(newLocation);

  if (saved) {
    /// Update local state
    const updatedLocations = {
      ...apiaryLocations,
      [selectedLocationContainer]: newLocation
    };
    setApiaryLocations(updatedLocations);

    alert('Location saved successfully to database!');
    setShowLocationModal(false);
    setSelectedLocationContainer(null);
    setLocationForm({ lat: '', lon: '', address: '' });
    
    // Reload all locations from database to ensure sync
    await loadApiaryLocations();
  } else {
    alert('Failed to save location. Please try again.');
  }
};

  const filteredPurchases = purchases.filter(purchase => {
    const userName = `${purchase.user.firstname} ${purchase.user.lastname}`.toLowerCase();
    const matchesSearch = userName.includes(searchQuery.toLowerCase()) ||
                         purchase.user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending') return matchesSearch && !purchase.hasAccess;
    if (filterStatus === 'active') return matchesSearch && purchase.hasAccess;
    
    return matchesSearch;
  });

  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => !p.hasAccess).length,
    active: purchases.filter(p => p.hasAccess).length,
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Verifying owner access...</p>
        </div>
      </div>
    );
  }

  // Not authorized (will redirect)
  if (!authorized) {
    return null;
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Smart Hive Access Management</h1>
                  <p className="text-sm text-yellow-600 font-medium">🔒 Owner-Only Access</p>
                </div>
              </div>
              <p className="text-gray-600">Manage user access and assign Azure containers</p>
            </div>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Purchases</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending Access</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Users</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'active'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active ({stats.active})
              </button>
            </div>
          </div>
        </div>

        {/* Apiary Locations Management */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Apiary Locations
          </h2>
          <p className="text-gray-600 mb-4">Set GPS coordinates for each apiary container</p>
          
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
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
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

        {/* Purchases Table */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Hives</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Containers</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Purchase Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No purchases found
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {purchase.user.firstname.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-800">
                              {purchase.user.firstname} {purchase.user.lastname}
                            </p>
                            <p className="text-xs text-gray-500">{purchase.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-800">
                          {purchase.masterHives} Master, {purchase.normalHives} Normal
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {purchase.assignedContainers && purchase.assignedContainers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {purchase.assignedContainers.map((container, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {container}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-800">
                          {new Date(purchase.purchaseDate).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {purchase.hasAccess ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          {purchase.hasAccess ? (
                            <>
                              <button
                                onClick={() => handleGrantAccessClick(purchase)}
                                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-all"
                              >
                                Edit Containers
                              </button>
                              <button
                                onClick={() => handleRevokeAccessClick(purchase)}
                                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all"
                              >
                                Revoke Access
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleGrantAccessClick(purchase)}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all"
                            >
                              Grant Access
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Location Modal */}
      {showLocationModal && selectedLocationContainer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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

      {/* Container Selection Modal */}
      {showContainerModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Assign Azure Containers
            </h3>
            <p className="text-gray-600 mb-6">
              Select containers for {selectedPurchase.user.firstname} {selectedPurchase.user.lastname}
            </p>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-700">Available Containers</h4>
                <span className="text-sm text-gray-500">
                  {selectedContainers.length} selected
                </span>
              </div>
              
              {containers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No containers available</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {containers.map((container) => {
                    const isSelected = selectedContainers.includes(container.name);
                    const location = apiaryLocations[container.name];
                    
                    return (
                      <div
                        key={container.name}
                        onClick={() => toggleContainer(container.name)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-800">{container.name}</p>
                                {location && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
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
                            <span className="text-sm text-gray-500">
                              {container.blobCount} files
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowContainerModal(false);
                  setSelectedContainers([]);
                  setSelectedPurchase(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAccessChange}
                disabled={processing || selectedContainers.length === 0}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
              >
                {processing ? 'Processing...' : `Grant Access (${selectedContainers.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {showConfirmModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Revoke Access?
            </h3>
            <p className="text-gray-600 mb-6">
              Revoke Smart Hive access from {selectedPurchase.user.firstname} {selectedPurchase.user.lastname}? This will remove all assigned containers.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedPurchase(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAccessChange}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all"
              >
                {processing ? 'Processing...' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
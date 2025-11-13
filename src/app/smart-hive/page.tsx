'use client';

// Declare window.storage type
declare global {
  interface Window {
    storage: {
      get: (key: string, shared?: boolean) => Promise<{ key: string; value: string; shared: boolean } | null>;
      set: (key: string, value: string, shared?: boolean) => Promise<{ key: string; value: string; shared: boolean } | null>;
      delete: (key: string, shared?: boolean) => Promise<{ key: string; deleted: boolean; shared: boolean } | null>;
      list: (prefix?: string, shared?: boolean) => Promise<{ keys: string[]; prefix?: string; shared: boolean } | null>;
    };
  }
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SensorData } from '../../lib/types';
import TemperatureChart from '../../components/Charts/TemperatureChart';
import HumidityChart from '../../components/Charts/HumidityChart';
import BatteryChart from '../../components/Charts/BatteryChart';
import WeightChart from '../../components/Charts/WeightChart';
import LocationMap from '../../components/Charts/LocationMap';
import { Home, ShoppingCart, LayoutDashboard, LogOut, Menu, X, RefreshCw, ChevronLeft, Edit2, Check, XCircle, Search, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { 
  getTemperature, 
  getHumidity, 
  getWeight, 
  getBattery,
  getLastValidValue,
  toNumber,
  getHiveData
} from '../../lib/hiveDataUtils';
import SmartHiveAIAssistant from '../../components/AIAssistant/SmartHiveAIAssistant';

interface PurchaseInfo {
  id: number;
  masterHives: number;
  normalHives: number;
  purchaseDate: string;
  accessGrantedAt: string;
  assignedContainers: string[];
}

const getLatestValue = (data: SensorData[], field: keyof SensorData): number | null => {
  if (!data || data.length === 0) return null;
  const latestItem = data[data.length - 1];
  return toNumber(latestItem?.[field]);
};

const isHiveActivated = (hiveData: SensorData[]): boolean => {
  if (!hiveData || hiveData.length === 0) return false;
  
  const latestItem = hiveData[hiveData.length - 1];
  if (!latestItem) return false;
  
  const tempInternal = getTemperature(latestItem, 'internal');
  const humInternal = getHumidity(latestItem, 'internal');
  const weight = getWeight(latestItem);
  const battery = getBattery(latestItem);
  
  const hasTemperature = tempInternal !== null && !isNaN(tempInternal) && tempInternal !== 0;
  const hasHumidity = humInternal !== null && !isNaN(humInternal) && humInternal !== 0;
  const hasWeight = weight !== null && !isNaN(weight) && weight !== 0;
  const hasBattery = battery !== null && !isNaN(battery);
  
  return hasTemperature || hasHumidity || hasWeight || hasBattery;
};

const calculateChange = (data: SensorData[], field: keyof SensorData): number | null => {
  if (!data || data.length < 2) return null;
  const latest = toNumber(data[data.length - 1]?.[field]);
  const previous = toNumber(data[data.length - 2]?.[field]);
  if (latest === null || previous === null) return null;
  return latest - previous;
};

const getBatteryColor = (battery: number | null): string => {
  if (battery === null) return '#9CA3AF';
  if (battery < 20) return '#EF4444';
  if (battery < 40) return '#F59E0B';
  return '#10B981';
};

const HiveCircle = ({ 
  hiveNumber, 
  data,
  isMaster,
  historicalData,
  onClick, 
  isSelected,
  onEditName,
  hiveName
}: { 
  hiveNumber: number;
  data: SensorData[];
  historicalData: SensorData[];
  isMaster: boolean;
  onClick: () => void;
  isSelected: boolean;
  onEditName: () => void;
  hiveName: string;
}) => {
  const hiveIndex = hiveNumber - 1;
  
  const tempInternal = getLastValidValue(
    data,
    historicalData,
    hiveIndex,
    (item) => getTemperature(item, 'internal')
  );
  
  const humInternal = getLastValidValue(
    data,
    historicalData,
    hiveIndex,
    (item) => getHumidity(item, 'internal')
  );
  
  const weight = getLastValidValue(
    data,
    historicalData,
    hiveIndex,
    (item) => getWeight(item)
  );
  
  const hiveData = getHiveData(data, hiveNumber);
  const latestHiveItem = hiveData.length > 0 ? hiveData[hiveData.length - 1] : null;
  const batteryRaw = latestHiveItem ? getBattery(latestHiveItem) : null;
  // Force battery to 0 for Hive 2, otherwise use actual value or default to 100
  const battery = hiveNumber === 2 ? 0 : (batteryRaw !== null ? batteryRaw : 100);
  
  const tempChange = calculateChange(hiveData, 'temp_internal');
  const weightChange = calculateChange(hiveData, 'weight');
  
  const batteryColor = getBatteryColor(battery);
  
   const getLastReadingTime = (): string | null => {
  // Helper function to check if a data point has real sensor readings
  const hasRealData = (item: any): boolean => {
    if (!item) return false;
    
    const temp = getTemperature(item, 'internal');
    const hum = getHumidity(item, 'internal');
    const weight = getWeight(item);
    
    // At least one sensor must have a valid non-zero reading
    // Battery reading alone is NOT sufficient (can be simulated)
    return (temp !== null && !isNaN(temp) && temp !== 0) || 
           (hum !== null && !isNaN(hum) && hum !== 0) || 
           (weight !== null && !isNaN(weight) && weight !== 0);
  };
  
  // Combine both latest and historical data for this specific hive
  const historicalHiveData = getHiveData(historicalData, hiveNumber);
  const allHiveData = [...historicalHiveData, ...hiveData];
  
  // Search backwards from most recent to oldest through ALL data
  for (let i = allHiveData.length - 1; i >= 0; i--) {
    const item = allHiveData[i];
    if (hasRealData(item)) {
      const timestamp = item?.timestamp || item?._metadata?.lastModified;
      if (timestamp) return timestamp;
    }
  }
  
  return null;
};

  const lastReadingTime = getLastReadingTime();



  const formatTimeAgo = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'No data';
    try {
      const now = new Date();
      const then = new Date(timestamp);
      
      if (isNaN(then.getTime())) return 'Invalid date';
      
      const diffMs = now.getTime() - then.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins === 1) return '1 minute ago';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return '1 day ago';
      return `${diffDays} days ago`;
    } catch (error) {
      return 'No data';
    }
  };
  
  return (
    <div 
      onClick={onClick}
      className={`relative group cursor-pointer transition-all duration-500 transform hover:scale-105 ${
        isSelected ? 'scale-110' : ''
      }`}
    >
      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
        isSelected 
          ? 'bg-gradient-to-br from-blue-400/40 via-indigo-400/40 to-purple-400/40 blur-2xl scale-125' 
          : 'bg-gradient-to-br from-blue-200/20 via-indigo-200/20 to-purple-200/20 blur-xl group-hover:blur-2xl group-hover:scale-110'
      }`}></div>
      
      <div className={`relative w-72 h-72 rounded-full overflow-visible transition-all duration-500 ${
        isSelected 
          ? 'shadow-2xl ring-4 ring-blue-400/50' 
          : 'shadow-xl group-hover:shadow-2xl'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-full"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full"></div>
        
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="50%" cy="50%" r="44%" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
          <circle
            cx="50%" cy="50%" r="44%" fill="none" stroke={batteryColor} strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 126 * (battery / 100)} ${2 * Math.PI * 126}`}
            className="transition-all duration-1000"
          />
        </svg>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <div className="text-center">
            <div className="mb-3 text-[9px] text-white/40 group-hover:text-white/60 transition-colors">
              Click for details
            </div>
            
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {hiveName}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditName();
              }}
              className="text-white/40 hover:text-white/80 transition-colors p-1 mb-2"
              title="Rename hive"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            
            <div className="pt-2 border-t border-white/10">
              <div className="text-[9px] text-white/50 mb-1">Last Reading</div>
              <div className="text-xs font-semibold text-white/70">
                {historicalData.length === 0 ? 'Loading...' : formatTimeAgo(lastReadingTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Temperature - Top */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-blue-400/40 shadow-lg shadow-blue-500/20">
          <div className="text-[9px] text-blue-300 text-center mb-0.5 font-semibold uppercase tracking-wider">Temp</div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-sm font-bold text-blue-400">
              {tempInternal !== null ? `${tempInternal.toFixed(1)}°C` : 'N/A'}
            </span>
            {tempChange !== null && Math.abs(tempChange) > 0.1 && (
              <span className={`text-[10px] flex items-center ${tempChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {tempChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(tempChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Humidity - Right */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-indigo-400/40 shadow-lg shadow-indigo-500/20">
          <div className="text-[9px] text-indigo-300 text-center mb-0.5 font-semibold uppercase tracking-wider">Humidity</div>
          <div className="text-sm font-bold text-indigo-400 text-center">
            {humInternal !== null ? `${humInternal.toFixed(0)}%` : 'N/A'}
          </div>
        </div>

        {/* Weight - Bottom */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-purple-400/40 shadow-lg shadow-purple-500/20">
          <div className="text-[9px] text-purple-300 text-center mb-0.5 font-semibold uppercase tracking-wider">Weight</div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-sm font-bold text-purple-400">
              {weight !== null ? `${weight.toFixed(1)}kg` : 'N/A'}
            </span>
            {weightChange !== null && Math.abs(weightChange) > 0.1 && (
              <span className={`text-[10px] flex items-center ${weightChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {weightChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(weightChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Battery - Left */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm px-3 py-2 rounded-xl border shadow-lg" style={{ borderColor: `${batteryColor}66`, boxShadow: `0 4px 12px ${batteryColor}33` }}>
          <div className="text-[9px] text-center mb-0.5 font-semibold uppercase tracking-wider" style={{ color: `${batteryColor}dd` }}>Battery</div>
          <div className="text-sm font-bold text-center flex items-center gap-1" style={{ color: batteryColor }}>
            <span>{Math.round(battery)}%</span>
            {batteryRaw === null && (
              <span className="text-[7px] text-white/30" title="Simulated data">*</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SmartHiveDashboard() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseInfo | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [latestData, setLatestData] = useState<SensorData[]>([]);
  const [historicalData, setHistoricalData] = useState<SensorData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedHive, setSelectedHive] = useState<number | null>(null);
  const [apiarySearchQuery, setApiarySearchQuery] = useState<string>('');
  const [hiveNames, setHiveNames] = useState<Record<number, string>>({});
  const [apiaryNames, setApiaryNames] = useState<Record<string, string>>({});
  const [editingHive, setEditingHive] = useState<number | null>(null);
  const [editingApiary, setEditingApiary] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
const [containerLoading, setContainerLoading] = useState(true);
const [containerError, setContainerError] = useState<string | null>(null);
  const isMountedRef = useRef(true);


  const fetchUserAccessAndContainers = useCallback(async () => {
  if (!isMountedRef.current) return;
  
  console.log('🔐 Checking authentication and access...');
  setAuthChecking(true);
  setContainerLoading(true);
  setContainerError(null);
  setAuthError(null);
  
  try {
    // Check user access and get assigned containers
    const accessResponse = await fetch('/api/smart-hive/check-access', {
      credentials: 'include',
      cache: 'no-store', // 🔥 CRITICAL: Always fetch fresh data
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!isMountedRef.current) return;
    
    // Handle 401 Unauthorized
    if (accessResponse.status === 401) {
      console.log('❌ Unauthorized - redirecting to login');
      setAuthError('Not authenticated. Redirecting to login...');
      setHasAccess(false);
      setTimeout(() => {
        router.push('/login');
      }, 1000);
      return;
    }
    
    // Handle other error responses
    if (!accessResponse.ok) {
      console.log(`❌ Access check failed with status: ${accessResponse.status}`);
      setAuthError('Failed to verify access. Please try again.');
      setHasAccess(false);
      // Don't redirect on error - let user retry
      setContainerLoading(false);
      setAuthChecking(false);
      return;
    }
    
    const accessResult = await accessResponse.json();
    
    if (!isMountedRef.current) return;
    
    console.log('📊 Access check result:', accessResult);
    
    // Case 1: Not authenticated at all
    if (!accessResult.success) {
      console.log('❌ Access denied - not authenticated');
      setAuthError('Session expired. Please login again.');
      setHasAccess(false);
      setTimeout(() => {
        router.push('/login');
      }, 1500);
      return;
    }
    
    // Case 2: No purchase made yet
    if (!accessResult.hasPurchased) {
      console.log('❌ No purchase found - redirecting to payment');
      setAuthError('No Smart Hive purchase found. Please purchase a plan first.');
      setHasAccess(false);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      return;
    }
    
    // Case 3: Purchase pending approval
    if (!accessResult.hasAccess) {
      console.log('⏳ Purchase pending admin approval');
      setHasAccess(false);
      setAuthError(null); // ✅ Clear auth error since user is authenticated
      setContainerError('Your purchase is pending admin approval. Please wait for access to be granted.');
      setContainerLoading(false);
      setAuthChecking(false);
      // Don't set purchaseInfo here - user has no access yet
      return;
    }
    
    // Case 4: Has access - get assigned containers
    const purchaseData = accessResult.purchase;
    const assignedContainers = purchaseData.assignedContainers || [];
    
    console.log(`✅ User has access to ${assignedContainers.length} containers:`, assignedContainers);
    
    // Case 5: Access granted but no containers assigned
    if (assignedContainers.length === 0) {
      console.log('⚠️ Access granted but no containers assigned');
      setHasAccess(true);
      setAuthError(null);
      setContainerError('Access granted but no containers assigned yet. Please contact admin to assign containers.');
      setAvailableContainers([]);
      setPurchaseInfo({
        id: purchaseData.id,
        masterHives: purchaseData.masterHives || 0,
        normalHives: purchaseData.normalHives || 0,
        purchaseDate: purchaseData.purchaseDate,
        accessGrantedAt: purchaseData.accessGrantedAt || new Date().toISOString(),
        assignedContainers: []
      });
      setContainerLoading(false);
      setAuthChecking(false);
      return;
    }
    
    // Case 6: Full access with containers ✅
    console.log('✅ Full access granted with containers:', assignedContainers);
    
    setAvailableContainers(assignedContainers);
    setHasAccess(true);
    setAuthError(null);
    setContainerError(null);
    
    // Set purchase info with correct data from database
    setPurchaseInfo({
      id: purchaseData.id,
      masterHives: purchaseData.masterHives || 0,
      normalHives: purchaseData.normalHives || 0,
      purchaseDate: purchaseData.purchaseDate,
      accessGrantedAt: purchaseData.accessGrantedAt || new Date().toISOString(),
      assignedContainers: assignedContainers
    });
    
    // Set first assigned container as default (or keep current if still valid)
    if (!selectedContainer || !assignedContainers.includes(selectedContainer)) {
      if (assignedContainers.length > 0) {
        setSelectedContainer(assignedContainers[0]);
      }
    }
    
    console.log(`✅ Authentication successful - ${assignedContainers.length} containers loaded`);
    
  } catch (error: any) {
    console.error('❌ Error fetching user access:', error);
    if (isMountedRef.current) {
      setHasAccess(false);
      setAuthError('Failed to check access. Please refresh the page.');
      setContainerError(error.message || 'Network error occurred');
      
      // Don't redirect on network error - let user retry
    }
  } finally {
    if (isMountedRef.current) {
      setContainerLoading(false);
      setAuthChecking(false);
      setLoading(false);
    }
  }
}, [selectedContainer, router]);


 useEffect(() => {
  isMountedRef.current = true;
  
  // Check authentication ONLY ONCE on mount
  fetchUserAccessAndContainers();
  
  return () => {
    isMountedRef.current = false;
  };
}, []);

// Handle URL parameters for direct container selection
useEffect(() => {
  if (typeof window === 'undefined' || availableContainers.length === 0) return;
  
  const params = new URLSearchParams(window.location.search);
  const containerParam = params.get('container');
  
  if (containerParam && availableContainers.includes(containerParam)) {
    console.log('📍 Setting container from URL:', containerParam);
    setSelectedContainer(containerParam);
  } else if (!selectedContainer && availableContainers.length > 0) {
    // If no valid parameter, set first available container
    setSelectedContainer(availableContainers[0]);
  }
}, [availableContainers]);



  useEffect(() => {
    const loadNames = async () => {
      if (!selectedContainer) return;
      
      try {
        if (typeof window !== 'undefined') {
          const savedHiveNames = localStorage.getItem(`hive-names:${selectedContainer}`);
          if (savedHiveNames) {
            setHiveNames(JSON.parse(savedHiveNames));
          }
          
          const savedApiaryNames = localStorage.getItem('apiary-names');
          if (savedApiaryNames) {
            setApiaryNames(JSON.parse(savedApiaryNames));
          }
        }
      } catch (error) {
        console.log('No saved names found, using defaults');
      }
    };
    
    loadNames();
  }, [selectedContainer]);

  

  const handleLogout = useCallback(async () => {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.clear(); // Clear everything
      }
      
      // Redirect to login
      router.push('/login');
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even on error
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    router.push('/login');
  }
}, [router]);

  const flattenData = useCallback((data: any): SensorData[] => {
    if (!data) return [];
    
    let flatData: SensorData[] = [];
    
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0]?.data) {
        flatData = data.flatMap(item => item.data || []);
      } else {
        flatData = data;
      }
    } else if (data.data) {
      flatData = Array.isArray(data.data) ? data.data : [data.data];
    } else {
      flatData = [data];
    }
    
    return flatData;
  }, []);

  const fetchLatestData = useCallback(async () => {
    if (!isMountedRef.current || !selectedContainer) return;
    
    try {
      const url = `/api/smart-hive/data/latest?containerId=${encodeURIComponent(selectedContainer)}`;
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!isMountedRef.current) return;
      
      if (!response.ok) {
        setLatestData([]);
        setLastUpdated(new Date().toISOString());
        setIsOnline(true);
        setError(`API returned ${response.status}: ${response.statusText}`);
        return;
      }
      
      const result = await response.json();
      if (!isMountedRef.current) return;

      const flatData = flattenData(result.data || result);

      setLatestData(flatData);

      const actualDataTimestamp = flatData.length > 0 && flatData[0]?.timestamp 
        ? flatData[0].timestamp 
        : (result.timestamp || new Date().toISOString());

      setLastUpdated(actualDataTimestamp);
      setIsOnline(true);
      if (flatData.length > 0) {
        setError(null);
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      setError('Failed to fetch latest data');
      setLatestData([]);
      setIsOnline(false);
    }
  }, [hasAccess, selectedContainer, flattenData]);

  const fetchHistoricalData = useCallback(async () => {
    if (!isMountedRef.current || !selectedContainer) return;
    
    try {
      const url = `/api/smart-hive/data/historical?containerId=${encodeURIComponent(selectedContainer)}&limit=48`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!isMountedRef.current) return;
      
      if (!response.ok) {
        setHistoricalData([]);
        return;
      }
      
      const result = await response.json();
      if (!isMountedRef.current) return;
      
      const flatData = flattenData(result.data || result);
      setHistoricalData(flatData);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      setHistoricalData([]);
    }
  }, [hasAccess, selectedContainer, flattenData]);

  const handleContainerChange = useCallback((newContainer: string) => {
    if (newContainer === selectedContainer) return;
    setSelectedContainer(newContainer);
    setSelectedHive(null);
  }, [selectedContainer]);

  const getHiveName = useCallback((hiveNumber: number): string => {
    return hiveNames[hiveNumber] || `Hive ${hiveNumber}`;
  }, [hiveNames]);

  const getApiaryName = useCallback((containerId: string): string => {
    return apiaryNames[containerId] || containerId;
  }, [apiaryNames]);

  const handleHiveNameEdit = useCallback((hiveNumber: number) => {
    setEditingHive(hiveNumber);
    setTempName(getHiveName(hiveNumber));
  }, [getHiveName]);

  const handleApiaryNameEdit = useCallback((containerId: string) => {
    setEditingApiary(containerId);
    setTempName(getApiaryName(containerId));
  }, [getApiaryName]);

  const saveHiveName = useCallback(async (hiveNumber: number, newName: string) => {
    if (!selectedContainer || !newName.trim()) {
      setEditingHive(null);
      return;
    }
    
    const trimmedName = newName.trim();
    const updatedNames = { ...hiveNames, [hiveNumber]: trimmedName };
    setHiveNames(updatedNames);
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hive-names:${selectedContainer}`, JSON.stringify(updatedNames));
      }
    } catch (error) {
      console.error('Failed to save hive name:', error);
    }
    
    setEditingHive(null);
  }, [selectedContainer, hiveNames]);

  const saveApiaryName = useCallback(async (containerId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingApiary(null);
      return;
    }
    
    const trimmedName = newName.trim();
    const updatedNames = { ...apiaryNames, [containerId]: trimmedName };
    setApiaryNames(updatedNames);
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('apiary-names', JSON.stringify(updatedNames));
      }
    } catch (error) {
      console.error('Failed to save apiary name:', error);
    }
    
    setEditingApiary(null);
  }, [apiaryNames]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      // First, refresh authentication and container access
      await fetchUserAccessAndContainers();
      
      // Then fetch the latest sensor data
      await Promise.allSettled([
        fetchLatestData(),
        fetchHistoricalData()
      ]);
      
      // Show success feedback
      console.log('✅ Dashboard refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing dashboard:', error);
      setError('Failed to refresh. Please try again.');
    } finally {
      setTimeout(() => {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }, 1000);
    }
  }, [isRefreshing, fetchLatestData, fetchHistoricalData]);

  useEffect(() => {
  // Wait for both containers and selection to be ready
  if (containerLoading || !selectedContainer) {
    setLoading(false);
    return;
  }

  setLatestData([]);
  setHistoricalData([]);
  setError(null);
  setLoading(true);

  const fetchData = async () => {
    if (!isMountedRef.current) return;
    
    await fetchHistoricalData();
    await fetchLatestData();
    
    if (isMountedRef.current) {
      setLoading(false);
    }
  };
  
  fetchData();
  
  // Auto-refresh data every 5 MINUTES (300000ms) - NOT on every render
  const interval = setInterval(() => {
    if (isMountedRef.current && document.visibilityState === 'visible') {
      console.log('🔄 Auto-refreshing sensor data...');
      fetchLatestData();
      fetchHistoricalData();
    }
  }, 300000); // 5 minutes

  return () => {
    clearInterval(interval);
  };
}, [selectedContainer]);



  

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
          <p className="text-xl text-indigo-900 font-semibold mb-2">Loading Smart Hive Dashboard</p>
          <p className="text-indigo-700/80 text-sm">Preparing your sensor data...</p>
        </div>
      </div>
    );
  }

 // Calculate actual number of hives from data (each row with unique id = 1 hive)
const getActualHiveCount = (): number => {
  // Try latest data first
  if (latestData && latestData.length > 0) {
    // Count unique hive IDs (each id represents a different hive)
    const uniqueHiveIds = new Set(
      latestData
        .map(item => item.id)
        .filter(id => id !== null && id !== undefined && !isNaN(id))
    );
    
    if (uniqueHiveIds.size > 0) {
      console.log('📊 Detected hives from latest data:', uniqueHiveIds.size);
      return uniqueHiveIds.size;
    }
  }
  
  // Try historical data as fallback
  if (historicalData && historicalData.length > 0) {
    const uniqueHiveIds = new Set(
      historicalData
        .map(item => item.id)
        .filter(id => id !== null && id !== undefined && !isNaN(id))
    );
    
    if (uniqueHiveIds.size > 0) {
      console.log('📊 Detected hives from historical data:', uniqueHiveIds.size);
      return uniqueHiveIds.size;
    }
  }
  
  // No data yet - return 0 to show empty state
  console.log('⚠️ No hive data found yet');
  return 0;
};

const actualHiveCount = getActualHiveCount();
const totalHives = actualHiveCount > 0 ? actualHiveCount : (purchaseInfo ? purchaseInfo.masterHives + purchaseInfo.normalHives : 0);
const hiveNumbers = Array.from({ length: totalHives }, (_, i) => i + 1);

console.log('🎯 Total hives to display:', totalHives);

  const activatedHives = hiveNumbers.filter((hiveNum) => {
  // Get all data for this specific hive from both sources
  const currentHiveData = getHiveData(latestData, hiveNum);
  const historicalHiveData = getHiveData(historicalData, hiveNum);
  const allHiveData = [...historicalHiveData, ...currentHiveData];
  
  // Define "recent" as within last 3 hours (adjustable)
  const RECENT_HOURS = 4;
  const recentThreshold = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
  
  // Search through all data points for this hive
  for (let i = allHiveData.length - 1; i >= 0; i--) {
    const item = allHiveData[i];
    if (!item) continue;
    
    // Check if data is recent enough
    const timestamp = item?.timestamp || item?._metadata?.lastModified;
    if (timestamp) {
      const dataTime = new Date(timestamp);
      if (dataTime < recentThreshold) {
        continue; // Skip old data
      }
    }
    
    const temp = getTemperature(item, 'internal');
    const hum = getHumidity(item, 'internal');
    const weight = getWeight(item);
    
    // Must have at least one real sensor reading (not battery alone)
    if ((temp !== null && !isNaN(temp) && temp !== 0) ||
        (hum !== null && !isNaN(hum) && hum !== 0) ||
        (weight !== null && !isNaN(weight) && weight !== 0)) {
      return true; // Found recent valid sensor data
    }
  }
  
  return false; // No recent valid sensor data found
}).length;

// Get list of inactive hives
const inactiveHives = hiveNumbers.filter((hiveNum) => {
  const currentHiveData = getHiveData(latestData, hiveNum);
  const historicalHiveData = getHiveData(historicalData, hiveNum);
  const allHiveData = [...historicalHiveData, ...currentHiveData];
  
  const RECENT_HOURS = 4;
  const recentThreshold = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
  
  for (let i = allHiveData.length - 1; i >= 0; i--) {
    const item = allHiveData[i];
    if (!item) continue;
    
    const timestamp = item?.timestamp || item?._metadata?.lastModified;
    if (timestamp) {
      const dataTime = new Date(timestamp);
      if (dataTime < recentThreshold) continue;
    }
    
    const temp = getTemperature(item, 'internal');
    const hum = getHumidity(item, 'internal');
    const weight = getWeight(item);
    
    if ((temp !== null && !isNaN(temp) && temp !== 0) ||
        (hum !== null && !isNaN(hum) && hum !== 0) ||
        (weight !== null && !isNaN(weight) && weight !== 0)) {
      return false; // Active
    }
  }
  
  return true; // Inactive
});

const inactiveHiveNames = inactiveHives.map(num => getHiveName(num));



  // Calculate average stats
  const calculateAverage = (field: 'temp' | 'hum' | 'weight') => {
    const values = hiveNumbers
      .map(hiveNum => {
        const hiveData = getHiveData(latestData, hiveNum);
        if (hiveData.length === 0) return null;
        const latest = hiveData[hiveData.length - 1];
        if (field === 'temp') return getTemperature(latest, 'internal');
        if (field === 'hum') return getHumidity(latest, 'internal');
        if (field === 'weight') return getWeight(latest);
        return null;
      })
      .filter((v): v is number => v !== null && !isNaN(v) && v !== 0);
    
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const avgTemp = calculateAverage('temp');
  const avgHum = calculateAverage('hum');
  const totalWeight = hiveNumbers
    .map(hiveNum => {
      const hiveData = getHiveData(latestData, hiveNum);
      if (hiveData.length === 0) return 0;
      const latest = hiveData[hiveData.length - 1];
      const w = getWeight(latest);
      return w !== null && !isNaN(w) ? w : 0;
    })
    .reduce((a, b) => a + b, 0);

    // Show loading screen while checking authentication
if (authChecking || loading) {
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
        <p className="text-xl text-indigo-900 font-semibold mb-2">
          {authError ? 'Redirecting...' : authChecking ? 'Verifying Access...' : 'Loading Dashboard...'}
        </p>
        <p className="text-indigo-700/80 text-sm">
          {authError || (authChecking ? 'Please wait while we check your credentials' : 'Preparing your sensor data...')}
        </p>
      </div>
    </div>
  );
}

// Show error screen if authentication failed
if (authError && !authChecking) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50"></div>
      </div>
      
      <div className="text-center relative z-10 max-w-md mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-red-200">
          <div className="mb-6">
            <svg className="w-20 h-20 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Error</h2>
          <p className="text-gray-600 mb-6">{authError}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setAuthError(null);
                fetchUserAccessAndContainers();
              }}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Show pending approval message if user has no access
if (!hasAccess && !authChecking && containerError) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50"></div>
      </div>
      
      <div className="text-center relative z-10 max-w-md mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-yellow-200">
          <div className="mb-6">
            <svg className="w-20 h-20 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Pending</h2>
          <p className="text-gray-600 mb-6">{containerError}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setContainerError(null);
                fetchUserAccessAndContainers();
              }}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Check Access Again
            </button>
            <button
              onClick={() => router.push('/welcome')}
              className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Go to Home
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Enhanced gradient background with blue/indigo/purple theme */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>
      
      {/* Edit Hive Name Modal */}
      {editingHive !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Rename Hive</h3>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveHiveName(editingHive, tempName);
                if (e.key === 'Escape') setEditingHive(null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 mb-4"
              placeholder="Enter hive name"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => saveHiveName(editingHive, tempName)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => setEditingHive(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Apiary Name Modal */}
      {editingApiary !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Rename Apiary</h3>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveApiaryName(editingApiary, tempName);
                if (e.key === 'Escape') setEditingApiary(null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 mb-4"
              placeholder="Enter apiary name"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => saveApiaryName(editingApiary, tempName)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => setEditingApiary(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <button
              onClick={() => {
                router.push('/welcome');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <Home className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
              <span className="font-medium">Home</span>
            </button>

            <button
              onClick={() => {
                router.push('/dashboard');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg shadow-blue-500/20"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </button>

            <button
              onClick={() => {
                router.push('/payment');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group"
            >
              <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Purchase Smart Hive</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-700/50 space-y-3">
            {purchaseInfo && (
              <div className="px-4 py-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Total Hives</p>
                <p className="text-2xl font-bold text-blue-400">
                  {purchaseInfo.masterHives + purchaseInfo.normalHives}
                </p>
              </div>
            )}
            <button
              onClick={() => {
                handleLogout();
                setSidebarOpen(false);
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
        {/* Enhanced Header */}
        <header className="relative bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-white/50 text-black overflow-hidden mx-4 mt-4">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5"></div>
          
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-4 p-2.5 rounded-xl hover:bg-blue-100/50 transition-all duration-300 hover:scale-110"
              >
                <Menu className="h-5 w-5 text-gray-700" />
              </button>
              <button
  onClick={() => router.push('/welcome')}
  className="mr-4 flex items-center gap-2 px-4 py-2 bg-white/80 rounded-xl border border-blue-200/50 shadow-sm hover:shadow-md transition-all text-sm font-medium text-gray-700 hover:text-blue-600"
>
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
                  {purchaseInfo && (
                    <p className="text-gray-600 text-xs mt-0.5">
                      Monitoring <span className="font-semibold text-blue-600">{purchaseInfo.masterHives + purchaseInfo.normalHives}</span> hives
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/80 rounded-xl border border-blue-200/50 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
                  {isOnline ? 'Connected' : 'Offline'}
                </span>
              </div>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg transform transition-all duration-500 flex items-center bg-gradient-to-r from-blue-600 to-indigo-500 text-white hover:from-blue-500 hover:to-indigo-400 hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 transition-all duration-300 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
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
          
          <p className="text-gray-600 text-xs mt-3 relative z-10 opacity-75">
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Awaiting data...'}
          </p>
          
          {error && (
            <div className="mt-3 p-3 bg-red-100/80 backdrop-blur-2xl border border-red-300/50 text-red-800 rounded-xl flex items-start gap-3 shadow-lg">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1600px] mx-auto">
            {/* Enhanced Stats and Controls Bar */}
            {purchaseInfo && (
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-5 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wider">Total Hives</p>
                      <p className="text-3xl font-bold text-blue-600">{totalHives}</p>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-200/50 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-indigo-800 mb-1 uppercase tracking-wider">Hives Active</p>
                      <p className="text-3xl font-bold text-indigo-600">{activatedHives}</p>
                      <p className="text-[10px] text-indigo-600 mt-1">of {totalHives} hives</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/50 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-purple-800 mb-1 uppercase tracking-wider">Select View</p>
                      <select
                        value={selectedHive || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedHive(value ? parseInt(value) : null);
                        }}
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-purple-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer text-sm"
                      >
                        <option value="">View All Hives</option>
                        {hiveNumbers.map((hiveNum) => (
                          <option key={hiveNum} value={hiveNum}>
                            {getHiveName(hiveNum)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Inactive Hives Alert */}
{inactiveHives.length > 0 && (
  <div className="mt-4 p-4 bg-yellow-50/90 backdrop-blur-xl border-l-4 border-yellow-500 rounded-xl shadow-lg">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0">
        <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-yellow-800 mb-1">
          ⚠️ {inactiveHives.length} {inactiveHives.length === 1 ? 'Hive' : 'Hives'} Inactive
        </h3>
        <p className="text-sm text-yellow-700 mb-2">
          The following {inactiveHives.length === 1 ? 'hive has' : 'hives have'} not sent data in the last 4 hours:
        </p>
        <div className="flex flex-wrap gap-2">
          {inactiveHiveNames.map((name, idx) => (
            <span 
              key={idx}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-200 text-yellow-800"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="text-xs text-yellow-600 mt-2">
          Please check sensor connections and battery levels.
        </p>
      </div>
      <button
        onClick={() => {
          // Optionally add dismiss functionality
          console.log('Alert dismissed');
        }}
        className="flex-shrink-0 text-yellow-600 hover:text-yellow-800 transition-colors"
        title="Dismiss"
      >
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  </div>
)}

                  {/* Filter Controls */}
<div className="flex items-center gap-3">
  <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
    <button
      onClick={() => setFilterStatus('all')}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        filterStatus === 'all'
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      All ({totalHives})
    </button>
    <button
      onClick={() => setFilterStatus('active')}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        filterStatus === 'active'
          ? 'bg-green-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      Active ({activatedHives})
    </button>
    <button
      onClick={() => setFilterStatus('inactive')}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        filterStatus === 'inactive'
          ? 'bg-yellow-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      Inactive ({inactiveHives.length})
    </button>
  </div>
</div>
                </div>
              </div>
            )}

            {/* Check if there's no data for the selected container */}
            {latestData.length === 0 && !loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="mb-6">
                    <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-700 mb-2">No Hives Available Yet</h3>
                  <p className="text-gray-500 mb-4">
                    This apiary doesn't contain any sensor data at the moment.
                  </p>
                  <p className="text-sm text-gray-400">
                    Please make sure your hives are connected and transmitting data.
                  </p>
                </div>
              </div>
            ) : selectedHive === null ? (
              /* Hive Circles View with Enhanced Container List */
              <div className="flex gap-6">
                {/* Container List - Left Side */}
                {purchaseInfo && purchaseInfo.assignedContainers && purchaseInfo.assignedContainers.length > 1 && (
                  <div className="w-80 flex-shrink-0">
                    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-5 sticky top-4">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Filter className="w-5 h-5 text-blue-600" />
                        Select Apiary
                      </h3>
                      
                      {/* Enhanced Search Bar */}
                      <div className="mb-4">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search apiary..."
                            value={apiarySearchQuery}
                            onChange={(e) => setApiarySearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pl-11 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
                          />
                          <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      {/* Apiary List */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {purchaseInfo.assignedContainers
                          .filter(container => 
                            getApiaryName(container).toLowerCase().includes(apiarySearchQuery.toLowerCase()) ||
                            container.toLowerCase().includes(apiarySearchQuery.toLowerCase())
                          )
                          .map((container) => (
                            <div key={container} className="relative group">
                              <div
                                onClick={() => {
                                  handleContainerChange(container);
                                  setApiarySearchQuery('');
                                }}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                                  selectedContainer === container
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`p-2 rounded-lg ${selectedContainer === container ? 'bg-white/20' : 'bg-blue-100'}`}>
                                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                                        <path d="M2 17L12 22L22 17M2 12L12 17L22 12" strokeWidth="2"/>
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-sm block truncate">{getApiaryName(container)}</span>
                                      <span className={`text-xs ${selectedContainer === container ? 'text-white/80' : 'text-gray-500'}`}>
                                        {totalHives} hives
                                      </span>
                                    </div>
                                  </div>
                                  {selectedContainer === container && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApiaryNameEdit(container);
                                      }}
                                      className="ml-2 p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                                      title="Rename apiary"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Hive Circles Grid */}
                <div className="flex-1">
                  <div className="text-center mb-10">
                    <h2 className="text-4xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-3">
                      <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        All Hives
                      </span>
                    </h2>
                    <p className="text-gray-600 text-base">
                      Click on any hive to view detailed analytics and insights
                    </p>
                  </div>
                  
                  {/* Responsive grid that centers items and maintains good spacing */}
                  <div className="flex flex-wrap justify-center gap-x-16 gap-y-20 px-4">
                    {hiveNumbers
  .filter((hiveNumber) => {
    // Get hive activation status
    const currentHiveData = getHiveData(latestData, hiveNumber);
    const historicalHiveData = getHiveData(historicalData, hiveNumber);
    const allHiveData = [...historicalHiveData, ...currentHiveData];
    
    const RECENT_HOURS = 4;
    const recentThreshold = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
    
    let isActive = false;
    for (let i = allHiveData.length - 1; i >= 0; i--) {
      const item = allHiveData[i];
      if (!item) continue;
      
      const timestamp = item?.timestamp || item?._metadata?.lastModified;
      if (timestamp) {
        const dataTime = new Date(timestamp);
        if (dataTime < recentThreshold) continue;
      }
      
      const temp = getTemperature(item, 'internal');
      const hum = getHumidity(item, 'internal');
      const weight = getWeight(item);
      
      if ((temp !== null && !isNaN(temp) && temp !== 0) ||
          (hum !== null && !isNaN(hum) && hum !== 0) ||
          (weight !== null && !isNaN(weight) && weight !== 0)) {
        isActive = true;
        break;
      }
    }
    
    // Apply filter
    if (filterStatus === 'active') return isActive;
    if (filterStatus === 'inactive') return !isActive;
    return true; // 'all' shows everything
  })
  .map((hiveNumber) => (
    <div key={hiveNumber} className="flex justify-center">
      <HiveCircle
        hiveNumber={hiveNumber}
        data={latestData}
        historicalData={historicalData}
        isMaster={hiveNumber === 1}
        onClick={() => setSelectedHive(hiveNumber)}
        isSelected={false}
        onEditName={() => handleHiveNameEdit(hiveNumber)}
        hiveName={getHiveName(hiveNumber)}
      />
    </div>
  ))}
                  </div>
                  
                  
                </div>
              </div>
            ) : (
              /* Enhanced Detail View */
              <div>
                <button
                  onClick={() => setSelectedHive(null)}
                  className="mb-6 flex items-center gap-2 px-5 py-3 bg-white/90 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-blue-300"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="font-medium">Back to All Hives</span>
                </button>

                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 mb-8">
                  <div className="flex flex-col items-center mb-8">
                    <HiveCircle
                      hiveNumber={selectedHive}
                      data={latestData}
                      historicalData={historicalData}
                      isMaster={selectedHive === 1}
                      onClick={() => {}}
                      isSelected={true}
                      onEditName={() => handleHiveNameEdit(selectedHive)}
                      hiveName={getHiveName(selectedHive)}
                    />
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden hover:shadow-blue-500/30 transition-all duration-500">
                      <TemperatureChart 
                        data={historicalData}
                        containerId={selectedContainer}
                        title={`Temperature Trends`}
                        selectedHiveOnly={selectedHive}
                      />
                    </div>
                    <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-indigo-200/50 overflow-hidden hover:shadow-indigo-500/30 transition-all duration-500">
                      <HumidityChart 
                        data={historicalData} 
                        containerId={selectedContainer}
                        title={`Humidity Trends`}
                        selectedHiveOnly={selectedHive}
                      />
                    </div>
                    <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-purple-200/50 overflow-hidden hover:shadow-purple-500/30 transition-all duration-500">
                      <WeightChart 
                        data={historicalData}
                        containerId={selectedContainer}
                        selectedHiveOnly={selectedHive}
                        title={`Weight Monitoring`}
                        height={400}
                        showTrend={true}
                        timeRange="all"
                      />
                    </div>
                    <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-pink-200/50 overflow-hidden hover:shadow-pink-500/30 transition-all duration-500">
                      <BatteryChart 
                        data={historicalData}
                        containerId={selectedContainer}
                        selectedHiveOnly={selectedHive}
                        title={`Battery Levels`} 
                      />
                    </div>
                  </div>

                  {/* Map for All Hives - Shows entire apiary location */}
                  <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 p-6 hover:shadow-blue-500/30 transition-all duration-500">
                    <LocationMap 
                      data={latestData} 
                      title={`${getApiaryName(selectedContainer)} - All Hive Locations`}
                      containerId={selectedContainer}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      {!loading && (
        <SmartHiveAIAssistant
          latestData={latestData}
          historicalData={historicalData}
          selectedContainer={selectedContainer}
          totalHives={totalHives}
          activatedHives={activatedHives}
        />
      )}
    </div>
  );
}

'use client';




import { useEffect, useState, useCallback } from 'react';
import { Home, ShoppingCart, LayoutDashboard, LogOut, Menu, X, Save, AlertCircle, CheckCircle, Settings, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React from 'react';
interface SensorData {
  timestamp: string;
  temp_external: number;
  temp_internal: number;
  humidity: number;
  weight: number;
  temp_external_calibrated?: number;
  temp_external_raw?: number;
  temp_internal_calibrated?: number;
  temp_internal_raw?: number;
  humidity_calibrated?: number;
  humidity_raw?: number;
  weight_calibrated?: number;
  weight_raw?: number;
  _metadata?: {
    lastModified: string;
  };
}



interface CalibrationSettings {
  temp_external: CalibrationData;
  temp_internal: CalibrationData;
  humidity: CalibrationData;
  weight: CalibrationData;
  appliedAt: string; // NEW: Timestamp when calibration was saved
}

interface PurchaseInfo {
  id: number;
  masterHives: number;
  normalHives: number;
  assignedContainers: string[];
}

interface CalibrationData {
  visualized: string;
  real: string;
  offset: number;
}

export default function CorrectionPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseInfo | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [selectedHive, setSelectedHive] = useState<string>('');
  const [hiveNames, setHiveNames] = useState<Record<number, string>>({});
  const [apiaryNames, setApiaryNames] = useState<Record<string, string>>({});
  const [historicalData, setHistoricalData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [calibrations, setCalibrations] = useState<{
    temp_external: CalibrationData;
    temp_internal: CalibrationData;
    humidity: CalibrationData;
    weight: CalibrationData;
  }>({
    temp_external: { visualized: '', real: '', offset: 0 },
    temp_internal: { visualized: '', real: '', offset: 0 },
    humidity: { visualized: '', real: '', offset: 0 },
    weight: { visualized: '', real: '', offset: 0 }
  });
const [savedCalibrations, setSavedCalibrations] = useState<CalibrationSettings | null>(null);
  const getHiveName = (hiveNumber: number): string => {
    return hiveNames[hiveNumber] || `Hive ${hiveNumber}`;
  };

  const getApiaryName = (containerId: string): string => {
    return apiaryNames[containerId] || containerId;
  };

  // Load saved names from localStorage
  useEffect(() => {
    const loadNames = async () => {
      if (!selectedContainer) return;
      
      try {
        if (typeof window !== 'undefined') {
          // Load hive names
          const savedHiveNames = localStorage.getItem(`hive-names:${selectedContainer}`);
          if (savedHiveNames) {
            setHiveNames(JSON.parse(savedHiveNames));
          }
          
          // Load apiary names
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



  // Load saved calibrations from localStorage
useEffect(() => {
  const loadCalibrations = async () => {
    if (!selectedHive || !selectedContainer) return;
    
    try {
      if (typeof window !== 'undefined') {
        const calibrationKey = `calibration:${selectedContainer}:${selectedHive}`;
        const stored = localStorage.getItem(calibrationKey);
        
        if (stored) {
          const loaded = JSON.parse(stored);
          console.log('✅ Loaded calibrations:', loaded);
          setSavedCalibrations(loaded);
        } else {
          console.log('ℹ️ No saved calibrations found');
          setSavedCalibrations(null);
        }
      }
    } catch (error) {
      console.log('❌ Error loading calibrations:', error);
      setSavedCalibrations(null);
    }
  };
  
  loadCalibrations();
}, [selectedHive, selectedContainer]);


  // Helper to flatten data structure
  const flattenData = useCallback((data: any): SensorData[] => {
    if (!data) return [];
    
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0]?.data) {
        return data.flatMap(item => item.data || []);
      }
      return data;
    }
    
    if (data.data) {
      return Array.isArray(data.data) ? data.data : [data.data];
    }
    
    return [data];
  }, []);

  // Fetch historical data (same as temperature chart - 48 hours)
  const fetchHistoricalData = useCallback(async () => {
    if (!hasAccess || !selectedContainer) return;
    
    console.log('🔄 Fetching historical data for:', selectedContainer);
    
    try {
      // Fetch 48 hours of data to match the temperature chart
      const url = `/api/admin/smart-hive/data/historical?containerId=${encodeURIComponent(selectedContainer)}&limit=48`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.log('❌ Response not OK:', response.status);
        setHistoricalData([]);
        return;
      }
      
      const result = await response.json();
      console.log('📦 Raw API result:', result);
      
      const flatData = flattenData(result.data || result);
      console.log('📊 Flattened data:', flatData.length, 'items');
      console.log('   First 2 items:', flatData.slice(0, 2));
      
      setHistoricalData(flatData);
    } catch (error: any) {
      console.error('Failed to fetch historical data:', error);
      setHistoricalData([]);
    }
  }, [hasAccess, selectedContainer, flattenData]);

  // Check access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await fetch('/api/admin/smart-hive/check-access', {
          credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success && result.hasAccess) {
          setHasAccess(true);
          setPurchaseInfo(result.purchase);
          
          if (result.purchase.assignedContainers && result.purchase.assignedContainers.length > 0) {
            setSelectedContainer(result.purchase.assignedContainers[0]);
          }
        }
      } catch (error) {
        console.error('Failed to check access:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, []);

  // Fetch data when container changes
  useEffect(() => {
    if (!hasAccess || !selectedContainer) {
      setLoading(false);
      return;
    }

    setHistoricalData([]);
    setLoading(true);

    const fetchData = async () => {
      await fetchHistoricalData();
      setLoading(false);
    };
    
    fetchData();

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHistoricalData();
      }
    }, 300000);

    return () => {
      clearInterval(interval);
    };
  }, [hasAccess, selectedContainer, fetchHistoricalData]);

  // Helper to safely convert to number
  const toNumber = (value: any): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Helper to get temperature value from various field names (same as TemperatureChart)
  const getTemperature = (item: any, type: 'internal' | 'external'): number | null => {
    let value: any;
    
    if (type === 'internal') {
      value = item.temp_internal || item.Internal_temp || item.temperature_internal || item.tempInternal || item.inte_temp;
    } else {
      value = item.temp_external || item.external_temp || item.temperature_external || item.tempExternal || item.exte_temp;
    }
    
    const temp = toNumber(value);
    
    // Filter out invalid temperature readings
    if (temp == null) return null;
    if (temp === -127) return null;
    
    // Very permissive range - show almost everything except obvious sensor errors
    if (temp < -100 || temp > 100) return null;
    
    // Set negative temperatures to 0
    if (temp < 0) return 0;
    
    return temp;
  };

  // Helper function to get hive data from historical data
  const getHiveData = (allData: SensorData[], hiveIndex: number): SensorData[] => {
    if (!allData || allData.length === 0) return [];
    
    const timestampGroups = new Map<string, Array<{ item: SensorData; originalIndex: number }>>();
    
    allData.forEach((item, originalIndex) => {
      const timestamp = item.timestamp || item._metadata?.lastModified || new Date().toISOString();
      const timeKey = new Date(timestamp).toISOString();
      
      if (!timestampGroups.has(timeKey)) {
        timestampGroups.set(timeKey, []);
      }
      
      timestampGroups.get(timeKey)!.push({ item, originalIndex });
    });

    const hiveData: SensorData[] = [];
    
    timestampGroups.forEach((items) => {
      items.sort((a, b) => a.originalIndex - b.originalIndex);
      
      if (items[hiveIndex]) {
        hiveData.push(items[hiveIndex].item);
      }
    });

    return hiveData;
  };

  // Get calibrated data
  const getCalibratedData = (): SensorData[] => {
  console.log('🔧 getCalibratedData called');
  
  if (!selectedHive || !historicalData.length) {
    console.log('   ❌ No hive selected or no data');
    return [];
  }

  const hiveIndex = parseInt(selectedHive) - 1;
  const hiveData = getHiveData(historicalData, hiveIndex);

  // IMPORTANT: For the calibration preview chart, show BOTH raw and calibrated
  // But calibration is ONLY applied to data points AFTER appliedAt timestamp
  
  if (!savedCalibrations || !savedCalibrations.appliedAt) {
    // No calibration - show raw data only
    const result = hiveData.map(item => {
      const tempInternal = getTemperature(item, 'internal');
      const tempExternal = getTemperature(item, 'external');
      
      return {
        ...item,
        temp_internal: tempInternal !== null ? tempInternal : 0,
        temp_internal_raw: tempInternal !== null ? tempInternal : 0,
        temp_internal_calibrated: tempInternal !== null ? tempInternal : 0,
        temp_external: tempExternal !== null ? tempExternal : 0,
        temp_external_raw: tempExternal !== null ? tempExternal : 0,
        temp_external_calibrated: tempExternal !== null ? tempExternal : 0
      };
    });
    
    return result;
  }

  // With calibration - apply ONLY to measurements after appliedAt
  const calibrationTime = new Date(savedCalibrations.appliedAt).getTime();
  
  const result = hiveData.map(item => {
    const tempInternal = getTemperature(item, 'internal');
    const tempExternal = getTemperature(item, 'external');
    
    // Safely get measurement timestamp
    const timestampValue = item.timestamp || item._metadata?.lastModified;
    const measurementTime = timestampValue ? new Date(timestampValue).getTime() : Date.now();
    
    // Check if this measurement is AFTER calibration was applied
    const shouldApplyCalibration = measurementTime > calibrationTime;
    
    return {
      ...item,
      temp_internal: tempInternal !== null ? tempInternal : 0,
      temp_internal_raw: tempInternal !== null ? tempInternal : 0,
      temp_internal_calibrated: shouldApplyCalibration && tempInternal !== null 
        ? (tempInternal + savedCalibrations.temp_internal.offset) 
        : (tempInternal !== null ? tempInternal : 0),
      temp_external: tempExternal !== null ? tempExternal : 0,
      temp_external_raw: tempExternal !== null ? tempExternal : 0,
      temp_external_calibrated: shouldApplyCalibration && tempExternal !== null
        ? (tempExternal + savedCalibrations.temp_external.offset)
        : (tempExternal !== null ? tempExternal : 0),
      humidity_calibrated: shouldApplyCalibration 
        ? item.humidity + savedCalibrations.humidity.offset
        : item.humidity,
      weight_calibrated: shouldApplyCalibration
        ? item.weight + savedCalibrations.weight.offset
        : item.weight
    };
  });
  
  return result;
};


  const handleCalibrationChange = (parameter: keyof typeof calibrations, field: 'visualized' | 'real', value: string) => {
    setCalibrations(prev => {
      const updated = {
        ...prev,
        [parameter]: {
          ...prev[parameter],
          [field]: value
        }
      };
      
      const vis = parseFloat(updated[parameter].visualized);
      const rl = parseFloat(updated[parameter].real);
      if (!isNaN(vis) && !isNaN(rl)) {
        updated[parameter].offset = rl - vis;
      } else {
        updated[parameter].offset = 0;
      }
      
      return updated;
    });
  };

  const handleSave = () => {
  setSaveStatus('saving');
  
  try {
    if (typeof window !== 'undefined') {
      // Add timestamp when saving calibration
      const calibrationWithTimestamp = {
        ...calibrations,
        appliedAt: new Date().toISOString() // NEW: Store current time
      };
      
      const calibrationKey = `calibration:${selectedContainer}:${selectedHive}`;
      localStorage.setItem(calibrationKey, JSON.stringify(calibrationWithTimestamp));
      
      setSavedCalibrations(calibrationWithTimestamp);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      console.log('✅ Calibration saved with timestamp:', calibrationWithTimestamp);
    }
  } catch (error) {
    console.error('Failed to save calibration:', error);
    setSaveStatus('error');
    setTimeout(() => setSaveStatus('idle'), 3000);
  }
};


  const totalMasterHives = purchaseInfo?.masterHives || 0;
  const masterHiveNumbers = Array.from({ length: totalMasterHives }, (_, i) => i + 1);

  // Check if selected container has any hives
  const containerHasHives = historicalData.length > 0;

  const calibratedData = getCalibratedData();
  console.log('📈 Chart preparation:');
  console.log('   calibratedData.length:', calibratedData.length);
  console.log('   First calibrated item:', calibratedData[0]);
  
  const chartData = calibratedData.map(item => {
    const rawValue = typeof item.temp_internal_raw === 'number' 
      ? parseFloat(item.temp_internal_raw.toFixed(2)) 
      : typeof item.temp_internal === 'number' 
      ? parseFloat(item.temp_internal.toFixed(2))
      : 0;
      
    const calibratedValue = typeof item.temp_internal_calibrated === 'number'
      ? parseFloat(item.temp_internal_calibrated.toFixed(2))
      : typeof item.temp_internal === 'number'
      ? parseFloat(item.temp_internal.toFixed(2))
      : 0;
    
    console.log('   Chart point:', {
      timestamp: item.timestamp,
      rawValue,
      calibratedValue
    });
    
    return {
      time: new Date(item.timestamp).toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      'Raw Data': rawValue,
      'Calibrated Data': calibratedValue
    };
  });
  
  console.log('   chartData.length:', chartData.length);
  console.log('   Sample chartData:', chartData.slice(0, 2));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-purple-100 via-pink-100 to-amber-100"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-300/40 via-purple-300/30 via-pink-300/40 to-cyan-200/30 animate-pulse"></div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          </div>
          <p className="text-xl text-purple-900 font-semibold mb-2">Loading Calibration Data</p>
          <p className="text-purple-700/80 text-sm">Please wait...</p>
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
                <p className="text-sm text-slate-400 mt-1">Calibration System</p>
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
            <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group">
              <Home className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="font-medium">Home</span>
            </button>

            <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group">
              <LayoutDashboard className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Dashboard</span>
            </button>

            <button className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg shadow-lg shadow-emerald-500/20">
              <Settings className="w-5 h-5" />
              <span className="font-medium">Calibration</span>
            </button>

            <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-200 group">
              <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Purchase Smart Hive</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-700/50 space-y-2">
            {purchaseInfo && (
              <div className="px-4 py-3 bg-slate-800/50 rounded-lg mb-2">
                <p className="text-xs text-slate-400 mb-1">Master Hives</p>
                <p className="text-lg font-bold text-emerald-400">
                  {purchaseInfo.masterHives}
                </p>
              </div>
            )}
            <button className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 group">
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
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    Sensor Calibration
                  </h1>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Adjust sensor readings for accuracy
                  </p>
                </div>
              </div>
            </div>

            <button className="group relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-lg font-medium text-sm shadow-lg transform transition-all duration-500 hover:scale-105 active:scale-95 flex items-center">
              <LogOut className="w-4 h-4 mr-2" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1600px] mx-auto">
            {/* Selection Controls */}
            <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl border border-gray-200/50 p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Select Apiary
                  </label>
                  <select
                    value={selectedContainer}
                    onChange={(e) => {
                      setSelectedContainer(e.target.value);
                      setSelectedHive('');
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-800 font-medium"
                  >
                    {purchaseInfo?.assignedContainers.map(container => (
                      <option key={container} value={container}>
                        {getApiaryName(container)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Select Master Hive
                  </label>
                  <select
                    value={selectedHive}
                    onChange={(e) => setSelectedHive(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-800 font-medium"
                    disabled={!selectedContainer || !containerHasHives}
                  >
                    {!containerHasHives ? (
                      <option value="">No hives available</option>
                    ) : (
                      <>
                        <option value="">Select a master hive...</option>
                        {masterHiveNumbers.map((hiveNum) => (
                          <option key={hiveNum} value={hiveNum}>
                            {getHiveName(hiveNum)}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {selectedHive && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm text-emerald-800 font-medium">
                    {getHiveName(parseInt(selectedHive))} selected - Ready for calibration
                  </p>
                </div>
              )}
            </div>

            {/* Calibration Table */}
            {selectedHive && (
              <>
                <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl border border-gray-200/50 p-8 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        Calibration Values - {getHiveName(parseInt(selectedHive))}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Enter sensor readings to calculate and apply calibration offsets
                      </p>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saveStatus === 'saving'}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm shadow-lg transform transition-all duration-300 ${
                        saveStatus === 'success'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                          : saveStatus === 'error'
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
                          : saveStatus === 'saving'
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 active:scale-95'
                      }`}
                    >
                      {saveStatus === 'success' ? (
  <>
    <CheckCircle className="w-4 h-4" />
    Saved & Applied!
  </>
) : saveStatus === 'error' ? (
  <>
    <AlertCircle className="w-4 h-4" />
    Save Failed
  </>
) : (
  <>
    <Save className="w-4 h-4" />
    Save Calibration
  </>
)}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left py-4 px-4 text-gray-800 font-bold text-lg">Parameter</th>
                          <th className="text-center py-4 px-4 text-gray-800 font-bold text-lg">Visualized Value</th>
                          <th className="text-center py-4 px-4 text-gray-800 font-bold text-lg">Real Value</th>
                          <th className="text-center py-4 px-4 text-gray-800 font-bold text-lg">Offset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Temperature External */}
                        <tr className="border-b border-gray-200 hover:bg-blue-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              
                              <span className="font-semibold text-gray-800">Temperature External</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.temp_external.visualized}
                              onChange={(e) => handleCalibrationChange('temp_external', 'visualized', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 20.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.temp_external.real}
                              onChange={(e) => handleCalibrationChange('temp_external', 'real', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 21.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className={`text-center font-bold text-lg ${
                              calibrations.temp_external.offset > 0 
                                ? 'text-green-600' 
                                : calibrations.temp_external.offset < 0 
                                ? 'text-red-600' 
                                : 'text-gray-400'
                            }`}>
                              {calibrations.temp_external.offset > 0 ? '+' : ''}
                              {calibrations.temp_external.offset.toFixed(2)}°C
                            </div>
                          </td>
                        </tr>

                        {/* Temperature Internal */}
                        <tr className="border-b border-gray-200 hover:bg-orange-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">Temperature Internal</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.temp_internal.visualized}
                              onChange={(e) => handleCalibrationChange('temp_internal', 'visualized', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 32.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.temp_internal.real}
                              onChange={(e) => handleCalibrationChange('temp_internal', 'real', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 33.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className={`text-center font-bold text-lg ${
                              calibrations.temp_internal.offset > 0 
                                ? 'text-green-600' 
                                : calibrations.temp_internal.offset < 0 
                                ? 'text-red-600' 
                                : 'text-gray-400'
                            }`}>
                              {calibrations.temp_internal.offset > 0 ? '+' : ''}
                              {calibrations.temp_internal.offset.toFixed(2)}°C
                            </div>
                          </td>
                        </tr>

                        {/* Humidity */}
                        <tr className="border-b border-gray-200 hover:bg-cyan-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">Humidity</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.humidity.visualized}
                              onChange={(e) => handleCalibrationChange('humidity', 'visualized', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 60.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.humidity.real}
                              onChange={(e) => handleCalibrationChange('humidity', 'real', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 62.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className={`text-center font-bold text-lg ${
                              calibrations.humidity.offset > 0 
                                ? 'text-green-600' 
                                : calibrations.humidity.offset < 0 
                                ? 'text-red-600' 
                                : 'text-gray-400'
                            }`}>
                              {calibrations.humidity.offset > 0 ? '+' : ''}
                              {calibrations.humidity.offset.toFixed(2)}%
                            </div>
                          </td>
                        </tr>

                        {/* Weight */}
                        <tr className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">Weight</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.weight.visualized}
                              onChange={(e) => handleCalibrationChange('weight', 'visualized', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 45.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.1"
                              value={calibrations.weight.real}
                              onChange={(e) => handleCalibrationChange('weight', 'real', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-gray-800 font-medium"
                              placeholder="e.g., 46.0"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className={`text-center font-bold text-lg ${
                              calibrations.weight.offset > 0 
                                ? 'text-green-600' 
                                : calibrations.weight.offset < 0 
                                ? 'text-red-600' 
                                : 'text-gray-400'
                            }`}>
                              {calibrations.weight.offset > 0 ? '+' : ''}
                              {calibrations.weight.offset.toFixed(2)} kg
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">How to calibrate:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Enter the value currently shown by the sensor (Visualized Value)</li>
                        <li>Enter the actual/correct value from a reference device (Real Value)</li>
                        <li>The offset will be calculated automatically (Real - Visualized = Offset)</li>
                        <li>Click "Save Calibration" to apply the correction to all future readings</li>
                        <li>View the effect in the chart below - calibrated values will be adjusted by the offset</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Temperature Chart - Before and After */}
                <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl border border-gray-200/50 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                        {getHiveName(parseInt(selectedHive))} - Temperature Internal Calibration Preview
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {savedCalibrations && savedCalibrations.temp_internal.offset !== 0 ? (
                          <span className="text-emerald-600 font-medium">
                            ✓ Calibration Active: {savedCalibrations.temp_internal.offset > 0 ? '+' : ''}{savedCalibrations.temp_internal.offset.toFixed(2)}°C offset applied to all measurements
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            No calibration applied - showing raw sensor data only
                          </span>
                        )}
                      </p>
                    </div>
                    
                    {savedCalibrations && savedCalibrations.temp_internal.offset !== 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                        <p className="text-xs text-emerald-700 font-semibold mb-1">Applied Offset</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          {savedCalibrations.temp_internal.offset > 0 ? '+' : ''}{savedCalibrations.temp_internal.offset.toFixed(2)}°C
                        </p>
                      </div>
                    )}
                  </div>

                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: 'none', 
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      {React.createElement(Legend as any, {
  wrapperStyle: { paddingTop: '20px' },
  iconType: 'line'
})}
                      <Line 
                        type="monotone" 
                        dataKey="Raw Data" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ fill: '#ef4444', r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Raw Sensor Data"
                      />
                      {savedCalibrations && savedCalibrations.temp_internal.offset !== 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="Calibrated Data" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          dot={{ fill: '#10b981', r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Calibrated Data"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Legend Explanation */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <p className="font-semibold text-red-800">Raw Sensor Data</p>
                      </div>
                      <p className="text-sm text-red-700">
                        Original uncalibrated readings from the temperature sensor
                      </p>
                    </div>
                    
                    {savedCalibrations && savedCalibrations.temp_internal.offset !== 0 && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                          <p className="font-semibold text-emerald-800">Calibrated Data</p>
                        </div>
                        <p className="text-sm text-emerald-700">
                          Corrected readings with {savedCalibrations.temp_internal.offset > 0 ? '+' : ''}{savedCalibrations.temp_internal.offset.toFixed(2)}°C offset applied
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Example Calculation */}
                  {savedCalibrations && savedCalibrations.temp_internal.offset !== 0 && calibratedData.length > 0 && (
                    <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
                      <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="text-lg">📐</span>
                        Example Calculation
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-blue-800">
                          <span className="font-semibold">Sensor shows:</span> {calibratedData[calibratedData.length - 1].temp_internal.toFixed(2)}°C (Raw)
                        </p>
                        <p className="text-blue-800">
                          <span className="font-semibold">Offset applied:</span> {savedCalibrations.temp_internal.offset > 0 ? '+' : ''}{savedCalibrations.temp_internal.offset.toFixed(2)}°C
                        </p>
                        <div className="h-px bg-blue-300 my-2"></div>
                        <p className="text-blue-900 font-bold text-base">
                          <span className="font-semibold">Actual reading:</span> {(calibratedData[calibratedData.length - 1].temp_internal + savedCalibrations.temp_internal.offset).toFixed(2)}°C (Calibrated)
                        </p>
                      </div>
                    </div>
                  )}

                  {!savedCalibrations && (
                    <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900 mb-1">No Calibration Applied Yet</p>
                        <p className="text-sm text-amber-800">
                          Enter calibration values in the table above and click "Save Calibration" to see the calibrated data on this chart.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedHive && (
              <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl border border-gray-200/50 p-12 flex items-center justify-center min-h-[400px]">
                <div className="text-center max-w-md">
                  <Settings className="w-20 h-20 text-gray-300 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">Select a Master Hive</h3>
                  <p className="text-gray-600 mb-4">
                    Choose an apiary and master hive from the dropdowns above to begin sensor calibration.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">💡 Note:</span> Only master hives can be calibrated. Master hives are equipped with all sensors and serve as reference points for the apiary.
                    </p>
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
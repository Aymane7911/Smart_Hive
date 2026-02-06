'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SensorData } from '../../lib/types';
import TemperatureChart from '../../components/Charts/TemperatureChart';
import HumidityChart from '../../components/Charts/HumidityChart';
import BatteryChart from '../../components/Charts/BatteryChart';
import WeightChart from '../../components/Charts/WeightChart';
import LocationMap from '../../components/Charts/LocationMap';
import { Home, ShoppingCart, LayoutDashboard, LogOut, Menu, X, RefreshCw, ChevronLeft, Edit2, Check, XCircle, Search, Filter, TrendingUp, TrendingDown, Moon, Sun } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';
import GasSensorChart from '../../components/Charts/GasSensorChart';
import HiveHealthIndex from '../../components/Charts/HiveHealthIndex';
import { svg } from 'leaflet';

interface PurchaseInfo {
  id: number;
  masterHives: number;
  normalHives: number;
  purchaseDate: string;
  accessGrantedAt: string;
  assignedContainers: string[];
}

interface VideoItem {
  id: number;
  title: string;
  path: string;
  thumbnail?: string;
  duration: string;
  description: string;
}

interface HiveVideos {
  [key: number]: VideoItem[];
}

interface AudioItem {
  id: number;
  title: string;
  path: string;
  duration: string;
  recordedDate: string;
  description: string;
  thumbnail?: string;
}

interface HiveBuzzSounds {
  [key: number]: AudioItem[];
}

const HIVE_BUZZ_SOUNDS: HiveBuzzSounds = {
  1: [
    { 
      id: 1, 
      title: "", 
      path: "/voice/buzz1.mp3",
      duration: "1:45",
      recordedDate: "2024-01-15",
      description: "Active morning foraging sounds",
    },
    { 
      id: 2, 
      title: "", 
      path: "/voice/buzz2.mp3",
      duration: "2:10",
      recordedDate: "2024-01-14",
      description: "Queen piping sound during inspection",
    },
    { 
      id: 3, 
      title: "", 
      path: "/voice/buzz3.mp3",
      duration: "3:30",
      recordedDate: "2024-01-13",
      description: "Pre-swarm colony behavior sounds",
    }
  ]
};

const HIVE_VIDEOS: HiveVideos = {
  1: [
    { 
      id: 1, 
      title: "Morning Activity", 
      path: "/videos/video1.mp4",
      duration: "2:30",
      description: "Morning bee activity and foraging behavior"
    },
    { 
      id: 2, 
      title: "Entrance Monitoring", 
      path: "/videos/video2.mp4",
      duration: "3:15",
      description: "Worker bees entering and exiting the hive"
    },
    { 
      id: 3, 
      title: "Queen Bee Activity", 
      path: "/videos/video3.mp4",
      duration: "4:00",
      description: "Queen bee inspection and behavior"
    },
    { 
      id: 4, 
      title: "Honey Production", 
      path: "/videos/video4.mp4",
      duration: "2:45",
      description: "Honey comb building and storage"
    },
    { 
      id: 5, 
      title: "Evening Activity", 
      path: "/videos/video5.mp4",
      duration: "3:30",
      description: "Evening bee behavior and hive settling"
    }
  ]
};

// HELPER FUNCTIONS - No color changes needed
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

// FIXED: HiveCircle component with clearer yellow colors in light mode

const HiveCircle = ({ 
  hiveNumber, 
  data,
  historicalData,
  onClick, 
  isSelected,
  onEditName,
  hiveName,
  isDarkMode
}: { 
  hiveNumber: number;
  data: SensorData[];
  historicalData: SensorData[];
  onClick: () => void;
  isSelected: boolean;
  onEditName: () => void;
  hiveName: string;
  isDarkMode: boolean;
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
  const battery = hiveNumber === 2 ? 0 : (batteryRaw !== null ? batteryRaw : 100);
  
  const tempChange = calculateChange(hiveData, 'temp_internal');
  const weightChange = calculateChange(hiveData, 'weight');
  
  const batteryColor = getBatteryColor(battery);
  
  // UPDATED: Blue colors for the main circle ring
  const circleColors = {
    ring: '#3b82f6', // Blue
    ringBg: 'rgba(59, 130, 246, 0.1)', // Light blue background
  };
  
  const getLastReadingTime = (): string | null => {
    const hasRealData = (item: any): boolean => {
      if (!item) return false;
      
      const temp = getTemperature(item, 'internal');
      const hum = getHumidity(item, 'internal');
      const weight = getWeight(item);
      
      return (temp !== null && !isNaN(temp) && temp !== 0) || 
             (hum !== null && !isNaN(hum) && hum !== 0) || 
             (weight !== null && !isNaN(weight) && weight !== 0);
    };
    
    const historicalHiveData = getHiveData(historicalData, hiveNumber);
    const allHiveData = [...historicalHiveData, ...hiveData];
    
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
      {/* UPDATED: Glow effect with blue */}
      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
        isSelected 
          ? 'bg-gradient-to-br from-blue-400/40 to-blue-500/40 blur-2xl scale-125'
          : 'bg-gradient-to-br from-blue-300/20 to-blue-400/20 blur-xl group-hover:blur-2xl group-hover:scale-110'
      }`}></div>
      
      <div className={`relative w-72 h-72 rounded-full overflow-visible transition-all duration-500 ${
        isSelected 
          ? 'shadow-2xl ring-4 ring-blue-400/50' 
          : 'shadow-xl group-hover:shadow-2xl'
      }`}>
        {/* BACKGROUND - UPDATED TO YELLOW */}
        <div className={`absolute inset-0 rounded-full ${
  isDarkMode 
    ? 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-400' 
    : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
}`}></div>
        
        {/* HOVER OVERLAY */}
        <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full ${
          'from-blue-500/10 to-blue-600/10'
        }`}></div>
        
        {/* UPDATED: Main circle ring (blue) and battery ring (green) - HIDE BLUE CIRCLE IF BATTERY IS 0 */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          {/* Blue outer ring background - only show if battery is NOT 0 */}
          {battery !== 0 && (
            <>
              <circle 
                cx="50%" 
                cy="50%" 
                r="44%" 
                fill="none" 
                stroke={circleColors.ringBg}
                strokeWidth="2.5" 
              />
              {/* Blue outer ring */}
              <circle
                cx="50%" cy="50%" r="44%" fill="none" stroke={circleColors.ring} strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 126}`}
                className="transition-all duration-1000"
              />
            </>
          )}
          {/* Green battery ring background */}
          <circle 
            cx="50%" 
            cy="50%" 
            r="44%" 
            fill="none" 
            stroke="rgba(34, 197, 94, 0.15)"
            strokeWidth="2.5" 
          />
          {/* Green battery progress ring */}
          <circle
            cx="50%" cy="50%" r="44%" fill="none" 
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 126 * (battery / 100)} ${2 * Math.PI * 126}`}
            className="transition-all duration-1000"
          />
        </svg>
        
        {/* CENTER CONTENT */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-900">
          <div className="text-center">
            <div className={`mb-3 text-[9px] transition-colors ${
  isDarkMode 
    ? 'text-gray-600 group-hover:text-gray-800' 
    : 'text-yellow-500 group-hover:text-yellow-300'
}`}>
  Click for details
</div>
            
            {/* Hive name - BLACK */}
            <div className={`text-3xl font-bold mb-2 ${
  isDarkMode ? 'text-gray-900' : 'text-yellow-400'
}`}>
  {hiveName}
</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditName();
              }}
              className="text-gray-600 hover:text-gray-900 transition-colors p-1 mb-2"
              title="Rename hive"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            
            <div className={`pt-2 border-t ${isDarkMode ? 'border-gray-300' : 'border-yellow-600/30'}`}>
  <div className={`text-[9px] mb-1 ${isDarkMode ? 'text-gray-600' : 'text-yellow-500'}`}>Last Reading</div>
  <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-900' : 'text-yellow-400'}`}>
    {historicalData.length === 0 ? 'Loading...' : formatTimeAgo(lastReadingTime)}
  </div>
</div>
          </div>
        </div>

        {/* TEMPERATURE - YELLOW THEME */}
        <div className={`absolute top-1 left-1/2 -translate-x-1/2 backdrop-blur-sm px-3 py-2 rounded-xl border shadow-lg ${
          isDarkMode 
            ? 'bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-yellow-400/40 shadow-yellow-500/20' 
            : 'bg-gradient-to-br from-yellow-50/90 to-amber-50/90 border-yellow-400/40 shadow-yellow-400/20'
        }`}>
          <div className={`text-[9px] text-center mb-0.5 font-semibold uppercase tracking-wider ${
            isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
          }`}>Temp</div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className={`text-sm font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              {tempInternal !== null ? `${tempInternal.toFixed(1)}°C` : 'N/A'}
            </span>
            {tempChange !== null && Math.abs(tempChange) > 0.1 && (
              <span className={`text-[10px] flex items-center ${tempChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {tempChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(tempChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* HUMIDITY - AMBER THEME */}
        <div className={`absolute right-1 top-1/2 -translate-y-1/2 backdrop-blur-sm px-3 py-2 rounded-xl border shadow-lg ${
          isDarkMode 
            ? 'bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-amber-400/40 shadow-amber-500/20' 
            : 'bg-gradient-to-br from-amber-50/90 to-orange-50/90 border-amber-400/40 shadow-amber-400/20'
        }`}>
          <div className={`text-[9px] text-center mb-0.5 font-semibold uppercase tracking-wider ${
            isDarkMode ? 'text-amber-300' : 'text-amber-700'
          }`}>Humidity</div>
          <div className={`text-sm font-bold text-center ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
            {humInternal !== null ? `${humInternal.toFixed(0)}%` : 'N/A'}
          </div>
        </div>

        {/* WEIGHT - YELLOW THEME */}
        <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 backdrop-blur-sm px-3 py-2 rounded-xl border shadow-lg ${
          isDarkMode 
            ? 'bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-yellow-400/40 shadow-yellow-500/20' 
            : 'bg-gradient-to-br from-yellow-50/90 to-amber-50/90 border-yellow-400/40 shadow-yellow-400/20'
        }`}>
          <div className={`text-[9px] text-center mb-0.5 font-semibold uppercase tracking-wider ${
            isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
          }`}>Weight</div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className={`text-sm font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              {weight !== null ? `${weight.toFixed(1)}kg` : 'N/A'}
            </span>
            {weightChange !== null && Math.abs(weightChange) > 0.1 && (
              <span className={`text-[10px] flex items-center ${weightChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {weightChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(weightChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* BATTERY - Keep dynamic color */}
        <div className={`absolute left-1 top-1/2 -translate-y-1/2 backdrop-blur-sm px-3 py-2 rounded-xl border shadow-lg ${
          isDarkMode ? 'bg-gradient-to-br from-slate-900/95 to-slate-800/95' : 'bg-gradient-to-br from-slate-50/90 to-gray-50/90'
        }`} style={{ borderColor: `${batteryColor}66`, boxShadow: `0 4px 12px ${batteryColor}33` }}>
          <div className="text-[9px] text-center mb-0.5 font-semibold uppercase tracking-wider" style={{ color: `${batteryColor}dd` }}>Battery</div>
          <div className="text-sm font-bold text-center flex items-center gap-1" style={{ color: batteryColor }}>
            <span>{Math.round(battery)}%</span>
            {batteryRaw === null && (
              <span className={`text-[7px] ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`} title="Simulated data">*</span>
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoLayout, setVideoLayout] = useState<'side' | 'top'>('side');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.7);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
const [isDarkMode, setIsDarkMode] = useState(false);



const HiveDataSummaryCard = ({ 
  hiveNumber,
  data,
  historicalData,
  hiveName,
  onEditName
}: {
  hiveNumber: number;
  data: SensorData[];
  historicalData: SensorData[];
  hiveName: string;
  onEditName: () => void;
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
  const battery = hiveNumber === 2 ? 0 : (batteryRaw !== null ? batteryRaw : 100);
  
  const tempChange = calculateChange(hiveData, 'temp_internal');
  const weightChange = calculateChange(hiveData, 'weight');
  
  const batteryColor = getBatteryColor(battery);
  
  const getLastReadingTime = (): string | null => {
    const hasRealData = (item: any): boolean => {
      if (!item) return false;
      const temp = getTemperature(item, 'internal');
      const hum = getHumidity(item, 'internal');
      const weight = getWeight(item);
      return (temp !== null && !isNaN(temp) && temp !== 0) || 
             (hum !== null && !isNaN(hum) && hum !== 0) || 
             (weight !== null && !isNaN(weight) && weight !== 0);
    };
    
    const historicalHiveData = getHiveData(historicalData, hiveNumber);
    const allHiveData = [...historicalHiveData, ...hiveData];
    
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
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* CHANGED: Icon background simplified to solid blue */}
          <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
              <path d="M2 17L12 22L22 17M2 12L12 17L22 12" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            {/* CHANGED: Text gradient simplified to blue */}
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              {hiveName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Real-time Monitoring Dashboard</p>
          </div>
        </div>
        <button
          onClick={onEditName}
          className="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
        >
          <Edit2 className="w-4 h-4" />
          <span className="text-sm font-medium">Rename</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Temperature - Keep Blue */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 border border-blue-200/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-500 rounded-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.69 2 6 4.69 6 8c0 1.89.87 3.58 2.24 4.7C7.45 13.36 7 14.14 7 15v4c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-4c0-.86-.45-1.64-1.24-2.3C17.13 11.58 18 9.89 18 8c0-3.31-2.69-6-6-6zm4 13h-1v-2h1v2zm-6 0v-2h1v2H10zm4-5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Temperature</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {tempInternal !== null ? `${tempInternal.toFixed(1)}°C` : 'N/A'}
            </span>
            {tempChange !== null && Math.abs(tempChange) > 0.1 && (
              <span className={`text-xs flex items-center ${tempChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tempChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(tempChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* CHANGED: Humidity - Changed from indigo to slate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 border border-slate-200/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-slate-500 rounded-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Humidity</span>
          </div>
          <div className="text-2xl font-bold text-slate-600">
            {humInternal !== null ? `${humInternal.toFixed(0)}%` : 'N/A'}
          </div>
        </div>

        {/* CHANGED: Weight - Changed from purple to blue-700 */}
        <div className="bg-gradient-to-br from-blue-100 to-blue-200/50 rounded-2xl p-4 border border-blue-300/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-700 rounded-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 2.5L18.5 12H17v6H7v-6H5.5L12 5.5z"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Weight</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700">
              {weight !== null ? `${weight.toFixed(1)}kg` : 'N/A'}
            </span>
            {weightChange !== null && Math.abs(weightChange) > 0.1 && (
              <span className={`text-xs flex items-center ${weightChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {weightChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(weightChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Battery - Keep dynamic color */}
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-4 border border-green-200/50" style={{
          backgroundImage: `linear-gradient(to bottom right, ${batteryColor}15, ${batteryColor}25)`
        }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: batteryColor }}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${batteryColor}dd` }}>Battery</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: batteryColor }}>
              {Math.round(battery)}%
            </span>
            {batteryRaw === null && (
              <span className="text-[9px] text-gray-400" title="Simulated data">*</span>
            )}
          </div>
        </div>

        {/* CHANGED: Last Reading - Changed from gray to slate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 border border-slate-200/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-slate-500 rounded-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Last Reading</span>
          </div>
          <div className="text-sm font-bold text-slate-600">
            {historicalData.length === 0 ? 'Loading...' : formatTimeAgo(lastReadingTime)}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Video configuration - Update paths to match your video files
const HIVE_VIDEOS: HiveVideos ={
  1: [ // Master Hive videos
    { 
      id: 1, 
      title: "Morning Activity", 
      path: "/videos/video1.mp4",
      duration: "2:30",
      description: "Morning bee activity and foraging behavior"
    },
    { 
      id: 2, 
      title: "Entrance Monitoring", 
      path: "/videos/video2.mp4",
      duration: "3:15",
      description: "Worker bees entering and exiting the hive"
    },
    { 
      id: 3, 
      title: "Queen Bee Activity", 
      path: "/videos/video3.mp4",
      duration: "4:00",
      description: "Queen bee inspection and behavior"
    },
    { 
      id: 4, 
      title: "Honey Production", 
      path: "/videos/video4.mp4",
      duration: "2:45",
      description: "Honey comb building and storage"
    },
    { 
      id: 5, 
      title: "Evening Activity", 
      path: "/videos/video5.mp4",
      duration: "3:30",
      description: "Evening bee behavior and hive settling"
    }
  ]
  // Add more hives if needed:
  // 2: [...videos for hive 2],
  // 3: [...videos for hive 3],
};



const HiveVideoPlayer = ({ 
  hiveNumber, 
  onClose,
  layout = 'side'
}: { 
  hiveNumber: number;
  onClose: () => void;
  layout?: 'side' | 'top';
}) => {
  const [selectedVideo, setSelectedVideo] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const videos = HIVE_VIDEOS[hiveNumber] || [];
  const currentVideo = videos[selectedVideo];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (selectedVideo < videos.length - 1) {
        setSelectedVideo(selectedVideo + 1);
      } else {
        setIsPlaying(false);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [selectedVideo, videos.length]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectVideo = (index: number) => {
    setSelectedVideo(index);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  if (videos.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-200/50 p-6">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600">No videos available for this hive</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={containerRef}
      className={`bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden ${
        layout === 'side' ? 'h-full' : 'w-full'
      }`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* CHANGED: Icon background from red/pink gradient to solid blue */}
            <div className="p-2 bg-blue-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1zm4 4l4-4v12l-4-4z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Video Gallery</h3>
              <p className="text-sm text-gray-600">Master Hive {hiveNumber} - {videos.length} Videos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close video"
          >
            <XCircle className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Main Video Player */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video mb-4">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            src={currentVideo.path}
            onClick={togglePlay}
          >
            Your browser does not support video playback.
          </video>

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={togglePlay}
            >
              <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                <svg className="w-10 h-10 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          )}

          {/* Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
            {/* CHANGED: Progress bar color to blue */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 mb-3 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
              }}
            />

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                <span className="text-sm font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    {isMuted || volume === 0 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium mr-4">{currentVideo.title}</span>
                
                <button onClick={toggleFullscreen} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Thumbnails Gallery */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Video Library ({videos.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-h-48 overflow-y-auto">
            {videos.map((video, index) => (
              <button
                key={video.id}
                onClick={() => selectVideo(index)}
                className={`group relative aspect-video rounded-lg overflow-hidden transition-all duration-300 ${
                  selectedVideo === index
                    ? 'ring-4 ring-blue-500 shadow-lg scale-105'
                    : 'ring-2 ring-gray-200 hover:ring-blue-300 hover:shadow-md'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  {video.thumbnail ? (
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{video.title}</p>
                    <p className="text-white/80 text-[10px]">{video.duration}</p>
                  </div>
                </div>

                {/* CHANGED: Playing indicator to blue */}
                {selectedVideo === index && isPlaying && (
                  <div className="absolute top-2 right-2">
                    <div className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      PLAYING
                    </div>
                  </div>
                )}

                {/* CHANGED: Selection badge to blue */}
                <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedVideo === index ? 'bg-blue-500 text-white' : 'bg-white/90 text-gray-700'
                }`}>
                  {index + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};



const BeeBuzzSoundsPlayer = ({ 
  hiveNumber
}: { 
  hiveNumber: number;
}) => {
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const sounds = HIVE_BUZZ_SOUNDS[hiveNumber as keyof typeof HIVE_BUZZ_SOUNDS] || [];
  const currentSound = sounds[selectedAudio];

  useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  // Reset audio element
  audio.pause();
  audio.currentTime = 0;
  
  // IMPORTANT: Use absolute path with origin for production
  const audioPath = currentSound.path.startsWith('http') 
    ? currentSound.path 
    : `${window.location.origin}${currentSound.path}`;
  
  console.log('🎵 Loading audio from:', audioPath);
  
  // Set the source
  audio.src = audioPath;
  
  const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
  const handleDurationChange = () => {
    if (isFinite(audio.duration)) {
      setDuration(audio.duration);
      console.log('✅ Audio duration:', audio.duration);
    }
  };
  const handlePlay = () => {
    console.log('▶️ Audio playing');
    setIsPlaying(true);
  };
  const handlePause = () => {
    console.log('⏸️ Audio paused');
    setIsPlaying(false);
  };
  const handleEnded = () => {
    console.log('⏹️ Audio ended');
    if (selectedAudio < sounds.length - 1) {
      setSelectedAudio(selectedAudio + 1);
    } else {
      setIsPlaying(false);
    }
  };
  const handleLoadedMetadata = () => {
    console.log('✅ Audio metadata loaded:', {
      duration: audio.duration,
      src: audio.src,
      readyState: audio.readyState
    });
    if (isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  };
  const handleError = (e: Event) => {
    console.error('❌ Audio error:', {
      src: audio.src,
      errorCode: audio.error?.code,
      errorMessage: audio.error?.message,
      networkState: audio.networkState,
      readyState: audio.readyState,
      error: audio.error
    });
    
    // Show user-friendly error
    alert(`Failed to load audio: ${currentSound.title || 'Unknown'}. Please check if the file exists.`);
  };
  const handleCanPlay = () => {
    console.log('✅ Audio can play:', audio.src);
  };

  audio.addEventListener('timeupdate', handleTimeUpdate);
  audio.addEventListener('durationchange', handleDurationChange);
  audio.addEventListener('play', handlePlay);
  audio.addEventListener('pause', handlePause);
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('loadedmetadata', handleLoadedMetadata);
  audio.addEventListener('error', handleError);
  audio.addEventListener('canplay', handleCanPlay);
  
  // Load the audio
  audio.load();

  return () => {
    audio.removeEventListener('timeupdate', handleTimeUpdate);
    audio.removeEventListener('durationchange', handleDurationChange);
    audio.removeEventListener('play', handlePlay);
    audio.removeEventListener('pause', handlePause);
    audio.removeEventListener('ended', handleEnded);
    audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    audio.removeEventListener('error', handleError);
    audio.removeEventListener('canplay', handleCanPlay);
  };
}, [currentSound.path, selectedAudio, sounds.length]);

  

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectAudio = (index: number) => {
    setSelectedAudio(index);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  if (sounds.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 p-6">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <p className="text-gray-600">No buzz sounds available for this hive</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 overflow-hidden h-full"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* CHANGED: Icon background from orange/amber to slate */}
            <div className="p-2 bg-slate-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Bee Buzz Sounds</h3>
              <p className="text-sm text-gray-600">Colony Audio Recordings - {sounds.length} files</p>
            </div>
          </div>
        </div>

        {/* Main Audio Player */}
        {/* CHANGED: Background from amber/orange gradient to slate/blue gradient */}
        <div className="relative bg-gradient-to-br from-slate-100 to-blue-100 rounded-2xl overflow-hidden aspect-video mb-4">
          <audio
  key={currentSound.id}
  ref={audioRef}
  preload="metadata"
  crossOrigin="anonymous"
>
  <source src={currentSound.path} type="audio/mpeg" />
  Your browser does not support the audio element.
</audio>

          {/* Waveform Visualization */}
          {/* CHANGED: Waveform colors from orange/amber to blue/slate */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="flex items-center justify-center gap-1 h-full w-full">
              {[...Array(40)].map((_, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-t from-blue-600 to-slate-500 rounded-full transition-all duration-150"
                  style={{
                    width: '2%',
                    height: `${isPlaying ? Math.random() * 60 + 20 : 30}px`,
                    opacity: (currentTime / duration) * 40 > i ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
              onClick={togglePlay}
            >
              {/* CHANGED: Play button color from orange to blue */}
              <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                <svg className="w-10 h-10 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          )}

          {/* Audio Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
            {/* CHANGED: Progress bar from orange to blue */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 mb-3 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
              }}
            />

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                <span className="text-sm font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    {isMuted || volume === 0 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium mr-4">{currentSound.title}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recording Library */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Recording Library ({sounds.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-h-48 overflow-y-auto">
            {sounds.map((sound, index) => (
              <button
                key={sound.id}
                onClick={() => selectAudio(index)}
                className={`group relative aspect-video rounded-lg overflow-hidden transition-all duration-300 ${
                  selectedAudio === index
                    ? 'ring-4 ring-blue-500 shadow-lg scale-105'
                    : 'ring-2 ring-gray-200 hover:ring-blue-300 hover:shadow-md'
                }`}
              >
                {/* CHANGED: Background from orange/amber to slate/blue */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-blue-900 flex items-center justify-center">
                  {sound.thumbnail ? (
                    <img 
                      src={sound.thumbnail} 
                      alt={sound.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-0.5 h-full px-2">
                      {/* CHANGED: Waveform from orange to blue/slate */}
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="bg-blue-300/60 rounded-full transition-all"
                          style={{
                            width: '3px',
                            height: `${20 + Math.random() * 40}%`,
                            animation: selectedAudio === index && isPlaying 
                              ? `pulse ${0.5 + Math.random()}s ease-in-out infinite` 
                              : 'none'
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{sound.title}</p>
                    <p className="text-white/80 text-[10px]">{sound.duration}</p>
                  </div>
                </div>

                {/* CHANGED: Playing indicator from orange to blue */}
                {selectedAudio === index && isPlaying && (
                  <div className="absolute top-2 right-2">
                    <div className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      PLAYING
                    </div>
                  </div>
                )}

                {/* CHANGED: Badge from orange to blue */}
                <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedAudio === index ? 'bg-blue-500 text-white' : 'bg-white/90 text-slate-700'
                }`}>
                  {index + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};






 const fetchUserAccessAndContainers = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setAuthChecking(true);
    setContainerLoading(true);
    setContainerError(null);
    setAuthError(null);
    
    try {
      const accessResponse = await fetch('/api/smart-hive/check-access', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!isMountedRef.current) return;
      
      if (accessResponse.status === 401) {
        setAuthError('Not authenticated. Redirecting to login...');
        setHasAccess(false);
        setTimeout(() => router.push('/login'), 1000);
        return;
      }
      
      if (!accessResponse.ok) {
        setAuthError('Failed to verify access. Please try again.');
        setHasAccess(false);
        setContainerLoading(false);
        setAuthChecking(false);
        return;
      }
      
      const accessResult = await accessResponse.json();
      
      if (!isMountedRef.current) return;
      
      if (!accessResult.success) {
        setAuthError('Session expired. Please login again.');
        setHasAccess(false);
        setTimeout(() => router.push('/login'), 1500);
        return;
      }
      
      if (!accessResult.hasPurchased) {
        setAuthError('No Smart Hive purchase found. Please purchase a plan first.');
        setHasAccess(false);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }
      
      if (!accessResult.hasAccess) {
        setHasAccess(false);
        setAuthError(null);
        setContainerError('Your purchase is pending admin approval. Please wait for access to be granted.');
        setContainerLoading(false);
        setAuthChecking(false);
        return;
      }
      
      const purchaseData = accessResult.purchase;
      const assignedContainers = purchaseData.assignedContainers || [];
      
      if (assignedContainers.length === 0) {
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
      
      setAvailableContainers(assignedContainers);
      setHasAccess(true);
      setAuthError(null);
      setContainerError(null);
      
      setPurchaseInfo({
        id: purchaseData.id,
        masterHives: purchaseData.masterHives || 0,
        normalHives: purchaseData.normalHives || 0,
        purchaseDate: purchaseData.purchaseDate,
        accessGrantedAt: purchaseData.accessGrantedAt || new Date().toISOString(),
        assignedContainers: assignedContainers
      });
      
      if (!selectedContainer || !assignedContainers.includes(selectedContainer)) {
        if (assignedContainers.length > 0) {
          setSelectedContainer(assignedContainers[0]);
        }
      }
      
    } catch (error: any) {
      if (isMountedRef.current) {
        setHasAccess(false);
        setAuthError('Failed to check access. Please refresh the page.');
        setContainerError(error.message || 'Network error occurred');
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
    fetchUserAccessAndContainers();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchUserAccessAndContainers]);

  useEffect(() => {
    if (typeof window === 'undefined' || availableContainers.length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const containerParam = params.get('container');
    
    if (containerParam && availableContainers.includes(containerParam)) {
      setSelectedContainer(containerParam);
    } else if (!selectedContainer && availableContainers.length > 0) {
      setSelectedContainer(availableContainers[0]);
    }
  }, [availableContainers, selectedContainer]);

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
        if (typeof window !== 'undefined') {
          localStorage.clear();
        }
        router.push('/login');
      }
    } catch (error) {
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
  }, [selectedContainer, flattenData]);

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
  }, [selectedContainer, flattenData]);

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

  const saveHiveName = useCallback((hiveNumber: number, newName: string) => {
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

  const saveApiaryName = useCallback((containerId: string, newName: string) => {
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
      await fetchUserAccessAndContainers();
      await Promise.allSettled([
        fetchLatestData(),
        fetchHistoricalData()
      ]);
    } catch (error) {
      setError('Failed to refresh. Please try again.');
    } finally {
      setTimeout(() => {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }, 1000);
    }
  }, [isRefreshing, fetchLatestData, fetchHistoricalData, fetchUserAccessAndContainers]);

  useEffect(() => {
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
    
    const interval = setInterval(() => {
      if (isMountedRef.current && document.visibilityState === 'visible') {
        fetchLatestData();
        fetchHistoricalData();
      }
    }, 300000);

    return () => clearInterval(interval);
  }, [selectedContainer, containerLoading, fetchLatestData, fetchHistoricalData]);

  useEffect(() => {
    if (selectedHive !== null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedHive]);

  useEffect(() => {
  // Load dark mode preference from localStorage
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode) {
    setIsDarkMode(savedDarkMode === 'true');
  }
}, []);

useEffect(() => {
  // Apply dark mode class to document
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  // Save preference
  localStorage.setItem('darkMode', isDarkMode.toString());
}, [isDarkMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* CHANGED: Background gradient simplified to blue/slate */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50"></div>
<div className="absolute inset-0 bg-gradient-to-tr from-yellow-300/20 via-transparent to-amber-200/20 animate-pulse"></div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="relative mb-6">
            {/* CHANGED: Spinner border colors from indigo to blue */}
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          </div>
          <p className="text-xl text-blue-900 font-semibold mb-2">Loading Smart Hive Dashboard</p>
          <p className="text-blue-700/80 text-sm">Preparing your sensor data...</p>
        </div>
      </div>
    );
  }

  const getActualHiveCount = (): number => {
    if (latestData && latestData.length > 0) {
      const uniqueHiveIds = new Set(
        latestData
          .map(item => item.id)
          .filter(id => id !== null && id !== undefined && !isNaN(id))
      );
      
      if (uniqueHiveIds.size > 0) {
        return uniqueHiveIds.size;
      }
    }
    
    if (historicalData && historicalData.length > 0) {
      const uniqueHiveIds = new Set(
        historicalData
          .map(item => item.id)
          .filter(id => id !== null && id !== undefined && !isNaN(id))
      );
      
      if (uniqueHiveIds.size > 0) {
        return uniqueHiveIds.size;
      }
    }
    
    return 0;
  };

  const actualHiveCount = getActualHiveCount();
  const totalHives = actualHiveCount > 0 ? actualHiveCount : (purchaseInfo ? purchaseInfo.masterHives + purchaseInfo.normalHives : 0);
  const hiveNumbers = Array.from({ length: totalHives }, (_, i) => i + 1);

  const isHiveActive = (hiveNum: number): boolean => {
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
        return true;
      }
    }
    
    return false;
  };

  const activatedHives = hiveNumbers.filter(isHiveActive).length;
  const inactiveHives = hiveNumbers.filter(num => !isHiveActive(num));
  const inactiveHiveNames = inactiveHives.map(num => getHiveName(num));

  // Auth checking or loading state
  if (authChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-300/20 via-transparent to-blue-200/20 animate-pulse"></div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          </div>
          <p className="text-xl text-blue-900 font-semibold mb-2">
            {authError ? 'Redirecting...' : authChecking ? 'Verifying Access...' : 'Loading Dashboard...'}
          </p>
          <p className="text-blue-700/80 text-sm">
            {authError || (authChecking ? 'Please wait while we check your credentials' : 'Preparing your sensor data...')}
          </p>
        </div>
      </div>
    );
  }

  // Auth error state - Keep red for errors
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
              {/* CHANGED: Buttons simplified to blue/slate */}
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
                className="w-full px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pending access state - Keep yellow for warnings
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
                className="w-full px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Go to Home
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium transition-colors text-sm"
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
    <div className={`min-h-screen relative overflow-hidden ${isDarkMode ? 'bg-slate-900' : ''}`}>
      {/* CHANGED: Background simplified to blue/slate */}
      <div className={`fixed inset-0 ${
  isDarkMode 
    ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' 
    : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50'
}`}></div>
<div className={`fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${
  isDarkMode 
    ? 'from-yellow-900/20 via-transparent to-transparent' 
    : 'from-yellow-100/40 via-transparent to-transparent'
}`}></div>
      {/* Edit Hive Name Modal - No color changes needed */}
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
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR - CHANGED: Colors simplified to blue/slate */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out shadow-2xl`}>
        <div className="h-full bg-slate-900 flex flex-col">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                {/* CHANGED: Text gradient simplified to blue */}
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
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

            {/* CHANGED: Active button gradient simplified to blue */}
            <button
              onClick={() => {
                router.push('/dashboard');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20"
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
              <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
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

       <div className="relative z-10">
        {/* HEADER */}
        {/* CHANGED: Overlay gradient simplified to blue */}
        <header className={`relative backdrop-blur-xl p-5 rounded-3xl shadow-2xl border overflow-hidden mx-4 mt-4 ${
  isDarkMode 
    ? 'bg-slate-800/90 border-slate-700/50 text-white' 
    : 'bg-white/90 border-white/50 text-black'
}`}>
  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-amber-600/5"></div>
  
  <div className="relative z-10 flex justify-between items-center">
    <div className="flex items-center">
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`mr-4 p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${
          isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-100/50'
        }`}
      >
        <Menu className={`h-5 w-5 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`} />
      </button>
      <button
        onClick={() => router.push('/welcome')}
        className={`mr-4 flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm hover:shadow-md transition-all text-sm font-medium ${
          isDarkMode 
            ? 'bg-slate-700/80 border-slate-600/50 text-slate-300 hover:text-slate-100' 
            : 'bg-white/80 border-blue-200/50 text-gray-700 hover:text-blue-600'
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center">
        <div className="mr-3 bg-gradient-to-br from-yellow-500 to-amber-600 p-2.5 rounded-xl shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
            <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="white" strokeWidth="2"/>
          </svg>
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${
            isDarkMode 
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent' 
              : 'bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent'
          }`}>
            Smart Hive Dashboard
          </h1>
          {purchaseInfo && (
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
              Monitoring <span className={`font-semibold ${isDarkMode ? 'text-yellow-400' : 'text-blue-600'}`}>{purchaseInfo.masterHives + purchaseInfo.normalHives}</span> hives
            </p>
          )}
        </div>
      </div>
    </div>

    <div className="flex items-center space-x-3">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm ${
        isDarkMode 
          ? 'bg-slate-700/80 border-slate-600/50' 
          : 'bg-white/80 border-blue-200/50'
      }`}>
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className={`text-sm font-medium ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
          {isOnline ? 'Connected' : 'Offline'}
        </span>
      </div>

      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg transform transition-all duration-500 flex items-center bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-600 hover:to-amber-700 hover:scale-105 active:scale-95 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 mr-2 transition-all duration-300 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
        <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
      </button>

      <button
        onClick={handleLogout}
        className={`group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg transform transition-all duration-500 hover:scale-105 active:scale-95 flex items-center ${
          isDarkMode 
            ? 'bg-slate-700 text-white hover:bg-slate-600' 
            : 'bg-slate-600 text-white hover:bg-slate-700'
        }`}
      >
        <LogOut className="w-4 h-4 mr-2" />
        <span>Logout</span>
      </button>

      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className={`p-2.5 rounded-xl font-medium text-sm shadow-lg transform transition-all duration-300 hover:scale-105 ${
          isDarkMode 
            ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400' 
            : 'bg-slate-700 text-white hover:bg-slate-600'
        }`}
        title="Toggle dark mode"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </div>
  </div>
  
  <p className={`text-xs mt-3 relative z-10 opacity-75 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
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
            {/* STATS CARDS SECTION */}
            {purchaseInfo && (
              <div className={`backdrop-blur-xl rounded-2xl shadow-xl border p-5 mb-6 ${
  isDarkMode 
    ? 'bg-slate-800/90 border-slate-700/50' 
    : 'bg-white/90 border-white/50'
}`}>
  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
      {/* Total Hives - Yellow Theme */}
      <div className={`rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow ${
        isDarkMode 
          ? 'bg-yellow-900/20 border-yellow-700/50' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${
          isDarkMode ? 'text-yellow-400' : 'text-yellow-800'
        }`}>Total Hives</p>
        <p className={`text-3xl font-bold ${
          isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
        }`}>{totalHives}</p>
      </div>
      
      {/* Hives Active - Amber Theme */}
      <div className={`rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow ${
        isDarkMode 
          ? 'bg-amber-900/20 border-amber-700/50' 
          : 'bg-amber-50 border-amber-200'
      }`}>
        <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${
          isDarkMode ? 'text-amber-400' : 'text-amber-800'
        }`}>Hives Active</p>
        <p className={`text-3xl font-bold ${
          isDarkMode ? 'text-amber-400' : 'text-amber-700'
        }`}>{activatedHives}</p>
        <p className={`text-[10px] mt-1 ${
          isDarkMode ? 'text-amber-500/80' : 'text-amber-600'
        }`}>of {totalHives} hives</p>
      </div>
      
      {/* Select View - Yellow Theme */}
      <div className={`rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow ${
        isDarkMode 
          ? 'bg-yellow-900/20 border-yellow-700/50' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${
          isDarkMode ? 'text-yellow-400' : 'text-yellow-800'
        }`}>Select View</p>
        <select
          value={selectedHive || ''}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedHive(value ? parseInt(value) : null);
          }}
          className={`w-full px-3 py-2 border rounded-lg font-medium focus:outline-none focus:ring-2 focus:border-transparent cursor-pointer text-sm ${
            isDarkMode 
              ? 'bg-slate-800 border-yellow-600 text-yellow-400 focus:ring-yellow-500' 
              : 'bg-white border-yellow-300 text-yellow-900 focus:ring-yellow-500'
          }`}
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


                  {/* Inactive Hives Warning - Keep yellow */}
                  {inactiveHives.length > 0 && (
  <div className={`mt-4 p-4 border-l-4 rounded-xl shadow-lg ${
    isDarkMode 
      ? 'bg-yellow-900/20 border-yellow-600 backdrop-blur-xl' 
      : 'bg-yellow-50/90 border-yellow-500 backdrop-blur-xl'
  }`}>
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0">
        <svg className={`w-6 h-6 ${isDarkMode ? 'text-yellow-500' : 'text-yellow-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
          ⚠️ {inactiveHives.length} {inactiveHives.length === 1 ? 'Hive' : 'Hives'} Inactive
        </h3>
        <p className={`text-sm mb-2 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
          The following {inactiveHives.length === 1 ? 'hive has' : 'hives have'} not sent data in the last 4 hours:
        </p>
        <div className="flex flex-wrap gap-2">
          {inactiveHiveNames.map((name, idx) => (
            <span 
              key={idx}
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                isDarkMode 
                  ? 'bg-yellow-700/50 text-yellow-300' 
                  : 'bg-yellow-200 text-yellow-800'
              }`}
            >
              {name}
            </span>
          ))}
        </div>
        <p className={`text-xs mt-2 ${isDarkMode ? 'text-yellow-400/80' : 'text-yellow-600'}`}>
          Please check sensor connections and battery levels.
        </p>
      </div>
      <button
        onClick={() => {}}
        className={`flex-shrink-0 transition-colors ${
          isDarkMode 
            ? 'text-yellow-400 hover:text-yellow-300' 
            : 'text-yellow-600 hover:text-yellow-800'
        }`}
        title="Dismiss"
      >
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  </div>
)}

                  {/* CHANGED: Filter button to slate */}
                  <div className="flex items-center gap-3">
  <div className={`flex items-center gap-2 rounded-lg border p-1 ${
    isDarkMode 
      ? 'bg-slate-800 border-slate-700' 
      : 'bg-white border-gray-200'
  }`}>
    <button
      onClick={() => setFilterStatus('inactive')}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        filterStatus === 'inactive'
          ? isDarkMode
            ? 'bg-yellow-600 text-white'
            : 'bg-yellow-600 text-white'
          : isDarkMode
            ? 'text-slate-300 hover:bg-slate-700'
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

            {/* Empty state - No color changes needed */}
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
              <div className="flex gap-6">
                {/* APIARY SELECTOR SIDEBAR */}
                {purchaseInfo && purchaseInfo.assignedContainers && purchaseInfo.assignedContainers.length > 1 && (
                  <div className="w-80 flex-shrink-0">
                    <div className={`backdrop-blur-xl rounded-2xl shadow-xl border p-5 sticky top-4 ${
  isDarkMode 
    ? 'bg-slate-800/90 border-slate-700/50' 
    : 'bg-white/90 border-white/50'
}`}>
  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
  isDarkMode ? 'text-slate-200' : 'text-gray-800'
}`}>
  <Filter className={`w-5 h-5 ${isDarkMode ? 'text-yellow-400' : 'text-blue-600'}`} />
  Select Apiary
</h3>
  
  <div className="mb-4">
    <div className="relative">
      <input
        type="text"
        placeholder="Search apiary..."
        value={apiarySearchQuery}
        onChange={(e) => setApiarySearchQuery(e.target.value)}
        className={`w-full px-4 py-3 pl-11 border rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-sm shadow-sm ${
          isDarkMode 
            ? 'bg-slate-700 border-slate-600 text-slate-200 focus:ring-yellow-500' 
            : 'bg-white border-gray-300 text-gray-800 focus:ring-blue-500'
        }`}
      />
      <Search className={`absolute left-4 top-3.5 w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />
    </div>
  </div>

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
      ? isDarkMode
        ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-500/30'
        : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-lg shadow-yellow-400/40'
      : isDarkMode
        ? 'text-slate-300 hover:bg-slate-700 border border-slate-600'
        : 'text-gray-900 hover:bg-gray-100 border border-gray-200'
  }`}
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className={`p-2 rounded-lg ${
        selectedContainer === container 
          ? 'bg-white/20' 
          : isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'
      }`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17M2 12L12 17L22 12" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm block truncate">{getApiaryName(container)}</span>
                  <span className={`text-xs ${
                    selectedContainer === container 
                      ? 'text-white/80' 
                      : isDarkMode ? 'text-slate-400' : 'text-gray-500'
                  }`}>
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

                {/* ALL HIVES GRID */}
                <div className="flex-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="all-hives"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="text-center mb-10">
  <h2 className={`text-4xl font-bold mb-3 flex items-center justify-center gap-3 ${
  isDarkMode ? 'text-slate-200' : 'text-gray-900'
}`}>
  <span className={isDarkMode ? 'bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent' : 'text-gray-900'}>
    All Hives
  </span>
</h2>
  <p className={`text-base ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
    Click on any hive to view detailed analytics and insights
  </p>
</div>
                      
                      <div className="flex flex-wrap justify-center gap-x-16 gap-y-20 px-4">
                        {hiveNumbers
                          .filter((hiveNumber) => {
                            if (filterStatus === 'active') return isHiveActive(hiveNumber);
                            if (filterStatus === 'inactive') return !isHiveActive(hiveNumber);
                            return true;
                          })
                          .map((hiveNumber, index) => (
                            <motion.div
                              key={hiveNumber}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ 
                                duration: 0.4, 
                                delay: index * 0.1,
                                ease: "easeOut"
                              }}
                              className="flex justify-center"
                            >
                              <HiveCircle
  hiveNumber={hiveNumber}
  data={latestData}
  historicalData={historicalData}
  onClick={() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedHive(hiveNumber);
      if (HIVE_VIDEOS[hiveNumber] && HIVE_VIDEOS[hiveNumber].length > 0) {
        setShowVideo(true);
      }
      setIsTransitioning(false);
    }, 300);
  }}
  isSelected={false}
  onEditName={() => handleHiveNameEdit(hiveNumber)}
  hiveName={getHiveName(hiveNumber)}
  isDarkMode={isDarkMode}
/>
                            </motion.div>
                          ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            ) : (
  <div>
                {/* BACK BUTTON */}
                <button
  onClick={() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedHive(null);
      setShowVideo(false);
      setSelectedVideoIndex(0);
      setIsTransitioning(false);
    }, 300);
  }}
  className={`mb-6 flex items-center gap-2 px-5 py-3 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border ${
    isDarkMode 
      ? 'bg-slate-800/90 text-slate-200 hover:text-slate-100 border-slate-700 hover:border-yellow-500/50' 
      : 'bg-white/90 text-gray-700 hover:text-gray-900 border-gray-200 hover:border-blue-300'
  }`}
>
  <ChevronLeft className="w-5 h-5" />
  <span className="font-medium">Back to All Hives</span>
</button>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`hive-${selectedHive}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    {/* Hive Data Summary Card */}
                    {selectedHive && (
                      <HiveDataSummaryCard
                        hiveNumber={selectedHive}
                        data={latestData}
                        historicalData={historicalData}
                        hiveName={getHiveName(selectedHive)}
                        onEditName={() => handleHiveNameEdit(selectedHive)}
                      />
                    )}

                    {/* TEMPERATURE & HUMIDITY CHARTS GRID */}
                    {/* CHANGED: All borders and shadows simplified to blue */}
                    <motion.div 
                      className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <motion.div 
                        className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                      >
                        <TemperatureChart 
                          data={historicalData}
                          containerId={selectedContainer}
                          title={`Temperature Trends`}
                          selectedHiveOnly={selectedHive}
                        />
                      </motion.div>
                  
                      <motion.div 
                        className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.4 }}
                      >
                        <HumidityChart 
                          data={historicalData} 
                          containerId={selectedContainer}
                          title={`Humidity Trends`}
                          selectedHiveOnly={selectedHive}
                        />
                      </motion.div>
                  
                      <motion.div 
                        className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                      >
                        <WeightChart 
                          data={historicalData}
                          containerId={selectedContainer}
                          selectedHiveOnly={selectedHive}
                          title={`Weight Monitoring`}
                          height={400}
                          showTrend={true}
                          timeRange="all"
                        />
                      </motion.div>
                  
                      <motion.div 
                        className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                      >
                        <BatteryChart 
                          data={historicalData}
                          containerId={selectedContainer}
                          selectedHiveOnly={selectedHive}
                          title={`Battery Levels`} 
                        />
                      </motion.div>
                    </motion.div>

                    {/* GAS MONITORING - ONLY FOR MASTER HIVE (Hive 1) */}
                    {selectedHive === 1 && (
                      <motion.div 
                        className="mb-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.7 }}
                      >
                        <motion.div 
                          className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.7 }}
                        >
                          <GasSensorChart 
                            data={latestData}
                            containerId={selectedContainer}
                            selectedHiveOnly={selectedHive}
                            title="Gas Monitoring"
                            height={500}
                            gasType="all"
                          />
                        </motion.div>
                      </motion.div>
                    )}

                    {/* HEALTH INDEX AND LOCATION MAP GRID */}
                    {/* CHANGED: All borders simplified to blue */}
                    <motion.div 
                      className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <motion.div 
                        className="rounded-3xl shadow-2xl overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.85 }}
                      >
                        <HiveHealthIndex 
                          data={latestData}
                          historicalData={historicalData}
                          containerId={selectedContainer}
                          selectedHiveOnly={selectedHive}
                          title="Hive Health Index"
                          height={600}
                        />
                      </motion.div>

                      <motion.div 
                        className="rounded-3xl shadow-2xl overflow-hidden hover:shadow-blue-500/20 transition-all duration-500 h-full"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.85 }}
                      >
                        <div className="h-full">
                          <LocationMap 
                            data={latestData} 
                            title={`${getApiaryName(selectedContainer)} - All Hive Locations`}
                            containerId={selectedContainer}
                            height={600}
                          />
                        </div>
                      </motion.div>
                    </motion.div>

                    {/* VIDEO AND AUDIO PLAYERS SECTION */}
                    {/* CHANGED: Hover shadows simplified to blue */}
                    <motion.div 
                      className={`grid gap-6 mb-8 ${
                        selectedHive === 1 && HIVE_BUZZ_SOUNDS[1] && HIVE_BUZZ_SOUNDS[1].length > 0
                          ? 'grid-cols-1 lg:grid-cols-2'
                          : 'grid-cols-1'
                      }`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.9 }}
                    >
                      {/* Video Gallery */}
                      {selectedHive && (() => {
                        const hiveVideos = HIVE_VIDEOS[selectedHive as keyof typeof HIVE_VIDEOS];
                        return hiveVideos && hiveVideos.length > 0;
                      })() && (
                        <motion.div 
                          className="rounded-3xl shadow-2xl overflow-hidden hover:shadow-blue-500/20 transition-all duration-500"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.95 }}
                        >
                          <HiveVideoPlayer 
                            hiveNumber={selectedHive}
                            onClose={() => {}}
                            layout="top"
                          />
                        </motion.div>
                      )}

                      {/* Bee Buzz Sounds - ONLY FOR MASTER HIVE */}
                      {selectedHive === 1 && HIVE_BUZZ_SOUNDS[1] && HIVE_BUZZ_SOUNDS[1].length > 0 && (
                        <motion.div 
                          className="rounded-3xl shadow-2xl overflow-hidden hover:shadow-slate-500/20 transition-all duration-500"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.95 }}
                        >
                          <BeeBuzzSoundsPlayer 
                            hiveNumber={selectedHive}
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI ASSISTANT - No color changes needed */}
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
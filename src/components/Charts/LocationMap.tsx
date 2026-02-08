'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

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

interface SensorData {
  id: number;
  lat?: number | string;
  lon?: number | string;
  battery?: number | string;
  weight?: number | string;
  temp_internal?: number | string;
  temp_external?: number | string;
  temp_inte?: number | string;
  temp_exte?: number | string;
  hum_internal?: number | string;
  hum_external?: number | string;
  hum_inte?: number | string;
  hum_exte?: number | string;
  timestamp?: string;
  [key: string]: any;
}

interface ApiaryLocation {
  containerId: string;
  lat: number;
  lon: number;
  address?: string;
}

interface LocationMapProps {
  data: SensorData[];
  title?: string;
  height?: number;
  selectedSensors?: number[];
  onSensorSelect?: (sensorIds: number[]) => void;
  containerId?: string;
  isDarkMode?: boolean;
}

// Helper to safely convert to number
const toNumber = (value: any): number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim());
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Helper to get battery level
const getBattery = (item: any): number => {
  const battery = toNumber(item.battery || item.Battery || item.bat);
  return battery !== null ? battery : 0;
};

// Helper to get weight
const getWeight = (item: any): number | null => {
  return toNumber(item.weight || item.Weight);
};

// Helper to get temperature
const getTemperature = (item: any, type: 'internal' | 'external'): number | null => {
  let value: any;
  
  if (type === 'internal') {
    value = item.temp_internal || item.temp_inte || item.Internal_temp || item.tempInternal;
  } else {
    value = item.temp_external || item.temp_exte || item.external_temp || item.tempExternal;
  }
  
  return toNumber(value);
};

// Helper to get humidity
const getHumidity = (item: any, type: 'internal' | 'external'): number | null => {
  let value: any;
  
  if (type === 'internal') {
    value = item.hum_internal || item.hum_inte || item.Internal_hum || item.humInternal;
  } else {
    value = item.hum_external || item.hum_exte || item.external_hum || item.humExternal;
  }
  
  return toNumber(value);
};

// Helper function to get marker color based on battery level
function getMarkerColor(battery: number): string {
  if (battery >= 50) return '#10b981'; // Green
  if (battery >= 25) return '#f59e0b'; // Amber
  if (battery >= 10) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

// Helper to get status
function getSensorStatus(battery: number): 'online' | 'low' | 'critical' {
  if (battery >= 25) return 'online';
  if (battery >= 10) return 'low';
  return 'critical';
}

function LocationMapComponent({ 
  data, 
  title = "Sensor Locations",
  height = 500,
  selectedSensors = [],
  onSensorSelect,
  containerId,
  isDarkMode = false
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiaryLocation, setApiaryLocation] = useState<ApiaryLocation | null>(null);

  console.log('🗺️ LocationMap: Raw data received:', data?.length || 0);
  console.log('🗺️ LocationMap: Container ID:', containerId);

  // Load apiary location from storage
  useEffect(() => {
    const loadApiaryLocation = async () => {
      if (!containerId) {
        console.log('⚠️ No containerId provided to LocationMap');
        return;
      }
      
      console.log('🔍 Loading apiary location for container:', containerId);
      
      try {
        const response = await fetch('/api/smart-hive/apiary-locations');
        const result = await response.json();
        
        console.log('📡 API response:', result);
        
        if (result.success && result.data) {
          console.log('📍 All locations from API:', result.data);
          
          const location = result.data[containerId];
          if (location) {
            console.log('✅ Found location for container:', location);
            setApiaryLocation(location);
          } else {
            console.log('⚠️ No location found for container:', containerId);
            console.log('Available containers:', Object.keys(result.data));
          }
        } else {
          console.log('⚠️ No apiary location data found in API');
        }
      } catch (error) {
        console.error('❌ Error loading apiary location:', error);
      }
    };
    
    loadApiaryLocation();
  }, [containerId]);

  // Process and validate location data
  const validLocationData = React.useMemo(() => {
    if (!data || data.length === 0) {
      console.log('❌ No data provided to LocationMap');
      return [];
    }

    console.log('🔍 Processing location data...');
    console.log('📊 Total rows in CSV:', data.length);

    // If we have an apiary location set, use it for all hives
    if (apiaryLocation) {
      console.log('📍 Using stored apiary location:', apiaryLocation);
      
      const validData = data
        .map((item, index) => {
          const battery = getBattery(item);
          const weight = getWeight(item);
          const temp_internal = getTemperature(item, 'internal');
          const temp_external = getTemperature(item, 'external');
          const hum_internal = getHumidity(item, 'internal');
          const hum_external = getHumidity(item, 'external');
          
          const hiveId = index;
          
          console.log(`📍 Row ${index} (Hive ${hiveId}): Using apiary location`);
          
          return {
            id: hiveId,
            lat: apiaryLocation.lat,
            lon: apiaryLocation.lon,
            battery,
            weight,
            temp_internal,
            temp_external,
            hum_internal,
            hum_external,
            timestamp: item.timestamp,
            isMaster: index === 0
          };
        });

      console.log('✅ Valid location data:', validData.length, 'hives');

      // Apply circular offset pattern so hives don't overlap
      if (validData.length > 1) {
        const offsetDistance = 0.0002; // ~20 meters
        validData.forEach((hive, index) => {
          if (index === 0) return; // Keep master at center
          
          const angle = (2 * Math.PI * index) / validData.length;
          hive.lat += offsetDistance * Math.cos(angle);
          hive.lon += offsetDistance * Math.sin(angle);
        });
      }

      return validData;
    }

    // No apiary location set - return empty array
    console.log('⚠️ No apiary location set for this container');
    return [];
  }, [data, apiaryLocation]);

  // Load Leaflet dynamically
  useEffect(() => {
    let mounted = true;

    const loadLeaflet = async () => {
      try {
        console.log('🔄 Loading Leaflet...');
        
        const L = await import('leaflet');
        
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        
        console.log('✅ Leaflet loaded successfully');
        if (mounted) {
          setLeafletLoaded(true);
          setLoadError(null);
        }
      } catch (error) {
        console.error('❌ Error loading Leaflet:', error);
        if (mounted) {
          setLoadError('Failed to load map library');
          setIsLoading(false);
        }
      }
    };

    loadLeaflet();

    return () => {
      mounted = false;
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || validLocationData.length === 0) {
      return;
    }

    let mounted = true;

    const initMap = async () => {
      try {
        if (!mapRef.current) return;
        
        const mapElement = mapRef.current;
        const L = (await import('leaflet')).default;

        console.log('🗺️ Initializing map with', validLocationData.length, 'sensors');

        // Clear existing map
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        // Calculate center
        const lats = validLocationData.map(s => s.lat);
        const lons = validLocationData.map(s => s.lon);
        const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length;

        console.log('🎯 Map center:', { lat: centerLat, lon: centerLon });

        // Initialize map
        const map = L.map(mapElement, {
          center: [centerLat, centerLon],
          zoom: 13,
          scrollWheelZoom: true,
          dragging: true,
          zoomControl: true
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;
        if (mounted) {
          setIsLoading(false);
          setLoadError(null);
        }

        // Add markers
        markersRef.current = [];
        validLocationData.forEach((sensor) => {
          const displayId = sensor.id + 1;
          const color = getMarkerColor(sensor.battery);
          const status = getSensorStatus(sensor.battery);

          const iconHtml = `
            <div style="position: relative;">
              <div style="
                width: 32px;
                height: 32px;
                background-color: ${color};
                border: 4px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-weight: bold;
                color: white;
                font-size: 14px;
              ">${displayId}</div>
              <div style="
                position: absolute;
                top: -6px;
                right: -6px;
                width: 16px;
                height: 16px;
                background-color: ${status === 'critical' ? '#ef4444' : status === 'low' ? '#f97316' : '#10b981'};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              "></div>
            </div>
          `;

          const icon = L.divIcon({
            html: iconHtml,
            className: 'custom-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const popupContent = `
            <div style="font-family: sans-serif; min-width: 200px;">
              <div style="font-weight: bold; font-size: 16px; color: #3b82f6; margin-bottom: 8px;">
                Hive ${displayId} ${sensor.isMaster ? '(Master)' : '(Slave)'}
              </div>
              <div style="font-size: 14px;">
                <div style="display: flex; justify-between; margin-bottom: 4px;">
                  <span style="color: #666;">Battery:</span>
                  <span style="font-weight: bold; color: ${sensor.battery < 15 ? '#ef4444' : sensor.battery < 30 ? '#f97316' : '#10b981'};">${sensor.battery}%</span>
                </div>
                ${sensor.weight !== null && sensor.weight !== undefined ? `
                  <div style="display: flex; justify-between; margin-bottom: 4px;">
                    <span style="color: #666;">Weight:</span>
                    <span style="font-weight: 500;">${sensor.weight}kg</span>
                  </div>
                ` : ''}
                ${sensor.temp_internal !== null && sensor.temp_internal !== undefined ? `
                  <div style="display: flex; justify-between; margin-bottom: 4px;">
                    <span style="color: #666;">Temp (Int):</span>
                    <span style="font-weight: 500; color: #3b82f6;">${sensor.temp_internal.toFixed(1)}°C</span>
                  </div>
                ` : ''}
                ${sensor.temp_external !== null && sensor.temp_external !== undefined ? `
                  <div style="display: flex; justify-between; margin-bottom: 4px;">
                    <span style="color: #666;">Temp (Ext):</span>
                    <span style="font-weight: 500; color: #ef4444;">${sensor.temp_external.toFixed(1)}°C</span>
                  </div>
                ` : ''}
                ${sensor.hum_internal !== null && sensor.hum_internal !== undefined ? `
                  <div style="display: flex; justify-between; margin-bottom: 4px;">
                    <span style="color: #666;">Humidity (Int):</span>
                    <span style="font-weight: 500; color: #3b82f6;">${sensor.hum_internal.toFixed(1)}%</span>
                  </div>
                ` : ''}
                ${sensor.hum_external !== null && sensor.hum_external !== undefined ? `
                  <div style="display: flex; justify-between; margin-bottom: 4px;">
                    <span style="color: #666;">Humidity (Ext):</span>
                    <span style="font-weight: 500; color: #ef4444;">${sensor.hum_external.toFixed(1)}%</span>
                  </div>
                ` : ''}
              </div>
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999;">
                <div>📍 ${sensor.lat.toFixed(6)}, ${sensor.lon.toFixed(6)}</div>
                ${sensor.timestamp ? `<div style="margin-top: 4px;">🕐 ${new Date(sensor.timestamp).toLocaleString()}</div>` : ''}
              </div>
            </div>
          `;

          const marker = L.marker([sensor.lat, sensor.lon], { icon })
            .addTo(map)
            .bindPopup(popupContent);

          marker.on('click', () => {
            if (onSensorSelect) {
              const newSelected = selectedSensors.includes(sensor.id)
                ? selectedSensors.filter(id => id !== sensor.id)
                : [...selectedSensors, sensor.id];
              onSensorSelect(newSelected);
            }
          });

          markersRef.current.push(marker);
        });

        // Fit bounds to show all markers with more padding for wider view
        if (validLocationData.length > 0) {
          const bounds = L.latLngBounds(
            validLocationData.map(s => [s.lat, s.lon] as [number, number])
          );
          map.fitBounds(bounds, { 
            padding: [60, 60],
            maxZoom: 13
          });
        }

        console.log('✅ Map initialized with', markersRef.current.length, 'markers');
      } catch (error) {
        console.error('❌ Error initializing map:', error);
        if (mounted) {
          setLoadError('Failed to initialize map');
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, validLocationData, selectedSensors, onSensorSelect]);

  // Show error if load failed
  if (loadError) {
    return (
      <div className={`w-full h-full rounded-xl shadow-xl border flex flex-col ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <div className={`flex-1 flex items-center justify-center ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'}`}>
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className={`mb-2 font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{loadError}</p>
            <button 
              onClick={() => window.location.reload()}
              className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Early return for no location set
  if (!apiaryLocation) {
    return (
      <div className={`w-full h-full rounded-xl shadow-xl border flex flex-col ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <div className={`flex-1 flex items-center justify-center ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📍</div>
            <p className={`mb-2 ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>No apiary location set</p>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Please set the GPS coordinates for this apiary in the Access Management page
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Early return for no data
  if (validLocationData.length === 0) {
    return (
      <div className={`w-full h-full rounded-xl shadow-xl border flex flex-col ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <div className={`flex-1 flex items-center justify-center ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📍</div>
            <p className={`mb-2 ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>No hive data available</p>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Waiting for sensor data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full rounded-xl shadow-xl border flex flex-col ${
      isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDarkMode ? 'border-slate-700' : 'border-gray-200'
      }`}>
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
          <span>📍 {validLocationData.length} hive{validLocationData.length !== 1 ? 's' : ''}</span>
          {apiaryLocation.address && (
            <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>• {apiaryLocation.address}</span>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef}
        className="relative flex-1 overflow-hidden"
        style={{ minHeight: '400px' }}
      >
        {isLoading && (
          <div className={`absolute inset-0 flex items-center justify-center z-50 ${
            isDarkMode ? 'bg-slate-900' : 'bg-gray-100'
          }`}>
            <div className="text-center">
              <div className="text-4xl mb-4">🗺️</div>
              <p className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>Loading map...</p>
              <div className={`mt-4 w-8 h-8 border-4 rounded-full animate-spin mx-auto ${
                isDarkMode 
                  ? 'border-slate-700 border-t-slate-400' 
                  : 'border-gray-200 border-t-gray-900'
              }`}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(LocationMapComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">Sensor Locations</h3>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-gray-600">Initializing map...</p>
          <div className="mt-4 w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    </div>
  )
});
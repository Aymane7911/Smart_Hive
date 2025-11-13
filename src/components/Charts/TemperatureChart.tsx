// app/components/Charts/TemperatureChart.tsx
'use client';

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ReferenceLine
} from 'recharts';
import { SensorData } from '../../lib/types';
import { 
  groupByTimestamp, 
  getUniqueHiveNumbers, 
  extractSharedValues, 
  getTemperature as getUniversalTemperature,
  toNumber 
} from '../../lib/hiveDataUtils';

interface TemperatureChartProps {
  data: SensorData[];
  containerId?: string;
  title?: string;
  height?: number;
  showInternal?: boolean;
  showExternal?: boolean;
  chartType?: 'line' | 'area' | 'scatter';
  selectedHiveOnly?: number | null;
}

interface CalibrationData {
  visualized: string;
  real: string;
  offset: number;
}

interface CalibrationSettings {
  temp_external: CalibrationData;
  temp_internal: CalibrationData;
  humidity: CalibrationData;
  weight: CalibrationData;
  appliedAt?: string;
}

export default function TemperatureChart({ 
  data,
  containerId,
  title = "Temperature Trends",
  height = 400,
  showInternal = true,
  showExternal = true,
  chartType: initialChartType = 'line',
  selectedHiveOnly = null
}: TemperatureChartProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [chartType, setChartType] = useState(initialChartType);
  const [selectedHives, setSelectedHives] = useState<number[]>([]);
  const [calibrations, setCalibrations] = useState<Map<number, CalibrationSettings>>(new Map());

  // Load calibrations for all hives
  useEffect(() => {
    const loadCalibrations = () => {
      if (!containerId || typeof window === 'undefined') return;

      console.log('🔧 Loading calibrations for container:', containerId);
      
      try {
        const calibMap = new Map<number, CalibrationSettings>();
        
        for (let hiveNum = 1; hiveNum <= 10; hiveNum++) {
          try {
            const calibrationKey = `calibration:${containerId}:${hiveNum}`;
            const stored = localStorage.getItem(calibrationKey);
            
            if (stored) {
              const loaded = JSON.parse(stored) as CalibrationSettings;
              calibMap.set(hiveNum, loaded);
              console.log(`✅ Loaded calibration for Hive ${hiveNum}:`, loaded);
            }
          } catch (error) {
            // Silently continue if calibration not found for this hive
          }
        }
        
        setCalibrations(calibMap);
        console.log(`✅ Total calibrations loaded: ${calibMap.size}`);
      } catch (error) {
        console.error('❌ Error loading calibrations:', error);
      }
    };

    loadCalibrations();
  }, [containerId]);

  const toNumber = (value: any): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Get temperature with calibration applied - FIXED to support both old and new field names
  const getTemperature = (item: any, type: 'internal' | 'external', hiveNumber: number): number | null => {
  // ✅ USE UNIVERSAL GETTER FIRST
  let temp = getUniversalTemperature(item, type);
  
  if (temp === null) return null;
    
    // Apply calibration ONLY if measurement is after calibration was saved
    const hiveCalibration = calibrations.get(hiveNumber);
    if (hiveCalibration && hiveCalibration.appliedAt) {
      // Safely get measurement timestamp
      const timestampValue = item.timestamp || item._metadata?.lastModified;
      if (!timestampValue) {
        // No timestamp available, apply calibration by default
        const offset = type === 'internal' 
          ? hiveCalibration.temp_internal.offset 
          : hiveCalibration.temp_external.offset;
        
        if (offset !== 0) {
          temp = temp + offset;
        }
        return temp;
      }
      
      const measurementTime = new Date(timestampValue).getTime();
      const calibrationTime = new Date(hiveCalibration.appliedAt).getTime();
      
      // Only apply offset if measurement is AFTER calibration was saved
      if (measurementTime > calibrationTime) {
        const offset = type === 'internal' 
          ? hiveCalibration.temp_internal.offset 
          : hiveCalibration.temp_external.offset;
        
        if (offset !== 0) {
          temp = temp + offset;
        }
      }
    }
    
    return temp;
  };

  // FIXED: Use useMemo and properly handle timestamp extraction
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timeRange === 'all') return data;
    
    const now = new Date();
    const cutoffTime = new Date();
    
    switch (timeRange) {
      case '24h':
        cutoffTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(now.getDate() - 30);
        break;
    }
    
    console.log(`🔍 Filtering data: timeRange=${timeRange}, cutoffTime=${cutoffTime.toISOString()}`);
    
    const filtered = data.filter(item => {
      // Try timestamp field first, then fall back to _metadata
      const timestampValue = item.timestamp || item._metadata?.lastModified;
      
      if (!timestampValue) {
        console.warn('⚠️ Item missing timestamp:', item);
        return false;
      }
      
      const itemTime = new Date(timestampValue);
      
      if (isNaN(itemTime.getTime())) {
        console.warn('⚠️ Invalid timestamp:', timestampValue);
        return false;
      }
      
      return itemTime >= cutoffTime;
    });
    
    console.log(`✅ Filtered: ${data.length} → ${filtered.length} items`);
    return filtered;
  }, [data, timeRange]);

  const uniqueHiveNumbers = useMemo(() => {
    // If viewing a single hive, return only that hive
    if (selectedHiveOnly !== null) {
      console.log(`🎯 Viewing single hive: ${selectedHiveOnly}`);
      return [selectedHiveOnly];
    }
    
    // Otherwise, return all hives
    const timestampGroups = new Map<string, number>();
    filteredData.forEach(item => {
      const timestamp = item.timestamp || new Date().toISOString();
      const count = timestampGroups.get(timestamp) || 0;
      timestampGroups.set(timestamp, count + 1);
    });
    
    const maxHives = Math.max(...Array.from(timestampGroups.values()), 0);
    return Array.from({ length: maxHives }, (_, i) => i + 1);
  }, [filteredData, selectedHiveOnly]);

  useEffect(() => {
    if (uniqueHiveNumbers.length > 0) {
      setSelectedHives(uniqueHiveNumbers);
    }
  }, [uniqueHiveNumbers, selectedHives.length]);

  const chartData = useMemo(() => {
  if (!filteredData || filteredData.length === 0) return [];

  const timestampGroups = groupByTimestamp(filteredData);

  // STEP 1: Extract shared external temperature values
  const allExternalTemps = extractSharedValues(
    filteredData,
    ['ext_temp', 'temp_external', 'external_temp', 'temperature_external', 'tempExternal', 'exte_temp']
  );
  
  console.log(`🌍 Found external temps for ${allExternalTemps.size}/${timestampGroups.size} timestamps`);

  // STEP 2: Build data points - ONLY for the hives in uniqueHiveNumbers
  const data = Array.from(timestampGroups.entries()).map(([timeKey, itemsWithIndex]) => {
    const dataPoint: any = {
      timestamp: timeKey,
      validDataPoints: 0
    };
    
    const sharedExternalTemp = allExternalTemps.get(timeKey);
    
    uniqueHiveNumbers.forEach((hiveNumber) => {
      const itemIndex = hiveNumber - 1;
      const itemData = itemsWithIndex[itemIndex];
      const item = itemData?.item;
      
      // Get internal temperature (unique per hive)
      if (item) {
        const temp_internal = getTemperature(item, 'internal', hiveNumber);
        if (temp_internal !== null) {
          dataPoint[`temp_internal_${hiveNumber}`] = temp_internal;
          dataPoint.validDataPoints++;
        }
      }
      
      // Assign shared external temp
      if (sharedExternalTemp !== undefined) {
        dataPoint[`temp_external_${hiveNumber}`] = sharedExternalTemp;
        dataPoint.validDataPoints++;
      }
    });
    
    return dataPoint;
  });

  const result = data
    .filter(item => item.validDataPoints > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return result;
}, [filteredData, calibrations, uniqueHiveNumbers]);


  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'];
    
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    
    // Find min and max temperature values from all selected hives
    chartData.forEach(dataPoint => {
      selectedHives.forEach(hiveNumber => {
        if (showInternal) {
          const internalTemp = dataPoint[`temp_internal_${hiveNumber}`];
          if (internalTemp !== null && internalTemp !== undefined && !isNaN(internalTemp)) {
            minTemp = Math.min(minTemp, internalTemp);
            maxTemp = Math.max(maxTemp, internalTemp);
          }
        }
        
        if (showExternal) {
          const externalTemp = dataPoint[`temp_external_${hiveNumber}`];
          if (externalTemp !== null && externalTemp !== undefined && !isNaN(externalTemp)) {
            minTemp = Math.min(minTemp, externalTemp);
            maxTemp = Math.max(maxTemp, externalTemp);
          }
        }
      });
    });
    
    // If no valid data found, use default range
    if (minTemp === Infinity || maxTemp === -Infinity) {
      return [0, 50];
    }
    
    // Add padding (10% on each side) for better visualization
    const range = maxTemp - minTemp;
    const padding = Math.max(range * 0.1, 2); // At least 2 degrees padding
    
    const domainMin = Math.floor(minTemp - padding);
    const domainMax = Math.ceil(maxTemp + padding);
    
    console.log(`📊 Y-axis auto-scale: [${domainMin}°C, ${domainMax}°C] (data range: ${minTemp.toFixed(1)}°C - ${maxTemp.toFixed(1)}°C)`);
    
    return [domainMin, domainMax];
  }, [chartData, selectedHives, showInternal, showExternal]);

  const getColorPalette = (index: number, isExternal: boolean = false) => {
    // Always use blue for internal and red for external when viewing a single hive
    if (selectedHiveOnly !== null) {
      return isExternal ? '#ef4444' : '#3b82f6';
    }
    
    // Use different colors for multiple hives
    const colors = [
      { internal: '#3b82f6', external: '#ef4444' },
      { internal: '#10b981', external: '#f59e0b' },
      { internal: '#8b5cf6', external: '#ec4899' },
      { internal: '#06b6d4', external: '#f97316' },
      { internal: '#84cc16', external: '#dc2626' },
    ];
    const colorSet = colors[index % colors.length];
    return isExternal ? colorSet.external : colorSet.internal;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl p-4 border border-purple-500/30 rounded-xl shadow-2xl">
          <p className="text-sm font-semibold text-white mb-3 pb-2 border-b border-purple-500/30">
            {new Date(label).toLocaleString()}
          </p>
          
          {payload
            .filter((entry: any) => entry.value !== null && entry.value !== undefined && !isNaN(entry.value))
            .map((entry: any, index: number) => {
              const parts = entry.dataKey.split('_');
              const hiveNumber = parseInt(parts[parts.length - 1]);
              const tempType = entry.dataKey.includes('internal') ? 'Internal' : 'External';
              const hasCalibration = calibrations.has(hiveNumber);
              
              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <p className="text-sm font-medium text-white">
                      Hive {hiveNumber} - {tempType}
                      {hasCalibration && <span className="ml-1 text-green-400 text-xs">✓</span>}
                    </p>
                  </div>
                  <p className="text-lg font-bold ml-5" style={{ color: entry.color }}>
                    {typeof entry.value === 'number' ? entry.value.toFixed(2) : 'N/A'}°C
                  </p>
                </div>
              );
            })}
        </div>
      );
    }
    return null;
  };

  const formatXAxisLabel = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      
      if (timeRange === '30d' || timeRange === 'all') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleTimeString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch {
      return '';
    }
  };

  const getXAxisTicks = useMemo(() => {
    if (timeRange !== '30d' && timeRange !== 'all') return undefined;

    const dateGroups = new Map<string, string[]>();
    chartData.forEach(item => {
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, []);
      }
      dateGroups.get(dateStr)!.push(item.timestamp);
    });

    return Array.from(dateGroups.values()).map(timestamps => timestamps[0]);
  }, [chartData, timeRange]);

  const getLegendItems = () => {
    const items: Array<{ label: string; color: string; calibrated: boolean }> = [];
    
    selectedHives.forEach((hiveNumber, index) => {
      const hasCalibration = calibrations.has(hiveNumber);
      
      if (showInternal) {
        items.push({
          label: `Int${hasCalibration ? ' ✓' : ''}`,
          color: getColorPalette(index, false),
          calibrated: hasCalibration
        });
      }
      if (showExternal) {
        items.push({
          label: `Ext${hasCalibration ? ' ✓' : ''}`,
          color: getColorPalette(index, true),
          calibrated: hasCalibration
        });
      }
    });
    
    return items;
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <p className="text-white/60">No data available</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <p className="text-white/60">No valid temperature readings found for selected time range</p>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    const renderLines = () => {
      const lines: React.ReactNode[] = [];
      
      selectedHives.forEach((hiveNumber, index) => {
        if (showInternal) {
          lines.push(
            <Line
              key={`internal_${hiveNumber}`}
              type="monotone"
              dataKey={`temp_internal_${hiveNumber}`}
              stroke={getColorPalette(index, false)}
              strokeWidth={3}
              dot={{ fill: getColorPalette(index, false), strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: getColorPalette(index, false), strokeWidth: 3 }}
              connectNulls={true}
              strokeDasharray={undefined}
            />
          );
        }
        
        if (showExternal) {
          lines.push(
            <Line
              key={`external_${hiveNumber}`}
              type="monotone"
              dataKey={`temp_external_${hiveNumber}`}
              stroke={getColorPalette(index, true)}
              strokeWidth={3}
              dot={{ fill: getColorPalette(index, true), strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: getColorPalette(index, true), strokeWidth: 3 }}
              connectNulls={true}
              strokeDasharray={undefined}
            />
          );
        }
      });
      
      return lines;
    };

    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis 
          dataKey="timestamp"
          ticks={getXAxisTicks}
          tickFormatter={formatXAxisLabel}
          angle={-45}
          textAnchor="end"
          height={80}
          fontSize={11}
          stroke="rgba(255,255,255,0.6)"
          tick={{ fill: 'rgba(255,255,255,0.6)' }}
          interval={0}
        />
        <YAxis 
          domain={yAxisDomain}
          label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
          fontSize={11}
          stroke="rgba(255,255,255,0.6)"
          tick={{ fill: 'rgba(255,255,255,0.6)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        {React.createElement(ReferenceLine as any, { y: 20, stroke: "#10b981", strokeDasharray: "3 3", strokeOpacity: 0.5 })}
{React.createElement(ReferenceLine as any, { y: 35, stroke: "#10b981", strokeDasharray: "3 3", strokeOpacity: 0.5 })}
        {renderLines()}
      </LineChart>
    );
  };

  const legendItems = getLegendItems();
  const calibratedCount = Array.from(calibrations.keys()).filter(h => selectedHives.includes(h)).length;

  return (
    <div className="w-full bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {calibratedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-sm text-green-300 font-medium">
                {calibratedCount} {calibratedCount === 1 ? 'hive' : 'hives'} calibrated
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-white/80">Time:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
            >
              <option value="24h" className="bg-slate-900">Last 24 Hours</option>
              <option value="7d" className="bg-slate-900">Last 7 Days</option>
              <option value="30d" className="bg-slate-900">Last 30 Days</option>
              <option value="all" className="bg-slate-900">All Data</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              {chartData.length} points
            </span>
            
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
        
        {legendItems.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t border-white/10">
            {legendItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-white/80">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// app/components/Charts/HumidityChart.tsx
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

interface HumidityChartProps {
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

export default function HumidityChart({ 
  data,
  containerId,
  title = "Humidity Trends",
  height = 400,
  showInternal = true,
  showExternal = true,
  chartType: initialChartType = 'line',
  selectedHiveOnly = null
}: HumidityChartProps) {
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

  // Get humidity with calibration applied
  const getHumidity = (item: any, type: 'internal' | 'external', hiveNumber: number): number | null => {
    let value: any;
    
    if (type === 'internal') {
      value = item.int_hum || item.hum_internal || item.Internal_hum || item.humidity_internal || item.humInternal || item.inte_hum;
    } else {
      value = item.ext_hum || item.hum_external || item.external_hum || item.humidity_external || item.humExternal || item.exte_hum;
    }
    
    let humidity = toNumber(value);
    
    if (humidity == null) return null;
    if (humidity < -50 || humidity > 150) return null;
    if (humidity < 0) humidity = 0;
    
    // Apply calibration ONLY if measurement is after calibration was saved
    const hiveCalibration = calibrations.get(hiveNumber);
    if (hiveCalibration && hiveCalibration.appliedAt) {
      const timestampValue = item.timestamp || item._metadata?.lastModified;
      if (!timestampValue) {
        const offset = hiveCalibration.humidity.offset;
        if (offset !== 0) {
          humidity = humidity + offset;
        }
        return humidity;
      }
      
      const measurementTime = new Date(timestampValue).getTime();
      const calibrationTime = new Date(hiveCalibration.appliedAt).getTime();
      
      if (measurementTime > calibrationTime) {
        const offset = hiveCalibration.humidity.offset;
        if (offset !== 0) {
          humidity = humidity + offset;
        }
      }
    }
    
    return humidity;
  };

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

  // Group by timestamp AND preserve original index
  const timestampGroups = new Map<string, Array<{item: any, originalIndex: number}>>();
  
  filteredData.forEach((item, originalIndex) => {
    const timestamp = item.timestamp || new Date().toISOString();
    const timeKey = new Date(timestamp).toISOString();
    
    if (!timestampGroups.has(timeKey)) {
      timestampGroups.set(timeKey, []);
    }
    
    timestampGroups.get(timeKey)!.push({ item, originalIndex });
  });

  // Sort items within each timestamp group by original index
  timestampGroups.forEach((items, timeKey) => {
    items.sort((a, b) => a.originalIndex - b.originalIndex);
  });

  // STEP 1: Find ANY external humidity value for each timestamp (search ALL hives)
  const allExternalHums = new Map<string, number>();
  
  Array.from(timestampGroups.entries()).forEach(([timeKey, itemsWithIndex]) => {
    // Search through ALL items to find one with ext_hum
    for (const { item } of itemsWithIndex) {
      const extHumValue = item.ext_hum;
      
      if (extHumValue !== undefined && extHumValue !== null && extHumValue !== '') {
        const hum = toNumber(extHumValue);
        if (hum !== null && hum >= -50 && hum <= 150) {
          const finalHum = hum < 0 ? 0 : hum;
          allExternalHums.set(timeKey, finalHum);
          console.log(`✅ Found ext_hum: ${finalHum}% at ${timeKey}`);
          break; // Found it, stop searching
        }
      }
    }
  });
  
  console.log(`🌍 Found external humidity for ${allExternalHums.size}/${timestampGroups.size} timestamps`);

  // STEP 2: Build data points - ONLY for the hives in uniqueHiveNumbers
  const data = Array.from(timestampGroups.entries()).map(([timeKey, itemsWithIndex]) => {
    const dataPoint: any = {
      timestamp: timeKey,
      validDataPoints: 0
    };
    
    // Get the shared external humidity (if found from ANY hive)
    const sharedExternalHum = allExternalHums.get(timeKey);
    
    // Process ONLY the hives specified in uniqueHiveNumbers
    uniqueHiveNumbers.forEach((hiveNumber) => {
      const itemIndex = hiveNumber - 1;
      const itemData = itemsWithIndex[itemIndex];
      const item = itemData?.item;
      
      // Get internal humidity (unique per hive)
      if (item) {
        const hum_internal = getHumidity(item, 'internal', hiveNumber);
        if (hum_internal !== null) {
          dataPoint[`hum_internal_${hiveNumber}`] = hum_internal;
          dataPoint.validDataPoints++;
        }
      }
      
      // ASSIGN shared external humidity to this hive (even if its own ext_hum is 0/empty)
      if (sharedExternalHum !== undefined) {
        dataPoint[`hum_external_${hiveNumber}`] = sharedExternalHum;
        dataPoint.validDataPoints++;
      }
    });
    
    return dataPoint;
  });

  const result = data
    .filter(item => item.validDataPoints > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  if (result.length > 0) {
    const internalFields = Object.keys(result[0]).filter(k => k.startsWith('hum_internal_'));
    const externalFields = Object.keys(result[0]).filter(k => k.startsWith('hum_external_'));
    console.log(`✅ Final chart data: ${internalFields.length} internal humidity, ${externalFields.length} external humidity`);
    console.log(`   Hives displayed:`, uniqueHiveNumbers);
  }
  
  return result;
}, [filteredData, calibrations, uniqueHiveNumbers]);

  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    let minHum = Infinity;
    let maxHum = -Infinity;
    
    // Find min and max humidity values from all selected hives
    chartData.forEach(dataPoint => {
      selectedHives.forEach(hiveNumber => {
        if (showInternal) {
          const internalHum = dataPoint[`hum_internal_${hiveNumber}`];
          if (internalHum !== null && internalHum !== undefined && !isNaN(internalHum)) {
            minHum = Math.min(minHum, internalHum);
            maxHum = Math.max(maxHum, internalHum);
          }
        }
        
        if (showExternal) {
          const externalHum = dataPoint[`hum_external_${hiveNumber}`];
          if (externalHum !== null && externalHum !== undefined && !isNaN(externalHum)) {
            minHum = Math.min(minHum, externalHum);
            maxHum = Math.max(maxHum, externalHum);
          }
        }
      });
    });
    
    // If no valid data found, use default range
    if (minHum === Infinity || maxHum === -Infinity) {
      return [0, 100];
    }
    
    // Add padding (10% on each side) for better visualization
    const range = maxHum - minHum;
    const padding = Math.max(range * 0.1, 5); // At least 5% padding
    
    let domainMin = Math.floor(minHum - padding);
    let domainMax = Math.ceil(maxHum + padding);
    
    // Keep within valid humidity range (0-100%)
    domainMin = Math.max(0, domainMin);
    domainMax = Math.min(100, domainMax);
    
    console.log(`📊 Y-axis auto-scale (Humidity): [${domainMin}%, ${domainMax}%] (data range: ${minHum.toFixed(1)}% - ${maxHum.toFixed(1)}%)`);
    
    return [domainMin, domainMax];
  }, [chartData, selectedHives, showInternal, showExternal]);

  const getColorPalette = (index: number, isExternal: boolean = false) => {
    // Always use cyan for internal and orange for external when viewing a single hive
    if (selectedHiveOnly !== null) {
      return isExternal ? '#f97316' : '#06b6d4';
    }
    
    // Use different colors for multiple hives
    const colors = [
      { internal: '#0891b2', external: '#c2410c' },
      { internal: '#059669', external: '#d97706' },
      { internal: '#7c3aed', external: '#db2777' },
      { internal: '#0284c7', external: '#ea580c' },
      { internal: '#65a30d', external: '#dc2626' },
    ];
    const colorSet = colors[index % colors.length];
    return isExternal ? colorSet.external : colorSet.internal;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl p-4 border border-cyan-500/30 rounded-xl shadow-2xl">
          <p className="text-sm font-semibold text-white mb-3 pb-2 border-b border-cyan-500/30">
            {new Date(label).toLocaleString()}
          </p>
          
          {payload
            .filter((entry: any) => entry.value !== null && entry.value !== undefined && !isNaN(entry.value))
            .map((entry: any, index: number) => {
              const parts = entry.dataKey.split('_');
              const hiveNumber = parseInt(parts[parts.length - 1]);
              const humType = entry.dataKey.includes('internal') ? 'Internal' : 'External';
              const hasCalibration = calibrations.has(hiveNumber);
              
              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <p className="text-sm font-medium text-white">
                      Hive {hiveNumber} - {humType}
                      {hasCalibration && <span className="ml-1 text-green-400 text-xs">✓</span>}
                    </p>
                  </div>
                  <p className="text-lg font-bold ml-5" style={{ color: entry.color }}>
                    {typeof entry.value === 'number' ? entry.value.toFixed(2) : 'N/A'}%
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
          <p className="text-white/60">No valid humidity readings found for selected time range</p>
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
              dataKey={`hum_internal_${hiveNumber}`}
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
              dataKey={`hum_external_${hiveNumber}`}
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

    const renderAreas = () => {
      const areas: React.ReactNode[] = [];
      
      selectedHives.forEach((hiveNumber, index) => {
        if (showInternal) {
          areas.push(
            <Area
              key={`internal_${hiveNumber}`}
              type="monotone"
              dataKey={`hum_internal_${hiveNumber}`}
              stackId={`internal_${hiveNumber}`}
              stroke={getColorPalette(index, false)}
              fill={getColorPalette(index, false)}
              fillOpacity={0.3}
              strokeWidth={2}
              connectNulls={true}
            />
          );
        }
        
        if (showExternal) {
          areas.push(
            <Area
              key={`external_${hiveNumber}`}
              type="monotone"
              dataKey={`hum_external_${hiveNumber}`}
              stackId={`external_${hiveNumber}`}
              stroke={getColorPalette(index, true)}
              fill={getColorPalette(index, true)}
              fillOpacity={0.3}
              strokeWidth={2}
              connectNulls={true}
            />
          );
        }
      });
      
      return areas;
    };

    const renderScatters = () => {
      const scatters: React.ReactNode[] = [];
      
      selectedHives.forEach((hiveNumber, index) => {
        if (showInternal) {
          scatters.push(
            <Scatter 
              key={`internal_${hiveNumber}`}
              dataKey={`hum_internal_${hiveNumber}`}
              fill={getColorPalette(index, false)}
            />
          );
        }
        
        if (showExternal) {
          scatters.push(
            <Scatter 
              key={`external_${hiveNumber}`}
              dataKey={`hum_external_${hiveNumber}`}
              fill={getColorPalette(index, true)}
            />
          );
        }
      });
      
      return scatters;
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
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
              label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
              fontSize={11}
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            {renderAreas()}
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
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
              label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
              fontSize={11}
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            {renderScatters()}
          </ScatterChart>
        );

      default:
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
              label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
              fontSize={11}
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            {React.createElement(ReferenceLine as any, { y: 30, stroke: "#f59e0b", strokeDasharray: "3 3", strokeOpacity: 0.5 })}
{React.createElement(ReferenceLine as any, { y: 40, stroke: "#10b981", strokeDasharray: "3 3", strokeOpacity: 0.5 })}
{React.createElement(ReferenceLine as any, { y: 60, stroke: "#10b981", strokeDasharray: "3 3", strokeOpacity: 0.5 })}
{React.createElement(ReferenceLine as any, { y: 70, stroke: "#f59e0b", strokeDasharray: "3 3", strokeOpacity: 0.5 })}
            {renderLines()}
          </LineChart>
        );
    }
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
              className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
            >
              <option value="24h" className="bg-slate-900">Last 24 Hours</option>
              <option value="7d" className="bg-slate-900">Last 7 Days</option>
              <option value="30d" className="bg-slate-900">Last 30 Days</option>
              <option value="all" className="bg-slate-900">All Data</option>
            </select>
          </div>

          

          <div className="ml-auto flex items-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
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
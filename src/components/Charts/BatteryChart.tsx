// components/Charts/BatteryChart.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart
} from 'recharts';
import { SensorData } from '../../lib/types';

interface BatteryChartProps {
  data: SensorData[];
  containerId?: string;
  title?: string;
  height?: number;
  selectedHiveOnly?: number | null;
  isDarkMode?: boolean;
}

interface ChartDataPoint {
  timestamp: string;
  formattedTime: string;
  validDataPoints: number;
  [key: string]: number | string;
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

const BatteryChart: React.FC<BatteryChartProps> = ({ 
  data,
  containerId,
  title = "Battery Levels",
  height = 400,
  selectedHiveOnly = null,
  isDarkMode = false
}) => {
  const [selectedHives, setSelectedHives] = useState<Set<number>>(new Set());
  const [showLowBatteryOnly, setShowLowBatteryOnly] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [calibrations, setCalibrations] = useState<Map<number, CalibrationSettings>>(new Map());

  // Load calibrations for all hives
  useEffect(() => {
    const loadCalibrations = () => {
      if (!containerId || typeof window === 'undefined') return;
      
      try {
        const calibMap = new Map<number, CalibrationSettings>();
        
        for (let hiveNum = 1; hiveNum <= 10; hiveNum++) {
          try {
            const calibrationKey = `calibration:${containerId}:${hiveNum}`;
            const stored = localStorage.getItem(calibrationKey);
            
            if (stored) {
              const loaded = JSON.parse(stored) as CalibrationSettings;
              calibMap.set(hiveNum, loaded);
            }
          } catch (error) {
            // Silently continue if calibration not found for this hive
          }
        }
        
        setCalibrations(calibMap);
      } catch (error) {
        console.error('Error loading calibrations:', error);
      }
    };

    loadCalibrations();
  }, [containerId]);

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

  // Helper to get battery value
  const getBattery = (item: any): number => {
    const value = item.battery || item.Battery || item.battery_level || item.bat || item.batt;
    const battery = toNumber(value);
    
    if (battery == null) {
      return 100;
    }
    
    if (battery < 0 || battery > 200) return 100;
    
    return battery;
  };

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    
    if (timeRange === 'all') {
      return data;
    }
    
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
    
    const filtered = data.filter(item => {
      const timestampValue = item.timestamp || item._metadata?.lastModified;
      
      if (!timestampValue) {
        return false;
      }
      
      const itemTime = new Date(timestampValue);
      
      if (isNaN(itemTime.getTime())) {
        return false;
      }
      
      return itemTime >= cutoffTime;
    });
    
    return filtered;
  }, [data, timeRange]);

  // Process and group data by hive
  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return [];
    }

    const timestampGroups = new Map<string, Array<{item: any, originalIndex: number}>>();
    
    filteredData.forEach((item, originalIndex) => {
      const timestamp = item.timestamp || item._metadata?.lastModified || new Date().toISOString();
      const timeKey = new Date(timestamp).toISOString();
      
      if (!timestampGroups.has(timeKey)) {
        timestampGroups.set(timeKey, []);
      }
      
      timestampGroups.get(timeKey)!.push({ item, originalIndex });
    });

    timestampGroups.forEach((items, timeKey) => {
      items.sort((a, b) => a.originalIndex - b.originalIndex);
    });

    const result: ChartDataPoint[] = [];
    
    timestampGroups.forEach((itemsWithIndex, timeKey) => {
      const dataPoint: ChartDataPoint = {
        timestamp: timeKey,
        formattedTime: new Date(timeKey).toLocaleString(),
        validDataPoints: 0
      };
      
      itemsWithIndex.forEach(({ item }, rowIndex) => {
        const hiveNumber = rowIndex + 1;
        
        if (selectedHiveOnly !== null && hiveNumber !== selectedHiveOnly) {
          return;
        }
        
        const battery = getBattery(item);
        
        dataPoint[`battery_${hiveNumber}`] = battery;
        dataPoint.validDataPoints++;
      });
      
      result.push(dataPoint);
    });

    const sortedResult = result.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return sortedResult;
  }, [filteredData, selectedHiveOnly]);

  // Get unique hive numbers from the data
  const hives = useMemo(() => {
    const hiveSet = new Set<number>();
    
    chartData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key.startsWith('battery_')) {
          const hiveNumber = parseInt(key.replace('battery_', ''));
          if (!isNaN(hiveNumber)) {
            if (selectedHiveOnly === null || hiveNumber === selectedHiveOnly) {
              hiveSet.add(hiveNumber);
            }
          }
        }
      });
    });

    const result = Array.from(hiveSet).sort((a, b) => a - b);
    return result;
  }, [chartData, selectedHiveOnly]);

  // Filter hives based on selection and low battery filter
  const visibleHives = useMemo(() => {
    let filtered = hives;

    if (showLowBatteryOnly) {
      filtered = hives.filter(hiveNumber => {
        return chartData.some(point => {
          const batteryLevel = point[`battery_${hiveNumber}`];
          return typeof batteryLevel === 'number' && batteryLevel < 30;
        });
      });
    }

    if (selectedHives.size > 0) {
      filtered = filtered.filter(hiveNumber => selectedHives.has(hiveNumber));
    }

    return filtered.slice(0, 10);
  }, [hives, selectedHives, showLowBatteryOnly, chartData]);

  // Colors for different hives
  const getColorForHive = (index: number): string => {
    const colors = [
      '#60A5FA', '#34D399', '#FBBF24', '#F87171', '#22D3EE',
      '#A78BFA', '#4ADE80', '#FB923C', '#EC4899', '#14B8A6'
    ];
    return colors[index % colors.length];
  };

  // Check if battery data exists in the dataset
  const hasBatteryData = useMemo(() => {
    if (!data || data.length === 0) return false;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const item = data[i];
      const value = item.battery;
      if (value !== undefined && value !== null) {
        return true;
      }
    }
    return false;
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-4 rounded-xl shadow-2xl border-2 ${
          isDarkMode 
            ? 'bg-slate-800 border-slate-600' 
            : 'bg-white border-gray-200'
        }`}>
          <p className={`text-sm font-semibold mb-3 pb-2 border-b ${
            isDarkMode 
              ? 'text-white border-slate-600' 
              : 'text-gray-900 border-gray-200'
          }`}>
            {new Date(label).toLocaleString()}
          </p>
          {payload
            .filter((entry: any) => entry.value !== null && entry.value !== undefined && !isNaN(entry.value))
            .map((entry: any, index: number) => {
              const hiveNumber = parseInt(entry.dataKey.replace('battery_', ''));
              const batteryLevel = Number(entry.value);
              const hasCalibration = calibrations.has(hiveNumber);
              
              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Hive {hiveNumber}
                      {hasCalibration && <span className="ml-1 text-green-600 text-xs">✓</span>}
                      {!hasBatteryData && <span className="ml-1 text-blue-600 text-xs">(simulated)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-5">
                    <p className="text-lg font-bold" style={{ color: entry.color }}>
                      {batteryLevel.toFixed(1)}%
                    </p>
                    {batteryLevel < 20 && (
                      <span className="text-xs text-red-600 font-bold px-2 py-0.5 bg-red-50 border border-red-200 rounded">
                        ⚠️ Critical
                      </span>
                    )}
                    {batteryLevel >= 20 && batteryLevel < 30 && (
                      <span className="text-xs text-orange-600 font-bold px-2 py-0.5 bg-orange-50 border border-orange-200 rounded">
                        ⚠️ Low
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      );
    }
    return null;
  };

  // Handle hive selection
  const toggleHive = (hiveNumber: number) => {
    const newSelection = new Set(selectedHives);
    if (newSelection.has(hiveNumber)) {
      newSelection.delete(hiveNumber);
    } else {
      newSelection.add(hiveNumber);
    }
    setSelectedHives(newSelection);
  };

  const selectAllHives = () => {
    setSelectedHives(new Set(hives));
  };

  const clearSelection = () => {
    setSelectedHives(new Set());
  };

  // Format X-axis labels
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

  // Get unique date ticks for the X-axis
  const getXAxisTicks = useMemo(() => {
    if (timeRange !== '30d' && timeRange !== 'all') {
      return undefined;
    }

    const dateGroups = new Map<string, string[]>();
    chartData.forEach(item => {
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, []);
      }
      dateGroups.get(dateStr)!.push(item.timestamp);
    });

    const ticks = Array.from(dateGroups.values()).map(timestamps => timestamps[0]);
    
    return ticks;
  }, [chartData, timeRange]);

  // Create legend items
  const getLegendItems = () => {
    return visibleHives.map((hiveNumber, index) => {
      const hasCalibration = calibrations.has(hiveNumber);
      return {
        label: `Hive ${hiveNumber}${hasCalibration ? ' ✓' : ''}`,
        color: getColorForHive(index),
        calibrated: hasCalibration
      };
    });
  };

  if (!data || data.length === 0) {
    return (
      <div className={`w-full h-full rounded-xl shadow-xl p-6 border flex flex-col ${
        isDarkMode 
          ? 'bg-slate-800 border-slate-700' 
          : 'bg-white border-gray-200'
      }`}>
        <h3 className={`text-xl font-bold mb-4 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>{title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🔋</div>
            <p className={`mb-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              No battery data available
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              Battery levels will appear here once data is collected
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className={`w-full h-full rounded-xl shadow-xl p-6 border flex flex-col ${
        isDarkMode 
          ? 'bg-slate-800 border-slate-700' 
          : 'bg-white border-gray-200'
      }`}>
        <h3 className={`text-xl font-bold mb-4 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>{title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className={`mb-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              No battery data for selected time range
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              Time range: {timeRange}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const legendItems = getLegendItems();
  const calibratedCount = Array.from(calibrations.keys()).filter(h => visibleHives.includes(h)).length;

  // Dynamic colors based on dark mode
  const gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const axisColor = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  return (
    <div className={`w-full h-full rounded-xl shadow-xl border flex flex-col ${
      isDarkMode 
        ? 'bg-slate-800 border-slate-700' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-2xl font-bold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>{title}</h3>
          <div className="flex items-center gap-3">
            <div className={`flex items-center space-x-2 text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-gray-600'
            }`}>
              {visibleHives.length !== hives.length && (
                <span className={isDarkMode ? 'text-slate-500' : 'text-gray-500'}>
                  ({visibleHives.length} shown)
                </span>
              )}
            </div>
            {calibratedCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-green-700 font-medium">
                  {calibratedCount} {calibratedCount === 1 ? 'hive' : 'hives'} calibrated
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Controls Row */}
        {selectedHiveOnly === null && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Range */}
            <div className="flex items-center gap-2">
              <label className={`text-sm font-medium ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>Time:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Data</option>
              </select>
            </div>

            {/* Low Battery Filter */}
            <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all ${
              isDarkMode 
                ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' 
                : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
            }`}>
              <input
                type="checkbox"
                checked={showLowBatteryOnly}
                onChange={(e) => setShowLowBatteryOnly(e.target.checked)}
                className="rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500"
              />
              <span className={`text-sm ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>Low battery only (&lt; 30%)</span>
            </label>

            {/* Selection Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={selectAllHives}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' 
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Clear
              </button>
            </div>

            {/* Stats */}
            <div className={`flex items-center gap-4 text-sm w-full sm:w-auto ${
              isDarkMode ? 'text-slate-400' : 'text-gray-600'
            }`}>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                {chartData.length} points
              </span>
            </div>
          </div>
        )}
        
        {/* Simplified controls for single hive */}
        {selectedHiveOnly !== null && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className={`text-sm font-medium ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>Time:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Data</option>
              </select>
            </div>
            
            <div className={`ml-auto flex items-center gap-4 text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-gray-600'
            }`}>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                {chartData.length} points
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chart - Full Height */}
      <div className="flex-1 p-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis 
              dataKey="timestamp"
              ticks={getXAxisTicks}
              tickFormatter={formatXAxisLabel}
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={11}
              stroke={axisColor}
              tick={{ fill: axisColor }}
              interval={0}
            />
            <YAxis 
              label={{ value: 'Battery Level (%)', angle: -90, position: 'insideLeft', fill: axisColor }}
              fontSize={11}
              stroke={axisColor}
              tick={{ fill: axisColor }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference lines */}
            <ReferenceLine y={20} stroke="#F87171" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={30} stroke="#FBBF24" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={50} stroke="#34D399" strokeDasharray="3 3" strokeOpacity={0.3} />
            
            {/* Battery level lines */}
            {visibleHives.map((hiveNumber, index) => {
              const dataKey = `battery_${hiveNumber}`;
              const color = getColorForHive(index);
              
              return (
                <Line
                  key={hiveNumber}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={3}
                  dot={{ r: 4, fill: color, strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: color, strokeWidth: 3 }}
                  connectNulls={true}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Legend */}
        {legendItems.length > 0 && (
          <div className={`flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t ${
            isDarkMode ? 'border-slate-700' : 'border-gray-200'
          }`}>
            {legendItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className={`text-xs ${
                  isDarkMode ? 'text-slate-300' : 'text-gray-700'
                }`}>Battery</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="px-6 pb-6">
        <div className="flex flex-wrap gap-2 justify-end">
          {visibleHives.map(hiveNumber => {
            const latestPoint = chartData[chartData.length - 1];
            const batteryLevel = latestPoint?.[`battery_${hiveNumber}`];
            
            if (typeof batteryLevel === 'number' && batteryLevel < 30) {
              return (
                <div 
                  key={hiveNumber}
                  className={`text-xs px-3 py-1 rounded-lg font-medium ${
                    batteryLevel < 20
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-orange-50 text-orange-600 border border-orange-200'
                  }`}
                >
                  H{hiveNumber}: {batteryLevel.toFixed(0)}% {batteryLevel < 20 ? '⚠️' : '⚡'}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
};

export default BatteryChart;
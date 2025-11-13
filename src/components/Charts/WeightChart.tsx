// components/Charts/WeightChart.tsx
'use client';

import React from 'react';
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import { ReferenceLine } from 'recharts';
import { SensorData } from '../../lib/types';

interface WeightChartProps {
  data: SensorData[];
  containerId?: string;
  selectedHiveOnly?: number | null;
  title?: string;
  height?: number;
  showTrend?: boolean;
  chartType?: 'line' | 'area' | 'scatter';
  timeRange?: '24h' | '7d' | '30d' | 'all';
}

interface HiveStats {
  current: number;
  average: number;
  min: number;
  max: number;
  count: number;
  totalChange: number;
  trend: 'increasing' | 'decreasing';
}

export default function WeightChart({ 
  data,
  containerId,
  selectedHiveOnly = null,
  title = "Weight Monitoring",
  height = 400,
  showTrend = false,
  chartType: initialChartType = 'line',
  timeRange: initialTimeRange = 'all'
}: WeightChartProps) {
  console.log('⚖️ WeightChart mounted with data:', data?.length || 0);
  console.log('⚖️ selectedHiveOnly:', selectedHiveOnly);
  
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>(initialTimeRange);
  const [chartType, setChartType] = useState(initialChartType);
  const [selectedHives, setSelectedHives] = useState<number[]>([]);
  const [showTrendState, setShowTrend] = useState(false);

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

  // Helper to get weight value
  const getWeight = (item: any): number | null => {
    const value = item.weight || item.Weight || item.weight_kg;
    const weight = toNumber(value);
    
    // Filter out invalid weight readings
    if (weight == null) return null;
    
    // Reasonable weight range for beehives (0 to 500kg)
    if (weight > 500) return null;
    
    // Set negative or zero weights to null (invalid reading)
    if (weight < 0) return 0;
    
    return weight;
  };

  // Simple data filtering by time range
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) {
      console.log('⚠️ No data to filter');
      return [];
    }
    
    if (timeRange === 'all') {
      console.log('✅ Returning all data:', data.length);
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
      const itemTime = new Date(item.timestamp || 0);
      return itemTime >= cutoffTime;
    });
    
    console.log(`✅ Filtered data for ${timeRange}:`, filtered.length);
    return filtered;
  }, [data, timeRange]);

  // Get unique hive numbers based on row index (not ID field)
  const uniqueHiveNumbers = React.useMemo(() => {
    console.log('🔍 Computing unique hive numbers from filteredData:', filteredData.length);
    
    // If viewing a single hive, return only that hive
    if (selectedHiveOnly !== null) {
      console.log(`🎯 Viewing single hive: ${selectedHiveOnly}`);
      return [selectedHiveOnly];
    }
    
    // Group data by timestamp to find how many rows per timestamp
    const timestampGroups = new Map<string, number>();
    filteredData.forEach(item => {
      const timestamp = item.timestamp || new Date().toISOString();
      const count = timestampGroups.get(timestamp) || 0;
      timestampGroups.set(timestamp, count + 1);
    });
    
    // Find the maximum number of rows in any timestamp group
    const maxHives = Math.max(...Array.from(timestampGroups.values()), 0);
    
    console.log('✅ Maximum hives detected:', maxHives);
    
    // Return array [1, 2, 3, ...] up to maxHives
    return Array.from({ length: maxHives }, (_, i) => i + 1);
  }, [filteredData, selectedHiveOnly]);

  // Initialize selected hives if not set
  React.useEffect(() => {
    console.log('🎯 useEffect: Setting initial selected hives');
    console.log('   uniqueHiveNumbers:', uniqueHiveNumbers);
    console.log('   selectedHives:', selectedHives);
    
    if (uniqueHiveNumbers.length > 0) {
      console.log('✅ Initializing selected hives:', uniqueHiveNumbers);
      setSelectedHives(uniqueHiveNumbers);
    }
  }, [uniqueHiveNumbers, selectedHives.length]);

  // Prepare chart data with proper hive separation - FIXED VERSION
  const prepareChartData = () => {
    console.log('📊 prepareChartData called with filteredData:', filteredData.length);
    
    if (!filteredData || filteredData.length === 0) {
      console.log('⚠️ No filtered data');
      return [];
    }

    console.log('🔍 Sample filtered data:', filteredData.slice(0, 2));

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

    // Convert to chart data structure - ONLY for the hives in uniqueHiveNumbers
    const chartData = Array.from(timestampGroups.entries()).map(([timeKey, itemsWithIndex]) => {
      const dataPoint: any = {
        timestamp: timeKey,
        validDataPoints: 0
      };
      
      // Process ONLY the hives specified in uniqueHiveNumbers
      uniqueHiveNumbers.forEach((hiveNumber) => {
        const itemIndex = hiveNumber - 1;
        const itemData = itemsWithIndex[itemIndex];
        const item = itemData?.item;
        
        if (item) {
          const weight = getWeight(item);
          
          // Only include valid weight readings
          if (weight !== null) {
            dataPoint[`weight_${hiveNumber}`] = Math.round(weight * 100) / 100; // Round to 2 decimal places
            dataPoint[`raw_weight_${hiveNumber}`] = item.weight;
            dataPoint.validDataPoints++;
          } else {
            dataPoint[`weight_${hiveNumber}`] = null;
            dataPoint[`raw_weight_${hiveNumber}`] = item.weight;
          }
        }
      });
      
      return dataPoint;
    });

    console.log('📦 Chart data length:', chartData.length);
    console.log('📦 Sample chart data:', chartData.slice(0, 2));

    // ✅ FIX: Don't filter out points - keep all timestamps for continuous lines
    const sortedData = chartData.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate trend data if requested (cumulative change from start)
    if (showTrendState && sortedData.length > 1) {
      uniqueHiveNumbers.forEach(hiveNumber => {
        const weightKey = `weight_${hiveNumber}`;
        const trendKey = `trend_${hiveNumber}`;
        
        // Find the first valid weight as baseline
        let baselineWeight: number | null = null;
        for (let i = 0; i < sortedData.length; i++) {
          const weight = sortedData[i][weightKey];
          if (weight !== null) {
            baselineWeight = weight;
            break;
          }
        }
        
        // Calculate cumulative change from baseline
        for (let i = 0; i < sortedData.length; i++) {
          const currentWeight = sortedData[i][weightKey];
          
          if (currentWeight !== null && baselineWeight !== null) {
            const trend = currentWeight - baselineWeight;
            sortedData[i][trendKey] = Math.round(trend * 100) / 100; // Round to 2 decimal places
          } else {
            sortedData[i][trendKey] = null;
          }
        }
      });
    }

    console.log('✅ Final chart data length:', sortedData.length);
    console.log('✅ Sample chart data:', sortedData.slice(0, 2));

    return sortedData;
  };

  const chartData = prepareChartData();

  console.log('🎨 WeightChart render:', {
    dataLength: data.length,
    filteredDataLength: filteredData.length,
    chartDataLength: chartData.length,
    selectedHivesCount: selectedHives.length,
    uniqueHiveNumbersCount: uniqueHiveNumbers.length,
    timeRange,
    chartType,
    showTrend: showTrendState
  });

  // Calculate statistics for each hive
  const calculateStats = () => {
    if (chartData.length === 0) return {};

    const stats: Record<number, any> = {};

    uniqueHiveNumbers.forEach(hiveNumber => {
      const weights = chartData
        .map(d => d[`weight_${hiveNumber}`])
        .filter(w => w !== null && !isNaN(w)) as number[];

      if (weights.length > 0) {
        const totalChange = weights.length > 1 ? weights[weights.length - 1] - weights[0] : 0;
        
        stats[hiveNumber] = {
          current: weights[weights.length - 1],
          average: weights.reduce((sum, w) => sum + w, 0) / weights.length,
          min: Math.min(...weights),
          max: Math.max(...weights),
          count: weights.length,
          totalChange,
          trend: totalChange >= 0 ? 'increasing' : 'decreasing'
        };
      }
    });

    return stats;
  };

  const stats = calculateStats();

  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    let minWeight = Infinity;
    let maxWeight = -Infinity;
    
    // Find min and max from ONLY weight values
    chartData.forEach(dataPoint => {
      selectedHives.forEach(hiveNumber => {
        const weight = dataPoint[`weight_${hiveNumber}`];
        
        if (weight !== null && weight !== undefined && !isNaN(weight)) {
          minWeight = Math.min(minWeight, weight);
          maxWeight = Math.max(maxWeight, weight);
        }
      });
    });
    
    // If no valid data found, use default range
    if (minWeight === Infinity || maxWeight === -Infinity) {
      return [0, 100];
    }
    
    // TIGHT padding for precise weight visualization
    const range = maxWeight - minWeight;
    
    // Adaptive padding based on range
    let padding;
    if (range < 0.5) {
      padding = Math.max(range * 0.2, 0.05); // 20% padding for very small ranges, min 0.05kg
    } else if (range < 2) {
      padding = Math.max(range * 0.15, 0.1); // 15% padding for small ranges, min 0.1kg
    } else if (range < 5) {
      padding = range * 0.1; // 10% padding for moderate ranges
    } else {
      padding = Math.max(range * 0.08, 0.5); // 8% padding for large ranges, min 0.5kg
    }
    
    let domainMin = minWeight - padding;
    let domainMax = maxWeight + padding;
    
    // Keep minimum at 0 (weight can't be negative)
    domainMin = Math.max(0, domainMin);
    
    // Round to 2 decimal places for cleaner axis labels
    domainMin = Math.floor(domainMin * 100) / 100;
    domainMax = Math.ceil(domainMax * 100) / 100;
    
    console.log(`📊 Y-axis (Weight Only): [${domainMin.toFixed(2)}kg, ${domainMax.toFixed(2)}kg] (range: ${minWeight.toFixed(2)}kg - ${maxWeight.toFixed(2)}kg, span: ${range.toFixed(2)}kg)`);
    
    return [domainMin, domainMax];
  }, [chartData, selectedHives]);

  // Dark theme color palette for different hives
  const getColorPalette = (index: number, isTrend: boolean = false) => {
    // Always use amber for weight when viewing a single hive
    if (selectedHiveOnly !== null) {
      return isTrend ? '#34D399' : '#F59E0B';
    }
    
    const colors = [
      { weight: '#60A5FA', trend: '#34D399' }, // Light Blue/Emerald
      { weight: '#F87171', trend: '#FBBF24' }, // Light Red/Amber
      { weight: '#A78BFA', trend: '#FB7185' }, // Light Purple/Pink
      { weight: '#4ADE80', trend: '#FB923C' }, // Light Green/Orange
      { weight: '#22D3EE', trend: '#A3E635' }, // Light Cyan/Lime
    ];
    const colorSet = colors[index % colors.length];
    return isTrend ? colorSet.trend : colorSet.weight;
  };

  // Custom tooltip with dark theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl p-4 border border-blue-500/30 rounded-xl shadow-2xl">
          <p className="text-sm font-semibold text-white mb-3 pb-2 border-b border-blue-500/30">
            {new Date(label).toLocaleString()}
          </p>
          
          {payload
            .filter((entry: any) => entry.value !== null && entry.value !== undefined && !isNaN(entry.value))
            .map((entry: any, index: number) => {
              const parts = entry.dataKey.split('_');
              const hiveNumber = parts[parts.length - 1];
              const dataType = entry.dataKey.includes('trend') ? 'Change' : 'Weight';
              const rawKey = `raw_weight_${hiveNumber}`;
              
              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <p className="text-sm font-medium text-white">
                      Hive {hiveNumber} - {dataType}
                    </p>
                  </div>
                  <p className="text-lg font-bold ml-5" style={{ color: entry.color }}>
                    {dataType === 'Change' ? (
                      <>{entry.value >= 0 ? '+' : ''}{entry.value.toFixed(2)} kg</>
                    ) : (
                      <>{entry.value.toFixed(2)} kg</>
                    )}
                  </p>
                  {dataType === 'Weight' && data?.[rawKey] && (
                    <p className="text-xs text-white/40 ml-5">
                      Raw: {data[rawKey]}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      );
    }
    return null;
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
    
    console.log('🎯 X-axis ticks:', ticks.length, 'dates');
    
    return ticks;
  }, [chartData, timeRange]);

  // Handle hive selection toggle
  const toggleHive = (hiveNumber: number) => {
    setSelectedHives(prev => 
      prev.includes(hiveNumber) 
        ? prev.filter(num => num !== hiveNumber)
        : [...prev, hiveNumber]
    );
  };

  // Create legend items manually
  const getLegendItems = () => {
    const items: Array<{ label: string; color: string; hiveNumber?: number }> = [];
    
    selectedHives.forEach((hiveNumber, index) => {
      items.push({
        label: `Weight`,
        color: getColorPalette(index, false),
        hiveNumber: hiveNumber
      });
      
      if (showTrendState) {
        items.push({
          label: `Change`,
          color: getColorPalette(index, true),
          hiveNumber: hiveNumber
        });
      }
    });
    
    return items;
  };

  if (!data || data.length === 0) {
    console.log('❌ No data prop provided');
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <p className="text-white/60">No data available</p>
        </div>
      </div>
    );
  }

  if (filteredData.length === 0) {
    console.log('⚠️ No filtered data - showing empty state');
    
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="text-center">
            <p className="text-white/60 mb-2">No weight data available for selected time range</p>
            <p className="text-white/40 text-sm">Original data: {data.length} records</p>
            <p className="text-white/40 text-sm">Time range: {timeRange}</p>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    const debugInfo = filteredData.slice(0, 3).map(item => ({
      weight: item.weight,
      timestamp: item.timestamp
    }));
    
    console.log('⚠️ No chart data after processing');
    
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center h-64 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
          <p className="text-white/60 mb-4">No valid weight readings found</p>
          <details className="text-xs text-white/40">
            <summary className="cursor-pointer hover:text-white/60">Debug Info</summary>
            <pre className="mt-2 text-left overflow-auto max-h-32">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
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
        // Weight line
        lines.push(
          <Line
            key={`weight_${hiveNumber}`}
            type="monotone"
            dataKey={`weight_${hiveNumber}`}
            stroke={getColorPalette(index, false)}
            strokeWidth={3}
            dot={{ fill: getColorPalette(index, false), strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: getColorPalette(index, false), strokeWidth: 3 }}
            connectNulls={true}
            strokeDasharray={undefined}
          />
        );
        
        // Trend line (if enabled)
        if (showTrendState) {
          lines.push(
            <Line
              key={`trend_${hiveNumber}`}
              type="monotone"
              dataKey={`trend_${hiveNumber}`}
              stroke={getColorPalette(index, true)}
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              connectNulls={true}
            />
          );
        }
      });
      
      return lines;
    };

    const renderAreas = () => {
      const areas: React.ReactNode[] = [];
      
      selectedHives.forEach((hiveNumber, index) => {
        areas.push(
          <Area
            key={`weight_${hiveNumber}`}
            type="monotone"
            dataKey={`weight_${hiveNumber}`}
            stackId={`weight_${hiveNumber}`}
            stroke={getColorPalette(index, false)}
            fill={getColorPalette(index, false)}
            fillOpacity={0.3}
            strokeWidth={2}
          />
        );
      });
      
      return areas;
    };

    const renderScatters = () => {
      const scatters: React.ReactNode[] = [];
      
      selectedHives.forEach((hiveNumber, index) => {
        scatters.push(
          <Scatter 
            key={`weight_${hiveNumber}`}
            dataKey={`weight_${hiveNumber}`}
            fill={getColorPalette(index, false)}
          />
        );
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
  label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
  fontSize={11}
  stroke="rgba(255,255,255,0.6)"
  tick={{ fill: 'rgba(255,255,255,0.6)' }}
  tickFormatter={(value: number) => value.toFixed(2)}
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
  label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
  fontSize={11}
  stroke="rgba(255,255,255,0.6)"
  tick={{ fill: 'rgba(255,255,255,0.6)' }}
  tickFormatter={(value: number) => value.toFixed(2)}
/>
            <Tooltip content={<CustomTooltip />} />
            {renderScatters()}
          </ScatterChart>
        );

      default: // line chart
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
  label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.6)' }}
  fontSize={11}
  stroke="rgba(255,255,255,0.6)"
  tick={{ fill: 'rgba(255,255,255,0.6)' }}
  tickFormatter={(value: number) => value.toFixed(2)}
/>
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference line for minimum weight */}
{Object.values(stats).length > 0 && (
  React.createElement(ReferenceLine as any, {
    y: Math.min(...Object.values(stats).map((s) => (s as any).min)),
    stroke: "#34D399",
    strokeDasharray: "3 3",
    strokeOpacity: 0.5
  })
)}
            
            {renderLines()}
          </LineChart>
        );
    }
  };

  const legendItems = getLegendItems();

  return (
    <div className="w-full bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        
        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-white/80">Time:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="24h" className="bg-slate-900">Last 24 Hours</option>
              <option value="7d" className="bg-slate-900">Last 7 Days</option>
              <option value="30d" className="bg-slate-900">Last 30 Days</option>
              <option value="all" className="bg-slate-900">All Data</option>
            </select>
          </div>

          

          {/* Stats Summary */}
          <div className="ml-auto flex items-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              {chartData.length} points
            </span>
            
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 pb-6">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
        {/* Custom Legend - Inside chart container */}
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
      
      

     {/* Status Footer with Weight Changes */}
      {Object.keys(stats).length > 0 && (
        <div className="flex flex-wrap justify-end gap-3 text-xs mt-4 pt-4 border-t border-white/10">
          {Object.entries(stats).map(([hiveNumberStr, stat]: [string, any]) => {
            const hiveNumber = parseInt(hiveNumberStr);
            return (
              <div key={hiveNumber} className="flex items-center gap-2">
                <span className="text-white/60">H{hiveNumber}:</span>
                <span className={stat.trend === 'increasing' ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                  {stat.trend === 'increasing' ? '↑' : '↓'} {Math.abs(stat.totalChange).toFixed(2)}kg
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
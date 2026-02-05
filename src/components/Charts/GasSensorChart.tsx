// app/components/Charts/GasSensorChart.tsx
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
  ReferenceLine,
  Legend
} from 'recharts';
import { SensorData } from '../../lib/types';
import { 
  groupByTimestamp, 
  extractSharedValues,
  toNumber 
} from '../../lib/hiveDataUtils';

interface GasSensorChartProps {
  data: SensorData[];
  containerId?: string;
  title?: string;
  height?: number;
  selectedHiveOnly?: number | null;
  gasType?: 'all' | 'toxic' | 'air-quality' | 'greenhouse';
}

// Gas configuration type
interface GasConfig {
  name: string;
  unit: string;
  color: string;
  safeMin?: number;
  safeMax?: number;
  dangerThreshold?: number;
  type: 'toxic' | 'air-quality' | 'greenhouse';
  fields: string[];
}

// Gas configurations with safe ranges and units
const GAS_CONFIGS: Record<string, GasConfig> = {
  H2S: { 
    name: 'Hydrogen Sulfide', 
    unit: 'ppm', 
    color: '#dc2626', 
    safeMax: 10,
    dangerThreshold: 20,
    type: 'toxic',
    fields: ['H2S', 'h2s', 'hydrogen_sulfide']
  },
  CO2: { 
    name: 'Carbon Dioxide', 
    unit: 'ppm', 
    color: '#f59e0b', 
    safeMax: 1000,
    dangerThreshold: 5000,
    type: 'greenhouse',
    fields: ['CO2', 'co2', 'carbon_dioxide']
  },
  O2: { 
    name: 'Oxygen', 
    unit: '%', 
    color: '#10b981', 
    safeMin: 19.5,
    safeMax: 23.5,
    dangerThreshold: 25,
    type: 'air-quality',
    fields: ['O2', 'o2', 'oxygen']
  },
  eCO2: { 
    name: 'Equivalent CO2', 
    unit: 'ppm', 
    color: '#f97316', 
    safeMax: 1000,
    dangerThreshold: 2000,
    type: 'air-quality',
    fields: ['eCO2', 'eco2', 'equivalent_co2', 'eCo2']
  },
  TVOC: { 
    name: 'Total VOC', 
    unit: 'ppb', 
    color: '#8b5cf6', 
    safeMax: 220,
    dangerThreshold: 660,
    type: 'air-quality',
    fields: ['TVOC', 'tvoc', 'total_voc']
  },
  CO: { 
    name: 'Carbon Monoxide', 
    unit: 'ppm', 
    color: '#ef4444', 
    safeMax: 9,
    dangerThreshold: 35,
    type: 'toxic',
    fields: ['CO', 'co', 'carbon_monoxide']
  },
  NH3: { 
    name: 'Ammonia', 
    unit: 'ppm', 
    color: '#06b6d4', 
    safeMax: 25,
    dangerThreshold: 50,
    type: 'toxic',
    fields: ['NH3', 'nh3', 'ammonia']
  },
  NO2: { 
    name: 'Nitrogen Dioxide', 
    unit: 'ppm', 
    color: '#ec4899', 
    safeMax: 1,
    dangerThreshold: 5,
    type: 'toxic',
    fields: ['NO2', 'no2', 'nitrogen_dioxide']
  },
  VOCindex: { 
    name: 'VOC Index', 
    unit: 'index', 
    color: '#a855f7', 
    safeMax: 100,
    dangerThreshold: 250,
    type: 'air-quality',
    fields: ['VOCindex', 'voc_index', 'vocIndex', 'VOC_index']
  }
};

export default function GasSensorChart({ 
  data,
  containerId,
  title = "Gas Sensor Monitoring",
  height = 400,
  selectedHiveOnly = null,
  gasType = 'all'
}: GasSensorChartProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [selectedGases, setSelectedGases] = useState<string[]>(Object.keys(GAS_CONFIGS));
  const [viewMode, setViewMode] = useState<'combined' | 'separate'>('combined');
  const [useSampleData, setUseSampleData] = useState(true);

  // Filter gases by type
  const availableGases = useMemo(() => {
    return Object.entries(GAS_CONFIGS).filter(([key, config]) => {
      if (gasType === 'all') return true;
      return config.type === gasType;
    }).map(([key]) => key);
  }, [gasType]);

  // Initialize selected gases based on gas type
  useEffect(() => {
    setSelectedGases(availableGases);
  }, [gasType, availableGases]);

  const uniqueHiveNumbers = useMemo(() => {
    if (selectedHiveOnly !== null) {
      return [selectedHiveOnly];
    }
    
    const timestampGroups = new Map<string, number>();
    data.forEach(item => {
      const timestamp = item.timestamp || new Date().toISOString();
      const count = timestampGroups.get(timestamp) || 0;
      timestampGroups.set(timestamp, count + 1);
    });
    
    const maxHives = Math.max(...Array.from(timestampGroups.values()), 0);
    return Array.from({ length: maxHives }, (_, i) => i + 1);
  }, [data, selectedHiveOnly]);

  // Get gas value from item using multiple possible field names
  const getGasValue = (item: any, gasKey: string): number | null => {
    const config = GAS_CONFIGS[gasKey];
    if (!config) return null;

    for (const field of config.fields) {
      const value = toNumber(item[field]);
      if (value !== null) return value;
    }
    return null;
  };

  // Generate sample data for gas sensors
  const generateSampleData = useMemo(() => {
    const now = new Date();
    const samples: any[] = [];
    
    // Generate 48 hours of data (one reading every hour)
    for (let i = 47; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      uniqueHiveNumbers.forEach((hiveNumber) => {
        const dataPoint: any = {
          timestamp: timestamp.toISOString(),
          id: hiveNumber,
          hive_id: hiveNumber
        };
        
        // Generate realistic gas values with some variation
        const timeOfDay = timestamp.getHours();
        const isDay = timeOfDay >= 6 && timeOfDay <= 18;
        
        // H2S - Low levels, occasional spikes
        dataPoint.H2S = Math.max(0, 2 + Math.random() * 3 + (Math.random() > 0.95 ? 10 : 0));
        
        // CO2 - Higher during day (bee activity)
        dataPoint.CO2 = isDay 
          ? 800 + Math.random() * 400 + Math.sin(i / 12) * 200
          : 600 + Math.random() * 200;
        
        // O2 - Stable around 20-21%
        dataPoint.O2 = 20.5 + Math.random() * 1 - 0.5;
        
        // eCO2 - Correlated with CO2
        dataPoint.eCO2 = dataPoint.CO2 * 0.9 + Math.random() * 100;
        
        // TVOC - Variable, higher during day
        dataPoint.TVOC = isDay 
          ? 150 + Math.random() * 150
          : 80 + Math.random() * 80;
        
        // CO - Low levels
        dataPoint.CO = 2 + Math.random() * 3;
        
        // NH3 - Moderate levels with variation
        dataPoint.NH3 = 15 + Math.random() * 15 + Math.sin(i / 6) * 5;
        
        // NO2 - Very low levels
        dataPoint.NO2 = 0.3 + Math.random() * 0.4;
        
        // VOC Index - Composite score
        dataPoint.VOCindex = 80 + Math.random() * 60 + (isDay ? 20 : 0);
        
        samples.push(dataPoint);
      });
    }
    
    return samples;
  }, [uniqueHiveNumbers]);

  // Use sample data instead of real data
  const dataToUse = useSampleData ? generateSampleData : data;

  const filteredData = useMemo(() => {
    if (!dataToUse || dataToUse.length === 0) return [];
    if (timeRange === 'all') return dataToUse;
    
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
    
    return dataToUse.filter(item => {
      const timestampValue = item.timestamp || item._metadata?.lastModified;
      if (!timestampValue) return false;
      const itemTime = new Date(timestampValue);
      return !isNaN(itemTime.getTime()) && itemTime >= cutoffTime;
    });
  }, [dataToUse, timeRange]);

  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const timestampGroups = groupByTimestamp(filteredData);

    const dataPoints = Array.from(timestampGroups.entries()).map(([timeKey, itemsWithIndex]) => {
      const dataPoint: any = {
        timestamp: timeKey,
        validDataPoints: 0
      };
      
      uniqueHiveNumbers.forEach((hiveNumber) => {
        const itemIndex = hiveNumber - 1;
        const itemData = itemsWithIndex[itemIndex];
        const item = itemData?.item;
        
        if (item) {
          selectedGases.forEach(gasKey => {
            const value = getGasValue(item, gasKey);
            if (value !== null) {
              dataPoint[`${gasKey}_${hiveNumber}`] = value;
              dataPoint.validDataPoints++;
            }
          });
        }
      });
      
      return dataPoint;
    });

    return dataPoints
      .filter(item => item.validDataPoints > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [filteredData, selectedGases, uniqueHiveNumbers]);

  // Calculate appropriate Y-axis domains for each gas type
  const getYAxisDomain = (gasKey: string) => {
    const config = GAS_CONFIGS[gasKey];
    if (!config) return ['auto', 'auto'];

    let minVal = Infinity;
    let maxVal = -Infinity;

    chartData.forEach(dataPoint => {
      uniqueHiveNumbers.forEach(hiveNumber => {
        const value = dataPoint[`${gasKey}_${hiveNumber}`];
        if (value !== null && value !== undefined && !isNaN(value)) {
          minVal = Math.min(minVal, value);
          maxVal = Math.max(maxVal, value);
        }
      });
    });

    if (minVal === Infinity || maxVal === -Infinity) {
      const defaultMax = config.dangerThreshold || config.safeMax || 100;
      return [0, defaultMax];
    }

    const range = maxVal - minVal;
    const defaultMax = config.dangerThreshold || config.safeMax || 100;
    const padding = Math.max(range * 0.1, defaultMax * 0.05);
    
    return [
      Math.max(0, Math.floor(minVal - padding)),
      Math.ceil(maxVal + padding)
    ];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-gray-200 p-4 rounded-xl shadow-2xl max-w-xs">
          <p className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            {new Date(label).toLocaleString()}
          </p>
          
          {payload
            .filter((entry: any) => entry.value !== null && entry.value !== undefined && !isNaN(entry.value))
            .map((entry: any, index: number) => {
              const parts = entry.dataKey.split('_');
              const hiveNumber = parts[parts.length - 1];
              const gasKey = parts.slice(0, -1).join('_');
              const config = GAS_CONFIGS[gasKey];
              
              if (!config) return null;

              const value = entry.value;
              const isDanger = config.dangerThreshold && value > config.dangerThreshold;
              const isWarning = config.safeMax && value > config.safeMax && !isDanger;
              
              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <p className="text-sm font-medium text-gray-900">
                      Hive {hiveNumber} - {config.name}
                      {isDanger && <span className="ml-1 text-red-600">⚠️</span>}
                      {isWarning && <span className="ml-1 text-yellow-600">⚡</span>}
                    </p>
                  </div>
                  <p className="text-lg font-bold ml-5" style={{ color: entry.color }}>
                    {value.toFixed(2)} {config.unit}
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

  const toggleGas = (gasKey: string) => {
    // Prevent deselecting all gases
    if (selectedGases.includes(gasKey) && selectedGases.length === 1) {
      return; // Don't allow deselecting the last gas
    }
    
    setSelectedGases(prev => 
      prev.includes(gasKey) 
        ? prev.filter(g => g !== gasKey)
        : [...prev, gasKey]
    );
  };

  if (!dataToUse || dataToUse.length === 0) {
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">No gas sensor data available</p>
          <button
            onClick={() => setUseSampleData(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all"
          >
            Load Sample Data
          </button>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-gray-500">No valid gas readings found for selected time range</p>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    return (
      <LineChart 
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
        <XAxis 
          dataKey="timestamp"
          tickFormatter={formatXAxisLabel}
          angle={-45}
          textAnchor="end"
          height={80}
          fontSize={11}
          stroke="rgba(0,0,0,0.6)"
          tick={{ fill: 'rgba(0,0,0,0.6)' }}
        />
        <YAxis 
          label={{ value: 'Concentration', angle: -90, position: 'insideLeft', fill: 'rgba(0,0,0,0.6)' }}
          fontSize={11}
          stroke="rgba(0,0,0,0.6)"
          tick={{ fill: 'rgba(0,0,0,0.6)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {selectedGases.map(gasKey => {
          const config = GAS_CONFIGS[gasKey];
          return uniqueHiveNumbers.map(hiveNumber => (
            <Line
              key={`${gasKey}_${hiveNumber}`}
              type="monotone"
              dataKey={`${gasKey}_${hiveNumber}`}
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={true}
            />
          ));
        })}
      </LineChart>
    );
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-xl p-6 border border-gray-200">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Time:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Data</option>
            </select>
          </div>

          

          <div className="ml-auto flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              {chartData.length} points
            </span>
          </div>
        </div>

        {/* Gas selection buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
          {availableGases.map(gasKey => {
            const config = GAS_CONFIGS[gasKey];
            const isSelected = selectedGases.includes(gasKey);
            const isOnlySelected = isSelected && selectedGases.length === 1;
            
            return (
              <button
                key={gasKey}
                onClick={() => toggleGas(gasKey)}
                disabled={isOnlySelected}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected 
                    ? 'bg-gray-100 border-2 text-gray-900' 
                    : 'bg-gray-50 border text-gray-500 hover:bg-gray-100'
                } ${isOnlySelected ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                style={{ 
                  borderColor: isSelected ? config.color : 'rgba(0,0,0,0.1)'
                }}
                title={isOnlySelected ? 'At least one gas must be selected' : `Toggle ${config.name}`}
              >
                <span className="flex items-center gap-1.5">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: config.color }}
                  />
                  {config.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
// app/components/Charts/HiveHealthIndex.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { 
  RadialBarChart, 
  RadialBar, 
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart
} from 'recharts';
import { SensorData } from '../../lib/types';
import { 
  getTemperature, 
  getHumidity, 
  getWeight,
  toNumber,
  getHiveData
} from '../../lib/hiveDataUtils';

interface HiveHealthIndexProps {
  data: SensorData[];
  historicalData: SensorData[];
  containerId?: string;
  selectedHiveOnly?: number | null;
  title?: string;
  height?: number;
}

interface HealthScore {
  category: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  details: string;
}

interface HiveHealthData {
  hiveNumber: number;
  overallHealth: number;
  scores: HealthScore[];
  status: 'excellent' | 'good' | 'warning' | 'critical';
  lastUpdated: string;
}

export default function HiveHealthIndex({
  data,
  historicalData,
  containerId,
  selectedHiveOnly = null,
  title = "Hive Health Index",
  height = 400
}: HiveHealthIndexProps) {
  const [viewMode, setViewMode] = useState<'radial' | 'trend'>('radial');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Calculate health score for a single hive
  const calculateHiveHealth = (hiveNumber: number): HiveHealthData => {
    const hiveData = getHiveData([...historicalData, ...data], hiveNumber);
    const latestData = hiveData.length > 0 ? hiveData[hiveData.length - 1] : null;

    if (!latestData) {
      return {
        hiveNumber,
        overallHealth: 0,
        scores: [],
        status: 'critical',
        lastUpdated: new Date().toISOString()
      };
    }

    const scores: HealthScore[] = [];

    // 1. Temperature Score (25 points)
    const temp = getTemperature(latestData, 'internal');
    let tempScore = 0;
    let tempStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
    let tempDetails = 'No data';

    if (temp !== null) {
      if (temp >= 34 && temp <= 36) {
        tempScore = 25;
        tempStatus = 'excellent';
        tempDetails = 'Optimal brood temperature';
      } else if (temp >= 32 && temp < 34 || temp > 36 && temp <= 38) {
        tempScore = 20;
        tempStatus = 'good';
        tempDetails = 'Acceptable temperature range';
      } else if (temp >= 30 && temp < 32 || temp > 38 && temp <= 40) {
        tempScore = 10;
        tempStatus = 'warning';
        tempDetails = 'Temperature suboptimal';
      } else {
        tempScore = 0;
        tempStatus = 'critical';
        tempDetails = 'Temperature dangerous';
      }
    }

    scores.push({
      category: 'Temperature',
      score: tempScore,
      maxScore: 25,
      status: tempStatus,
      details: tempDetails
    });

    // 2. Humidity Score (20 points)
    const humidity = getHumidity(latestData, 'internal');
    let humScore = 0;
    let humStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
    let humDetails = 'No data';

    if (humidity !== null) {
      if (humidity >= 50 && humidity <= 60) {
        humScore = 20;
        humStatus = 'excellent';
        humDetails = 'Ideal humidity level';
      } else if (humidity >= 45 && humidity < 50 || humidity > 60 && humidity <= 70) {
        humScore = 15;
        humStatus = 'good';
        humDetails = 'Acceptable humidity';
      } else if (humidity >= 40 && humidity < 45 || humidity > 70 && humidity <= 80) {
        humScore = 8;
        humStatus = 'warning';
        humDetails = 'Humidity suboptimal';
      } else {
        humScore = 0;
        humStatus = 'critical';
        humDetails = 'Humidity dangerous';
      }
    }

    scores.push({
      category: 'Humidity',
      score: humScore,
      maxScore: 20,
      status: humStatus,
      details: humDetails
    });

    // 3. Weight Trend Score (25 points)
    const recentHiveData = hiveData.slice(-7);
    let weightScore = 0;
    let weightStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
    let weightDetails = 'No data';

    if (recentHiveData.length >= 2) {
      const weights = recentHiveData.map(d => getWeight(d)).filter(w => w !== null) as number[];
      
      if (weights.length >= 2) {
        const firstWeight = weights[0];
        const lastWeight = weights[weights.length - 1];
        const weightChange = lastWeight - firstWeight;
        const changePercent = (weightChange / firstWeight) * 100;

        if (weightChange > 0 && changePercent > 2) {
          weightScore = 25;
          weightStatus = 'excellent';
          weightDetails = `Gaining weight (+${weightChange.toFixed(1)}kg)`;
        } else if (weightChange > 0 || Math.abs(changePercent) < 2) {
          weightScore = 20;
          weightStatus = 'good';
          weightDetails = 'Weight stable';
        } else if (changePercent < -2 && changePercent > -5) {
          weightScore = 10;
          weightStatus = 'warning';
          weightDetails = `Losing weight (${weightChange.toFixed(1)}kg)`;
        } else {
          weightScore = 5;
          weightStatus = 'critical';
          weightDetails = `Rapid weight loss (${weightChange.toFixed(1)}kg)`;
        }
      }
    }

    scores.push({
      category: 'Weight Trend',
      score: weightScore,
      maxScore: 25,
      status: weightStatus,
      details: weightDetails
    });

    // 4. Activity Score (15 points)
    const timestamp = latestData.timestamp || latestData._metadata?.lastModified;
    let activityScore = 0;
    let activityStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
    let activityDetails = 'No recent data';

    if (timestamp) {
      const now = new Date();
      const dataTime = new Date(timestamp);
      const hoursSinceUpdate = (now.getTime() - dataTime.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate < 1) {
        activityScore = 15;
        activityStatus = 'excellent';
        activityDetails = 'Active (updated recently)';
      } else if (hoursSinceUpdate < 4) {
        activityScore = 12;
        activityStatus = 'good';
        activityDetails = 'Active (updated < 4h ago)';
      } else if (hoursSinceUpdate < 12) {
        activityScore = 6;
        activityStatus = 'warning';
        activityDetails = 'Low activity';
      } else {
        activityScore = 0;
        activityStatus = 'critical';
        activityDetails = 'No recent activity';
      }
    }

    scores.push({
      category: 'Activity',
      score: activityScore,
      maxScore: 15,
      status: activityStatus,
      details: activityDetails
    });

    // 5. Environmental Score (15 points)
    let envScore = 0;
    let envStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
    let envDetails = 'No data';

    if (recentHiveData.length >= 3) {
      const temps = recentHiveData
        .map(d => getTemperature(d, 'internal'))
        .filter(t => t !== null) as number[];

      if (temps.length >= 3) {
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        const variance = temps.reduce((sum, t) => sum + Math.pow(t - avgTemp, 2), 0) / temps.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev < 1) {
          envScore = 15;
          envStatus = 'excellent';
          envDetails = 'Very stable temperature';
        } else if (stdDev < 2) {
          envScore = 12;
          envStatus = 'good';
          envDetails = 'Stable temperature';
        } else if (stdDev < 3) {
          envScore = 6;
          envStatus = 'warning';
          envDetails = 'Temperature fluctuating';
        } else {
          envScore = 0;
          envStatus = 'critical';
          envDetails = 'Unstable temperature';
        }
      }
    }

    scores.push({
      category: 'Stability',
      score: envScore,
      maxScore: 15,
      status: envStatus,
      details: envDetails
    });

    const overallHealth = scores.reduce((sum, s) => sum + s.score, 0);
    
    let overallStatus: 'excellent' | 'good' | 'warning' | 'critical';
    if (overallHealth >= 85) overallStatus = 'excellent';
    else if (overallHealth >= 70) overallStatus = 'good';
    else if (overallHealth >= 50) overallStatus = 'warning';
    else overallStatus = 'critical';

    return {
      hiveNumber,
      overallHealth,
      scores,
      status: overallStatus,
      lastUpdated: timestamp || new Date().toISOString()
    };
  };

  const uniqueHiveNumbers = useMemo(() => {
    if (selectedHiveOnly !== null) return [selectedHiveOnly];

    const allData = [...historicalData, ...data];
    const hiveIds = new Set(
      allData.map(item => item.id).filter(id => id !== null && id !== undefined)
    );
    
    return Array.from(hiveIds).sort((a, b) => a - b);
  }, [data, historicalData, selectedHiveOnly]);

  const hivesHealth = useMemo(() => {
    return uniqueHiveNumbers.map(hiveNum => calculateHiveHealth(hiveNum));
  }, [uniqueHiveNumbers, data, historicalData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'excellent': return '🟢';
      case 'good': return '🔵';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  };

  const renderRadialView = () => {
    return (
      <div className="w-full px-6 py-6">
        {hivesHealth.map((hive) => {
          const radialData = [
            {
              name: 'Health',
              value: hive.overallHealth,
              fill: getStatusColor(hive.status)
            }
          ];

          return (
            <div key={hive.hiveNumber} className="w-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-bold text-gray-900">Hive {hive.hiveNumber}</h4>
                <span className="text-3xl">{getStatusEmoji(hive.status)}</span>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Left: Radial Chart */}
                <div className="flex flex-col items-center">
                  <div className="relative w-56 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="100%"
                        data={radialData}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar
                          background
                          dataKey="value"
                          cornerRadius={10}
                          fill={getStatusColor(hive.status)}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-5xl font-bold text-gray-900">
                        {hive.overallHealth}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Health Score</div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-6">
                    <span 
                      className="px-6 py-2 rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: getStatusColor(hive.status) }}
                    >
                      {hive.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Right: Score Breakdown */}
                <div className="space-y-4">
                  {hive.scores.map((score, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-900 text-base font-medium">
                          {score.category}
                        </span>
                        <span className="text-gray-900 font-bold text-base">
                          {score.score}/{score.maxScore}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(score.score / score.maxScore) * 100}%`,
                            backgroundColor: getStatusColor(score.status)
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {score.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Updated */}
              <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
                Updated {new Date(hive.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (hivesHealth.length === 0) {
    return (
      <div className="w-full h-full bg-white rounded-xl shadow-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">No hive data available to calculate health index</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Average Health:</span>
            <span className="text-xl font-bold text-gray-900">
              {Math.round(hivesHealth.reduce((sum, h) => sum + h.overallHealth, 0) / hivesHealth.length)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Excellent (85-100)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Good (70-84)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">Warning (50-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Critical (0-49)</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderRadialView()}
      </div>
    </div>
  );
}
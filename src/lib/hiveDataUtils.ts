// lib/hiveDataUtils.ts
// Utility functions for processing hive sensor data across all charts

import { SensorData } from '../lib/types';

/**
 * Safely convert any value to a number
 */
export const toNumber = (value: any): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Group data by timestamp and preserve original array index
 * This is critical for maintaining hive identity across readings
 */
export const groupByTimestamp = (data: SensorData[]) => {
  const timestampGroups = new Map<string, Array<{item: SensorData, originalIndex: number}>>();
  
  data.forEach((item, originalIndex) => {
    const timestamp = item.timestamp || item._metadata?.lastModified || new Date().toISOString();
    const timeKey = new Date(timestamp).toISOString();
    
    if (!timestampGroups.has(timeKey)) {
      timestampGroups.set(timeKey, []);
    }
    
    timestampGroups.get(timeKey)!.push({ item, originalIndex });
  });

  // Sort items within each timestamp group by original index
  timestampGroups.forEach((items) => {
    items.sort((a, b) => a.originalIndex - b.originalIndex);
  });

  return timestampGroups;
};

/**
 * Get unique hive numbers from the data
 * Hive number = array index + 1 (first row = Hive 1, second row = Hive 2, etc.)
 */
export const getUniqueHiveNumbers = (data: SensorData[]): number[] => {
  if (!data || data.length === 0) return [];
  
  const timestampGroups = new Map<string, number>();
  data.forEach(item => {
    const timestamp = item.timestamp || new Date().toISOString();
    const count = timestampGroups.get(timestamp) || 0;
    timestampGroups.set(timestamp, count + 1);
  });
  
  const maxHives = Math.max(...Array.from(timestampGroups.values()), 0);
  return Array.from({ length: maxHives }, (_, i) => i + 1);
};

/**
 * Get data for a specific hive based on its position in the array
 * @param data - Full dataset
 * @param hiveNumber - Hive number (1-based index)
 * @returns Array of data points for the specified hive
 */
export const getHiveData = (data: SensorData[], hiveNumber: number): SensorData[] => {
  if (!data || data.length === 0) return [];
  
  // Check if data has 'id' field (new format)
  const hasIdField = data.some(item => item.id !== undefined);
  
  if (hasIdField) {
    // 🔥 NEW FORMAT: Filter by ID field
    const hiveIndex = hiveNumber - 1; // 0-based index
    
    return data.filter(item => {
      // Use == for loose equality (handles string/number comparison)
      // eslint-disable-next-line eqeqeq
      return item.id == hiveIndex;
    }).sort((a, b) => {
      const timeA = new Date(a.timestamp || a._metadata?.lastModified || 0).getTime();
      const timeB = new Date(b.timestamp || b._metadata?.lastModified || 0).getTime();
      return timeA - timeB;
    });
  } else {
    // 🔥 OLD FORMAT: Use array position within timestamp groups
    const timestampGroups = groupByTimestamp(data);
    const hiveData: SensorData[] = [];
    
    timestampGroups.forEach((itemsWithIndex) => {
      const itemIndex = hiveNumber - 1;
      
      if (itemsWithIndex[itemIndex]) {
        hiveData.push(itemsWithIndex[itemIndex].item);
      }
    });

    return hiveData;
  }
};

/**
 * Extract a shared value that appears in ANY row at a given timestamp
 * (e.g., external temperature/humidity that's the same for all hives)
 */
export const extractSharedValues = <T extends keyof SensorData>(
  data: SensorData[],
  fieldNames: string[]
): Map<string, number> => {
  const timestampGroups = groupByTimestamp(data);
  const sharedValues = new Map<string, number>();
  
  Array.from(timestampGroups.entries()).forEach(([timeKey, itemsWithIndex]) => {
    // Search through ALL items to find one with the field
    for (const { item } of itemsWithIndex) {
      let foundValue: number | null = null;
      
      // Try all possible field names
      for (const fieldName of fieldNames) {
        const value = (item as any)[fieldName];
        
        if (value !== undefined && value !== null && value !== '') {
          const numValue = toNumber(value);
          if (numValue !== null) {
            foundValue = numValue;
            break;
          }
        }
      }
      
      if (foundValue !== null) {
        sharedValues.set(timeKey, foundValue);
        break; // Found it, stop searching
      }
    }
  });
  
  return sharedValues;
};

/**
 * Get temperature value from item with fallback field names
 */
export const getTemperature = (
  item: any,
  type: 'internal' | 'external',
  hiveNumber?: number
): number | null => {
  let value: any;
  
  if (type === 'internal') {
    value = item.int_temp || item.temp_internal || item.Internal_temp || 
            item.temperature_internal || item.tempInternal || item.inte_temp;
  } else {
    value = item.ext_temp || item.temp_external || item.external_temp || 
            item.temperature_external || item.tempExternal || item.exte_temp;
  }
  
  let temp = toNumber(value);
  
  if (temp == null) return null;
  if (temp === -127) return null; // Sensor error
  if (temp < -100 || temp > 100) return null;
  
  // 🔥 UNIVERSAL RULE: Force external temp to 0 if zero or negative
  if (type === 'external' && temp <= 0) {
    return 0;
  }
  
  // 🔥 UNIVERSAL RULE: Force internal temp to 0 if negative
  if (type === 'internal' && temp < 0) {
    return 0;
  }
  
  return temp;
};

/**
 * Get humidity value from item with fallback field names
 */
export const getHumidity = (
  item: any,
  type: 'internal' | 'external',
  hiveNumber?: number
): number | null => {
  let value: any;
  
  if (type === 'internal') {
    value = item.int_hum || item.hum_internal || item.Internal_hum || 
            item.humidity_internal || item.humInternal || item.inte_hum;
  } else {
    value = item.ext_hum || item.hum_external || item.external_hum || 
            item.humidity_external || item.humExternal || item.exte_hum;
  }
  
  let humidity = toNumber(value);
  
  if (humidity == null) return null;
  if (humidity < -50 || humidity > 150) return null;
  if (humidity < 0) humidity = 0;
  
  return humidity;
};

/**
 * Get weight value from item with fallback field names
 */
export const getWeight = (item: any): number | null => {
  const value = item.weight || item.Weight || item.weight_kg;
  const weight = toNumber(value);
  
  if (weight == null) return null;
  if (weight > 500) return null; // Max reasonable weight
  
  // 🔥 UNIVERSAL RULE: Convert negative weight to 0, keep zero as valid
  if (weight < 0) return 0;
  
  // 🔥 UNIVERSAL RULE: Show 0kg if weight is exactly 0 (don't treat as null)
  return weight;
};

/**
 * Get battery value from item with fallback field names
 */
export const getBattery = (item: any): number => {
  const value = item.battery || item.Battery || item.battery_level || 
                item.bat || item.batt;
  const battery = toNumber(value);
  
  // If no battery field exists, default to 100%
  if (battery == null) return 100;
  
  // Filter out invalid battery readings and default to 100%
  if (battery < 0 || battery > 200) return 100;
  
  return battery;
};

/**
 * Get last valid value with fallback to historical data
 * 🔥 UNIVERSAL FALLBACK: Search historical data for last known value when current is N/A
 */
export const getLastValidValue = (
  currentData: SensorData[],
  historicalData: SensorData[],
  hiveIndex: number,
  fieldGetter: (item: any) => number | null
): number | null => {
  // Try current data first
  const currentHiveData = getHiveData(currentData, hiveIndex + 1);
  if (currentHiveData.length > 0) {
    const latestItem = currentHiveData[currentHiveData.length - 1];
    const value = fieldGetter(latestItem);
    if (value !== null && value !== 0) {
      return value;
    }
  }
  
  // 🔥 FALLBACK: Search historical data backwards for last valid value
  const historicalHiveData = getHiveData(historicalData, hiveIndex + 1);
  for (let i = historicalHiveData.length - 1; i >= 0; i--) {
    const item = historicalHiveData[i];
    const value = fieldGetter(item);
    if (value !== null && value !== 0) {
      return value;
    }
  }
  
  return null;
};

/**
 * Format time range filters
 */
export const filterByTimeRange = (
  data: SensorData[],
  timeRange: '24h' | '7d' | '30d' | 'all'
): SensorData[] => {
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
  
  return data.filter(item => {
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
};

/**
 * Build chart data points for a specific metric across all or selected hives
 */
export const buildChartData = (
  data: SensorData[],
  selectedHiveNumbers: number[],
  metricExtractor: (item: SensorData, hiveNumber: number) => number | null,
  metricPrefix: string
) => {
  if (!data || data.length === 0) return [];
  
  const timestampGroups = groupByTimestamp(data);
  
  const chartData = Array.from(timestampGroups.entries()).map(([timeKey, itemsWithIndex]) => {
    const dataPoint: any = {
      timestamp: timeKey,
      validDataPoints: 0
    };
    
    // Process ONLY the selected hives
    selectedHiveNumbers.forEach((hiveNumber) => {
      const itemIndex = hiveNumber - 1;
      const itemData = itemsWithIndex[itemIndex];
      const item = itemData?.item;
      
      if (item) {
        const value = metricExtractor(item, hiveNumber);
        if (value !== null) {
          dataPoint[`${metricPrefix}_${hiveNumber}`] = value;
          dataPoint.validDataPoints++;
        }
      }
    });
    
    return dataPoint;
  });
  
  return chartData
    .filter(item => item.validDataPoints > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
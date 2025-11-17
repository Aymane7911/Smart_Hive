// lib/fieldMapping.ts
/**
 * Unified field mapping utility to handle different CSV formats
 * Supports both old and new Azure Storage CSV formats
 */

import { SensorData } from './types'; // ✅ Use the main SensorData type

/**
 * Helper to safely convert to number
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
 * Get temperature value from various field names
 */
export const getTemperature = (item: any, type: 'internal' | 'external'): number | null => {
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
  if (temp < 0) temp = 0;
  
  return temp;
};

/**
 * Get humidity value from various field names
 */
export const getHumidity = (item: any, type: 'internal' | 'external'): number | null => {
  let value: any;
  
  if (type === 'internal') {
    value = item.int_hum || item.hum_internal || item.Internal_hum || 
            item.humidity_internal || item.humInternal || item.inte_hum;
  } else {
    value = item.ext_hum || item.hum_external || item.external_hum || 
            item.humidity_external || item.humExternal || item.exte_hum;
  }
  
  const humidity = toNumber(value);
  
  if (humidity == null) return null;
  if (humidity < -50 || humidity > 150) return null;
  if (humidity < 0) return 0;
  
  return humidity;
};

/**
 * Get weight value from various field names
 */
export const getWeight = (item: any): number | null => {
  const value = item.weight || item.Weight || item.weight_kg;
  const weight = toNumber(value);
  
  if (weight == null) return null;
  if (weight > 500) return null;
  if (weight <= 0) return null;
  
  return weight;
};

/**
 * Get battery value from various field names
 */
export const getBattery = (item: any): number | null => {
  const value = item.battery || item.Battery || item.battery_level;
  const battery = toNumber(value);
  
  if (battery == null) return null;
  if (battery < 0 || battery > 200) return null;
  
  return battery;
};

/**
 * Get timestamp from various field names and formats
 * This is CRITICAL for the new format where 'time' is used instead of 'timestamp'
 */
export const getTimestamp = (item: any): string => {
  // Priority order for timestamp fields
  const timestampValue = 
    item.timestamp || 
    item.time ||  // NEW FORMAT uses 'time'
    item._metadata?.lastModified || 
    new Date().toISOString();
  
  // Handle Excel date serial numbers (like 45678.123456)
  if (typeof timestampValue === 'number') {
    // Excel date serial number (days since 1900-01-01)
    const date = new Date((timestampValue - 25569) * 86400 * 1000);
    return date.toISOString();
  }
  
  // Handle string timestamps
  if (typeof timestampValue === 'string') {
    // If it looks like an Excel formula result (########), use current time
    if (timestampValue.includes('#')) {
      console.warn('Invalid timestamp format detected:', timestampValue);
      return new Date().toISOString();
    }
    
    // Try to parse as date
    const parsed = new Date(timestampValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  
  // Fallback to current time
  console.warn('Could not parse timestamp, using current time:', timestampValue);
  return new Date().toISOString();
};

/**
 * Get hive identification from various field names
 */
const getHiveId = (item: any): number => {
  // Try multiple possible field names
  const id = item.id || item.hiveNumber || item.hive_number || item.sensor_id || item.device_id;
  
  // Convert to number
  if (typeof id === 'number') return id;
  if (typeof id === 'string') {
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? 1 : parsed; // Default to 1 if invalid
  }
  
  return 1; // Default hive ID
};

/**
 * Get location data from various field names
 */
const getLocation = (item: any): { lat?: number; lon?: number } => {
  const lat = toNumber(item.lat || item.latitude || item.Latitude);
  const lon = toNumber(item.lon || item.longitude || item.Longitude);
  
  return {
    lat: lat !== null ? lat : undefined,
    lon: lon !== null ? lon : undefined
  };
};

/**
 * Normalize sensor data to ensure consistent field names
 * This transforms the new format into the format expected by charts
 */
export const normalizeSensorData = (item: any): SensorData => {
  const location = getLocation(item);
  const tempInternal = getTemperature(item, 'internal');
  const tempExternal = getTemperature(item, 'external');
  const humInternal = getHumidity(item, 'internal');
  const humExternal = getHumidity(item, 'external');
  const weight = getWeight(item);
  const battery = getBattery(item);
  
  const normalized: SensorData = {
    id: getHiveId(item), // ✅ Ensure id is always a number
    hiveNumber: item.hiveNumber || item.hive_number,
    hiveName: item.hiveName || item.hive_name,
    isMaster: item.isMaster || item.is_master || false,
    
    // Ensure timestamp field exists (critical fix for new format)
    timestamp: getTimestamp(item),
    
    // Normalize temperature fields
    temp_internal: tempInternal !== null ? tempInternal : undefined,
    temp_external: tempExternal !== null ? tempExternal : undefined,
    
    // Normalize humidity fields
    hum_internal: humInternal !== null ? humInternal : undefined,
    hum_external: humExternal !== null ? humExternal : undefined,
    
    // Normalize weight field
    weight: weight !== null ? weight : undefined,
    
    // Normalize battery field
    battery: battery !== null ? battery : undefined,
    
    // Normalize location fields
    lat: location.lat,
    lon: location.lon,
    
    // Additional fields
    filename: item.filename || item.source || item._metadata?.blobName,
    sensor_id: item.sensor_id || item.sensorId,
    device_id: item.device_id || item.deviceId,
    
    // Preserve metadata
    _metadata: item._metadata
  };
  
  return normalized;
};

/**
 * Normalize an array of sensor data
 */
export const normalizeSensorDataArray = (data: any[]): SensorData[] => {
  if (!data || !Array.isArray(data)) {
    console.warn('Invalid data provided to normalizeSensorDataArray');
    return [];
  }
  
  const normalized = data.map(item => normalizeSensorData(item));
  
  console.log(`✅ Normalized ${normalized.length} sensor data records`);
  
  if (normalized.length > 0) {
    console.log('📊 Sample normalized data:', {
      id: normalized[0].id,
      timestamp: normalized[0].timestamp,
      temp_internal: normalized[0].temp_internal,
      temp_external: normalized[0].temp_external,
      hum_internal: normalized[0].hum_internal,
      weight: normalized[0].weight,
      battery: normalized[0].battery
    });
  }
  
  return normalized;
};

/**
 * Detect CSV format and provide information
 */
export const detectCSVFormat = (data: any[]): {
  format: 'new' | 'old' | 'unknown';
  hasTimeField: boolean;
  hasTimestampField: boolean;
  hasNewTempFields: boolean;
  hasOldTempFields: boolean;
} => {
  if (!data || data.length === 0) {
    return {
      format: 'unknown',
      hasTimeField: false,
      hasTimestampField: false,
      hasNewTempFields: false,
      hasOldTempFields: false
    };
  }
  
  const sample = data[0];
  
  const hasTimeField = 'time' in sample;
  const hasTimestampField = 'timestamp' in sample;
  const hasNewTempFields = 'int_temp' in sample || 'ext_temp' in sample;
  const hasOldTempFields = 'temp_internal' in sample || 'temp_external' in sample;
  
  let format: 'new' | 'old' | 'unknown' = 'unknown';
  
  if (hasTimeField && hasNewTempFields) {
    format = 'new';
  } else if (hasTimestampField && hasOldTempFields) {
    format = 'old';
  } else if (hasNewTempFields) {
    format = 'new';
  } else if (hasOldTempFields) {
    format = 'old';
  }
  
  console.log(`📋 Detected CSV format: ${format}`, {
    hasTimeField,
    hasTimestampField,
    hasNewTempFields,
    hasOldTempFields
  });
  
  return {
    format,
    hasTimeField,
    hasTimestampField,
    hasNewTempFields,
    hasOldTempFields
  };
};
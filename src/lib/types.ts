// lib/types.ts - Enhanced types for your dashboard

// Core sensor data interface
export interface SensorData {
  id: number;
  hiveNumber?: number; // Line-based hive number (1-based: Hive 1, Hive 2, etc.)
  hiveName?: string; // e.g., "Master Hive 1" or "Hive 2"
  isMaster?: boolean; // Is this a master hive?
  temp_internal?: number;
  hum_internal?: number;
  temp_external?: number;
  hum_external?: number;
  weight?: number;
  battery?: number;
  lat?: number;
  lon?: number;
  timestamp?: string;
  filename?: string;
  // Optional fields that may be added during processing
  sensor_id?: string | number; // Alternative sensor identifier
  device_id?: string | number; // Device identifier
  _metadata?: {
    sourceBlob: string;
    blobLastModified?: string;
    lastModified?: string;
    size?: number;
    processedAt: string;
  };
}

// Azure Blob Storage related types
export interface BlobData {
  id: string;
  name: string;
  lastModified: string; // Made required since we handle undefined cases
  accessTier: string;
  blobType: string;
  size: number;
  leaseState: string;
  contentType?: string;
  etag?: string;
  url?: string;
}

// Internal type for raw Azure blob data that might have undefined lastModified
export interface RawBlobData {
  id: string;
  name: string;
  lastModified: Date | undefined;
  accessTier: string;
  blobType: string;
  size: number;
  leaseState: string;
  contentType?: string;
  etag?: string;
  url?: string;
}

// Parsed blob data with CSV metadata
export interface ParsedBlobData {
  blobInfo: BlobData;
  csvMetadata: {
    totalRows: number;
    totalColumns: number;
    headers: string[];
    delimiter: string;
    hasErrors: boolean;
    errorCount: number;
    columnTypes: Record<string, string>;
    parsedAt: string;
  };
  data: SensorData[];
  recordCount: number;
}

// API Response types
export interface HistoricalDataResponse {
  data: SensorData[];
  totalFiles: number;
  totalRecords: number;
  processingErrors: Array<{
    blob: string;
    error: string;
  }>;
  metadata: {
    requestedLimit: number;
    actualFiles: number;
    dateRange: {
      from?: string;
      to?: string;
    };
    generatedAt: string;
  };
}

export interface LatestDataResponse {
  data: SensorData[];
  lastUpdated: string;
  filename: string;
  totalBlobs?: number;
  summary?: {
    totalRecords: number;
    latestBlobTimestamp?: string;
    oldestBlobTimestamp?: string;
  };
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    azure: {
      status: 'connected' | 'disconnected';
      responseTime?: string;
      blobCount?: number;
      error?: string;
    };
    api: {
      status: 'operational';
      uptime: number;
    };
  };
  version: string;
  environment: string;
  error?: string;
}

// Chart and UI related types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  sensorId?: number;
  hiveNumber?: number;
  count?: number;
}

export interface TimeSeriesData {
  timestamp: string;
  temp_internal?: number;
  temp_external?: number;
  hum_internal?: number;
  hum_external?: number;
  weight?: number;
  battery?: number;
  [key: string]: any; // For dynamic sensor fields like temp_internal_1, temp_external_2
}

export interface StatisticsData {
  count: number;
  min: number;
  max: number;
  average: number;
  median: number;
  standardDeviation: number;
}

export interface SensorStatistics {
  sensorId: number;
  recordCount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  temperature: {
    internal: StatisticsData;
    external: StatisticsData;
  };
  humidity: {
    internal: StatisticsData;
    external: StatisticsData;
  };
  weight: StatisticsData;
  battery: StatisticsData;
  location: {
    lat: StatisticsData;
    lon: StatisticsData;
  };
}

// Dashboard state and configuration types
export interface DashboardConfig {
  refreshInterval: number; // in milliseconds
  autoRefresh: boolean;
  defaultTimeRange: '24h' | '7d' | '30d' | 'all';
  defaultChartType: 'line' | 'area' | 'scatter';
  showInternalTemp: boolean;
  showExternalTemp: boolean;
  theme: 'light' | 'dark';
  gridLayout: {
    cols: number;
    rows: number;
  };
}

export interface DashboardData {
  latest: SensorData[];
  historical: SensorData[];
  lastUpdated: string;
  statistics?: {
    totalSensors: number;
    activeSensors: number;
    lowBatterySensors: number;
    avgTemperature: {
      internal: number;
      external: number;
    };
    dataQuality: {
      score: number;
      issues: string[];
    };
  };
}

// Filter and sorting types
export interface DataFilter {
  sensorIds?: number[];
  hiveNumbers?: number[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  temperatureRange?: {
    min: number;
    max: number;
  };
  batteryRange?: {
    min: number;
    max: number;
  };
  searchTerm?: string;
}

export interface SortConfig {
  field: keyof SensorData;
  direction: 'asc' | 'desc';
}

// Map related types
export interface LocationData {
  lat: number;
  lon: number;
  sensorId: number;
  hiveNumber?: number;
  battery: number;
  temperature: {
    internal: number;
    external: number;
  };
  lastReading: string;
  status: 'online' | 'offline' | 'low_battery' | 'critical';
}

export interface MapBounds {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
}

// Error handling types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Data quality types
export interface DataQualityReport {
  overall: {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  issues: Array<{
    type: 'missing_data' | 'invalid_values' | 'duplicates' | 'outliers' | 'time_gaps';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedRecords: number;
    suggestions?: string[];
  }>;
  metrics: {
    completeness: number; // Percentage of non-null values
    accuracy: number; // Percentage of valid values
    consistency: number; // Percentage of consistent data
    timeliness: number; // How recent the data is
  };
  recommendations: string[];
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

// Export utility types
export interface ExportConfig {
  format: 'csv' | 'json' | 'xlsx';
  dateRange: {
    start: Date;
    end: Date;
  };
  sensorIds?: number[];
  hiveNumbers?: number[];
  fields?: (keyof SensorData)[];
  includeMetadata: boolean;
}

// Webhook/Alert types
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Array<{
    field: keyof SensorData;
    operator: '>' | '<' | '=' | '!=' | '>=' | '<=';
    value: number;
  }>;
  actions: Array<{
    type: 'email' | 'webhook' | 'sms';
    config: Record<string, any>;
  }>;
  cooldownMinutes: number;
  lastTriggered?: string;
}

// Real-time data types
export interface RealtimeUpdate {
  type: 'data_update' | 'sensor_status' | 'alert';
  timestamp: string;
  payload: {
    sensorData?: SensorData[];
    sensorStatus?: {
      sensorId: number;
      status: 'online' | 'offline';
    };
    alert?: {
      ruleId: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    };
  };
}

// Component prop types
export interface ChartProps {
  data: SensorData[];
  title?: string;
  height?: number;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

export interface TableProps extends ChartProps {
  maxHeight?: string;
  showPagination?: boolean;
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
}

export interface MapProps extends ChartProps {
  selectedSensors?: number[];
  selectedHives?: number[];
  onSensorSelect?: (sensorIds: number[]) => void;
  onHiveSelect?: (hiveNumbers: number[]) => void;
  showBatteryStatus?: boolean;
  showTemperatureData?: boolean;
}

// Utility type helpers
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Type guards
export const isSensorData = (data: any): data is SensorData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'number' &&
    (data.temp_internal === undefined || typeof data.temp_internal === 'number') &&
    (data.temp_external === undefined || typeof data.temp_external === 'number') &&
    (data.hum_internal === undefined || typeof data.hum_internal === 'number') &&
    (data.hum_external === undefined || typeof data.hum_external === 'number') &&
    (data.weight === undefined || typeof data.weight === 'number') &&
    (data.battery === undefined || typeof data.battery === 'number') &&
    (data.lat === undefined || typeof data.lat === 'number') &&
    (data.lon === undefined || typeof data.lon === 'number')
  );
};

export const isValidBlobData = (data: any): data is BlobData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.name === 'string' &&
    typeof data.lastModified === 'string' &&
    typeof data.size === 'number'
  );
};

// Constants
export const SENSOR_FIELD_LABELS: Record<string, string> = {
  id: 'Sensor ID',
  hiveNumber: 'Hive Number',
  hiveName: 'Hive Name',
  isMaster: 'Master Hive',
  temp_internal: 'Internal Temperature',
  hum_internal: 'Internal Humidity',
  temp_external: 'External Temperature',
  hum_external: 'External Humidity',
  weight: 'Weight',
  battery: 'Battery Level',
  lat: 'Latitude',
  lon: 'Longitude',
  timestamp: 'Timestamp',
  filename: 'Source File',
  sensor_id: 'Sensor ID (Alt)',
  device_id: 'Device ID',
  _metadata: 'Metadata'
};

export const SENSOR_FIELD_UNITS: Record<string, string> = {
  temp_internal: '°C',
  temp_external: '°C',
  hum_internal: '%',
  hum_external: '%',
  weight: 'kg',
  battery: '%',
  lat: '°',
  lon: '°'
};

export const BATTERY_STATUS_THRESHOLDS = {
  CRITICAL: 10,
  LOW: 25,
  MEDIUM: 50,
  GOOD: 100
} as const;

export const REFRESH_INTERVALS = {
  REAL_TIME: 1000, // 1 second
  FAST: 30000, // 30 seconds
  NORMAL: 300000, // 5 minutes
  SLOW: 900000, // 15 minutes
  IOT_STANDARD: 14400000 // 4 hours
} as const;
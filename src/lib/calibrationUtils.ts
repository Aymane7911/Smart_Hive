// lib/calibrationUtils.ts
// Utility functions for applying calibration to sensor data

import { SensorData } from './types';

export interface CalibrationOffsets {
  tempExternalOffset: number;
  tempInternalOffset: number;
  humidityOffset: number;
  weightOffset: number;
  appliedAt: string;
}


// ✅ NEW: UI Form structure (for correction page)
export interface CalibrationFormData {
  visualized: string;  // What the sensor shows
  real: string;        // What the actual value is
  offset: number;      // Calculated difference (real - visualized)
}

// ✅ NEW: Complete form state (matches correction page)
export interface CalibrationFormState {
  temp_external: CalibrationFormData;
  temp_internal: CalibrationFormData;
  humidity: CalibrationFormData;
  weight: CalibrationFormData;
  appliedAt?: string;
}

// ✅ NEW: Conversion function - Form to Database
export function formToOffsets(form: CalibrationFormState): CalibrationOffsets {
  return {
    tempExternalOffset: form.temp_external.offset,
    tempInternalOffset: form.temp_internal.offset,
    humidityOffset: form.humidity.offset,
    weightOffset: form.weight.offset,
    appliedAt: form.appliedAt || new Date().toISOString()
  };
}

// ✅ NEW: Conversion function - Database to Form
export function offsetsToForm(offsets: CalibrationOffsets, originalValues?: {
  tempExternal?: { visualized: number; real: number };
  tempInternal?: { visualized: number; real: number };
  humidity?: { visualized: number; real: number };
  weight?: { visualized: number; real: number };
}): CalibrationFormState {
  return {
    temp_external: {
      visualized: originalValues?.tempExternal?.visualized?.toString() || '',
      real: originalValues?.tempExternal?.real?.toString() || '',
      offset: offsets.tempExternalOffset
    },
    temp_internal: {
      visualized: originalValues?.tempInternal?.visualized?.toString() || '',
      real: originalValues?.tempInternal?.real?.toString() || '',
      offset: offsets.tempInternalOffset
    },
    humidity: {
      visualized: originalValues?.humidity?.visualized?.toString() || '',
      real: originalValues?.humidity?.real?.toString() || '',
      offset: offsets.humidityOffset
    },
    weight: {
      visualized: originalValues?.weight?.visualized?.toString() || '',
      real: originalValues?.weight?.real?.toString() || '',
      offset: offsets.weightOffset
    },
    appliedAt: offsets.appliedAt
  };
}

// ✅ NEW: Validate form data before saving
export function validateCalibrationForm(form: CalibrationFormState): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if at least one calibration has values
  const hasAnyCalibration = 
    form.temp_external.offset !== 0 ||
    form.temp_internal.offset !== 0 ||
    form.humidity.offset !== 0 ||
    form.weight.offset !== 0;

  if (!hasAnyCalibration) {
    errors.push('At least one sensor must have calibration values');
  }

  // Validate reasonable offset ranges
  if (Math.abs(form.temp_external.offset) > 50) {
    errors.push('Temperature external offset seems too large (>50°C)');
  }
  if (Math.abs(form.temp_internal.offset) > 50) {
    errors.push('Temperature internal offset seems too large (>50°C)');
  }
  if (Math.abs(form.humidity.offset) > 100) {
    errors.push('Humidity offset seems too large (>100%)');
  }
  if (Math.abs(form.weight.offset) > 1000) {
    errors.push('Weight offset seems too large (>1000kg)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ✅ Enhanced SensorData with calibration fields
export interface CalibratedSensorData extends SensorData {
  // Calibrated values
  temp_external_calibrated?: number;
  temp_external_raw?: number;
  temp_internal_calibrated?: number;
  temp_internal_raw?: number;
  hum_internal_calibrated?: number;
  hum_internal_raw?: number;
  hum_external_calibrated?: number;
  hum_external_raw?: number;
  weight_calibrated?: number;
  weight_raw?: number;
  
  // Calibration metadata
  _calibrated?: boolean;
  _calibration?: {
    tempExternalOffset: number;
    tempInternalOffset: number;
    humidityOffset: number;
    weightOffset: number;
    appliedAt: string;
  };
}

/**
 * Safely convert any value to number
 */
function toNumber(value: any): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Apply calibration offsets to a single sensor reading
 */
export function applyCalibrationsToReading(
  reading: SensorData,
  calibration: CalibrationOffsets | null
): CalibratedSensorData {
  if (!calibration) {
    return reading as CalibratedSensorData; // No calibration - return raw data
  }

  // Only apply calibration to readings AFTER calibration was saved
  const readingTime = reading.timestamp ? new Date(reading.timestamp).getTime() : Date.now();
  const calibrationTime = new Date(calibration.appliedAt).getTime();

  if (readingTime <= calibrationTime) {
    return reading as CalibratedSensorData; // Reading is BEFORE calibration - don't adjust
  }

  // Convert sensor values to numbers safely
  const tempExternal = toNumber(reading.temp_external);
  const tempInternal = toNumber(reading.temp_internal);
  const humInternal = toNumber(reading.hum_internal);
  const humExternal = toNumber(reading.hum_external);
  const weight = toNumber(reading.weight);

  // Apply calibration offsets
  const calibratedData: CalibratedSensorData = {
    ...reading,
    
    // Update main fields with calibrated values
    temp_external: tempExternal !== null 
      ? tempExternal + calibration.tempExternalOffset 
      : reading.temp_external,
    temp_internal: tempInternal !== null 
      ? tempInternal + calibration.tempInternalOffset 
      : reading.temp_internal,
    hum_internal: humInternal !== null 
      ? humInternal + calibration.humidityOffset 
      : reading.hum_internal,
    hum_external: humExternal !== null 
      ? humExternal + calibration.humidityOffset 
      : reading.hum_external,
    weight: weight !== null 
      ? weight + calibration.weightOffset 
      : reading.weight,
    
    // Store raw values for comparison
    temp_external_raw: tempExternal !== null ? tempExternal : undefined,
    temp_external_calibrated: tempExternal !== null 
      ? tempExternal + calibration.tempExternalOffset 
      : undefined,
    temp_internal_raw: tempInternal !== null ? tempInternal : undefined,
    temp_internal_calibrated: tempInternal !== null 
      ? tempInternal + calibration.tempInternalOffset 
      : undefined,
    hum_internal_raw: humInternal !== null ? humInternal : undefined,
    hum_internal_calibrated: humInternal !== null 
      ? humInternal + calibration.humidityOffset 
      : undefined,
    hum_external_raw: humExternal !== null ? humExternal : undefined,
    hum_external_calibrated: humExternal !== null 
      ? humExternal + calibration.humidityOffset 
      : undefined,
    weight_raw: weight !== null ? weight : undefined,
    weight_calibrated: weight !== null 
      ? weight + calibration.weightOffset 
      : undefined,
    
    // Mark as calibrated
    _calibrated: true,
    _calibration: {
      tempExternalOffset: calibration.tempExternalOffset,
      tempInternalOffset: calibration.tempInternalOffset,
      humidityOffset: calibration.humidityOffset,
      weightOffset: calibration.weightOffset,
      appliedAt: calibration.appliedAt
    }
  };

  return calibratedData;
}

/**
 * Apply calibration to an array of sensor readings
 * Groups readings by hive and applies corresponding calibration
 */
export function applyCalibrationToDataset(
  data: SensorData[],
  calibrations: Map<number, CalibrationOffsets>
): CalibratedSensorData[] {
  return data.map((reading) => {
    // Determine hive number from data (check multiple possible fields)
    const hiveNumber = reading.hiveNumber || reading.id || reading.sensor_id;
    
    if (!hiveNumber) {
      return reading as CalibratedSensorData; // Can't determine hive - skip calibration
    }

    // Convert to number if it's a string
    const hiveNum = typeof hiveNumber === 'string' ? parseInt(hiveNumber, 10) : hiveNumber;
    
    if (isNaN(hiveNum)) {
      return reading as CalibratedSensorData; // Invalid hive number - skip calibration
    }

    const calibration = calibrations.get(hiveNum);
    return applyCalibrationsToReading(reading, calibration || null);
  });
}

/**
 * Fetch all calibrations for a user and container from database
 */
export async function fetchCalibrations(
  userId: number,
  containerId: string,
  prisma: any
): Promise<Map<number, CalibrationOffsets>> {
  try {
    console.log(`🔍 Fetching calibrations for user ${userId}, container ${containerId}`);
    
    const calibrations = await prisma.calibration.findMany({
      where: {
        userId: userId,
        containerId: containerId
      }
    });

    if (calibrations.length === 0) {
      console.log('ℹ️ No calibrations found');
      return new Map<number, CalibrationOffsets>();
    }

    const calibrationMap = new Map<number, CalibrationOffsets>();

    calibrations.forEach((cal: any) => {
      calibrationMap.set(cal.hiveNumber, {
        tempExternalOffset: cal.tempExternalOffset,
        tempInternalOffset: cal.tempInternalOffset,
        humidityOffset: cal.humidityOffset,
        weightOffset: cal.weightOffset,
        appliedAt: cal.appliedAt.toISOString()
      });
      
      console.log(`✅ Loaded calibration for hive ${cal.hiveNumber}:`, {
        tempInternal: cal.tempInternalOffset,
        tempExternal: cal.tempExternalOffset,
        humidity: cal.humidityOffset,
        weight: cal.weightOffset
      });
    });

    console.log(`📊 Total calibrations loaded: ${calibrationMap.size}`);
    return calibrationMap;
    
  } catch (error) {
    console.error('❌ Error fetching calibrations:', error);
    return new Map<number, CalibrationOffsets>();
  }
}

/**
 * Get calibration summary for a dataset
 */
export function getCalibrationSummary(data: CalibratedSensorData[]): {
  totalRecords: number;
  calibratedRecords: number;
  uncalibratedRecords: number;
  calibrationPercentage: number;
  hivesWithCalibration: number[];
} {
  const calibratedRecords = data.filter(r => r._calibrated === true);
  const hivesWithCalibration = Array.from(
    new Set(
      calibratedRecords
        .map(r => r.hiveNumber || r.id)
        .filter((h): h is number => h !== undefined)
    )
  );

  return {
    totalRecords: data.length,
    calibratedRecords: calibratedRecords.length,
    uncalibratedRecords: data.length - calibratedRecords.length,
    calibrationPercentage: data.length > 0 
      ? Math.round((calibratedRecords.length / data.length) * 100) 
      : 0,
    hivesWithCalibration: hivesWithCalibration
  };
}

/**
 * Check if a specific reading has been calibrated
 */
export function isCalibrated(reading: SensorData | CalibratedSensorData): reading is CalibratedSensorData {
  return '_calibrated' in reading && reading._calibrated === true;
}

/**
 * Get calibration info for a specific hive from a dataset
 */
export function getHiveCalibrationInfo(
  data: CalibratedSensorData[],
  hiveNumber: number
): CalibrationOffsets | null {
  const calibratedReading = data.find(
    r => (r.hiveNumber === hiveNumber || r.id === hiveNumber) && r._calibrated
  );

  if (!calibratedReading || !calibratedReading._calibration) {
    return null;
  }

  return calibratedReading._calibration;
}

/**
 * Remove calibration from a dataset (revert to raw values)
 */
export function removeCalibration(data: CalibratedSensorData[]): SensorData[] {
  return data.map(reading => {
    if (!reading._calibrated) {
      return reading; // Already uncalibrated
    }

    const uncalibrated: SensorData = {
      ...reading,
      temp_external: reading.temp_external_raw ?? reading.temp_external,
      temp_internal: reading.temp_internal_raw ?? reading.temp_internal,
      hum_internal: reading.hum_internal_raw ?? reading.hum_internal,
      hum_external: reading.hum_external_raw ?? reading.hum_external,
      weight: reading.weight_raw ?? reading.weight
    };

    // Remove calibration-specific fields
    delete (uncalibrated as any).temp_external_calibrated;
    delete (uncalibrated as any).temp_external_raw;
    delete (uncalibrated as any).temp_internal_calibrated;
    delete (uncalibrated as any).temp_internal_raw;
    delete (uncalibrated as any).hum_internal_calibrated;
    delete (uncalibrated as any).hum_internal_raw;
    delete (uncalibrated as any).hum_external_calibrated;
    delete (uncalibrated as any).hum_external_raw;
    delete (uncalibrated as any).weight_calibrated;
    delete (uncalibrated as any).weight_raw;
    delete (uncalibrated as any)._calibrated;
    delete (uncalibrated as any)._calibration;

    return uncalibrated;
  });
}

/**
 * Validate calibration offsets
 */
export function validateCalibration(calibration: Partial<CalibrationOffsets>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for required fields
  if (calibration.tempExternalOffset === undefined) {
    errors.push('tempExternalOffset is required');
  }
  if (calibration.tempInternalOffset === undefined) {
    errors.push('tempInternalOffset is required');
  }
  if (calibration.humidityOffset === undefined) {
    errors.push('humidityOffset is required');
  }
  if (calibration.weightOffset === undefined) {
    errors.push('weightOffset is required');
  }
  if (!calibration.appliedAt) {
    errors.push('appliedAt timestamp is required');
  }

  // Check for reasonable offset ranges (adjust these limits as needed)
  if (calibration.tempExternalOffset !== undefined) {
    if (Math.abs(calibration.tempExternalOffset) > 50) {
      errors.push('tempExternalOffset seems unreasonably large (>50°C)');
    }
  }
  if (calibration.tempInternalOffset !== undefined) {
    if (Math.abs(calibration.tempInternalOffset) > 50) {
      errors.push('tempInternalOffset seems unreasonably large (>50°C)');
    }
  }
  if (calibration.humidityOffset !== undefined) {
    if (Math.abs(calibration.humidityOffset) > 100) {
      errors.push('humidityOffset seems unreasonably large (>100%)');
    }
  }
  if (calibration.weightOffset !== undefined) {
    if (Math.abs(calibration.weightOffset) > 1000) {
      errors.push('weightOffset seems unreasonably large (>1000kg)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
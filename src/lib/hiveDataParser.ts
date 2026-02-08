// lib/hiveDataParser.ts
import { csvParser, csvUtils } from './csvParser';

export interface HiveData {
  hiveNumber: number;
  hiveName: string;
  isMaster: boolean;
  data: {
    temp_internal?: number;
    hum_internal?: number;
    temp_external?: number;
    hum_external?: number;
    weight?: number;
    battery?: number;
    lat?: number;
    lon?: number;
    timestamp?: string;
  };
  raw: any;
}

export class HiveLineParser {
  // Containers that have the column offset issue
  private readonly CONTAINERS_WITH_OFFSET = ['h-honeypark', 'h-manahel'];

  /**
   * Detect if this CSV has the column offset issue
   * by checking if slave hive rows have numeric values in the 'time' column
   */
  private detectColumnOffset(parsedData: any[]): boolean {
    if (parsedData.length < 2) return false;
    
    // Check the second row (first slave hive)
    const slaveRow = parsedData[1];
    
    // If 'time' column contains a small number (like -0.12, 0.32), it's likely weight
    if (slaveRow.time !== undefined) {
      const timeValue = parseFloat(String(slaveRow.time));
      if (!isNaN(timeValue) && Math.abs(timeValue) < 100 && !slaveRow.time.includes(':')) {
        console.log('🔍 Detected column offset issue - slave data is shifted');
        return true;
      }
    }
    
    return false;
  }

  /**
   * Parse CSV and extract data by line number
   * Line 1 = Hive 1 (Master), Line 2 = Hive 2, etc.
   * 
   * IMPORTANT: Some containers have column offset issues where slave hive data is shifted
   * This method auto-detects and handles both formats
   */
  async parseHiveDataByLine(csvContent: string, totalHives: number, masterHives: number, containerId?: string): Promise<HiveData[]> {
    try {
      // Parse CSV with header detection
      const parsed = await csvUtils.parseAzureCSV(csvContent);
      
      if (!parsed.data || parsed.data.length === 0) {
        console.warn('No data found in CSV');
        return [];
      }

      console.log(`📊 Parsed ${parsed.data.length} rows from CSV`);
      console.log(`📋 Detected headers:`, parsed.meta.fields);

      // Auto-detect if this CSV has the column offset issue
      const hasColumnOffset = this.detectColumnOffset(parsed.data);
      
      if (hasColumnOffset) {
        console.warn('⚠️ Column offset detected - using shifted mapping for slave hives');
      }

      // Map each line to a hive
      const hiveDataArray: HiveData[] = [];

      for (let i = 0; i < Math.min(parsed.data.length, totalHives); i++) {
        const row = parsed.data[i];
        const hiveNumber = i + 1; // Line 1 = Hive 1
        const isMaster = hiveNumber <= masterHives;

        let hiveData: HiveData;

        if (isMaster || !hasColumnOffset) {
          // Master hive OR normal format (no offset): use standard column mapping
          hiveData = {
            hiveNumber,
            hiveName: isMaster ? `Master Hive ${hiveNumber}` : `Hive ${hiveNumber}`,
            isMaster,
            data: {
              temp_internal: this.parseNumber(row.int_temp),
              hum_internal: this.parseNumber(row.int_hum),
              temp_external: this.parseNumber(row.ext_temp),
              hum_external: this.parseNumber(row.ext_hum),
              weight: this.parseNumber(row.weight),
              battery: this.parseNumber(row.battery),
              lat: this.parseNumber(row.lat),
              lon: this.parseNumber(row.lon),
              timestamp: row.time || new Date().toISOString()
            },
            raw: row
          };
        } else {
          // Slave hive WITH column offset: data is shifted to different columns
          // Based on the screenshot:
          // - weight is in the 'time' column (column B)
          // - int_temp is in the 'weight' column (column C)
          // - int_hum is in the 'int_temp' column (column D)
          hiveData = {
            hiveNumber,
            hiveName: `Hive ${hiveNumber}`,
            isMaster: false,
            data: {
              weight: this.parseNumber(row.time),           // weight is in 'time' column
              temp_internal: this.parseNumber(row.weight),  // int_temp is in 'weight' column
              hum_internal: this.parseNumber(row.int_temp), // int_hum is in 'int_temp' column
              temp_external: this.parseNumber(row.int_hum), // ext_temp might be in 'int_hum' column
              hum_external: undefined, // May not be available for slaves
              battery: undefined,
              lat: undefined,
              lon: undefined,
              timestamp: parsed.data[0]?.time || new Date().toISOString() // Use master's timestamp
            },
            raw: row
          };
        }

        console.log(`🐝 Hive ${hiveNumber} (${isMaster ? 'Master' : 'Slave'}):`, {
          weight: hiveData.data.weight,
          temp_internal: hiveData.data.temp_internal,
          hum_internal: hiveData.data.hum_internal,
          hasOffset: hasColumnOffset && !isMaster
        });

        hiveDataArray.push(hiveData);
      }

      console.log(`✅ Mapped ${hiveDataArray.length} hives`);
      return hiveDataArray;

    } catch (error) {
      console.error('Error parsing hive data by line:', error);
      throw error;
    }
  }

  /**
   * Get data for a specific hive number
   */
  async getHiveByNumber(csvContent: string, hiveNumber: number, totalHives: number, masterHives: number, containerId?: string): Promise<HiveData | null> {
    const allHives = await this.parseHiveDataByLine(csvContent, totalHives, masterHives, containerId);
    return allHives.find(h => h.hiveNumber === hiveNumber) || null;
  }

  /**
   * Parse number safely
   */
  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num = parseFloat(String(value));
    return isNaN(num) ? undefined : num;
  }

  /**
   * Transform hive data array into SensorData format for charts
   */
  transformToSensorData(hiveDataArray: HiveData[], selectedHiveNumber?: number) {
    const hivesToShow = selectedHiveNumber 
      ? hiveDataArray.filter(h => h.hiveNumber === selectedHiveNumber)
      : hiveDataArray;

    return hivesToShow.map(hive => ({
      id: hive.hiveNumber,
      hiveNumber: hive.hiveNumber,
      hiveName: hive.hiveName,
      isMaster: hive.isMaster,
      temp_internal: hive.data.temp_internal,
      hum_internal: hive.data.hum_internal,
      temp_external: hive.data.temp_external,
      hum_external: hive.data.hum_external,
      weight: hive.data.weight,
      battery: hive.data.battery,
      lat: hive.data.lat,
      lon: hive.data.lon,
      timestamp: hive.data.timestamp
    }));
  }
}

// Export singleton
export const hiveLineParser = new HiveLineParser();
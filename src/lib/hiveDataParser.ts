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
  /**
   * Parse CSV and extract data by line number
   * Line 1 = Hive 1 (Master), Line 2 = Hive 2, etc.
   */
  async parseHiveDataByLine(csvContent: string, totalHives: number, masterHives: number): Promise<HiveData[]> {
    try {
      // Parse CSV
      const parsed = await csvUtils.parseAzureCSV(csvContent);
      
      if (!parsed.data || parsed.data.length === 0) {
        console.warn('No data found in CSV');
        return [];
      }

      console.log(`📊 Parsed ${parsed.data.length} rows from CSV`);

      // Map each line to a hive
      const hiveDataArray: HiveData[] = [];

      for (let i = 0; i < Math.min(parsed.data.length, totalHives); i++) {
        const row = parsed.data[i];
        const hiveNumber = i + 1; // Line 1 = Hive 1
        const isMaster = hiveNumber <= masterHives;

        const hiveData: HiveData = {
          hiveNumber,
          hiveName: isMaster ? `Master Hive ${hiveNumber}` : `Hive ${hiveNumber}`,
          isMaster,
          data: {
            temp_internal: this.parseNumber(row.temp_internal),
            hum_internal: this.parseNumber(row.hum_internal),
            temp_external: this.parseNumber(row.temp_external),
            hum_external: this.parseNumber(row.hum_external),
            weight: this.parseNumber(row.weight),
            battery: this.parseNumber(row.battery),
            lat: this.parseNumber(row.lat),
            lon: this.parseNumber(row.lon),
            timestamp: row.timestamp || new Date().toISOString()
          },
          raw: row
        };

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
  async getHiveByNumber(csvContent: string, hiveNumber: number, totalHives: number, masterHives: number): Promise<HiveData | null> {
    const allHives = await this.parseHiveDataByLine(csvContent, totalHives, masterHives);
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
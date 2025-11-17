// ============================================
// FIXED VERSION OF /api/admin/smart-hive/data/latest/route.ts
// ============================================

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '../../../../../lib/azure';
import { csvUtils, csvParser } from '../../../../../lib/csvParser';
import { normalizeSensorDataArray, detectCSVFormat } from '../../../../../lib/fieldMapping';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { fetchCalibrations, applyCalibrationToDataset } from '../../../../../lib/calibrationUtils';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Environment-based logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'production';
const isVerbose = LOG_LEVEL === 'verbose' || LOG_LEVEL === 'debug';

export async function GET(request: NextRequest) {
  console.log('🚀 [LATEST API] Starting request');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '1');
    const containerId = searchParams.get('containerId');
    
    if (isVerbose) {
      console.log('📊 Request params:', { count, containerId });
    }
    
    // Validate container ID
    if (!containerId) {
      console.error('❌ Missing containerId parameter');
      return NextResponse.json({
        error: 'containerId parameter is required',
        data: [],
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // ✅ STEP 1: Get user ID from token (for calibration lookup)
    const token = request.cookies.get('user-token')?.value || 
                  request.cookies.get('auth-token')?.value;
    
    let userId: number | null = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.userId || decoded.id;
        console.log('🔐 User authenticated:', userId);
      } catch (error) {
        console.warn('⚠️ Invalid token for calibration lookup');
      }
    }
    
    // Initialize Azure service and fetch blobs
    const azureService = new AzureBlobService(containerId);
    const blobs = await azureService.listBlobs();
    
    console.log(`📁 Found ${blobs.length} blobs in container: ${containerId}`);
    
    if (blobs.length === 0) {
      console.warn(`⚠️ No blobs found in container: ${containerId}`);
      return NextResponse.json({
        data: [],
        message: `No blobs found in container: ${containerId}`,
        containerId: containerId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get the most recent blobs
    const latestBlobs = blobs
      .filter(blob => {
        if (!blob.lastModified && isVerbose) {
          console.warn(`⚠️ Blob without lastModified: ${blob.name}`);
        }
        return !!blob.lastModified;
      })
      .sort((a, b) => {
        const dateA = new Date(a.lastModified!).getTime();
        const dateB = new Date(b.lastModified!).getTime();
        return dateB - dateA;
      })
      .slice(0, count);
    
    console.log(`🔄 Processing ${latestBlobs.length} latest blob(s)`);
    
    const latestData = [];
    let detectedFormat: string | null = null;
    
    for (const [index, blob] of latestBlobs.entries()) {
      if (isVerbose) {
        console.log(`📄 Processing ${index + 1}/${latestBlobs.length}: ${blob.name}`);
      }
      
      try {
        // Download and validate
        const csvContent = await azureService.downloadBlob(blob.name);
        const validation = await csvParser.validateCSV(csvContent);
        
        if (!validation.isValid) {
          console.warn(`❌ Invalid CSV in ${blob.name}:`, validation.errors);
          continue;
        }
        
        // Parse CSV
        const parsedResult = await csvUtils.parseAzureCSV(csvContent);
        
        // Debug: Log CSV columns
        if (parsedResult.data.length > 0 && isVerbose) {
          console.log('🔍 CSV Columns:', Object.keys(parsedResult.data[0]));
          console.log('🔍 First row sample:', parsedResult.data[0]);
        }
        
        // Detect CSV format (only on first blob)
        if (!detectedFormat && parsedResult.data.length > 0) {
          const formatInfo = detectCSVFormat(parsedResult.data);
          detectedFormat = formatInfo.format;
          console.log(`📋 CSV Format detected: ${detectedFormat}`, formatInfo);
        }
        
        // Extract metadata
        const metadata = csvParser.extractMetadata(parsedResult);
        
        // Transform data
        const transformedData = csvParser.transformForDashboard(parsedResult, {
          dateFields: ['timestamp', 'time', 'lastModified', 'datetime', 'DateTime', 'Date', 'Time'],
          numericFields: [
            'value', 'temperature', 'pressure', 'humidity',
            'temp_internal', 'temp_external', 'temperature_internal', 'temperature_external',
            'tempInternal', 'tempExternal', 'inte_temp', 'exte_temp',
            'int_temp', 'ext_temp',
            'hum_internal', 'hum_external', 'humidity_internal', 'humidity_external',
            'humInternal', 'humExternal', 'inte_hum', 'exte_hum',
            'int_hum', 'ext_hum',
            'weight', 'Weight', 'weight_kg',
            'battery', 'Battery', 'battery_level',
            'lat', 'latitude', 'lon', 'longitude'
          ],
          requiredFields: [],
          defaultValues: {
            containerId: containerId
          }
        });
        
        // Helper function to ensure ISO string
        const ensureISOString = (timestamp: string | Date | undefined | null): string => {
          if (!timestamp) return new Date().toISOString();
          if (typeof timestamp === 'string') return timestamp;
          return new Date(timestamp).toISOString();
        };

        // Add timestamps to data
        const dataWithTimestamps = transformedData.map((row, rowIndex) => {
          const csvTimestamp = row.timestamp || 
                              row.Timestamp || 
                              row.datetime || 
                              row.DateTime || 
                              row.time || 
                              row.Time || 
                              row.Date ||
                              row.date ||
                              row.created_at ||
                              row.createdAt ||
                              row.recorded_at ||
                              row.recordedAt ||
                              row.measured_at ||
                              row.measuredAt;
          
          if (rowIndex === 0) {
            console.log('🔍 Container:', containerId);
            console.log('🔍 ALL CSV FIELDS:', Object.keys(row));
            console.log('🔍 CSV timestamp value found:', csvTimestamp);
            console.log('🔍 Blob lastModified:', blob.lastModified);
          }
          
          let finalTimestamp: string;
          
          if (csvTimestamp) {
            const parsedDate = new Date(csvTimestamp);
            if (!isNaN(parsedDate.getTime())) {
              finalTimestamp = parsedDate.toISOString();
              if (rowIndex === 0) {
                console.log('✅ Using CSV timestamp:', finalTimestamp);
              }
            } else {
              finalTimestamp = ensureISOString(blob.lastModified);
              console.warn(`⚠️ Invalid CSV timestamp "${csvTimestamp}", using blob timestamp`);
            }
          } else {
            finalTimestamp = ensureISOString(blob.lastModified);
            if (rowIndex === 0) {
              console.warn('⚠️ No CSV timestamp field found! Using blob.lastModified as fallback');
            }
          }
          
          return {
            ...row,
            timestamp: finalTimestamp,
            _metadata: {
              lastModified: ensureISOString(blob.lastModified),
              blobName: blob.name,
              containerId: containerId,
              hasOriginalTimestamp: !!csvTimestamp,
              detectedTimestampField: csvTimestamp ? 'from CSV' : 'from blob'
            }
          };
        });
        
        // Normalize data to ensure consistent field names
        const normalizedData = normalizeSensorDataArray(dataWithTimestamps);
        
        // Sanitize data
        let sanitizedData = csvParser.sanitizeData(normalizedData);

        // ✅ STEP 2: Apply calibrations if user is authenticated
        if (userId && containerId) {
          const calibrations = await fetchCalibrations(userId, containerId, prisma);
          
          if (calibrations.size > 0) {
            console.log(`🔧 Applying ${calibrations.size} calibration(s) to latest data`);
            sanitizedData = applyCalibrationToDataset(sanitizedData, calibrations);
          } else {
            console.log('ℹ️ No calibrations found for this user/container');
          }
        }
        
        // Log timestamp sources summary
        const timestampSources = sanitizedData.reduce((acc, row) => {
          const source = row._metadata?.hasOriginalTimestamp ? 'fromCSV' : 'fromBlob';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(`⏰ Timestamp sources for ${blob.name}:`, timestampSources);
        
        const blobResult = {
          blobInfo: {
            name: blob.name,
            lastModified: blob.lastModified || new Date().toISOString(),
            size: blob.size,
            contentType: blob.contentType,
            etag: blob.etag,
            containerId: containerId,
            format: detectedFormat || 'unknown'
          },
          csvMetadata: {
            ...metadata,
            normalized: true,
            detectedFormat: detectedFormat,
            timestampSources: timestampSources,
            calibrated: sanitizedData.some(r => r._calibrated) // ✅ Track if calibrated
          },
          data: sanitizedData,
          recordCount: sanitizedData.length
        };
        
        latestData.push(blobResult);
        
        if (isVerbose) {
          console.log(`✓ Processed ${blob.name}: ${blobResult.recordCount} records (normalized${blobResult.csvMetadata.calibrated ? ' & calibrated' : ''})`);
          console.log(`   Sample record:`, sanitizedData[0]);
        }
        
      } catch (parseError) {
        console.error(`❌ Error processing ${blob.name}:`, 
          parseError instanceof Error ? parseError.message : 'Unknown error'
        );
        
        if (isVerbose && parseError instanceof Error) {
          console.error('Stack trace:', parseError.stack);
        }
      }
    }
    
    const responseData = {
      data: latestData,
      containerId: containerId,
      totalBlobs: latestBlobs.length,
      timestamp: new Date().toISOString(),
      summary: {
        totalRecords: latestData.reduce((sum, item) => sum + item.recordCount, 0),
        latestBlobTimestamp: latestBlobs[0]?.lastModified,
        oldestBlobTimestamp: latestBlobs[latestBlobs.length - 1]?.lastModified,
        csvFormat: detectedFormat,
        normalized: true,
        calibrated: latestData.some(item => item.csvMetadata.calibrated) // ✅ Overall calibration status
      }
    };
    
    console.log(`✅ Completed: ${latestData.length} blob(s), ${responseData.summary.totalRecords} records (Format: ${detectedFormat}, Calibrated: ${responseData.summary.calibrated})`);
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('💥 Critical error:', error instanceof Error ? error.message : 'Unknown error');
    
    if (isVerbose && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    
    return NextResponse.json(
      {
        error: 'Failed to fetch latest data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const revalidate = 300; // Cache for 5 minutes



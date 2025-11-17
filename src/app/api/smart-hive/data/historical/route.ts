// app/api/data/historical/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '../../../../../lib/azure';
import { csvUtils, csvParser } from '../../../../../lib/csvParser';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { fetchCalibrations, applyCalibrationToDataset } from '../../../../../lib/calibrationUtils';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Environment-based logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'production';
const isVerbose = LOG_LEVEL === 'verbose' || LOG_LEVEL === 'debug';

export async function GET(request: NextRequest) {
  console.log('🚀 [HISTORICAL API] Starting request');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '24');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const containerId = searchParams.get('containerId');
    
    if (isVerbose) {
      console.log('📊 Request params:', { limit, dateFrom, dateTo, containerId });
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
    
    // Initialize Azure service
    const azureService = new AzureBlobService(containerId);
    const blobs = await azureService.listBlobs();
    
    console.log(`📁 Found ${blobs.length} blobs in container: ${containerId}`);
    
    // Filter blobs by date range if provided
    let filteredBlobs = blobs;
    if (dateFrom || dateTo) {
      filteredBlobs = blobs.filter(blob => {
        if (!blob.lastModified) return false;
        
        const blobDate = new Date(blob.lastModified);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        
        return (!fromDate || blobDate >= fromDate) && (!toDate || blobDate <= toDate);
      });
      
      console.log(`📅 Date filtered: ${blobs.length} → ${filteredBlobs.length} blobs`);
    }
    
    // Get recent files
    const recentBlobs = filteredBlobs.slice(0, limit);
    console.log(`🔄 Processing ${recentBlobs.length} blobs (limit: ${limit})`);
    
    const historicalData = [];
    const processingErrors = [];
    let processedCount = 0;
    
    for (const blob of recentBlobs) {
      try {
        // Log progress
        processedCount++;
        if (processedCount % 10 === 0 || processedCount === recentBlobs.length) {
          console.log(`⏳ Progress: ${processedCount}/${recentBlobs.length} blobs`);
        }
        
        // Download and parse
        const csvContent = await azureService.downloadBlob(blob.name);
        const parsedResult = await csvUtils.parseAzureCSV(csvContent);
        
        // Transform data
        const transformedData = csvParser.transformForDashboard(parsedResult, {
          dateFields: ['timestamp', 'lastModified', 'createdAt'],
          numericFields: ['value', 'size', 'count', 'duration', 'temp_internal', 'temp_external', 'humidity', 'weight'],
          requiredFields: ['timestamp'],
          defaultValues: {
            timestamp: blob.lastModified || new Date().toISOString(),
            source: blob.name,
            blobName: blob.name,
            containerId: containerId
          }
        });
        
        // Add metadata
        const enrichedData = transformedData.map((record: any) => ({
          ...record,
          _metadata: {
            sourceBlob: blob.name,
            containerId: containerId,
            lastModified: blob.lastModified || new Date().toISOString(),
            size: blob.size,
            processedAt: new Date().toISOString()
          }
        }));
        
        historicalData.push(...enrichedData);
        
        if (isVerbose) {
          console.log(`✓ Processed ${blob.name}: ${enrichedData.length} records`);
        }
        
      } catch (parseError) {
        const errorInfo = {
          blob: blob.name,
          containerId: containerId,
          error: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        };
        
        console.error(`❌ Error parsing ${blob.name}:`, errorInfo.error);
        processingErrors.push(errorInfo);
      }
    }

    // ✅ STEP 2: Apply calibrations if user is authenticated
    let calibratedHistoricalData = historicalData;
    
    if (userId && containerId) {
      const calibrations = await fetchCalibrations(userId, containerId, prisma);
      
      if (calibrations.size > 0) {
        console.log(`🔧 Applying ${calibrations.size} calibration(s) to historical data`);
        calibratedHistoricalData = applyCalibrationToDataset(historicalData, calibrations);
      } else {
        console.log('ℹ️ No calibrations found for this user/container');
      }
    }
    
    // Sort by timestamp (most recent first)
    calibratedHistoricalData.sort((a, b) => {
      const timestampA = new Date(a.timestamp || a._metadata?.lastModified || new Date()).getTime();
      const timestampB = new Date(b.timestamp || b._metadata?.lastModified || new Date()).getTime();
      return timestampB - timestampA;
    });
    
    const responseData = {
      data: calibratedHistoricalData,
      containerId: containerId,
      totalFiles: recentBlobs.length,
      totalRecords: calibratedHistoricalData.length,
      processingErrors,
      calibrated: calibratedHistoricalData.some(r => r._calibrated), // ✅ Track calibration status
      metadata: {
        requestedLimit: limit,
        actualFiles: recentBlobs.length,
        dateRange: {
          from: dateFrom,
          to: dateTo
        },
        generatedAt: new Date().toISOString()
      }
    };
    
    console.log(`✅ Completed: ${recentBlobs.length} files, ${calibratedHistoricalData.length} records, ${processingErrors.length} errors (Calibrated: ${responseData.calibrated})`);
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('💥 Critical error:', error instanceof Error ? error.message : 'Unknown error');
    
    if (isVerbose && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    
    return NextResponse.json(
      {
        error: 'Failed to fetch historical data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const revalidate = 0; // No cache for historical data
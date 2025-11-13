// app/api/data/historical/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { AzureBlobService } from '../../../../../lib/azure';
import { csvUtils, csvParser } from '../../../../../lib/csvParser';

// hey Environment-based logging
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
    
    // 1- Validate container ID
    if (!containerId) {
      console.error('❌ Missing containerId parameter');
      return NextResponse.json({
        error: 'containerId parameter is required',
        data: [],
        timestamp: new Date().toISOString()
      }, { status: 400 });
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
        // Only log progress every 10 blobs or on last blob
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
          numericFields: ['value', 'size', 'count', 'duration'],
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
        
        // Verbose logging only
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
    
    // Sort by timestamp (most recent first)
    historicalData.sort((a, b) => {
      const timestampA = new Date(a.timestamp || a._metadata?.lastModified || new Date()).getTime();
      const timestampB = new Date(b.timestamp || b._metadata?.lastModified || new Date()).getTime();
      return timestampB - timestampA;
    });
    
    const responseData = {
      data: historicalData,
      containerId: containerId,
      totalFiles: recentBlobs.length,
      totalRecords: historicalData.length,
      processingErrors,
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
    
    console.log(`✅ Completed: ${recentBlobs.length} files, ${historicalData.length} records, ${processingErrors.length} errors`);
    
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

export const revalidate = 0; // Cache for 1 hour
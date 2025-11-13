// app/api/smart-hive/containers/public/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export const dynamic = 'force-dynamic';

interface AzureContainer {
  name: string;
  lastModified?: Date;
  blobCount?: number;
}

// ============================================================================
// GET - Fetch all Azure Blob Storage containers (NO AUTH REQUIRED)
// ============================================================================
export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📥 GET /api/smart-hive/containers/public (NO AUTH)');
  console.log('='.repeat(70));

  try {
    // Get Azure Storage credentials
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      console.error('❌ Azure Storage connection string not configured');
      return NextResponse.json({
        success: false,
        error: 'Azure Storage not configured. Please contact support.'
      }, { status: 500 });
    }

    console.log('☁️  Connecting to Azure Blob Storage...');

    // Create BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // List all containers
    const containers: AzureContainer[] = [];
    
    console.log('📦 Fetching containers...');

    for await (const container of blobServiceClient.listContainers()) {
      console.log(`  - Found container: ${container.name}`);
      
      // Get container properties
      const containerClient = blobServiceClient.getContainerClient(container.name);
      
      // Count blobs in container (optional - can be slow for large containers)
      let blobCount = 0;
      try {
        for await (const blob of containerClient.listBlobsFlat()) {
          blobCount++;
          // Limit counting to avoid timeout
          if (blobCount >= 100) {
            blobCount = 100; // Cap at 100+ for faster response
            break;
          }
        }
      } catch (countError) {
        console.warn(`    ⚠️  Could not count blobs in ${container.name}`);
        blobCount = 0;
      }

      containers.push({
        name: container.name,
        lastModified: container.properties.lastModified,
        blobCount: blobCount
      });
    }

    console.log(`✅ Found ${containers.length} containers`);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      data: containers,
      total: containers.length
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error fetching containers:', error);
    console.log('='.repeat(70) + '\n');

    // Azure-specific errors
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return NextResponse.json({
        success: false,
        error: 'Could not connect to Azure Storage. Please check configuration.'
      }, { status: 503 });
    }

    if (error.statusCode === 403 || error.code === 'AuthenticationFailed') {
      return NextResponse.json({
        success: false,
        error: 'Azure Storage authentication failed. Please check credentials.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch containers. Please try again.',
      details: error.message
    }, { status: 500 });
  }
}
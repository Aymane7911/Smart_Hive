// app/api/smart-hive/containers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { BlobServiceClient } from '@azure/storage-blob';

interface TokenPayload {
  adminId: number;
  email: string;
  role: string;
  schemaName?: string;
  isOwner?: boolean;
  iat: number;
  exp: number;
}

interface AzureContainer {
  name: string;
  lastModified?: Date;
  blobCount?: number;
}

// ============================================================================
// ADMIN ACCESS VERIFICATION MIDDLEWARE
// ============================================================================
async function verifyAdminAccess(request: NextRequest): Promise<TokenPayload> {
  console.log('🔒 Verifying admin access for containers API...');

  const token = request.cookies.get('admin-token')?.value;
  
  if (!token) {
    console.log('❌ No admin token found');
    throw new Error('UNAUTHORIZED');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('❌ JWT_SECRET not configured');
    throw new Error('SERVER_CONFIG_ERROR');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    
    console.log('👤 Token decoded:', {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      isOwner: decoded.isOwner
    });

    // Check if user has admin privileges (either admin role OR isOwner flag)
    const isAdmin = decoded.role === 'admin' || decoded.isOwner === true;

    if (!isAdmin) {
      console.log('⛔ Access denied - user is not admin');
      throw new Error('ADMIN_ACCESS_REQUIRED');
    }

    console.log('✅ Admin access verified for containers');
    return decoded;

  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    }
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    throw error;
  }
}

// ============================================================================
// GET - Fetch all Azure Blob Storage containers
// ============================================================================
export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📥 GET /api/smart-hive/containers');
  console.log('='.repeat(70));

  try {
    // Verify admin access
    await verifyAdminAccess(request);

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
          if (blobCount >= 1000) {
            blobCount = 1000; // Cap at 1000+
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

    // Handle specific error types
    if (error.message === 'UNAUTHORIZED' || error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized. Please log in again.'
      }, { status: 401 });
    }

    if (error.message === 'ADMIN_ACCESS_REQUIRED') {
      return NextResponse.json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      }, { status: 403 });
    }

    if (error.message === 'SERVER_CONFIG_ERROR') {
      return NextResponse.json({
        success: false,
        error: 'Server configuration error. Please contact support.'
      }, { status: 500 });
    }

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
      error: 'Failed to fetch containers. Please try again.'
    }, { status: 500 });
  }
}

// ============================================================================
// POST - Create a new Azure container (optional)
// ============================================================================
export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📤 POST /api/smart-hive/containers');
  console.log('='.repeat(70));

  try {
    // Verify admin access
    await verifyAdminAccess(request);

    const body = await request.json();
    const { containerName } = body;

    if (!containerName) {
      return NextResponse.json({
        success: false,
        error: 'Container name is required'
      }, { status: 400 });
    }

    // Validate container name (Azure rules)
    const containerNameRegex = /^[a-z0-9](?!.*--)[a-z0-9-]{1,61}[a-z0-9]$/;
    if (!containerNameRegex.test(containerName)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid container name. Must be 3-63 characters, lowercase letters, numbers, and hyphens only.'
      }, { status: 400 });
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      return NextResponse.json({
        success: false,
        error: 'Azure Storage not configured'
      }, { status: 500 });
    }

    console.log(`📦 Creating container: ${containerName}`);

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container
    // Access levels: 'blob' (anonymous read for blobs), 'container' (anonymous read for container and blobs), or undefined (private)
    const createResponse = await containerClient.createIfNotExists({
      access: undefined // Private access (no anonymous access)
    });

    if (createResponse.succeeded) {
      console.log(`✅ Container created: ${containerName}`);
      
      return NextResponse.json({
        success: true,
        message: 'Container created successfully',
        data: {
          name: containerName,
          created: true
        }
      }, { status: 201 });
    } else {
      console.log(`⚠️  Container already exists: ${containerName}`);
      
      return NextResponse.json({
        success: true,
        message: 'Container already exists',
        data: {
          name: containerName,
          created: false
        }
      }, { status: 200 });
    }

  } catch (error: any) {
    console.error('❌ Error creating container:', error);

    if (error.message === 'UNAUTHORIZED' || error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized. Please log in again.'
      }, { status: 401 });
    }

    if (error.message === 'ADMIN_ACCESS_REQUIRED') {
      return NextResponse.json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create container. Please try again.'
    }, { status: 500 });
  }
}

// ============================================================================
// Handle other HTTP methods
// ============================================================================
export async function PUT() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed'
  }, { status: 405 });
}
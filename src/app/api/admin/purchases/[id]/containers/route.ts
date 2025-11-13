// app/api/admin/purchases/[id]/containers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface TokenPayload {
  adminId: number;
  email: string;
  role: string;
}

// ============================================================================
// ADMIN ACCESS VERIFICATION
// ============================================================================
async function verifyAdminAccess(request: NextRequest): Promise<TokenPayload> {
  const token = request.cookies.get('admin-token')?.value;
  
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    
    const isAdmin = decoded.role === 'admin';
    if (!isAdmin) {
      throw new Error('ADMIN_ACCESS_REQUIRED');
    }

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
// PUT - Update container assignments for a purchase
// ============================================================================
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log('\n' + '='.repeat(70));
  console.log('📤 PUT /api/admin/purchases/[id]/containers');
  console.log('='.repeat(70));

  try {
    // Verify admin access
    await verifyAdminAccess(request);

    // 🔑 FIX: Await params before accessing properties
    const params = await context.params;
    const purchaseId = parseInt(params.id);

    console.log(`📦 Updating containers for purchase ID: ${purchaseId}`);

    if (isNaN(purchaseId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid purchase ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const { containers, adminNotes } = body;

    if (!Array.isArray(containers)) {
      return NextResponse.json({
        success: false,
        error: 'Containers must be an array'
      }, { status: 400 });
    }

    console.log(`📋 Assigning ${containers.length} containers:`, containers);
    console.log(`📝 Admin notes: ${adminNotes || '(none)'}`);

    // Check if purchase exists
    const existingPurchase = await prisma.purchase.findUnique({
      where: { id: purchaseId }
    });

    if (!existingPurchase) {
      console.log(`❌ Purchase not found: ${purchaseId}`);
      return NextResponse.json({
        success: false,
        error: 'Purchase not found'
      }, { status: 404 });
    }

    // Update purchase with new container assignments
    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        assignedContainers: containers,
        adminNotes: adminNotes || null,
        updatedAt: new Date()
      },
      include: {
        user: true
      }
    });

    console.log(`✅ Containers updated successfully for purchase ${purchaseId}`);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Container assignments updated successfully',
      data: updatedPurchase
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Update containers error:', error);
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

    return NextResponse.json({
      success: false,
      error: 'Failed to update container assignments. Please try again.'
    }, { status: 500 });
  }
}

// ============================================================================
// GET - Get container assignments for a purchase
// ============================================================================
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAccess(request);

    // 🔑 FIX: Await params
    const params = await context.params;
    const purchaseId = parseInt(params.id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid purchase ID'
      }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: true
      }
    });

    if (!purchase) {
      return NextResponse.json({
        success: false,
        error: 'Purchase not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        purchaseId: purchase.id,
        assignedContainers: purchase.assignedContainers,
        adminNotes: purchase.adminNotes
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Get containers error:', error);

    if (error.message === 'UNAUTHORIZED' || error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    if (error.message === 'ADMIN_ACCESS_REQUIRED') {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch container assignments'
    }, { status: 500 });
  }
}
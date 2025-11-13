// app/api/admin/purchases/[id]/revoke/route.ts
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log('\n' + '='.repeat(70));
  console.log('🔒 POST /api/admin/purchases/[id]/revoke');
  console.log('='.repeat(70));

  try {
    await verifyAdminAccess(request);

    // 🔑 FIX: Await params
    const params = await context.params;
    const purchaseId = parseInt(params.id);

    console.log(`🔐 Revoking access for purchase ID: ${purchaseId}`);

    if (isNaN(purchaseId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid purchase ID'
      }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { user: true }
    });

    if (!purchase) {
      console.log(`❌ Purchase not found: ${purchaseId}`);
      return NextResponse.json({
        success: false,
        error: 'Purchase not found'
      }, { status: 404 });
    }

    if (!purchase.accessGranted) {
      console.log(`⚠️  Access not granted for purchase ${purchaseId}`);
      return NextResponse.json({
        success: false,
        error: 'Access not currently granted for this purchase'
      }, { status: 400 });
    }

    // Revoke access
    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        accessGranted: false,
        accessGrantedAt: null
      },
      include: { user: true }
    });

    console.log(`✅ Access revoked from ${purchase.user.email}`);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Access revoked successfully',
      data: updatedPurchase
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Revoke access error:', error);
    console.log('='.repeat(70) + '\n');

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
      error: 'Failed to revoke access'
    }, { status: 500 });
  }
}
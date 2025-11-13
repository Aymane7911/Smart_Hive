//app/api/smart-hive/access/route.ts
 
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface TokenPayload {
  userId?: number;
  id?: number;
  email?: string;
  role?: string;
}

export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('🔐 Smart Hive Access Check API Called');
  console.log('='.repeat(70));
  
  try {
    // Get token from cookies - check all possible cookie names
    const token = request.cookies.get('user-token')?.value || 
                  request.cookies.get('auth-token')?.value ||
                  request.cookies.get('admin-token')?.value;

    if (!token) {
      console.log('❌ No authentication token found');
      return NextResponse.json(
        { 
          success: true, 
          hasPurchased: false,
          hasAccess: false,
          message: 'Not authenticated. Please log in.'
        },
        { status: 200 }
      );
    }

    // Decode and verify JWT token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      console.log('✅ Token decoded:', { 
        userId: decoded.userId || decoded.id, 
        email: decoded.email,
        role: decoded.role
      });
    } catch (error: any) {
      console.log('❌ Invalid token:', error.message);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or expired token',
          hasPurchased: false,
          hasAccess: false
        },
        { status: 401 }
      );
    }

    // Validate we have a user identifier
    const userIdRaw = decoded.userId || decoded.id;
    const userEmail = decoded.email;

    if (!userIdRaw && !userEmail) {
      console.log('❌ Token missing user identifier');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid token: missing user identifier',
          hasPurchased: false,
          hasAccess: false
        },
        { status: 401 }
      );
    }

    // Convert userId to number if it's a string
    const userId = typeof userIdRaw === 'string' ? parseInt(userIdRaw, 10) : userIdRaw;

    // Find user by ID or email
    let user;
    if (userId && !isNaN(userId)) {
      user = await prisma.user.findUnique({
        where: { id: userId }
      });
      console.log(`🔍 Searched by ID: ${userId}, found:`, !!user);
    }
    
    // If not found by ID, try email
    if (!user && userEmail) {
      user = await prisma.user.findUnique({
        where: { email: userEmail }
      });
      console.log(`🔍 Searched by email: ${userEmail}, found:`, !!user);
    }

    if (!user) {
      console.log('❌ User not found in database');
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found',
          hasPurchased: false,
          hasAccess: false
        },
        { status: 404 }
      );
    }

    console.log(`✅ User found: ${user.email} (ID: ${user.id})`);

    // Check for ANY Smart Hive purchase (to determine hasPurchased)
    const anyPurchase = await prisma.purchase.findFirst({
      where: {
        userId: user.id
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    });

    console.log('📦 Any purchase found:', !!anyPurchase);

    // Check for ACTIVE Smart Hive purchase (with access granted by admin)
    const activePurchase = await prisma.purchase.findFirst({
      where: {
        userId: user.id,
        accessGranted: true  // Changed from hasAccess to accessGranted
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    });

    console.log('✅ Active purchase with access:', !!activePurchase);

    const hasPurchased = !!anyPurchase;
    const hasAccess = !!activePurchase;

    // Case 1: No purchase at all
    if (!hasPurchased) {
      console.log('❌ No purchase found for user:', user.id);
      console.log('='.repeat(70) + '\n');
      return NextResponse.json({
        success: true,
        hasPurchased: false,
        hasAccess: false,
        message: 'No Smart Hive purchase found. Please purchase a plan first.'
      });
    }

    // Case 2: Purchase exists but access not granted yet
    if (!hasAccess) {
      console.log('⏳ Purchase found but access not granted yet');
      console.log('Purchase status:', anyPurchase.status);
      console.log('='.repeat(70) + '\n');
      return NextResponse.json({
        success: true,
        hasPurchased: true,
        hasAccess: false,
        message: 'Purchase pending admin approval. Please wait for admin to grant access.',
        pendingPurchase: {
          id: anyPurchase.id,
          masterHives: anyPurchase.masterHives,
          normalHives: anyPurchase.normalHives,
          purchaseDate: anyPurchase.purchaseDate,
          status: anyPurchase.status
        }
      });
    }

    // Case 3: Active purchase with access granted
    const assignedContainers = activePurchase.assignedContainers || [];
    
    console.log('✅ Active purchase found:', {
      id: activePurchase.id,
      masterHives: activePurchase.masterHives,
      normalHives: activePurchase.normalHives,
      assignedContainers: assignedContainers.length,
      accessGrantedAt: activePurchase.accessGrantedAt
    });

    // Check if admin has assigned containers
    if (assignedContainers.length === 0) {
      console.log('⚠️  Access granted but no containers assigned yet');
      console.log('='.repeat(70) + '\n');
      return NextResponse.json({
        success: true,
        hasPurchased: true,
        hasAccess: true,
        message: 'Access granted but no containers assigned yet. Please contact admin.',
        purchase: {
          id: activePurchase.id,
          masterHives: activePurchase.masterHives,
          normalHives: activePurchase.normalHives,
          purchaseDate: activePurchase.purchaseDate,
          accessGrantedAt: activePurchase.accessGrantedAt,
          assignedContainers: []
        }
      });
    }

    console.log('✅ Full access granted with containers:', assignedContainers);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      hasPurchased: true,
      hasAccess: true,
      message: `Access granted to ${assignedContainers.length} container(s)`,
      purchase: {
        id: activePurchase.id,
        masterHives: activePurchase.masterHives,
        normalHives: activePurchase.normalHives,
        totalAmount: activePurchase.totalAmount,
        purchaseDate: activePurchase.purchaseDate,
        accessGrantedAt: activePurchase.accessGrantedAt,
        assignedContainers: assignedContainers,
        status: activePurchase.status,
        adminNotes: activePurchase.adminNotes
      }
    });

  } catch (error: any) {
    console.error('❌ Check access error:', error);
    console.log('='.repeat(70) + '\n');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check access',
        hasPurchased: false,
        hasAccess: false,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

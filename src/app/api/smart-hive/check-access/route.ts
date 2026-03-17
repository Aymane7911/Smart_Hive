//app/api/smart-hive/check-access/route.ts

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
    const token = request.cookies.get('user-token')?.value || 
                  request.cookies.get('auth-token')?.value ||
                  request.cookies.get('admin-token')?.value;

    if (!token) {
      console.log('❌ No authentication token found');
      return NextResponse.json(
        { success: true, hasPurchased: false, hasAccess: false, message: 'Not authenticated. Please log in.' },
        { status: 200 }
      );
    }

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      console.log('✅ Token decoded:', { userId: decoded.userId || decoded.id, email: decoded.email, role: decoded.role });
    } catch (error: any) {
      console.log('❌ Invalid token:', error.message);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token', hasPurchased: false, hasAccess: false },
        { status: 401 }
      );
    }

    const userIdRaw = decoded.userId || decoded.id;
    const userEmail = decoded.email;

    if (!userIdRaw && !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Invalid token: missing user identifier', hasPurchased: false, hasAccess: false },
        { status: 401 }
      );
    }

    const userId = typeof userIdRaw === 'string' ? parseInt(userIdRaw, 10) : userIdRaw;

    let user;
    if (userId && !isNaN(userId)) {
      user = await prisma.user.findUnique({ where: { id: userId } });
      console.log(`🔍 Searched by ID: ${userId}, found:`, !!user);
    }
    if (!user && userEmail) {
      user = await prisma.user.findUnique({ where: { email: userEmail } });
      console.log(`🔍 Searched by email: ${userEmail}, found:`, !!user);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found', hasPurchased: false, hasAccess: false },
        { status: 404 }
      );
    }

    console.log(`✅ User found: ${user.email} (ID: ${user.id}, Role: ${user.role})`);

    // ── Shared user info included in every response ────────────────
    const userInfo = {
      id:        user.id,
      email:     user.email,
      firstname: user.firstname,
      lastname:  user.lastname,
      role:      user.role,
    };

    // ── Admin bypass — admins always have full access ──────────────
    if (user.role === 'admin') {
      console.log('👑 Admin user — granting full access bypass');
      const anyPurchase = await prisma.purchase.findFirst({
        where: { userId: user.id },
        orderBy: { purchaseDate: 'desc' },
      });
      return NextResponse.json({
        success:      true,
        hasPurchased: true,
        hasAccess:    true,
        user:         userInfo,
        role:         user.role,
        purchase: anyPurchase ?? {
          id: 0,
          masterHives: 0,
          normalHives: 0,
          totalAmount: 0,
          purchaseDate: new Date().toISOString(),
          accessGrantedAt: new Date().toISOString(),
          assignedContainers: [],
          status: 'approved',
          adminNotes: null,
        },
      });
    }

    // ── Regular user checks ────────────────────────────────────────
    const anyPurchase = await prisma.purchase.findFirst({
      where: { userId: user.id },
      orderBy: { purchaseDate: 'desc' },
    });

    console.log('📦 Any purchase found:', !!anyPurchase);

    const activePurchase = await prisma.purchase.findFirst({
      where: { userId: user.id, accessGranted: true },
      orderBy: { purchaseDate: 'desc' },
    });

    console.log('✅ Active purchase with access:', !!activePurchase);

    const hasPurchased = !!anyPurchase;
    const hasAccess    = !!activePurchase;

    if (!hasPurchased) {
      console.log('❌ No purchase found for user:', user.id);
      return NextResponse.json({
        success: true, hasPurchased: false, hasAccess: false,
        user: userInfo, role: user.role,
        message: 'No Smart Hive purchase found. Please purchase a plan first.',
      });
    }

    if (!hasAccess) {
      console.log('⏳ Purchase found but access not granted yet');
      return NextResponse.json({
        success: true, hasPurchased: true, hasAccess: false,
        user: userInfo, role: user.role,
        message: 'Purchase pending admin approval. Please wait for admin to grant access.',
        pendingPurchase: {
          id:          anyPurchase!.id,
          masterHives: anyPurchase!.masterHives,
          normalHives: anyPurchase!.normalHives,
          purchaseDate: anyPurchase!.purchaseDate,
          status:      anyPurchase!.status,
        },
      });
    }

    const assignedContainers = activePurchase!.assignedContainers || [];

    if (assignedContainers.length === 0) {
      return NextResponse.json({
        success: true, hasPurchased: true, hasAccess: true,
        user: userInfo, role: user.role,
        message: 'Access granted but no containers assigned yet. Please contact admin.',
        purchase: {
          id:                 activePurchase!.id,
          masterHives:        activePurchase!.masterHives,
          normalHives:        activePurchase!.normalHives,
          purchaseDate:       activePurchase!.purchaseDate,
          accessGrantedAt:    activePurchase!.accessGrantedAt,
          assignedContainers: [],
        },
      });
    }

    console.log('✅ Full access granted with containers:', assignedContainers);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success:      true,
      hasPurchased: true,
      hasAccess:    true,
      user:         userInfo,
      role:         user.role,
      message:      `Access granted to ${assignedContainers.length} container(s)`,
      purchase: {
        id:                 activePurchase!.id,
        masterHives:        activePurchase!.masterHives,
        normalHives:        activePurchase!.normalHives,
        totalAmount:        activePurchase!.totalAmount,
        purchaseDate:       activePurchase!.purchaseDate,
        accessGrantedAt:    activePurchase!.accessGrantedAt,
        assignedContainers: assignedContainers,
        status:             activePurchase!.status,
        adminNotes:         activePurchase!.adminNotes,
      },
    });

  } catch (error: any) {
    console.error('❌ Check access error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check access', hasPurchased: false, hasAccess: false,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}
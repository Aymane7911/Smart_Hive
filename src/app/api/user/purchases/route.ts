// app/api/user/purchases/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Type definitions for better TypeScript support
interface JWTPayload {
  userId?: number;
  id?: number;
  email: string;
}

interface PurchaseFromDB {
  id: number;
  masterHives: number;
  normalHives: number;
  totalAmount: number;
  purchaseDate: Date;
  status: string;
  accessGranted: boolean;
  accessGrantedAt: Date | null;
  assignedContainers: string[];
}

interface SerializedPurchase {
  id: number;
  masterHives: number;
  normalHives: number;
  totalAmount: number;
  purchaseDate: string;
  status: string;
  accessGranted: boolean;
  accessGrantedAt: string | null;
  assignedContainers: string[];
}

export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📦 API: Fetching User Purchases');
  console.log('='.repeat(70));

  try {
    // Step 1: Get token from cookies
    console.log('🔐 Step 1: Checking authentication...');
    const token = request.cookies.get('token')?.value || 
                  request.cookies.get('user-token')?.value;

    if (!token) {
      console.log('❌ No token found in cookies');
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Step 2: Verify JWT token
    console.log('🔐 Step 2: Verifying token...');
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log('✅ Token verified successfully');
      console.log(`   User Email: ${decoded.email}`);
    } catch (error) {
      console.log('❌ Invalid or expired token');
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Step 3: Extract user ID
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      console.log('❌ No user ID found in token');
      return NextResponse.json(
        { success: false, error: 'Invalid token payload' },
        { status: 401 }
      );
    }

    console.log(`✅ User ID extracted: ${userId}`);

    // Step 4: Fetch purchases from database
    console.log('📦 Step 3: Fetching purchases from database...');
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: Number(userId)
      },
      orderBy: {
        purchaseDate: 'desc'
      },
      select: {
        id: true,
        masterHives: true,
        normalHives: true,
        totalAmount: true,
        purchaseDate: true,
        status: true,
        accessGranted: true,
        accessGrantedAt: true,
        assignedContainers: true
      }
    });

    console.log(`✅ Found ${purchases.length} purchase(s) for user ${userId}`);

    // Step 5: Log details of each purchase for debugging
    if (purchases.length > 0) {
      console.log('\n📊 Purchase Details:');
      purchases.forEach((purchase: PurchaseFromDB, idx: number) => {
        console.log(`\n📦 Purchase ${idx + 1}:`);
        console.log(`   ├─ ID: ${purchase.id}`);
        console.log(`   ├─ Status: ${purchase.status}`);
        console.log(`   ├─ Access Granted: ${purchase.accessGranted}`);
        console.log(`   ├─ Master Hives: ${purchase.masterHives}`);
        console.log(`   ├─ Normal Hives: ${purchase.normalHives}`);
        console.log(`   ├─ Total Amount: ${purchase.totalAmount}`);
        console.log(`   ├─ Purchase Date: ${purchase.purchaseDate.toISOString()}`);
        console.log(`   ├─ Assigned Containers: ${purchase.assignedContainers?.length || 0}`);
        
        if (purchase.assignedContainers && purchase.assignedContainers.length > 0) {
          purchase.assignedContainers.forEach((containerId: string, containerIdx: number) => {
            const isLast = containerIdx === purchase.assignedContainers.length - 1;
            const prefix = isLast ? '   └─' : '   ├─';
            console.log(`${prefix} Container ${containerIdx + 1}: ${containerId}`);
          });
        } else {
          console.log('   └─ ⚠️  No containers assigned yet');
        }
      });
    } else {
      console.log('\n⚠️  No purchases found for this user');
    }

    // Step 6: Serialize purchases for JSON response
    console.log('\n🔄 Step 4: Serializing purchases...');
    const serializedPurchases: SerializedPurchase[] = purchases.map((purchase: PurchaseFromDB): SerializedPurchase => ({
      id: Number(purchase.id),
      masterHives: purchase.masterHives,
      normalHives: purchase.normalHives,
      totalAmount: purchase.totalAmount,
      purchaseDate: purchase.purchaseDate.toISOString(),
      status: purchase.status,
      accessGranted: purchase.accessGranted,
      accessGrantedAt: purchase.accessGrantedAt?.toISOString() || null,
      assignedContainers: purchase.assignedContainers || []
    }));

    // Step 7: Calculate summary statistics
    const stats = {
      totalPurchases: serializedPurchases.length,
      activePurchases: serializedPurchases.filter((p: SerializedPurchase) => 
        p.status === 'approved' && p.accessGranted && p.assignedContainers.length > 0
      ).length,
      pendingPurchases: serializedPurchases.filter((p: SerializedPurchase) => p.status === 'pending').length,
      totalHives: serializedPurchases.reduce((sum: number, p: SerializedPurchase) => sum + p.masterHives + p.normalHives, 0),
      totalContainers: serializedPurchases.reduce((sum: number, p: SerializedPurchase) => sum + p.assignedContainers.length, 0)
    };

    console.log('\n📊 Summary Statistics:');
    console.log(`   Total Purchases: ${stats.totalPurchases}`);
    console.log(`   Active Purchases: ${stats.activePurchases}`);
    console.log(`   Pending Purchases: ${stats.pendingPurchases}`);
    console.log(`   Total Hives: ${stats.totalHives}`);
    console.log(`   Total Containers: ${stats.totalContainers}`);

    console.log('\n✅ Success: Returning purchase data');
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      purchases: serializedPurchases,
      count: serializedPurchases.length,
      stats: stats
    });

  } catch (error) {
    console.error('\n❌ ERROR: Failed to fetch purchases');
    console.error('Error details:', error);
    console.log('='.repeat(70) + '\n');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch purchases',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    // Clean up database connection
    await prisma.$disconnect();
  }
}

// Optional: POST endpoint to update purchase notes or metadata
export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📝 API: Update Purchase Metadata');
  console.log('='.repeat(70));

  try {
    // Verify authentication
    const token = request.cookies.get('token')?.value || 
                  request.cookies.get('user-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid token payload' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { purchaseId, notes } = body;

    if (!purchaseId) {
      return NextResponse.json(
        { success: false, error: 'Purchase ID is required' },
        { status: 400 }
      );
    }

    // Verify the purchase belongs to this user
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: Number(purchaseId),
        userId: Number(userId)
      }
    });

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: 'Purchase not found or access denied' },
        { status: 404 }
      );
    }

    // Update purchase (currently just notes, can be extended)
    const updated = await prisma.purchase.update({
      where: {
        id: Number(purchaseId)
      },
      data: {
        adminNotes: notes || null,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Purchase ${purchaseId} updated successfully`);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Purchase updated successfully',
      purchase: {
        id: Number(updated.id),
        notes: updated.adminNotes
      }
    });

  } catch (error) {
    console.error('❌ Error updating purchase:', error);
    console.log('='.repeat(70) + '\n');
    
    return NextResponse.json(
      { success: false, error: 'Failed to update purchase' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
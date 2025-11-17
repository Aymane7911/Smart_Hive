import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface TokenPayload {
  userId?: number;
  id?: number;
  email?: string;
}

export async function GET(request: NextRequest) {
  console.log('📖 [GET CALIBRATION] API Called');
  
  try {
    // 1. Authenticate user
    const token = request.cookies.get('user-token')?.value || 
                  request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 2. Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const containerId = searchParams.get('containerId');
    const hiveNumber = searchParams.get('hiveNumber');

    if (!containerId || !hiveNumber) {
      return NextResponse.json(
        { success: false, error: 'containerId and hiveNumber are required' },
        { status: 400 }
      );
    }

    // 3. Fetch calibration from database
    const calibration = await prisma.calibration.findUnique({
      where: {
        userId_containerId_hiveNumber: {
          userId: userId,
          containerId: containerId,
          hiveNumber: parseInt(hiveNumber)
        }
      }
    });

    if (!calibration) {
      return NextResponse.json({
        success: true,
        hasCalibration: false,
        message: 'No calibration found for this hive'
      });
    }

    console.log('✅ Calibration found:', {
      userId,
      containerId,
      hiveNumber,
      calibrationId: calibration.id
    });

    return NextResponse.json({
      success: true,
      hasCalibration: true,
      calibration: {
        id: calibration.id,
        tempExternal: {
          offset: calibration.tempExternalOffset,
          visualized: calibration.tempExternalVisualized,
          real: calibration.tempExternalReal
        },
        tempInternal: {
          offset: calibration.tempInternalOffset,
          visualized: calibration.tempInternalVisualized,
          real: calibration.tempInternalReal
        },
        humidity: {
          offset: calibration.humidityOffset,
          visualized: calibration.humidityVisualized,
          real: calibration.humidityReal
        },
        weight: {
          offset: calibration.weightOffset,
          visualized: calibration.weightVisualized,
          real: calibration.weightReal
        },
        appliedAt: calibration.appliedAt,
        updatedAt: calibration.updatedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Get calibration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get calibration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
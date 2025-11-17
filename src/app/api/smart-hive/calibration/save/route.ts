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

export async function POST(request: NextRequest) {
  console.log('💾 [SAVE CALIBRATION] API Called');
  
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

    // 2. Parse request body
    const body = await request.json();
    const {
      containerId,
      hiveNumber,
      tempExternalOffset,
      tempExternalVisualized,
      tempExternalReal,
      tempInternalOffset,
      tempInternalVisualized,
      tempInternalReal,
      humidityOffset,
      humidityVisualized,
      humidityReal,
      weightOffset,
      weightVisualized,
      weightReal
    } = body;

    // 3. Validate required fields
    if (!containerId || !hiveNumber) {
      return NextResponse.json(
        { success: false, error: 'containerId and hiveNumber are required' },
        { status: 400 }
      );
    }

    // 4. Upsert calibration (update if exists, create if not)
    const calibration = await prisma.calibration.upsert({
      where: {
        userId_containerId_hiveNumber: {
          userId: userId,
          containerId: containerId,
          hiveNumber: parseInt(hiveNumber)
        }
      },
      update: {
        tempExternalOffset: parseFloat(tempExternalOffset) || 0,
        tempExternalVisualized: tempExternalVisualized ? parseFloat(tempExternalVisualized) : null,
        tempExternalReal: tempExternalReal ? parseFloat(tempExternalReal) : null,
        tempInternalOffset: parseFloat(tempInternalOffset) || 0,
        tempInternalVisualized: tempInternalVisualized ? parseFloat(tempInternalVisualized) : null,
        tempInternalReal: tempInternalReal ? parseFloat(tempInternalReal) : null,
        humidityOffset: parseFloat(humidityOffset) || 0,
        humidityVisualized: humidityVisualized ? parseFloat(humidityVisualized) : null,
        humidityReal: humidityReal ? parseFloat(humidityReal) : null,
        weightOffset: parseFloat(weightOffset) || 0,
        weightVisualized: weightVisualized ? parseFloat(weightVisualized) : null,
        weightReal: weightReal ? parseFloat(weightReal) : null,
        appliedAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        containerId: containerId,
        hiveNumber: parseInt(hiveNumber),
        tempExternalOffset: parseFloat(tempExternalOffset) || 0,
        tempExternalVisualized: tempExternalVisualized ? parseFloat(tempExternalVisualized) : null,
        tempExternalReal: tempExternalReal ? parseFloat(tempExternalReal) : null,
        tempInternalOffset: parseFloat(tempInternalOffset) || 0,
        tempInternalVisualized: tempInternalVisualized ? parseFloat(tempInternalVisualized) : null,
        tempInternalReal: tempInternalReal ? parseFloat(tempInternalReal) : null,
        humidityOffset: parseFloat(humidityOffset) || 0,
        humidityVisualized: humidityVisualized ? parseFloat(humidityVisualized) : null,
        humidityReal: humidityReal ? parseFloat(humidityReal) : null,
        weightOffset: parseFloat(weightOffset) || 0,
        weightVisualized: weightVisualized ? parseFloat(weightVisualized) : null,
        weightReal: weightReal ? parseFloat(weightReal) : null,
        appliedAt: new Date()
      }
    });

    console.log('✅ Calibration saved:', {
      userId,
      containerId,
      hiveNumber,
      calibrationId: calibration.id
    });

    return NextResponse.json({
      success: true,
      message: 'Calibration saved successfully',
      calibration: {
        id: calibration.id,
        appliedAt: calibration.appliedAt,
        offsets: {
          tempExternal: calibration.tempExternalOffset,
          tempInternal: calibration.tempInternalOffset,
          humidity: calibration.humidityOffset,
          weight: calibration.weightOffset
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Save calibration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save calibration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
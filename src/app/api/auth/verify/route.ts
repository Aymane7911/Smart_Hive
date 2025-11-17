import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

interface JWTPayload {
  adminId?: number;
  userId?: number;
  email: string;
  role: string;
  isOwner?: boolean;
}

export async function GET(request: NextRequest) {
  console.log('======================================================================');
  console.log('🔐 POST /api/auth/verify');
  console.log('======================================================================');

  try {
    // Get token from Authorization header or cookies
    let token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // Try to get from cookies
      token = request.cookies.get('authToken')?.value;
    }

    if (!token) {
      console.log('❌ No token provided');
      return NextResponse.json(
        { success: false, error: 'No authentication token provided' },
        { status: 401 }
      );
    }

    console.log('🔑 Token found, verifying...');

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    console.log('✅ Token verified successfully');
    console.log('👤 User info:', {
      adminId: decoded.adminId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isOwner: decoded.isOwner
    });

    // Return user information
    return NextResponse.json({
      success: true,
      adminId: decoded.adminId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isOwner: decoded.isOwner || false
    });

  } catch (error: any) {
    console.error('❌ Token verification failed:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { success: false, error: 'Token expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Token verification failed' },
      { status: 500 }
    );
  }
}

// Also support POST method
export async function POST(request: NextRequest) {
  return GET(request);
}
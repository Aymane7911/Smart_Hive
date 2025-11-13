import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper function to clear all authentication cookies
function clearAllAuthCookies(response: NextResponse) {
  const cookieNames = ['token', 'admin-token', 'user-token', 'auth-token'];
  
  cookieNames.forEach(name => {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });
  });
  
  console.log('🧹 All auth cookies cleared');
}

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('🔐 User Login Request');
  console.log('='.repeat(70));

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    console.log(`📧 Login attempt for: ${email}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        purchases: {
          where: {
            status: 'approved',
            accessGranted: true
          },
          select: {
            id: true,
            status: true,
            accessGranted: true
          }
        }
      }
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`✅ User found in database:`, {
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log(`❌ Invalid password for: ${email}`);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`✅ Password verified for: ${email}`);

    // Check if user has approved purchases (for regular users)
    const hasApprovedPurchase = user.purchases.length > 0 || user.role === 'admin';

    // ============================================================================
    // 🔥 CRITICAL FIX: Create token payload with ACTUAL user data
    // ============================================================================
    
    const tokenPayload: any = {
      userId: user.id.toString(),
      id: user.id,
      email: user.email, // ✅ ACTUAL user email
      role: user.role,
      firstname: user.firstname,
      lastname: user.lastname
    };

    // For admin users, add adminId field
    if (user.role === 'admin') {
      tokenPayload.adminId = user.id;
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    console.log(`✅ User logged in: ${user.email} (${user.role})`);
    console.log(`🎫 Token created for userId: ${user.id}, email: ${user.email}`);
    
    if (user.role === 'admin') {
      console.log(`🔐 Admin token generated with adminId: ${user.id}`);
    }

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: Number(user.id),
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        hasApprovedPurchase,
        phone: user.phone,
        address: user.address,
        city: user.city,
        country: user.country
      }
    });

    // ============================================================================
    // 🔥 CRITICAL FIX: Clear all old cookies first, then set new ones
    // ============================================================================
    
    clearAllAuthCookies(response);

    // Set role-specific cookie with UNIQUE name
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    };

    if (user.role === 'admin') {
      // Admin uses 'admin-token' cookie
      response.cookies.set('admin-token', token, cookieOptions);
      console.log('🔐 Admin cookie (admin-token) set for:', user.email);
    } else {
      // Regular users use 'user-token' cookie
      response.cookies.set('user-token', token, cookieOptions);
      console.log('🔐 User cookie (user-token) set for:', user.email);
    }

    // Also set general 'token' as fallback
    response.cookies.set('token', token, cookieOptions);

    console.log('='.repeat(70) + '\n');
    return response;

  } catch (error) {
    console.error('❌ Login error:', error);
    console.log('='.repeat(70) + '\n');
    return NextResponse.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// LOGOUT ENDPOINT - Enhanced cookie clearing
// ============================================================================

export async function DELETE(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('🚪 User Logout Request');
  console.log('='.repeat(70));

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });

  // Clear ALL possible auth cookies
  clearAllAuthCookies(response);

  console.log('✅ User logged out - all cookies cleared');
  console.log('='.repeat(70) + '\n');

  return response;
}
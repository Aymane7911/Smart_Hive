import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper function to clear all possible authentication cookies
 * This ensures clean logout even if multiple cookie names were used
 */
function clearAllAuthCookies(response: NextResponse) {
  // List of all possible auth cookie names used in the system
  const cookieNames = [
    'token',           // General auth token
    'admin-token',     // Admin-specific token
    'user-token',      // User-specific token
    'auth-token',      // Alternative auth token name
    'authToken',       // Camel case variant
  ];
  
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,  // Expire immediately
    path: '/'   // Clear for entire domain
  };
  
  // Clear each cookie
  cookieNames.forEach(name => {
    response.cookies.set(name, '', cookieOptions);
  });
  
  console.log(`🧹 Cleared ${cookieNames.length} authentication cookies`);
}

/**
 * ============================================================================
 * POST /api/auth/logout
 * ============================================================================
 * Handles user logout - clears all session cookies
 */
export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('🚪 Logout Request');
  console.log('='.repeat(70));

  try {
    // Get current token to log user info (optional)
    const token = request.cookies.get('token')?.value || 
                  request.cookies.get('user-token')?.value ||
                  request.cookies.get('admin-token')?.value;

    if (token) {
      try {
        // Optionally decode token to log which user is logging out
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token) as any;
        console.log(`👤 User logging out: ${decoded?.email || 'Unknown'}`);
      } catch (err) {
        console.log('⚠️  Could not decode token for logging');
      }
    } else {
      console.log('⚠️  No active session found');
    }

    // Create success response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    }, { status: 200 });

    // Clear all authentication cookies
    clearAllAuthCookies(response);

    console.log('✅ Logout successful - all cookies cleared');
    console.log('='.repeat(70) + '\n');

    return response;

  } catch (error: any) {
    console.error('❌ Logout error:', error);
    console.log('='.repeat(70) + '\n');

    // Even if there's an error, still try to clear cookies
    const response = NextResponse.json({
      success: false,
      error: 'Logout failed, but cookies cleared',
      message: 'You have been logged out'
    }, { status: 500 });

    clearAllAuthCookies(response);

    return response;
  }
}

/**
 * ============================================================================
 * GET /api/auth/logout
 * ============================================================================
 * Alternative logout endpoint using GET (for simple redirects)
 */
export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('🚪 Logout Request (GET)');
  console.log('='.repeat(70));

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  }, { status: 200 });

  clearAllAuthCookies(response);

  console.log('✅ Logout successful');
  console.log('='.repeat(70) + '\n');

  return response;
}

/**
 * ============================================================================
 * DELETE /api/auth/logout
 * ============================================================================
 * RESTful logout endpoint using DELETE method
 */
export async function DELETE(request: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('🚪 Logout Request (DELETE)');
  console.log('='.repeat(70));

  const response = NextResponse.json({
    success: true,
    message: 'Session terminated successfully'
  }, { status: 200 });

  clearAllAuthCookies(response);

  console.log('✅ Session terminated');
  console.log('='.repeat(70) + '\n');

  return response;
}
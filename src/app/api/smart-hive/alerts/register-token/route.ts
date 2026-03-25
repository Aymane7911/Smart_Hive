// app/api/smart-hive/alerts/register-token/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma     = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const getUserId = (req: NextRequest): number | null => {
  const token =
    req.cookies.get('token')?.value ||
    req.cookies.get('admin-token')?.value ||
    req.cookies.get('user-token')?.value ||
    req.cookies.get('auth-token')?.value;

  if (!token) return null;
  try {
    const d = jwt.verify(token, JWT_SECRET) as any;
    const id = Number(d.userId || d.id);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
};

// ── POST — save or update FCM token for the logged-in user ─────────────────────
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { fcmToken } = body;

  if (!fcmToken || typeof fcmToken !== 'string') {
    return NextResponse.json({ error: 'fcmToken is required' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data:  { fcmToken: fcmToken.trim() },
    });

    console.log(`✅ [register-token] FCM token saved for user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[register-token] DB error:', err);
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
  }
}

// ── DELETE — clear FCM token on logout ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: userId },
      data:  { fcmToken: null },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[register-token] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to clear token' }, { status: 500 });
  }
}
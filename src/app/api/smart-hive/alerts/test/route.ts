// app/api/smart-hive/alerts/test/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import admin from '@/lib/firebaseAdmin';

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

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body        = await req.json();
    const containerId = body.containerId || 'unknown';
    const hiveNumber  = Number(body.hiveNumber ?? 1);

    // Look up the user's FCM token
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      return NextResponse.json({
        success: false,
        error:   'No device token found. Open the app on your Android device first so it can register for notifications.',
      }, { status: 400 });
    }

    const message = [
      '🧪 NahalAI TEST Alert',
      `Hive ${hiveNumber} — ${containerId}`,
      '',
      '✅ Your push notifications are working!',
      '',
      `🕐 ${new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })}`,
    ].join('\n');

    await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title: '🧪 NahalAI Test Alert',
        body:  message,
      },
      android: {
        priority: 'high',
        notification: {
          sound:      'default',
          channelId:  'hive-alerts',
          priority:   'max',
          visibility: 'public',
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Test notification sent ✓ — should arrive within a few seconds!',
    });

  } catch (err: any) {
    console.error('[alerts/test POST]', err);

    // FCM token expired or unregistered — clear it from DB
    if (err?.code === 'messaging/registration-token-not-registered' ||
        err?.code === 'messaging/invalid-registration-token') {
      await prisma.user.update({
        where: { id: userId },
        data:  { fcmToken: null },
      }).catch(() => {});

      return NextResponse.json({
        success: false,
        error:   'Device token expired. Please reopen the app to re-register, then try again.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error:   err instanceof Error ? err.message : 'Unknown server error',
    }, { status: 500 });
  }
}
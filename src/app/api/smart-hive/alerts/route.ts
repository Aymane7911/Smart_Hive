// app/api/smart-hive/alerts/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma     = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const getUser = (req: NextRequest) => {
  const token =
    req.cookies.get('token')?.value ||
    req.cookies.get('admin-token')?.value ||
    req.cookies.get('user-token')?.value ||
    req.cookies.get('auth-token')?.value;

  if (!token) return null;
  try {
    const d      = jwt.verify(token, JWT_SECRET) as any;
    const userId = Number(d.userId || d.id);
    return isNaN(userId) ? null : { userId };
  } catch {
    return null;
  }
};

const toFloat = (v: any) => (v == null || v === '') ? null : parseFloat(v);

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const containerId = req.nextUrl.searchParams.get('containerId');
  if (!containerId) return NextResponse.json({ error: 'containerId required' }, { status: 400 });

  try {
    const configs = await (prisma as any).alertConfig.findMany({
      where:   { userId: user.userId, containerId },
      orderBy: { hiveNumber: 'asc' },
    });
    return NextResponse.json({ success: true, data: configs });
  } catch (err) {
    console.error('[alerts GET]', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// ── POST (upsert) ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      containerId,
      hiveNumber      = 0,
      tempInternalMin, tempInternalMax,
      tempExternalMin, tempExternalMax,
      humidityMin,     humidityMax,
      weightMin,       weightMax,
      batteryMin,
      co2Max, nh3Max, o2Min, vocsMax, coMax, no2Max,
      isEnabled       = true,
      cooldownMinutes = 60,
    } = body;

    if (!containerId)
      return NextResponse.json({ error: 'containerId required' }, { status: 400 });

    const data = {
      tempInternalMin: toFloat(tempInternalMin), tempInternalMax: toFloat(tempInternalMax),
      tempExternalMin: toFloat(tempExternalMin), tempExternalMax: toFloat(tempExternalMax),
      humidityMin:     toFloat(humidityMin),     humidityMax:     toFloat(humidityMax),
      weightMin:       toFloat(weightMin),        weightMax:      toFloat(weightMax),
      batteryMin:      toFloat(batteryMin),
      co2Max:  toFloat(co2Max),  nh3Max: toFloat(nh3Max), o2Min:   toFloat(o2Min),
      vocsMax: toFloat(vocsMax), coMax:  toFloat(coMax),  no2Max:  toFloat(no2Max),
      isEnabled,
      cooldownMinutes: parseInt(cooldownMinutes) || 60,
    };

    const config = await (prisma as any).alertConfig.upsert({
      where: {
        userId_containerId_hiveNumber: {
          userId:      user.userId,
          containerId,
          hiveNumber:  parseInt(hiveNumber) || 0,
        },
      },
      update: data,
      create: {
        userId:      user.userId,
        containerId,
        hiveNumber:  parseInt(hiveNumber) || 0,
        ...data,
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    console.error('[alerts POST]', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const containerId = req.nextUrl.searchParams.get('containerId');
  const hiveNumber  = parseInt(req.nextUrl.searchParams.get('hiveNumber') ?? '0');

  if (!containerId)
    return NextResponse.json({ error: 'containerId required' }, { status: 400 });

  try {
    await (prisma as any).alertConfig.deleteMany({
      where: { userId: user.userId, containerId, hiveNumber },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[alerts DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
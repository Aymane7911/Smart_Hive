// app/api/admin/devices/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyAdminToken } from '@/lib/auth'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/devices
// Returns all registered devices with owner info if claimed.
// ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const devices = await prisma.device.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        purchases: {
          select: {
            id: true,
            status: true,
            accessGranted: true,
            user: {
              select: {
                id: true,
                email: true,
                firstname: true,
                lastname: true,
              },
            },
          },
          take: 1,
        },
      },
    })

    return NextResponse.json({ success: true, data: devices })
  } catch (error: any) {
    console.error('[GET /api/admin/devices]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/devices
// Register a new device — links a serial number to an Azure container.
// Body: { serialNumber, azureContainerId, hiveCount?, model? }
// ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { serialNumber, azureContainerId, hiveCount, model } = body

    // ── Validation ──────────────────────────────────────────────
    if (!serialNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Serial number is required' },
        { status: 400 }
      )
    }
    if (!azureContainerId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Azure container ID is required' },
        { status: 400 }
      )
    }

    const parsedHiveCount = hiveCount ? parseInt(hiveCount) : 1
    if (isNaN(parsedHiveCount) || parsedHiveCount < 1 || parsedHiveCount > 50) {
      return NextResponse.json(
        { success: false, error: 'Hive count must be between 1 and 50' },
        { status: 400 }
      )
    }

    const normalizedSerial    = serialNumber.trim().toUpperCase()
    const normalizedContainer = azureContainerId.trim()

    // ── Check for duplicates ────────────────────────────────────
    const existingSerial = await prisma.device.findUnique({
      where: { serialNumber: normalizedSerial },
    })
    if (existingSerial) {
      return NextResponse.json(
        { success: false, error: `Serial number "${normalizedSerial}" is already registered` },
        { status: 409 }
      )
    }

    

    // ── Create ──────────────────────────────────────────────────
    const device = await prisma.device.create({
      data: {
        serialNumber:     normalizedSerial,
        azureContainerId: normalizedContainer,
        hiveCount:        parsedHiveCount,
        model:            model?.trim().toUpperCase() || 'STANDARD',
        status:           'unclaimed',
        createdByAdminId: parseInt(String(admin.id)),
      },
    })

    return NextResponse.json({ success: true, data: device }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/admin/devices]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
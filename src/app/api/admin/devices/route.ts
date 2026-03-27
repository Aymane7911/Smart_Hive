import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/devices
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
// Body: { serialNumber, azureContainerIds: string[], hiveCount?, model? }
// ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { serialNumber, azureContainerIds, hiveCount, model } = body

    if (!serialNumber?.trim()) {
      return NextResponse.json({ success: false, error: 'Serial number is required' }, { status: 400 })
    }
    if (!Array.isArray(azureContainerIds) || azureContainerIds.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one Azure container is required' }, { status: 400 })
    }

    const parsedHiveCount = hiveCount ? parseInt(hiveCount) : 1
    if (isNaN(parsedHiveCount) || parsedHiveCount < 1 || parsedHiveCount > 50) {
      return NextResponse.json({ success: false, error: 'Hive count must be between 1 and 50' }, { status: 400 })
    }

    const normalizedSerial     = serialNumber.trim().toUpperCase()
    const normalizedContainers = azureContainerIds.map((c: string) => c.trim()).filter(Boolean)

    const device = await prisma.device.create({
      data: {
        serialNumber:      normalizedSerial,
        azureContainerIds: normalizedContainers,
        hiveCount:         parsedHiveCount,
        model:             model?.trim().toUpperCase() || 'STANDARD',
        status:            'unclaimed',
        createdByAdminId:  parseInt(String(admin.id)),
      },
    })

    return NextResponse.json({ success: true, data: device }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/admin/devices]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
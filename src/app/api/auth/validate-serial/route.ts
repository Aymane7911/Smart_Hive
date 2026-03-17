// app/api/auth/validate-serial/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────
// GET /api/auth/validate-serial?serial=SH-2024-001234
//
// Called on input blur during registration to give live feedback.
// Returns minimal info only — azureContainerId is NEVER exposed.
//
// Possible responses:
//   ✅ valid: true  — unclaimed, ready to register
//   ❌ valid: false — not found, already claimed, or suspended
// ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const serial = req.nextUrl.searchParams.get('serial')?.trim().toUpperCase()

    if (!serial) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Serial number is required' },
        { status: 400 }
      )
    }

    const device = await prisma.device.findUnique({
      where: { serialNumber: serial },
      select: {
        status:    true,
        hiveCount: true,
        model:     true,
        // azureContainerId is intentionally excluded here
      },
    })

    if (!device) {
      return NextResponse.json({
        success: false,
        valid:   false,
        error:   'Serial number not found. Check the sticker inside your SmartHive box.',
      })
    }

    if (device.status === 'claimed') {
      return NextResponse.json({
        success: false,
        valid:   false,
        error:   'This device is already registered to another account. Contact support if this is a mistake.',
      })
    }

    if (device.status === 'suspended') {
      return NextResponse.json({
        success: false,
        valid:   false,
        error:   'This device has been suspended. Please contact support.',
      })
    }

    // Valid and unclaimed — safe to proceed with registration
    return NextResponse.json({
      success:   true,
      valid:     true,
      hiveCount: device.hiveCount,
      model:     device.model,
      message:   `Valid device · ${device.hiveCount} hive${device.hiveCount !== 1 ? 's' : ''} · ${device.model}`,
    })
  } catch (error: any) {
    console.error('[GET /api/auth/validate-serial]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
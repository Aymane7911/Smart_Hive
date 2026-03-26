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

    // Serial numbers are no longer unique — find an unclaimed device first
    const unclaimedDevice = await prisma.device.findFirst({
      where: {
        serialNumber: serial,
        status: 'unclaimed',
      },
      select: {
        status:    true,
        hiveCount: true,
        model:     true,
        // azureContainerId is intentionally excluded here
      },
    })

    if (unclaimedDevice) {
      // Found an available device — valid and ready to register
      return NextResponse.json({
        success:   true,
        valid:     true,
        hiveCount: unclaimedDevice.hiveCount,
        model:     unclaimedDevice.model,
        message:   `Valid device · ${unclaimedDevice.hiveCount} hive${unclaimedDevice.hiveCount !== 1 ? 's' : ''} · ${unclaimedDevice.model}`,
      })
    }

    // No unclaimed device found — check if the serial exists at all
    const anyDevice = await prisma.device.findFirst({
      where: { serialNumber: serial },
      select: { status: true },
    })

    if (!anyDevice) {
      return NextResponse.json({
        success: false,
        valid:   false,
        error:   'Serial number not found. Check the sticker inside your SmartHive box.',
      })
    }

    if (anyDevice.status === 'suspended') {
      return NextResponse.json({
        success: false,
        valid:   false,
        error:   'This device has been suspended. Please contact support.',
      })
    }

    // Serial exists but all matching devices are claimed
    return NextResponse.json({
      success: false,
      valid:   false,
      error:   'This device is already registered to another account. Contact support if this is a mistake.',
    })

  } catch (error: any) {
    console.error('[GET /api/auth/validate-serial]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
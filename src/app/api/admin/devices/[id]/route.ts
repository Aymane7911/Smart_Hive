// app/api/admin/devices/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyAdminToken } from '@/lib/auth'

const prisma = new PrismaClient()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rawId } = await params
    const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid device ID' }, { status: 400 })
    }

    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    const body = await req.json()
    const { hiveCount, model, status } = body

    const allowedStatuses = ['unclaimed', 'claimed', 'suspended']
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (hiveCount !== undefined) {
      const parsed = parseInt(hiveCount)
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        return NextResponse.json(
          { success: false, error: 'Hive count must be between 1 and 50' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(hiveCount !== undefined && { hiveCount: parseInt(hiveCount) }),
        ...(model     !== undefined && { model: model.trim().toUpperCase() }),
        ...(status    !== undefined && { status }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[PATCH /api/admin/devices/:id]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rawId } = await params
    const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid device ID' }, { status: 400 })
    }

    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    if (device.status === 'claimed') {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete a claimed device. Use PATCH to suspend it, or revoke the user's access first.",
        },
        { status: 400 }
      )
    }

    await prisma.device.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/devices/:id]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
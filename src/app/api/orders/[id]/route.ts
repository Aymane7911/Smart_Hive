// app/api/orders/[id]/route.ts
//
// PATCH /api/orders/:id  (admin only)
// Update status, adminNotes, or mark as shipped.
// Body: { status?, adminNotes? }
// Statuses: "new" | "reviewed" | "shipped" | "rejected"

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient }              from '@prisma/client'
import { verifyAdminToken }          from '@/lib/auth'

const prisma = new PrismaClient()

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const id = parseInt(params.id)
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })

    const body = await req.json()
    const { status, adminNotes } = body

    const allowed = ['new', 'reviewed', 'shipped', 'rejected']
    if (status && !allowed.includes(status))
      return NextResponse.json({ success: false, error: `Invalid status. Use: ${allowed.join(', ')}` }, { status: 400 })

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(status     !== undefined && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(status === 'shipped'     && { shippedAt: new Date() }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[PATCH /api/orders/:id]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
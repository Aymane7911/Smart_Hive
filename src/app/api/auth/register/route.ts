// app/api/auth/register/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import bcrypt                        from 'bcryptjs'
import jwt                           from 'jsonwebtoken'

const JWT_SECRET  = process.env.JWT_SECRET  || 'change-me-in-production'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firstname, lastname, email, password, serialNumber } = body

    if (!email?.trim())
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
    if (!password)
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 })
    if (password.length < 8)
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 })
    if (!serialNumber?.trim())
      return NextResponse.json({ success: false, error: 'Serial number is required' }, { status: 400 })

    const normalizedEmail  = email.trim().toLowerCase()
    const normalizedSerial = serialNumber.trim().toUpperCase()

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing)
      return NextResponse.json({ success: false, error: 'An account with this email already exists' }, { status: 409 })

    // Find an unclaimed device with this serial number
    const device = await prisma.device.findFirst({
      where: { serialNumber: normalizedSerial, status: 'unclaimed' },
    })

    if (!device) {
      const anyDevice = await prisma.device.findFirst({ where: { serialNumber: normalizedSerial } })
      if (!anyDevice)
        return NextResponse.json({ success: false, error: 'Serial number not found. Check the sticker inside your SmartHive box.' }, { status: 400 })
      return NextResponse.json({ success: false, error: 'This serial number has no available devices. Please contact support.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create user
      const user = await tx.user.create({
        data: {
          email:     normalizedEmail,
          password:  hashedPassword,
          firstname: firstname?.trim() || null,
          lastname:  lastname?.trim()  || null,
          role:      'user',
        },
      })

      // 2. Claim the device
      await tx.device.update({
        where: { id: device.id },
        data: { status: 'claimed', ownerId: user.id, claimedAt: new Date() },
      })

      // 3. Create a pending purchase so user appears in the admin Access tab
      await tx.purchase.create({
        data: {
          userId:             user.id,
          status:             'pending',
          accessGranted:      false,
          masterHives:        device.hiveCount,
          normalHives:        0,
          totalAmount:        0,
          assignedContainers: [device.azureContainerId],
        },
      })

      return user
    })

    const token = jwt.sign(
      { userId: result.id, email: result.email, role: result.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES } as any
    )

    return NextResponse.json({
      success: true,
      token,
      user: {
        id:        result.id,
        email:     result.email,
        firstname: result.firstname,
        lastname:  result.lastname,
        role:      result.role,
      },
      nextStep: '/login',
    }, { status: 201 })

  } catch (error: any) {
    console.error('[POST /api/auth/register]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
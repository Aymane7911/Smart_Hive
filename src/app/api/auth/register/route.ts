// app/api/auth/register/route.ts
//
// POST /api/auth/register
//
// Page 1 of 2: Creates the user account and claims the SmartHive device.
// Purchase (order config, shipping, payment) is handled by /api/auth/complete-purchase.
//
// Body: { firstname, lastname, email, password, serialNumber }
//
// On success: returns { success, user: { id, email, … }, token }
// The client stores the token, then redirects to /order.

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient }              from '@prisma/client'
import bcrypt                        from 'bcryptjs'
import jwt                           from 'jsonwebtoken'

const prisma = new PrismaClient()

const JWT_SECRET  = process.env.JWT_SECRET  || 'change-me-in-production'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firstname, lastname, email, password, serialNumber } = body

    // ── 1. Field validation ──────────────────────────────────────────────────
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

    // ── 2. Check email not already taken ────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing)
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      )

    // ── 3. Validate serial number ────────────────────────────────────────────
    const device = await prisma.device.findUnique({ where: { serialNumber: normalizedSerial } })

    if (!device)
      return NextResponse.json(
        { success: false, error: 'Serial number not found. Check the sticker inside your SmartHive box.' },
        { status: 400 }
      )

    if (device.status === 'claimed')
      return NextResponse.json(
        { success: false, error: 'This device is already registered to another account.' },
        { status: 409 }
      )

    if (device.status === 'suspended')
      return NextResponse.json(
        { success: false, error: 'This device has been suspended. Please contact support.' },
        { status: 400 }
      )

    // ── 4. Hash password ─────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12)

    // ── 5. Create user + claim device atomically ─────────────────────────────
    //       Purchase is NOT created here — that happens after the order page.
    const result = await prisma.$transaction(async (tx) => {

      const user = await tx.user.create({
        data: {
          email:     normalizedEmail,
          password:  hashedPassword,
          firstname: firstname?.trim() || null,
          lastname:  lastname?.trim()  || null,
          role:      'user',
          // shipping fields are collected on the order page and stored with the Purchase record
        },
      })

      // Mark device as claimed and link to user
      await tx.device.update({
        where: { id: device.id },
        data: {
          status:    'claimed',
          ownerId:   user.id,
          claimedAt: new Date(),
        },
      })

      return user
    })

    // ── 6. Issue JWT ─────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userId: result.id, email: result.email, role: result.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES } as any
    )

    // ── 7. Respond ───────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id:        result.id,
          email:     result.email,
          firstname: result.firstname,
          lastname:  result.lastname,
          role:      result.role,
        },
        // Tell client to proceed to /order
        nextStep: '/order',
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('[POST /api/auth/register]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
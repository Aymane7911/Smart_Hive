// app/api/auth/complete-purchase/route.ts
//
// POST /api/auth/complete-purchase
//
// Page 2 of 2: Saves order configuration, shipping info, and payment details.
// User must already be registered (calls /api/auth/register first).
// Requires a valid JWT (Bearer token in Authorization header, or userId in body as fallback).
//
// Body: {
//   userId,        // fallback if no token
//   masterHives,   // number of master hive units
//   normalHives,   // number of normal hive units
//   totalAmount,   // computed on client, verified on server
//   address, city, state, country, postalCode, phone,   // shipping
//   cardLastFour,                                       // payment (never raw card numbers)
// }

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient }              from '@prisma/client'
import jwt                           from 'jsonwebtoken'

const prisma     = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

// ─── Pricing (must match client) ─────────────────────────────────────────────
const MASTER_HIVE_PRICE = 299
const NORMAL_HIVE_PRICE = 199
const SHIPPING_PRICE    = 49

// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────────
    let authenticatedUserId: number | null = null

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number }
        authenticatedUserId = payload.userId
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
      }
    }

    const body = await req.json()
    const {
      userId,
      masterHives, normalHives, totalAmount,
      address, city, state, country, postalCode, phone,
      cardLastFour,
    } = body

    // Use JWT userId if available, fall back to body (for dev/testing)
    const resolvedUserId = authenticatedUserId ?? (userId ? parseInt(userId) : null)
    if (!resolvedUserId || isNaN(resolvedUserId))
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 })

    // ── 2. Validate user exists ──────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { id: resolvedUserId } })
    if (!user)
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

    // ── 3. Validate order quantities ─────────────────────────────────────────
    const parsedMaster = parseInt(masterHives) || 0
    const parsedNormal = parseInt(normalHives) || 0

    if (parsedMaster < 0 || parsedNormal < 0)
      return NextResponse.json({ success: false, error: 'Hive quantities cannot be negative' }, { status: 400 })

    if (parsedMaster + parsedNormal === 0)
      return NextResponse.json({ success: false, error: 'Please order at least one hive unit' }, { status: 400 })

    // ── 4. Verify total on server ─────────────────────────────────────────────
    const expectedTotal = parsedMaster * MASTER_HIVE_PRICE + parsedNormal * NORMAL_HIVE_PRICE + SHIPPING_PRICE
    const clientTotal   = parseFloat(totalAmount) || 0

    if (Math.abs(clientTotal - expectedTotal) > 0.01)
      return NextResponse.json(
        { success: false, error: `Order total mismatch. Expected $${expectedTotal}.` },
        { status: 400 }
      )

    // ── 5. Validate shipping fields ──────────────────────────────────────────
    if (!address?.trim())    return NextResponse.json({ success: false, error: 'Address is required' },      { status: 400 })
    if (!city?.trim())       return NextResponse.json({ success: false, error: 'City is required' },         { status: 400 })
    if (!country?.trim())    return NextResponse.json({ success: false, error: 'Country is required' },      { status: 400 })
    if (!postalCode?.trim()) return NextResponse.json({ success: false, error: 'Postal code is required' },  { status: 400 })
    if (!phone?.trim())      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })

    // ── 6. Find the device claimed by this user ──────────────────────────────
    const device = await prisma.device.findFirst({
      where: { ownerId: resolvedUserId, status: 'claimed' },
    })

    // ── 7. Create the Purchase record ────────────────────────────────────────
    const purchase = await prisma.$transaction(async (tx) => {

      // Update user's shipping details (convenience — stored on user too)
      await tx.user.update({
        where: { id: resolvedUserId },
        data: {
          address:    address.trim(),
          city:       city.trim(),
          country:    country.trim(),
          postalCode: postalCode.trim(),
          phone:      phone.trim(),
        },
      })

      // Create the purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          userId:       resolvedUserId,
          deviceId:     device?.id || null,
          status:       'pending',
          accessGranted:false,
          // Customer snapshot (pulled from user record at purchase time)
          fullName:     `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim(),
          email:        user.email,
          // Order config
          masterHives:  parsedMaster,
          normalHives:  parsedNormal,
          totalAmount:  expectedTotal,
          // Shipping
          address:      address.trim(),
          city:         city.trim(),
          state:        state?.trim() || null,
          country:      country.trim(),
          postalCode:   postalCode.trim(),
          phone:        phone.trim(),
          // Payment (store only safe fields — integrate a real payment processor in production)
          cardLastFour: cardLastFour?.toString().slice(-4) || null,
          // Link Azure container if device was already claimed
          assignedContainers: device ? [device.azureContainerId] : [],
        },
      })

      return newPurchase
    })

    // ── 8. Respond ───────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success:    true,
        purchaseId: purchase.id,
        total:      expectedTotal,
        message:    'Purchase recorded. Redirecting to your dashboard.',
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('[POST /api/auth/complete-purchase]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
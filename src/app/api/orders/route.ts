// app/api/orders/route.ts
//
// POST /api/orders
// Public endpoint — no auth required.
// Saves order inquiry to DB and sends notification email to the team.
//
// GET /api/orders  (admin only)
// Returns all order inquiries.

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient }              from '@prisma/client'
import { verifyAdminToken }          from '@/lib/auth'
import nodemailer                    from 'nodemailer'

const prisma = new PrismaClient()

// ─── Email transport (configure via .env) ────────────────────────────────────
// Add these to your .env:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=your@gmail.com
//   SMTP_PASS=your-app-password
//   TEAM_EMAIL=team@yourcompany.com
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders — submit order inquiry (public)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fullName, email, phone, country, city, masterHives, normalHives, message } = body

    // ── Validation ────────────────────────────────────────────────
    if (!fullName?.trim())  return NextResponse.json({ success: false, error: 'Full name is required' },  { status: 400 })
    if (!email?.trim())     return NextResponse.json({ success: false, error: 'Email is required' },      { status: 400 })
    if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 })
    if (!phone?.trim())     return NextResponse.json({ success: false, error: 'Phone is required' },      { status: 400 })
    if (!country?.trim())   return NextResponse.json({ success: false, error: 'Country is required' },    { status: 400 })

    const master = parseInt(masterHives) || 0
    const normal = parseInt(normalHives) || 0
    if (master + normal === 0) return NextResponse.json({ success: false, error: 'Select at least one hive' }, { status: 400 })

    // ── Save to DB ────────────────────────────────────────────────
    const order = await prisma.order.create({
      data: {
        fullName:    fullName.trim(),
        email:       email.trim().toLowerCase(),
        phone:       phone.trim(),
        country:     country.trim(),
        city:        city?.trim() || null,
        masterHives: master,
        normalHives: normal,
        message:     message?.trim() || null,
        status:      'new',
      },
    })

    // ── Send email notification to team ──────────────────────────
    if (process.env.SMTP_USER && process.env.TEAM_EMAIL) {
      try {
        const transporter = createTransport()
        await transporter.sendMail({
          from:    `"SmartHive Orders" <${process.env.SMTP_USER}>`,
          to:      process.env.TEAM_EMAIL,
          subject: `🐝 New SmartHive Order — ${fullName} (${country})`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f59e0b, #eab308); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">🐝 New SmartHive Order Inquiry</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Order #${order.id} · ${new Date().toLocaleDateString()}</p>
              </div>
              <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                
                <h2 style="font-size: 16px; color: #111827; margin: 0 0 16px;">Contact Details</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                  <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${fullName}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #f59e0b;">${email}</a></td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Phone</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${phone}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Location</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${city ? city + ', ' : ''}${country}</td></tr>
                </table>

                <h2 style="font-size: 16px; color: #111827; margin: 0 0 16px;">Order Details</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                  <tr><td style="padding: 8px 0; color: #6b7280;">Master Hives</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${master} × $299 = $${master * 299}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Normal Hives</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${normal} × $199 = $${normal * 199}</td></tr>
                  <tr style="border-top: 2px solid #e5e7eb;">
                    <td style="padding: 12px 0; font-weight: 700; color: #111827;">Estimated Total</td>
                    <td style="padding: 12px 0; font-weight: 700; color: #f59e0b; font-size: 18px;">$${master * 299 + normal * 199}</td>
                  </tr>
                </table>

                ${message ? `
                <h2 style="font-size: 16px; color: #111827; margin: 0 0 8px;">Message</h2>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; color: #374151; font-size: 14px; line-height: 1.6;">
                  ${message}
                </div>
                ` : ''}

                <div style="margin-top: 24px; padding: 16px; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;">
                  <p style="margin: 0; color: #92400e; font-size: 13px;">
                    <strong>Next step:</strong> Review and contact ${fullName} to confirm the order. 
                    Once confirmed, create a Device record in the admin panel and ship the boxes.
                  </p>
                </div>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        // Email failed but order was saved — don't block the response
        console.error('[Orders] Email notification failed:', emailErr)
      }
    }

    return NextResponse.json({ success: true, orderId: order.id }, { status: 201 })

  } catch (error: any) {
    console.error('[POST /api/orders]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders — list all orders (admin only)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req)
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: orders })
  } catch (error: any) {
    console.error('[GET /api/orders]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
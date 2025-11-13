// app/api/auth/register-with-purchase/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sendPurchaseConfirmationEmail, sendAdminNotificationEmail } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      // Account data
      firstname,
      lastname,
      email,
      password,
      phone,
      address,
      city,
      country,
      postalCode,
      
      // Purchase data
      masterHives,
      normalHives,
      totalAmount,
      fullName,
      cardLastFour
    } = body;

    // Validate required fields
    if (!firstname || !lastname || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required account fields' },
        { status: 400 }
      );
    }

    if (!masterHives || masterHives < 1) {
      return NextResponse.json(
        { success: false, error: 'At least 1 master hive is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and purchase in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create user
      const user = await tx.user.create({
        data: {
          firstname: firstname,
          lastname: lastname,
          email: email.toLowerCase(),
          password: hashedPassword,
          phone: phone || null,
          address: address || null,
          city: city || null,
          country: country || null,
          postalCode: postalCode || null,
          role: 'user'
        }
      });

      // Create purchase record
      const purchase = await tx.purchase.create({
        data: {
          userId: user.id,
          masterHives: parseInt(masterHives),
          normalHives: parseInt(normalHives),
          totalAmount: parseFloat(totalAmount),
          fullName: fullName || `${firstname} ${lastname}`,
          email: email.toLowerCase(),
          phone: phone || '',
          address: address || '',
          city: city || '',
          country: country || '',
          postalCode: postalCode || '',
          cardLastFour: cardLastFour || null,
          paymentMethod: 'card',
          status: 'pending',
          accessGranted: false,
          assignedContainers: []
        }
      });

      return { user, purchase };
    });

    // Send confirmation emails (don't fail the registration if emails fail)
    try {
      // Send confirmation email to customer
      await sendPurchaseConfirmationEmail({
        toEmail: result.user.email,
        userName: `${result.user.firstname || ''} ${result.user.lastname || ''}`.trim(),
        masterHives: result.purchase.masterHives,
        normalHives: result.purchase.normalHives,
        totalAmount: result.purchase.totalAmount,
        purchaseId: result.purchase.id.toString(),
        fullName: result.purchase.fullName,
        address: result.purchase.address,
        city: result.purchase.city,
        country: result.purchase.country,
        postalCode: result.purchase.postalCode,
      });

      // Send notification email to admin
      await sendAdminNotificationEmail({
        userName: `${result.user.firstname || ''} ${result.user.lastname || ''}`.trim(),
        userEmail: result.user.email,
        masterHives: result.purchase.masterHives,
        normalHives: result.purchase.normalHives,
        totalAmount: result.purchase.totalAmount,
        purchaseId: result.purchase.id.toString(),
        purchaseDate: result.purchase.purchaseDate,
      });

      console.log('✅ Confirmation emails sent successfully');
    } catch (emailError) {
      console.error('⚠️ Email sending failed, but registration succeeded:', emailError);
      // Continue without failing the registration
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Your purchase is pending approval.',
      data: {
        userId: result.user.id,
        email: result.user.email,
        purchaseId: result.purchase.id.toString(),
        status: result.purchase.status
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check if email is available
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    return NextResponse.json({
      success: true,
      available: !existingUser
    });

  } catch (error) {
    console.error('Email check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check email availability' },
      { status: 500 }
    );
  }
}
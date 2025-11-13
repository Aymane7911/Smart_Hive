// lib/email.ts
import nodemailer from 'nodemailer';

interface PurchaseEmailData {
  toEmail: string;
  userName: string;
  masterHives: number;
  normalHives: number;
  totalAmount: number;
  purchaseId: string;
  fullName: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
}

interface AdminNotificationData {
  userName: string;
  userEmail: string;
  masterHives: number;
  normalHives: number;
  totalAmount: number;
  purchaseId: string;
  purchaseDate: Date;
}

// Create reusable transporter
const createTransporter = () => {
  // Use existing EMAIL_USER and EMAIL_PASSWORD from .env
  // or fall back to SMTP_* variables if they exist
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD,
    },
  };

  console.log('📧 SMTP Configuration:');
  console.log('Host:', smtpConfig.host);
  console.log('Port:', smtpConfig.port);
  console.log('User:', smtpConfig.auth.user);
  console.log('Password:', smtpConfig.auth.pass ? '***SET***' : 'NOT SET');

  return nodemailer.createTransport(smtpConfig);
};

export async function sendPurchaseConfirmationEmail(data: PurchaseEmailData) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SmartHive" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: data.toEmail,
      subject: '✅ SmartHive Purchase Confirmation - Pending Approval',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Purchase Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🐝 SmartHive</h1>
                      <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">Purchase Confirmation</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px;">Thank you, ${data.userName}!</h2>
                      
                      <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.5;">
                        Your SmartHive purchase request has been successfully submitted and is now pending admin approval.
                      </p>
                      
                      <!-- Status Banner -->
                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">
                          <strong>⏳ Status:</strong> Pending Admin Approval<br>
                          Your access will be activated once an administrator reviews and approves your purchase.
                        </p>
                      </div>
                      
                      <!-- Order Details -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 30px 0; background-color: #f9fafb; border-radius: 6px;">
                        <tr>
                          <td style="padding: 20px;">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Order Details</h3>
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order ID:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right; font-weight: 600;">#${data.purchaseId}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Master Hives:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.masterHives}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Normal Hives:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.normalHives}</td>
                              </tr>
                              <tr>
                                <td colspan="2" style="padding: 12px 0; border-top: 2px solid #e5e7eb;"></td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Total Amount:</td>
                                <td style="padding: 8px 0; color: #10b981; font-size: 18px; text-align: right; font-weight: bold;">$${data.totalAmount}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Shipping Address -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 30px 0; background-color: #f9fafb; border-radius: 6px;">
                        <tr>
                          <td style="padding: 20px;">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Shipping Address</h3>
                            <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                              ${data.fullName}<br>
                              ${data.address}<br>
                              ${data.city}, ${data.postalCode}<br>
                              ${data.country}
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- What's Next -->
                      <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">What happens next?</h3>
                      <ol style="margin: 0 0 30px 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                        <li>An administrator will review your purchase request</li>
                        <li>Once approved, you'll receive a confirmation email</li>
                        <li>Your SmartHive devices will be shipped to your address</li>
                        <li>You'll gain access to the SmartHive dashboard</li>
                      </ol>
                      
                      <!-- What's Included -->
                      <div style="background-color: #ecfdf5; border-radius: 6px; padding: 20px; margin: 0 0 30px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #065f46; font-size: 16px;">✓ What's Included:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.8;">
                          <li>IoT sensors and hardware</li>
                          <li>Mobile app access</li>
                          <li>Real-time monitoring dashboard</li>
                          <li>1-year warranty</li>
                          <li>Free installation guide</li>
                          <li>24/7 customer support</li>
                        </ul>
                      </div>
                      
                      <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                        If you have any questions, please don't hesitate to contact our support team.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">
                        © 2024 SmartHive. All rights reserved.
                      </p>
                      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                        This is an automated message. Please do not reply to this email.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Purchase confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw error;
  }
}

export async function sendAdminNotificationEmail(data: AdminNotificationData) {
  try {
    const transporter = createTransporter();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
      from: `"SmartHive" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: '🔔 New SmartHive Purchase Request - Action Required',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Purchase Request</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🔔 Admin Notification</h1>
                      <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">New Purchase Request</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                          ⚠️ ACTION REQUIRED: A new SmartHive purchase is awaiting your approval.
                        </p>
                      </div>
                      
                      <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px;">Purchase Details</h2>
                      
                      <!-- Customer Info -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0; background-color: #f9fafb; border-radius: 6px;">
                        <tr>
                          <td style="padding: 20px;">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Customer Information</h3>
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Name:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right; font-weight: 600;">${data.userName}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.userEmail}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Purchase Date:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${new Date(data.purchaseDate).toLocaleString()}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Order Summary -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 30px 0; background-color: #f9fafb; border-radius: 6px;">
                        <tr>
                          <td style="padding: 20px;">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Order Summary</h3>
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order ID:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right; font-weight: 600;">#${data.purchaseId}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Master Hives:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.masterHives}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Normal Hives:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.normalHives}</td>
                              </tr>
                              <tr>
                                <td colspan="2" style="padding: 12px 0; border-top: 2px solid #e5e7eb;"></td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Total Amount:</td>
                                <td style="padding: 8px 0; color: #10b981; font-size: 18px; text-align: right; font-weight: bold;">$${data.totalAmount}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5; text-align: center;">
                        Please review and approve this purchase to activate the customer's access.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="margin: 0; color: #6b7280; font-size: 12px;">
                        © 2024 SmartHive Admin Portal. All rights reserved.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Admin notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Admin email sending error:', error);
    throw error;
  }
}
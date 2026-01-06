import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const contactEmail = process.env.CONTACT_EMAIL || 'contact@perkos.xyz';

    // Send notification email to PerkOS team
    await resend.emails.send({
      from: 'PerkOS Contact <noreply@perkos.xyz>',
      to: [contactEmail],
      subject: `[PerkOS Contact] ${subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${name}</p>
            </div>
            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
              <p style="margin: 0; color: #111827; font-size: 16px;"><a href="mailto:${email}" style="color: #3b82f6; text-decoration: none;">${email}</a></p>
            </div>
            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Subject</p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">${subject}</p>
            </div>
            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
              <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
              This message was sent from the PerkOS website contact form.
            </p>
          </div>
        </div>
      `,
    });

    // Send autoresponse to the user
    await resend.emails.send({
      from: 'PerkOS <noreply@perkos.xyz>',
      to: [email],
      subject: `Thanks for contacting PerkOS!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Thank you, ${name}!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">We've received your message</p>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for reaching out to PerkOS! We appreciate your interest in building the future of web payments together.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Our team will review your message and get back to you as soon as possible, typically within 24-48 hours.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Your message:</p>
              <p style="margin: 0 0 5px 0; color: #111827; font-size: 14px;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px; white-space: pre-wrap;">${message}</p>
            </div>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              In the meantime, feel free to explore:
            </p>
            <div style="margin-bottom: 20px;">
              <a href="https://spark.perkos.xyz" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-right: 10px; margin-bottom: 10px;">Launch Spark</a>
              <a href="https://stack.perkos.xyz" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-bottom: 10px;">Explore Stack</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
              <strong>PerkOS</strong> — The Operating System for AI Agents
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
              <a href="https://twitter.com/PerkOS_xyz" style="color: #9ca3af; text-decoration: none; margin: 0 10px;">Twitter</a>
              <a href="https://github.com/PerkOS-xyz" style="color: #9ca3af; text-decoration: none; margin: 0 10px;">GitHub</a>
              <a href="https://perkos.xyz" style="color: #9ca3af; text-decoration: none; margin: 0 10px;">Website</a>
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(
      { success: true, message: 'Message sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, orderId } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Email sending disabled temporarily
    console.log('Email sending disabled. Would have sent:', { to, subject, orderId });
    return NextResponse.json({ 
      success: true, 
      message: 'Email sending is temporarily disabled',
      debug: { to, subject, orderId }
    });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

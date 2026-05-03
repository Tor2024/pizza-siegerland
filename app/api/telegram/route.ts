import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, orderId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('Telegram not configured. Bot Token or Chat ID missing.');
      return NextResponse.json({ 
        success: false, 
        message: 'Telegram not configured' 
      }, { status: 200 }); // Return 200 so order still proceeds
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram API error:', result);
      return NextResponse.json({ 
        success: false, 
        error: result.description || 'Failed to send Telegram message' 
      });
    }

    console.log(`📱 Telegram notification sent for order ${orderId || ''}`);
    return NextResponse.json({ success: true, message: 'Telegram notification sent' });

  } catch (error) {
    console.error('Telegram send error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to send Telegram message' 
    }, { status: 200 });
  }
}
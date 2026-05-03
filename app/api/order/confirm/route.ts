import { NextRequest, NextResponse } from 'next/server';
import { getOrder, saveOrder, getOrders } from '@/lib/githubStorage';

// POST - confirm order with 6-digit code
export async function POST(req: NextRequest) {
  try {
    const { orderId, confirmationCode } = await req.json();

    if (!orderId || !confirmationCode) {
      return NextResponse.json({ error: 'Order ID and confirmation code are required' }, { status: 400 });
    }

    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'pending_confirmation') {
      return NextResponse.json({ error: 'Order is not pending confirmation' }, { status: 400 });
    }

    if (order.confirmationCode !== confirmationCode) {
      return NextResponse.json({ error: 'Invalid confirmation code' }, { status: 400 });
    }

    // Update order status to confirmed
    order.status = 'confirmed';
    order.confirmedAt = Date.now();
    order.updatedAt = Date.now();
    
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'confirmed',
      timestamp: Date.now(),
      note: 'Order confirmed by customer via code'
    });

    await saveOrder(order);

    return NextResponse.json({ 
      success: true, 
      message: 'Order confirmed successfully',
      order: { id: order.id, status: order.status }
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.json({ 
      error: 'Failed to confirm order',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET - keep for backward compatibility (maybe not needed)
export async function GET(req: NextRequest) {
  return new NextResponse(
    generateHtmlResponse('Info', 'Bitte verwenden Sie das Formular in der App zur Bestätigung Ihrer Bestellung.', 'success'),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function generateHtmlResponse(title: string, message: string, type: 'success' | 'danger'): string {
  const bgColor = type === 'success' ? '#10b981' : '#ef4444';
  const icon = type === 'success' ? '✅' : '❌';
  
  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Pizza Roma</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .container { max-width: 500px; width: 100%; text-align: center; }
        .card { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 40px 30px; backdrop-filter: blur(10px); }
        h1 { color: ${bgColor}; margin-bottom: 20px; font-size: 28px; }
        .message { font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .btn { display: inline-block; background: #c41e3a; color: white; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; transition: all 0.3s; }
        .btn:hover { background: #a0152d; transform: translateY(-2px); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>${icon} ${title}</h1>
          <div class="message">${message}</div>
          <a href="/" class="btn">🍕 Zurück zur Website</a>
        </div>
      </div>
    </body>
    </html>
  `;
}
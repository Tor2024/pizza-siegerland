import { NextRequest, NextResponse } from 'next/server';
import { getOrder, saveOrder, getOrders } from '@/lib/githubStorage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return new NextResponse(
        generateHtmlResponse('Fehler', 'Token fehlt!', 'danger'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Search in all orders for matching confirmation token
    const orders = await getOrders();
    const foundOrder = orders.find((o: any) => o.confirmationToken === token);

    if (!foundOrder) {
      return new NextResponse(
        generateHtmlResponse('Fehler', 'Ungültiger oder abgelaufener Token!', 'danger'),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (foundOrder.status === 'confirmed') {
      return new NextResponse(
        generateHtmlResponse('Bereits bestätigt', 'Diese Bestellung wurde bereits bestätigt!', 'success'),
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Update order status to confirmed
    foundOrder.status = 'confirmed';
    foundOrder.confirmedAt = Date.now();
    foundOrder.updatedAt = Date.now();
    
    // Optional: add to status history if it exists
    if (!foundOrder.statusHistory) foundOrder.statusHistory = [];
    foundOrder.statusHistory.push({
      status: 'confirmed',
      timestamp: Date.now(),
      note: 'Order confirmed by customer via email'
    });

    await saveOrder(foundOrder);

    return new NextResponse(
      generateHtmlResponse(
        '✅ Bestellung bestätigt!',
        `
        <div class="text-left">
          <p class="mb-4">Vielen Dank! Ihre Bestellung <strong>#${foundOrder.id.slice(-8)}</strong> wurde erfolgreich bestätigt.</p>
          
          <div class="bg-white/10 rounded-lg p-4 mb-4">
            <h3 class="font-bold mb-2">Bestelldetails:</h3>
            <p>📍 ${foundOrder.customer.address}</p>
            <p>📞 ${foundOrder.customer.phone}</p>
            <p class="mt-2"><strong>Gesamt: ${foundOrder.total.toFixed(2)}€</strong></p>
          </div>

          <p class="text-sm opacity-80">Wir bereiten Ihre Bestellung jetzt zu. Die voraussichtliche Lieferzeit beträgt ${foundOrder.estimatedDelivery || '25-35 Min'}.</p>
        </div>
        `,
        'success'
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  } catch (error) {
    console.error('Confirmation error:', error);
    return new NextResponse(
      generateHtmlResponse('Fehler', 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', 'danger'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
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
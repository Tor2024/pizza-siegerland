import { NextResponse } from 'next/server';
import { saveOrder, getOrder } from '@/lib/githubStorage';
import { findUserByEmail, addUser, addOrderToUser } from '@/lib/userStorage';
import { Resend } from 'resend';

// In-memory cache for fast access
const orderCache = new Map<string, any>();

// POST - создать заказ (для клиентов)
export async function POST(req: Request) {
  try {
    const orderData = await req.json();
    
    // Валидация обязательных полей
    if (!orderData.items || orderData.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }
    
    if (!orderData.customer?.name || !orderData.customer?.phone || !orderData.customer?.address) {
      return NextResponse.json({ error: 'Missing customer information' }, { status: 400 });
    }

    if (!orderData.total || orderData.total < 15) {
      return NextResponse.json({ error: 'Minimum order is 15€' }, { status: 400 });
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const confirmationToken = `conf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
      const newOrder: any = {
        id: orderId,
        items: orderData.items,
        customer: orderData.customer,
        total: orderData.total,
        subtotal: orderData.subtotal,
        deliveryFee: orderData.deliveryFee,
        promoCode: orderData.promoCode || null,
        promoDiscount: orderData.promoDiscount || 0,
        status: 'received' as const,
        statusHistory: [
          { status: 'received' as const, timestamp: Date.now(), note: 'Order received' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        estimatedDelivery: orderData.estimatedDelivery || '25-35 min',
        confirmationToken: confirmationToken
      };

    // Сохраняем заказ в GitHub (persistent) и cache
    await saveOrder(newOrder);
    orderCache.set(orderId, newOrder);

    // Привязываем заказ к пользователю (по email)
    if (orderData.customer?.email) {
      try {
        let user = await findUserByEmail(orderData.customer.email);
        if (!user) {
          // Создаем нового пользователя
          user = {
            id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            email: orderData.customer.email,
            name: orderData.customer.name,
            phone: orderData.customer.phone,
            address: orderData.customer.address,
            createdAt: Date.now(),
            orders: [orderId]
          };
          await addUser(user);
        } else {
          // Добавляем заказ к существующему пользователю
          await addOrderToUser(orderData.customer.email, orderId);
        }
      } catch (userError) {
        console.error('User processing error:', userError);
        // Не прерываем создание заказа, если работа с юзером не удалась
      }
    }

    // Send confirmation email
    if (orderData.customer?.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pizza-siegerland.vercel.app'}/order/confirm?token=${confirmationToken}`;
        
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Pizza Roma <noreply@pizza-roma.de>',
          to: [orderData.customer.email],
          subject: `🍕 Bestätigen Sie Ihre Bestellung #${orderId.slice(-8)}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #c41e3a;">Pizza Roma - Bestellung bestätigen</h1>
              <p>Hallo ${orderData.customer.name},</p>
              <p>vielen Dank für Ihre Bestellung! Bitte bestätigen Sie Ihre Bestellung durch Klick auf den Button:</p>
              
              <div style="margin: 30px 0;">
                <a href="${confirmUrl}" style="background: #c41e3a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                  ✅ Bestellung bestätigen
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Oder kopieren Sie diesen Link in Ihren Browser:<br>
                <code style="background: #f5f5f5; padding: 10px; display: block; margin-top: 10px; border-radius: 4px;">${confirmUrl}</code>
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <h3>Ihre Bestellung:</h3>
              <ul>
                ${orderData.items.map((item: any) => `<li>${item.quantity}x ${item.name.de} (${item.size}) - ${(item.price * item.quantity).toFixed(2)}€</li>`).join('')}
              </ul>
              <p><strong>Gesamt: ${orderData.total.toFixed(2)}€</strong></p>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Pizza Roma Siegen<br>
                📍 Ihre Lieferadresse: ${orderData.customer.address}<br>
                📞 ${orderData.customer.phone}
              </p>
            </div>
          `,
        });
        console.log(`📧 Confirmation email sent to ${orderData.customer.email}`);
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Don't fail the order if email fails
      }
    }

    // Отправляем уведомление админу (заглушка для future webhook)
    console.log(`🍕 New order received: ${orderId} - ${orderData.customer.name} - ${orderData.total}€`);

    return NextResponse.json({ 
      success: true, 
      orderId,
      order: newOrder,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create order',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET - получить статус заказа по ID (для клиентов)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    // Try cache first, then GitHub
    let order = orderCache.get(orderId);
    if (!order) {
      order = await getOrder(orderId);
      if (order) orderCache.set(orderId, order);
    }
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Возвращаем только нужные поля для клиента
    const { id, status, items, total, customer, createdAt, estimatedDelivery } = order as any;
    
    return NextResponse.json({
      id,
      status,
      items,
      total,
      customer: { name: customer.name }, // Не возвращаем полные данные клиента
      createdAt,
      estimatedDelivery
    });
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch order',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

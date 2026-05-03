import { NextResponse } from 'next/server';
import { saveOrder, getOrder } from '@/lib/githubStorage';
import { findUserByEmail, addUser, addOrderToUser } from '@/lib/userStorage';

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
        estimatedDelivery: orderData.estimatedDelivery || '25-35 min'
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

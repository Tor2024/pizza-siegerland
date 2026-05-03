import { NextResponse } from 'next/server';
import { saveOrder, getOrder } from '@/lib/githubStorage';
import { findUserByEmail, addUser, addOrderToUser } from '@/lib/userStorage';

// In-memory cache for fast access
const orderCache = new Map<string, any>();

// Helper to get Google Maps API key
async function getGoogleMapsApiKey(): Promise<string | null> {
  try {
    const { getMenuFromGitHub } = await import('@/lib/githubMenuStorage');
    const menuData = await getMenuFromGitHub();
    if (menuData?.settings?.googleMapsApiKey) {
      return menuData.settings.googleMapsApiKey;
    }
  } catch (e) {
    console.log('Could not load menu settings for API key');
  }
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

// Pizzeria address as default origin for directions
const PIZZERIA_ADDRESS = 'Kölner Tor 1, Siegen, Germany';

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
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code;
    
    // Validate address using Google Maps API
    let addressValid = true;
    let addressMessage = '';
    let customerCoords = null;
    let deliveryRoute = null;
    
    try {
      const apiKey = await getGoogleMapsApiKey();
      if (apiKey) {
        // Step 1: Validate address and get coordinates
        const encodedAddress = encodeURIComponent(orderData.customer.address);
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&components=country:de&language=de`;
        const geoResponse = await fetch(geocodeUrl);
        const geoData = await geoResponse.json();
        
        if (geoData.status === 'OK' && geoData.results?.length > 0) {
          const result = geoData.results[0];
          const { lat, lng } = result.geometry.location;
          
          // Strict validation: check if address has street number
          const hasStreetNumber = result.address_components.some((comp: any) => 
            comp.types.includes('street_number')
          );
          
          if (!hasStreetNumber) {
            addressValid = false;
            addressMessage = 'Bitte geben Sie eine genaue Adresse mit Hausnummer an.';
          } else {
            customerCoords = { lat, lng, formatted_address: result.formatted_address };
            
            // Step 2: Get directions from pizzeria to customer
            const directionsParams = new URLSearchParams({
              origin: PIZZERIA_ADDRESS,
              destination: `${lat},${lng}`,
              mode: 'driving',
              key: apiKey,
              language: 'de'
            });
            const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?${directionsParams.toString()}`;
            const dirResponse = await fetch(directionsUrl);
            const dirData = await dirResponse.json();
            
            if (dirData.status === 'OK' && dirData.routes?.length > 0) {
              const route = dirData.routes[0];
              const leg = route.legs[0];
              deliveryRoute = {
                duration: leg.duration, // { text: "15 mins", value: 900 }
                distance: leg.distance,
                start_address: leg.start_address,
                end_address: leg.end_address,
                maps_url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(PIZZERIA_ADDRESS)}&destination=${encodeURIComponent(result.formatted_address)}&travelmode=driving`
              };
            }
          }
        } else {
          addressValid = false;
          addressMessage = 'Die Adresse konnte nicht gefunden werden. Bitte überprüfen Sie die Eingabe.';
        }
      }
    } catch (addressError) {
      console.error('Address validation error:', addressError);
      // Continue with order even if validation fails
    }
    
      const newOrder: any = {
        id: orderId,
        items: orderData.items,
        customer: orderData.customer,
        total: orderData.total,
        subtotal: orderData.subtotal,
        deliveryFee: orderData.deliveryFee,
        promoCode: orderData.promoCode || null,
        promoDiscount: orderData.promoDiscount || 0,
        status: 'pending_confirmation' as const,
        statusHistory: [
          { status: 'pending_confirmation' as const, timestamp: Date.now(), note: 'Order pending confirmation' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        estimatedDelivery: deliveryRoute?.duration?.text || orderData.estimatedDelivery || '25-35 min',
        confirmationCode: confirmationCode,
        // Address validation results
        addressValid,
        addressMessage: addressValid ? undefined : addressMessage,
        customerCoords,
        deliveryRoute
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

    // Send confirmation email with 6-digit code
    const emailConfigured = !!process.env.RESEND_API_KEY;
    
    if (orderData.customer?.email && emailConfigured) {
      try {
        const apiKey = process.env.RESEND_API_KEY;
        
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Pizza Roma <noreply@pizza-roma.de>',
            to: [orderData.customer.email],
            subject: `🍕 Ihr Bestätigungscode für Bestellung #${orderId.slice(-8)}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #c41e3a;">Pizza Roma - Bestätigungscode</h1>
              <p>Hallo ${orderData.customer.name},</p>
              <p>vielen Dank für Ihre Bestellung! Bitte geben Sie den folgenden 6-stelligen Code in der Bestellübersicht ein, um Ihre Bestellung zu bestätigen:</p>
              
              <div style="margin: 30px 0; text-align: center;">
                <div style="background: #f5f5f5; color: #c41e3a; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; border: 2px dashed #c41e3a;">
                  ${confirmationCode}
                </div>
              </div>
              
              <p style="color: #666; font-size: 14px;">Dieser Code ist für Ihre Bestellung <strong>#${orderId.slice(-8)}</strong> bestimmt.</p>
              
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
          }),
        });
        
        if (response.ok) {
          console.log(`📧 Confirmation email with code sent to ${orderData.customer.email}`);
        } else {
          const errorData = await response.json();
          console.error('Resend API error:', errorData);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    } else if (!emailConfigured) {
      console.log(`⚠️ RESEND_API_KEY not configured. Confirmation code for ${orderData.customer?.email || 'customer'}: ${confirmationCode}`);
    }

    // Отправляем уведомление админу (заглушка для future webhook)
    console.log(`🍕 New order received: ${orderId} - ${orderData.customer.name} - ${orderData.total}€`);

    // Always return confirmation code in response for UI display
    return NextResponse.json({ 
      success: true, 
      orderId,
      confirmationCode: confirmationCode, // Always return code for UI
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

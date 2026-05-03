import { NextRequest, NextResponse } from 'next/server';

// Google Maps API key from settings or environment
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

export async function POST(req: NextRequest) {
  try {
    const { origin, destination, mode = 'driving' } = await req.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 });
    }

    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Google Maps API key not configured',
        message: 'Directions service unavailable'
      }, { status: 200 });
    }

    // Build URL for Directions API
    const params = new URLSearchParams({
      origin: origin,
      destination: destination,
      mode: mode,
      key: apiKey,
      language: 'de',
      region: 'de'
    });

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
    
    const response = await fetch(directionsUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      return NextResponse.json({
        success: false,
        error: 'Directions request failed',
        message: data.status,
        details: data.error_message
      });
    }

    const route = data.routes[0];
    if (!route) {
      return NextResponse.json({
        success: false,
        error: 'No route found'
      });
    }

    const leg = route.legs[0];
    const duration = leg.duration; // { text: "15 mins", value: 900 }
    const distance = leg.distance;

    return NextResponse.json({
      success: true,
      duration: duration,
      distance: distance,
      start_address: leg.start_address,
      end_address: leg.end_address,
      overview_polyline: route.overview_polyline?.points
    });

  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Directions service error'
    }, { status: 200 });
  }
}
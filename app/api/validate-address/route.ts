import { NextRequest, NextResponse } from 'next/server';

// Google Maps API key from settings or environment
async function getGoogleMapsApiKey(): Promise<string | null> {
  try {
    // Try to get from menu settings (GitHub storage)
    const { getMenuFromGitHub } = await import('@/lib/githubMenuStorage');
    const menuData = await getMenuFromGitHub();
    if (menuData?.settings?.googleMapsApiKey) {
      return menuData.settings.googleMapsApiKey;
    }
  } catch (e) {
    console.log('Could not load menu settings for API key');
  }
  
  // Fallback to environment variable
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Google Maps API key not configured',
        message: 'Address validation is currently unavailable. Order will be accepted without validation.'
      }, { status: 200 }); // Return 200 so order can still proceed
    }

    // Call Google Maps Geocoding API
    const encodedAddress = encodeURIComponent(address);
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&components=country:de&language=de`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return NextResponse.json({
        valid: false,
        error: 'Address not found',
        message: 'Die Adresse konnte nicht gefunden werden. Bitte überprüfen Sie die Eingabe.',
        details: data.status
      });
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    
    // Strict validation: check if address has street number
    const hasStreetNumber = result.address_components.some((comp: any) => 
      comp.types.includes('street_number')
    );
    
    if (!hasStreetNumber) {
      return NextResponse.json({
        valid: false,
        error: 'Incomplete address',
        message: 'Bitte geben Sie eine genaue Adresse mit Hausnummer an.',
        lat,
        lng,
        formatted_address: result.formatted_address
      });
    }

    return NextResponse.json({
      valid: true,
      lat,
      lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id
    });

  } catch (error) {
    console.error('Address validation error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Validation service error',
      message: 'Ein Fehler ist aufgetreten. Bestellung wird trotzdem angenommen.'
    }, { status: 200 });
  }
}
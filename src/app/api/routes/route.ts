
import {NextResponse} from 'next/server';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export async function POST(request: Request) {
  if (!googleMapsApiKey) {
    console.error('Google Maps API key is not configured.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { origin, destination } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Missing origin or destination' }, { status: 400 });
    }
    
    const body = {
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: 'TRANSIT',
        transitPreferences: {
            allowedTravelModes: ['BUS']
        },
        languageCode: 'es-UY',
        regionCode: 'UY',
        computeAlternativeRoutes: true,
    };

    const response = await fetch(ROUTES_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleMapsApiKey,
            // Request all the fields we need
            'X-Goog-FieldMask': 'routes(legs,duration,distanceMeters,polyline,description,warnings,viewport,travelAdvisory)'
        },
        body: JSON.stringify(body)
    });
    
    const data = await response.json();

    if (data.error) {
       console.error('Routes API Error:', data.error);
       const errorMessage = data.error?.message || 'Unknown error from Google Routes API';
       return NextResponse.json({ error: 'Failed to get routes from Google', details: errorMessage }, { status: response.status || 500 });
    }
    
    // Pass the raw DirectionsResult-like object to the frontend
    // The DirectionsRenderer can handle this structure directly.
    return NextResponse.json({ routes: data.routes || [] }, { status: 200 });

  } catch (error) {
    console.error('Fatal error in routes endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Add a GET handler to prevent build errors if needed, or for health checks.
export async function GET() {
  return NextResponse.json({ message: 'Routes API endpoint is active. Use POST to get routes.' });
}

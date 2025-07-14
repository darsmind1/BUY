
import {NextResponse} from 'next/server';

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

export async function POST(request: Request) {
  if (!googleMapsApiKey) {
    console.error('Google Maps API key is not configured.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { busLocation, stopLocation } = await request.json();

    if (!busLocation || !stopLocation) {
      return NextResponse.json({ error: 'Missing busLocation or stopLocation' }, { status: 400 });
    }

    const origin = `${busLocation.lat},${busLocation.lng}`;
    const destination = `${stopLocation.lat},${stopLocation.lng}`;
    
    // Use departure_time: 'now' and traffic_model: 'best_guess' for real-time traffic
    const url = `${DISTANCE_MATRIX_URL}?origins=${origin}&destinations=${destination}&key=${googleMapsApiKey}&departure_time=now&traffic_model=best_guess&language=es`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows[0]?.elements[0]) {
       console.error('Distance Matrix API Error:', data.error_message || data.status);
       return NextResponse.json({ error: 'Failed to get ETA from Google', details: data.error_message || data.status }, { status: 500 });
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
        // This can happen if a route is not found between the points
        return NextResponse.json({ eta: null }, { status: 200 });
    }
    
    // 'duration_in_traffic' is the most accurate value, fallback to 'duration'
    const durationInSeconds = element.duration_in_traffic?.value ?? element.duration.value;

    return NextResponse.json({ eta: durationInSeconds }, { status: 200 });

  } catch (error) {
    console.error('Error in ETA endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

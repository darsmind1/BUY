
import {NextResponse} from 'next/server';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Function to convert API response to a google.maps.DirectionsResult compatible format
// This is a simplified conversion and might need adjustments for full compatibility.
function toDirectionsResult(routesApiResponse: any): any {
  if (!routesApiResponse.routes || routesApiResponse.routes.length === 0) {
    return { routes: [] };
  }

  const transformedRoutes = routesApiResponse.routes.map((route: any) => ({
    ...route,
    overview_polyline: { points: route.polyline?.encodedPolyline },
    legs: route.legs.map((leg: any) => ({
      ...leg,
      start_address: leg.startAddress,
      end_address: leg.endAddress,
      start_location: { lat: () => leg.startLocation.latLng.latitude, lng: () => leg.startLocation.latLng.longitude },
      end_location: { lat: () => leg.endLocation.latLng.latitude, lng: () => leg.endLocation.latLng.longitude },
      duration: { text: leg.duration, value: parseInt(leg.duration.replace('s', ''), 10) },
      distance: { text: `${leg.distanceMeters} m`, value: leg.distanceMeters },
      steps: leg.steps.map((step: any) => ({
        ...step,
        travel_mode: step.travelMode,
        duration: { text: step.duration, value: parseInt(step.duration.replace('s', ''), 10) },
        distance: { text: `${step.distanceMeters} m`, value: step.distanceMeters },
        instructions: step.navigationInstruction?.instructions,
        transit: step.transitDetails ? {
          ...step.transitDetails,
          line: {
            ...step.transitDetails.line,
            short_name: step.transitDetails.line.shortName,
            vehicle: {
              name: step.transitDetails.line.vehicle.name.text,
              type: step.transitDetails.line.vehicle.type,
            }
          },
          arrival_stop: {
            name: step.transitDetails.arrivalStop.name,
            location: {
              lat: () => step.transitDetails.arrivalStop.location.latLng.latitude,
              lng: () => step.transitDetails.arrivalStop.location.latLng.longitude,
              toJSON: () => ({ lat: step.transitDetails.arrivalStop.location.latLng.latitude, lng: step.transitDetails.arrivalStop.location.latLng.longitude })
            }
          },
          departure_stop: {
            name: step.transitDetails.departureStop.name,
            location: {
              lat: () => step.transitDetails.departureStop.location.latLng.latitude,
              lng: () => step.transitDetails.departureStop.location.latLng.longitude,
              toJSON: () => ({ lat: step.transitDetails.departureStop.location.latLng.latitude, lng: step.transitDetails.departureStop.location.latLng.longitude })
            }
          },
          num_stops: step.transitDetails.stopCount,
          headsign: step.transitDetails.headsign,
          departure_time: { text: new Date(step.transitDetails.departureTime).toLocaleTimeString('es-UY') },
        } : undefined,
        polyline: { points: step.polyline?.encodedPolyline }
      }))
    })),
    // Bounds might need to be calculated manually if not directly available
    bounds: route.viewport,
  }));
  
  return { ...routesApiResponse, routes: transformedRoutes };
}

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
            'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.polyline,routes.description,routes.warnings,routes.viewport'
        },
        body: JSON.stringify(body)
    });
    
    const data = await response.json();

    if (!response.ok || data.error) {
       console.error('Routes API Error:', data.error || `Status: ${response.status}`);
       return NextResponse.json({ error: 'Failed to get routes from Google', details: data.error?.message || 'Unknown error' }, { status: 500 });
    }
    
    // Convert the response to be as compatible as possible with DirectionsResult
    const compatibleResult = toDirectionsResult(data);

    return NextResponse.json(compatibleResult, { status: 200 });

  } catch (error) {
    console.error('Error in routes endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Add a GET handler to prevent build errors if needed, or for health checks.
export async function GET() {
  return NextResponse.json({ message: 'Routes API endpoint is active. Use POST to get routes.' });
}

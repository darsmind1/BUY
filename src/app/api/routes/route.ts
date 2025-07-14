
import {NextResponse} from 'next/server';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Function to convert API response to a google.maps.DirectionsResult compatible format
// This version is more robust and uses optional chaining to prevent crashes.
function toDirectionsResult(routesApiResponse: any): any {
  if (!routesApiResponse.routes || routesApiResponse.routes.length === 0) {
    return { routes: [] };
  }

  const transformedRoutes = routesApiResponse.routes.map((route: any) => ({
    ...route,
    overview_polyline: { points: route.polyline?.encodedPolyline },
    legs: route.legs?.map((leg: any) => ({
      ...leg,
      start_address: leg.startAddress,
      end_address: leg.endAddress,
      start_location: { 
        lat: () => leg.startLocation?.latLng?.latitude, 
        lng: () => leg.startLocation?.latLng?.longitude,
        toJSON: () => ({ lat: leg.startLocation?.latLng?.latitude, lng: leg.startLocation?.latLng?.longitude })
      },
      end_location: { 
        lat: () => leg.endLocation?.latLng?.latitude, 
        lng: () => leg.endLocation?.latLng?.longitude,
        toJSON: () => ({ lat: leg.endLocation?.latLng?.latitude, lng: leg.endLocation?.latLng?.longitude })
      },
      duration: leg.duration ? { text: leg.duration.replace('s',' seg'), value: parseInt(leg.duration.replace('s', ''), 10) } : undefined,
      distance: leg.distanceMeters ? { text: `${leg.distanceMeters} m`, value: leg.distanceMeters } : undefined,
      steps: leg.steps?.map((step: any) => {
        const transitDetails = step.transitDetails;
        return {
          ...step,
          travel_mode: step.travelMode || 'TRANSIT',
          duration: step.duration ? { text: step.duration.replace('s',' seg'), value: parseInt(step.duration.replace('s', ''), 10) } : undefined,
          distance: step.distanceMeters ? { text: `${step.distanceMeters} m`, value: step.distanceMeters } : undefined,
          instructions: step.navigationInstruction?.instructions || step.instruction,
          polyline: { points: step.polyline?.encodedPolyline },
          transit: transitDetails ? {
            ...transitDetails,
            line: {
              ...(transitDetails.line || {}),
              short_name: transitDetails.transitLine?.shortName || 'N/A',
              name: transitDetails.transitLine?.name || '',
              vehicle: {
                name: transitDetails.transitLine?.vehicle?.name?.text || 'Bus',
                type: transitDetails.transitLine?.vehicle?.type || 'BUS',
              }
            },
            arrival_stop: {
              name: transitDetails.arrivalStop?.name || 'Parada de llegada',
              location: {
                lat: () => transitDetails.arrivalStop?.location?.latLng?.latitude,
                lng: () => transitDetails.arrivalStop?.location?.latLng?.longitude,
                toJSON: () => ({ lat: transitDetails.arrivalStop?.location?.latLng?.latitude, lng: transitDetails.arrivalStop?.location?.latLng?.longitude })
              }
            },
            departure_stop: {
              name: transitDetails.departureStop?.name || 'Parada de salida',
              location: {
                lat: () => transitDetails.departureStop?.location?.latLng?.latitude,
                lng: () => transitDetails.departureStop?.location?.latLng?.longitude,
                toJSON: () => ({ lat: transitDetails.departureStop?.location?.latLng?.latitude, lng: transitDetails.departureStop?.location?.latLng?.longitude })
              }
            },
            num_stops: transitDetails.stopCount,
            headsign: transitDetails.headsign,
            departure_time: { text: transitDetails.departureTime ? new Date(transitDetails.departureTime).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit'}) : 'N/A' },
          } : undefined,
        }
      }) || [] // Use empty array as fallback if steps are missing
    })) || [], // Use empty array as fallback if legs are missing
    bounds: route.viewport ? {
        north: route.viewport.high?.latitude,
        south: route.viewport.low?.latitude,
        east: route.viewport.high?.longitude,
        west: route.viewport.low?.longitude,
    } : undefined,
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
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs,routes.polyline.encodedPolyline,routes.description,routes.warnings,routes.viewport'
        },
        body: JSON.stringify(body)
    });
    
    const data = await response.json();

    if (!response.ok || data.error) {
       console.error('Routes API Error:', data.error || `Status: ${response.status}`);
       const errorMessage = data.error?.message || 'Unknown error from Google Routes API';
       return NextResponse.json({ error: 'Failed to get routes from Google', details: errorMessage }, { status: response.status || 500 });
    }
    
    // Convert the response to be as compatible as possible with DirectionsResult
    const compatibleResult = toDirectionsResult(data);
    
    return NextResponse.json(compatibleResult, { status: 200 });

  } catch (error) {
    console.error('Fatal error in routes endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Add a GET handler to prevent build errors if needed, or for health checks.
export async function GET() {
  return NextResponse.json({ message: 'Routes API endpoint is active. Use POST to get routes.' });
}


import {NextResponse} from 'next/server';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Function to convert API response to a google.maps.DirectionsResult compatible format
// This version is highly robust, using optional chaining and providing safe fallbacks.
function toDirectionsResult(routesApiResponse: any): any {
  if (!routesApiResponse?.routes?.length) {
    return { routes: [] };
  }

  const transformedRoutes = routesApiResponse.routes.map((route: any) => ({
    ...route,
    overview_polyline: { points: route.polyline?.encodedPolyline },
    legs: route.legs?.map((leg: any) => ({
      ...leg,
      start_address: leg.startAddress ?? 'Dirección de partida no disponible',
      end_address: leg.endAddress ?? 'Dirección de llegada no disponible',
      start_location: { 
        lat: leg.startLocation?.latLng?.latitude, 
        lng: leg.startLocation?.latLng?.longitude 
      },
      end_location: { 
        lat: leg.endLocation?.latLng?.latitude, 
        lng: leg.endLocation?.latLng?.longitude 
      },
      duration: leg.duration && typeof leg.duration === 'string' 
        ? { text: leg.duration.replace('s',' seg'), value: parseInt(leg.duration.replace('s', ''), 10) || 0 } 
        : { text: 'N/A', value: 0 },
      distance: leg.distanceMeters 
        ? { text: `${leg.distanceMeters} m`, value: leg.distanceMeters } 
        : { text: 'N/A', value: 0 },
      steps: leg.steps?.map((step: any) => {
        const transitDetails = step.transitDetails;
        return {
          ...step,
          travel_mode: step.travelMode || 'TRANSIT',
          duration: step.duration && typeof step.duration === 'string' 
            ? { text: step.duration.replace('s',' seg'), value: parseInt(step.duration.replace('s', ''), 10) || 0 } 
            : { text: 'N/A', value: 0 },
          distance: step.distanceMeters 
            ? { text: `${step.distanceMeters} m`, value: step.distanceMeters } 
            : { text: 'N/A', value: 0 },
          instructions: step.navigationInstruction?.instructions ?? '',
          polyline: { points: step.polyline?.encodedPolyline },
          transit: transitDetails ? {
            ...transitDetails,
            line: {
              ...(transitDetails.transitLine || {}),
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
                lat: transitDetails.arrivalStop?.location?.latLng?.latitude,
                lng: transitDetails.arrivalStop?.location?.latLng?.longitude,
              }
            },
            departure_stop: {
              name: transitDetails.departureStop?.name || 'Parada de salida',
              location: {
                lat: transitDetails.departureStop?.location?.latLng?.latitude,
                lng: transitDetails.departureStop?.location?.latLng?.longitude,
              }
            },
            num_stops: transitDetails.stopCount ?? 0,
            headsign: transitDetails.headsign ?? '',
            departure_time: { text: transitDetails.departureTime ? new Date(transitDetails.departureTime).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit'}) : 'N/A' },
          } : undefined,
        }
      }) || [],
    })) || [],
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
            'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.warnings,routes.viewport'
        },
        body: JSON.stringify(body)
    });
    
    const data = await response.json();

    if (data.error) {
       console.error('Routes API Error:', data.error);
       const errorMessage = data.error?.message || 'Unknown error from Google Routes API';
       return NextResponse.json({ error: 'Failed to get routes from Google', details: errorMessage }, { status: response.status || 500 });
    }
    
    // The DirectionsRenderer in the frontend needs a full DirectionsResult object.
    // We create a compatible structure from the Routes API response.
    const directionsResult = {
      geocoded_waypoints: [],
      routes: data.routes.map((route: any) => ({
        ...route,
        overview_polyline: route.polyline, // The renderer can handle the polyline object directly
        legs: route.legs.map((leg: any) => ({
          ...leg,
          start_location: {
            lat: () => leg.startLocation.latLng.latitude,
            lng: () => leg.startLocation.latLng.longitude,
          },
          end_location: {
            lat: () => leg.endLocation.latLng.latitude,
            lng: () => leg.endLocation.latLng.longitude,
          },
          steps: leg.steps.map((step: any) => ({
            ...step,
            travel_mode: step.travelMode,
            instructions: step.navigationInstruction?.instructions || '',
            transit: step.transitDetails ? {
              ...step.transitDetails,
              arrival_stop: {
                name: step.transitDetails.arrivalStop.name,
                location: {
                  lat: () => step.transitDetails.arrivalStop.location.latLng.latitude,
                  lng: () => step.transitDetails.arrivalStop.location.latLng.longitude,
                }
              },
              departure_stop: {
                name: step.transitDetails.departureStop.name,
                location: {
                  lat: () => step.transitDetails.departureStop.location.latLng.latitude,
                  lng: () => step.transitDetails.departureStop.location.latLng.longitude,
                }
              },
              line: {
                short_name: step.transitDetails.transitLine.shortName || 'N/A',
                name: step.transitDetails.transitLine.name,
                vehicle: step.transitDetails.transitLine.vehicle,
              },
              num_stops: step.transitDetails.stopCount || 0,
            } : undefined,
          }))
        })),
        bounds: new google.maps.LatLngBounds(
          { lat: route.viewport.low.latitude, lng: route.viewport.low.longitude },
          { lat: route.viewport.high.latitude, lng: route.viewport.high.longitude }
        )
      }))
    };
    
    return NextResponse.json(directionsResult, { status: 200 });

  } catch (error) {
    console.error('Fatal error in routes endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Add a GET handler to prevent build errors if needed, or for health checks.
export async function GET() {
  return NextResponse.json({ message: 'Routes API endpoint is active. Use POST to get routes.' });
}

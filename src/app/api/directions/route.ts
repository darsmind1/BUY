
import { NextRequest, NextResponse } from 'next/server';

// This is a simplified polyline decoder. For production, a robust library is recommended.
function decode(encoded: string): {lat: number, lng: number}[] {
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    const path: {lat: number, lng: number}[] = [];

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        path.push({lat: lat / 1e5, lng: lng / 1e5});
    }
    return path;
}


function formatLocation(location: any) {
    if (typeof location === 'string') {
        const [lat, lng] = location.split(',');
        return {
            location: {
                latLng: {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                }
            }
        };
    }
    return {
        location: {
            latLng: {
                latitude: location.lat,
                longitude: location.lng,
            }
        }
    };
}

async function translateRoutesResponse(routesApiResponse: any): Promise<any> {
    if (!routesApiResponse.routes || routesApiResponse.routes.length === 0) {
        return { routes: [] };
    }
    
    const translatedRoutes = routesApiResponse.routes.map((route: any) => {
        const leg = route.legs?.[0];
        if (!leg) return null;

        return {
            bounds: {
                north: route.viewport.high.latitude,
                south: route.viewport.low.latitude,
                east: route.viewport.high.longitude,
                west: route.viewport.low.longitude,
            },
            copyrights: 'Google',
            legs: [{
                steps: leg.steps?.map((step: any) => {
                    const travelMode = step.travelMode === 'WALK' ? 'WALKING' : 'TRANSIT';
                    const decodedPath = decode(step.polyline.encodedPolyline);

                    const directionsStep: any = {
                        distance: { text: `${step.distanceMeters} m`, value: step.distanceMeters },
                        duration: { text: step.staticDuration, value: parseInt(step.staticDuration.replace('s', ''), 10) || 0 },
                        end_location: { lat: step.endLocation.latLng.latitude, lng: step.endLocation.latLng.longitude },
                        start_location: { lat: step.startLocation.latLng.latitude, lng: step.startLocation.latLng.longitude },
                        instructions: step.navigationInstruction?.instructions || '',
                        path: decodedPath,
                        travel_mode: travelMode,
                        transit: null
                    };

                    if (travelMode === 'TRANSIT' && step.transitDetails) {
                        const transit = step.transitDetails;
                        directionsStep.transit = {
                            arrival_stop: {
                                location: { lat: transit.stopDetails.arrivalStop.location.latLng.latitude, lng: transit.stopDetails.arrivalStop.location.latLng.longitude },
                                name: transit.stopDetails.arrivalStop.name
                            },
                            departure_stop: {
                                location: { lat: transit.stopDetails.departureStop.location.latLng.latitude, lng: transit.stopDetails.departureStop.location.latLng.longitude },
                                name: transit.stopDetails.departureStop.name
                            },
                            arrival_time: { text: '', value: new Date(), time_zone: '' }, 
                            departure_time: { text: '', value: new Date(), time_zone: '' },
                            headsign: transit.headsign,
                            line: {
                                name: transit.transitLine.name,
                                short_name: transit.transitLine.shortName,
                                color: transit.transitLine.color,
                                agencies: transit.transitLine.agencies.map((a:any) => ({ name: a.name, phone: a.phoneNumber, url: a.uri })),
                                vehicle: {
                                    name: transit.transitLine.vehicle.name.text,
                                    type: transit.transitLine.vehicle.type,
                                    icon: ''
                                }
                            },
                            num_stops: transit.stopCount,
                        };
                    }
                    return directionsStep;
                }),
                start_address: leg.startAddress,
                end_address: leg.endAddress,
                start_location: { lat: leg.startLocation.latLng.latitude, lng: leg.startLocation.latLng.longitude },
                end_location: { lat: leg.endLocation.latLng.latitude, lng: leg.endLocation.latLng.longitude },
                distance: { text: `${leg.distanceMeters} m`, value: leg.distanceMeters },
                duration: { text: leg.staticDuration, value: parseInt(leg.staticDuration.replace('s', ''), 10) || 0 }
            }],
            overview_polyline: { points: route.polyline.encodedPolyline },
            summary: route.description || 'STM Route',
            warnings: [],
            waypoint_order: [],
        };
    }).filter(Boolean);

    return {
        geocoded_waypoints: [],
        routes: translatedRoutes,
    };
}


export async function POST(req: NextRequest) {
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";
    if (!googleMapsApiKey) {
        return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { origin, destination } = body;

        if (!origin || !destination) {
            return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 });
        }

        const requestBody = {
            origin: formatLocation(origin),
            destination: formatLocation(destination),
            travelMode: 'TRANSIT',
            computeAlternativeRoutes: true,
            transitPreferences: {
                allowedTravelModes: ['BUS'],
            },
            languageCode: 'es-419',
            regionCode: 'UY',
        };

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': googleMapsApiKey,
                'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.description,routes.polyline,routes.viewport',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Google Routes API Error:', JSON.stringify(error, null, 2));
            return NextResponse.json({ error: 'Failed to fetch directions from Google Routes API' }, { status: response.status });
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            return NextResponse.json({ routes: [] });
        }

        const translatedData = await translateRoutesResponse(data);
        
        // The client-side will receive a plain JSON object that mimics the structure of
        // a google.maps.DirectionsResult. The Google Maps script on the client will
        // re-hydrate this into proper LatLng, LatLngBounds etc. objects.
        return NextResponse.json(translatedData);

    } catch (error) {
        console.error('Server error in /api/directions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

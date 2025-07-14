
import { NextRequest, NextResponse } from 'next/server';

// This is a simplified polyline decoder. For production, a robust library is recommended.
function decode(encoded: string): [number, number][] {
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    const path: [number, number][] = [];

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

        path.push([lat / 1e5, lng / 1e5]);
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

async function translateRoutesResponse(routesApiResponse: any): Promise<google.maps.DirectionsResult> {
    const directionsResult: google.maps.DirectionsResult = {
        geocoded_waypoints: [], // This can be populated if needed
        routes: routesApiResponse.routes?.map((route: any) => {
            const leg = route.legs?.[0];
            return {
                bounds: new google.maps.LatLngBounds(
                    { lat: route.viewport.low.latitude, lng: route.viewport.low.longitude },
                    { lat: route.viewport.high.latitude, lng: route.viewport.high.longitude }
                ),
                copyrights: 'Google',
                legs: [{
                    steps: leg.steps?.map((step: any) => {
                        const travelMode = step.travelMode === 'WALK' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.TRANSIT;
                        const decodedPath = decode(step.polyline.encodedPolyline).map(p => new google.maps.LatLng(p[0], p[1]));

                        const directionsStep: google.maps.DirectionsStep = {
                            distance: { text: `${step.distanceMeters} m`, value: step.distanceMeters },
                            duration: { text: leg.duration, value: parseInt(leg.duration) || 0 }, // fallback
                            end_location: new google.maps.LatLng(step.endLocation.latLng.latitude, step.endLocation.latLng.longitude),
                            start_location: new google.maps.LatLng(step.startLocation.latLng.latitude, step.startLocation.latLng.longitude),
                            instructions: step.navigationInstruction?.instructions || '',
                            path: decodedPath,
                            travel_mode: travelMode,
                            transit: null
                        };

                        if (travelMode === google.maps.TravelMode.TRANSIT && step.transitDetails) {
                            directionsStep.transit = {
                                arrival_stop: {
                                    location: new google.maps.LatLng(step.transitDetails.stopDetails.arrivalStop.location.latLng.latitude, step.transitDetails.stopDetails.arrivalStop.location.latLng.longitude),
                                    name: step.transitDetails.stopDetails.arrivalStop.name
                                },
                                departure_stop: {
                                    location: new google.maps.LatLng(step.transitDetails.stopDetails.departureStop.location.latLng.latitude, step.transitDetails.stopDetails.departureStop.location.latLng.longitude),
                                    name: step.transitDetails.stopDetails.departureStop.name
                                },
                                arrival_time: { text: '', value: new Date(), time_zone: '' }, // Placeholder
                                departure_time: { text: '', value: new Date(), time_zone: '' }, // Placeholder
                                headsign: step.transitDetails.headsign,
                                line: {
                                    name: step.transitDetails.transitLine.name,
                                    short_name: step.transitDetails.transitLine.shortName,
                                    color: step.transitDetails.transitLine.color,
                                    agencies: step.transitDetails.transitLine.agencies.map((a:any) => ({ name: a.name, phone: a.phoneNumber, url: a.uri })),
                                    vehicle: {
                                        name: step.transitDetails.transitLine.vehicle.name.text,
                                        type: step.transitDetails.transitLine.vehicle.type,
                                        icon: ''
                                    }
                                },
                                num_stops: step.transitDetails.stopCount,
                            };
                        }

                        return directionsStep;
                    }),
                    start_address: leg.startAddress,
                    end_address: leg.endAddress,
                    start_location: new google.maps.LatLng(leg.startLocation.latLng.latitude, leg.startLocation.latLng.longitude),
                    end_location: new google.maps.LatLng(leg.endLocation.latLng.latitude, leg.endLocation.latLng.longitude),
                    distance: { text: `${leg.distanceMeters} m`, value: leg.distanceMeters },
                    duration: { text: leg.duration, value: parseInt(leg.duration) || 0 }
                }],
                overview_polyline: { points: route.polyline.encodedPolyline },
                summary: 'STM Route',
                warnings: [],
                waypoint_order: [],
                fare: undefined,
                overview_path: [],
            };
        }) || [],
    };

    return directionsResult;
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
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs,routes.polyline,routes.viewport',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Google Routes API Error:', error);
            return NextResponse.json({ error: 'Failed to fetch directions from Google Routes API' }, { status: response.status });
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            return NextResponse.json({ routes: [] });
        }

        const translatedData = await translateRoutesResponse(data);
        
        // The `google.maps` classes won't be available here, so we send the plain object
        // and the client-side Google Maps script will re-hydrate them.
        return NextResponse.json(translatedData);

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

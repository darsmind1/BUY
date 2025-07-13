
'use server';

import config from './config';
import { haversineDistance } from './utils';

// Initialize with a random index to distribute load initially
let currentCredentialIndex = Math.floor(Math.random() * config.stm.credentials.length);

if (config.stm.credentials.length === 0) {
  const errorMessage = 'CRITICAL: No STM API credentials found. Please check your environment variables for STM_CLIENT_ID_1, STM_CLIENT_SECRET_1, etc.';
  console.error(errorMessage);
}

interface StmToken {
  access_token: string;
  expires_in: number;
}

export interface BusLocation {
    id: string;
    timestamp: string;
    line: string;
    destination?: string;
    location: {
        coordinates: [number, number]; // [lng, lat]
    };
    access?: string;
    thermalConfort?: string;
}

export interface BusArrival {
    bus: BusLocation | null;
    eta: number; // in seconds, -1 for scheduled
    lastUpdate: number;
}

export interface StmBusStop {
    busstopId: number;
    location: {
        coordinates: [number, number]; // [lng, lat]
    };
    name: string;
}

export interface StmLineInfo {
    line: number;
    description: string;
}

export interface StmRouteOption {
    line: number;
    destination: string;
    departureStop: StmBusStop;
    arrivalStop: StmBusStop;
    userLocation: { lat: number, lng: number };
    stops: number;
    duration: number; // in minutes
    shape: [number, number][]; // Array of [lng, lat]
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getAccessToken(): Promise<string> {
  const credentials = config.stm.credentials;
  if (credentials.length === 0) {
    console.error("CRITICAL: No STM credentials configured.");
    throw new Error("No STM credentials configured.");
  }
  
  // Rotate to the next credential for the next call
  const credential = credentials[currentCredentialIndex];
  currentCredentialIndex = (currentCredentialIndex + 1) % credentials.length;
  

  const now = Date.now();
  const cached = tokenCache.get(credential.clientId);

  if (cached && now < cached.expiresAt) {
    return cached.token;
  }

  try {
    const response = await fetch(STM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credential.clientId,
        client_secret: credential.clientSecret,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch STM token for client ID ending in ...${credential.clientId.slice(-4)}. Status: ${response.status}. Body: ${errorText}.`);
      tokenCache.delete(credential.clientId);
      throw new Error(`Failed to get STM access token: ${response.status}`);
    }

    const tokenData: StmToken = await response.json();
    const newCachedToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000, // 60-second buffer
    };
    tokenCache.set(credential.clientId, newCachedToken);
    
    return newCachedToken.token;

  } catch (error) {
    console.error(`CRITICAL: Network or other exception while fetching STM access token for client ...${credential.clientId.slice(-4)}.`, error);
    tokenCache.delete(credential.clientId);
    throw error;
  }
}

async function stmApiFetch(path: string, options: RequestInit = {}, retries = 3): Promise<any> {
  try {
    const accessToken = await getAccessToken();
    const url = `${STM_API_BASE_URL}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 }
    });

    if (response.status === 204) {
      if (path.includes('/buses/busstops') && retries > 0) {
        console.warn(`Received 204 for ${path}. Retrying... (${retries - 1} left)`);
        await delay(1000);
        return stmApiFetch(path, options, retries - 1);
      }
      return [];
    }
    
    if (response.status === 429) {
      console.warn(`STM API rate limit exceeded for path ${path}. Returning null to avoid crash.`);
      return null;
    }

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`STM API request to ${path} resulted in a 404 Not Found. This likely means the requested resource doesn't exist. Returning empty array.`);
            return [];
        }
      const errorText = await response.text();
      console.error(`STM API request to ${path} failed:`, response.status, errorText);
      throw new Error(`STM API request failed for ${path}: ${response.status} ${errorText}`);
    }
    
    return await response.json();

  } catch (error) {
    console.error(`Exception during STM API fetch for path ${path}:`, error);
    throw error;
  }
}

export async function checkApiConnection(): Promise<boolean> {
    try {
        await getAccessToken();
        return true;
    } catch {
        return false;
    }
}

export async function getBusLocation(line: string, destination?: string): Promise<BusLocation[]> {
    if (!line) return [];
    
    let path = `/buses?lines=${line}`;
    if (destination) {
        path += `&destination=${encodeURIComponent(destination)}`;
    }

    const data = await stmApiFetch(path);

    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
            return [];
        }
        console.warn(`STM API response for ${path} was not an array, returning empty array to avoid crash:`, data);
        return [];
    }

    return data.map((bus: any) => {
        const busLine = typeof bus.line === 'object' && bus.line !== null && bus.line.value ? bus.line.value : bus.line;
        return {
            ...bus,
            line: busLine.toString(),
            id: bus.id?.toString(),
            access: bus.access,
            thermalConfort: bus.thermalConfort,
            destination: bus.destination,
        };
    }) as BusLocation[];
}

export async function getAllBusStops(): Promise<StmBusStop[]> {
    const data = await stmApiFetch('/buses/busstops');
    return (Array.isArray(data) ? data : []) as StmBusStop[];
}

export async function getLinesForBusStop(busstopId: number): Promise<StmLineInfo[]> {
    const data = await stmApiFetch(`/buses/busstops/${busstopId}/lines`);
    return (Array.isArray(data) ? data : []) as StmLineInfo[];
}

export async function getLinesForStops(stopIds: number[]): Promise<Map<number, number[]>> {
    const promises = stopIds.map(id => getLinesForBusStop(id));
    const results = await Promise.all(promises);
    const stopLinesMap = new Map<number, number[]>();
    stopIds.forEach((id, index) => {
        stopLinesMap.set(id, results[index].map(l => l.line));
    });
    return stopLinesMap;
}

export async function getArrivalsForStop(stopId: number, lineId?: number): Promise<BusArrival[] | null> {
    let path = `/buses/busstops/${stopId}/arrivals`;
    if (lineId) {
        path = `/buses/busstops/${stopId}/lines/${lineId}/arrivals`;
    }
    
    const data = await stmApiFetch(path);
    
    if (data === null) {
        return null;
    }
    
    if (!Array.isArray(data)) {
        console.warn(`STM API response for arrivals was not an array for stop ${stopId}.`, data);
        return [];
    }
    return data.map(arrival => ({
        ...arrival,
        bus: arrival.bus ? {
            ...arrival.bus,
            line: arrival.bus.line?.toString(),
            id: arrival.bus.id?.toString(),
            destination: arrival.bus.destination,
        } : null,
    }));
}

export async function getNearbyStops(coords: { lat: number, lng: number }, radius: number = 500): Promise<StmBusStop[]> {
    const data = await stmApiFetch(`/buses/busstops?latitude=${coords.lat}&longitude=${coords.lng}&radius=${radius}`);
    return (Array.isArray(data) ? data : []) as StmBusStop[];
}

async function getLineShape(line: number, stopId: number): Promise<{ shape: [number, number, number][], destination: string } | null> {
    try {
        const path = `/buses/lines/${line}/busstops/${stopId}/shape`;
        const data = await stmApiFetch(path);
        if (data && data.shape && data.shape.coordinates && data.destination) {
            return {
                shape: data.shape.coordinates, // [lng, lat, stopId?]
                destination: data.destination.name
            };
        }
        console.warn(`No shape data returned for line ${line} at stop ${stopId}`);
        return null;
    } catch (error) {
        console.error(`Error fetching shape for line ${line} at stop ${stopId}:`, error);
        return null;
    }
}

export async function findDirectBusRoutes(origin: { lat: number, lng: number }, destination: { lat: number, lng: number }): Promise<StmRouteOption[]> {
    const [originStops, destinationStops] = await Promise.all([
        getNearbyStops(origin),
        getNearbyStops(destination)
    ]);

    if (originStops.length === 0 || destinationStops.length === 0) {
        return [];
    }

    const originStopIds = originStops.map(s => s.busstopId);
    const destinationStopIds = destinationStops.map(s => s.busstopId);

    const [originLinesMap, destinationLinesMap] = await Promise.all([
        getLinesForStops(originStopIds),
        getLinesForStops(destinationStopIds)
    ]);

    const commonLines = new Map<number, { departureStops: number[], arrivalStops: number[] }>();

    originLinesMap.forEach((lines, stopId) => {
        lines.forEach(line => {
            if (!commonLines.has(line)) {
                commonLines.set(line, { departureStops: [], arrivalStops: [] });
            }
            commonLines.get(line)!.departureStops.push(stopId);
        });
    });

    destinationLinesMap.forEach((lines, stopId) => {
        lines.forEach(line => {
            if (commonLines.has(line)) {
                commonLines.get(line)!.arrivalStops.push(stopId);
            }
        });
    });

    const routeOptions: StmRouteOption[] = [];
    const shapePromises: Promise<void>[] = [];

    for (const [line, stops] of commonLines.entries()) {
        if (stops.departureStops.length > 0 && stops.arrivalStops.length > 0) {
            
            const departureStop = originStops.find(s => s.busstopId === stops.departureStops[0])!;
            const arrivalStop = destinationStops.find(s => s.busstopId === stops.arrivalStops[0])!;

            const promise = getLineShape(line, departureStop.busstopId).then(shapeInfo => {
                if (shapeInfo && shapeInfo.shape.length > 0) {
                    
                    const stopIdsInShape = shapeInfo.shape.map(p => p[2]);
                    const depStopIndex = stopIdsInShape.indexOf(departureStop.busstopId);
                    
                    // Find any of the possible arrival stops in the shape
                    let arrStopIndex = -1;
                    for(const stopId of stops.arrivalStops){
                        const index = stopIdsInShape.indexOf(stopId);
                        if(index > depStopIndex) {
                           arrStopIndex = index;
                           break;
                        }
                    }

                    if (depStopIndex !== -1 && arrStopIndex !== -1) {
                        const stopsBetween = arrStopIndex - depStopIndex;
                        routeOptions.push({
                            line,
                            destination: shapeInfo.destination,
                            departureStop,
                            arrivalStop,
                            userLocation: origin,
                            stops: stopsBetween,
                            duration: stopsBetween * 2, // Approx 2 mins per stop
                            shape: shapeInfo.shape.map(p => [p[0], p[1]]),
                        });
                    }
                }
            });
            shapePromises.push(promise);
        }
    }

    await Promise.all(shapePromises);

    // Sort by walking distance to departure stop
    routeOptions.sort((a, b) => {
        const distA = haversineDistance(origin, { lat: a.departureStop.location.coordinates[1], lng: a.departureStop.location.coordinates[0] });
        const distB = haversineDistance(origin, { lat: b.departureStop.location.coordinates[1], lng: b.departureStop.location.coordinates[0] });
        return distA - distB;
    });

    // Remove duplicate routes (same line and destination)
    const uniqueRoutes = new Map<string, StmRouteOption>();
    routeOptions.forEach(route => {
        const key = `${route.line}-${route.destination}`;
        if (!uniqueRoutes.has(key)) {
            uniqueRoutes.set(key, route);
        }
    });

    return Array.from(uniqueRoutes.values());
}

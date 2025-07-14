
'use server';

import config from './config';
import type { BusLocation, StmBusStop, StmLineRoute, UpcomingBus } from './types';
import { haversineDistance } from './utils';

// Initialize with a random index to distribute load initially
let currentCredentialIndex = Math.floor(Math.random() * (config.stm.credentials.length || 1));

if (config.stm.credentials.length === 0) {
  const errorMessage = 'CRITICAL: No STM API credentials found. Please check your environment variables for STM_CLIENT_ID_1, STM_CLIENT_SECRET_1, etc.';
  console.error(errorMessage);
}

interface StmToken {
  access_token: string;
  expires_in: number;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const allStopsCache = {
    stops: [] as StmBusStop[],
    expiresAt: 0,
};

const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

// Forcefully gets a new token, ignoring the cache.
async function getNewAccessToken(): Promise<string> {
    const credentials = config.stm.credentials;
    if (credentials.length === 0) {
      console.error("CRITICAL: No STM credentials configured.");
      throw new Error("No STM credentials configured.");
    }
    
    // Rotate to the next credential
    currentCredentialIndex = (currentCredentialIndex + 1) % credentials.length;
    const credential = credentials[currentCredentialIndex];
    
    // Remove the old token from the cache before fetching a new one
    tokenCache.delete(credential.clientId);
  
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
        console.error(`Failed to fetch new STM token for client ...${credential.clientId.slice(-4)}. Status: ${response.status}. Body: ${errorText}.`);
        throw new Error(`Failed to get new STM access token: ${response.status}`);
      }
  
      const tokenData: StmToken = await response.json();
      const newCachedToken = {
        token: tokenData.access_token,
        // Set expiration with a 60-second buffer
        expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000, 
      };
      tokenCache.set(credential.clientId, newCachedToken);
      
      return newCachedToken.token;
  
    } catch (error) {
      console.error(`CRITICAL: Exception while fetching new STM access token for client ...${credential.clientId.slice(-4)}.`, error);
      throw error;
    }
}


// Gets a token, using the cache if valid.
async function getAccessToken(): Promise<string> {
    const credentials = config.stm.credentials;
    if (credentials.length === 0) {
      throw new Error("No STM credentials configured.");
    }
    const credential = credentials[currentCredentialIndex];
    const cached = tokenCache.get(credential.clientId);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    // If not cached or expired, get a new one (which also rotates the credential)
    return getNewAccessToken();
}

async function stmApiFetch(path: string, options: RequestInit = {}): Promise<any> {
    const makeRequest = async () => {
        const accessToken = await getAccessToken();
        const url = `${STM_API_BASE_URL}${path}`;

        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            next: { revalidate: 0 } // No caching for these requests
        });
    };

    let response = await makeRequest();
    
    // If authentication fails (401 or 403), our token is likely invalid.
    // Force a new token and retry once.
    if (response.status === 401 || response.status === 403) {
        console.warn(`STM API authentication failed with status ${response.status} for path ${path}. Forcing new token and retrying.`);
        await getNewAccessToken(); // This will clear the cache and rotate credentials
        response = await makeRequest();
    }
    
    if (response.status === 204) {
       return []; // No Content
    }
    if (response.status === 429) {
      console.warn(`STM API rate limit exceeded for path ${path}.`);
      return null;
    }
    if (response.status === 404) {
        console.warn(`STM API request to ${path} resulted in a 404 Not Found.`);
        return [];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`STM API request to ${path} failed with status ${response.status}: ${errorText}`);
      throw new Error(`STM API request failed for ${path}: ${response.status} ${errorText}`);
    }
    
    return await response.json();
}

export async function checkApiConnection(): Promise<boolean> {
    try {
        await getAccessToken();
        return true;
    } catch {
        return false;
    }
}

export async function getBusLocation(lines: {line?: string | null, destination?: string | null}[]): Promise<BusLocation[]> {
    const uniqueLineNumbers = [...new Set(lines.filter(l => l.line).map(l => l.line))];
    if (uniqueLineNumbers.length === 0) return [];
    
    const lineParams = uniqueLineNumbers.join(',');
    const path = `/buses?lines=${lineParams}`;
    
    try {
        const data = await stmApiFetch(path);

        if (!Array.isArray(data)) {
            if (data === null) return []; // Handle rate limiting case
            console.warn(`STM API response for ${path} was not an array, returning empty. Response:`, data);
            return [];
        }

        const allBuses = data.map((bus: any) => ({
            ...bus,
            line: (bus.line?.value ?? bus.line).toString(),
            id: (bus.id)?.toString(),
        })) as BusLocation[];

        // Filter by destination if provided
        return allBuses.filter(bus => {
            const lineMatch = lines.find(l => l.line === bus.line);
            // If no destination is specified for this line, include it.
            // If a destination is specified, check if the bus's destination includes it.
            return !lineMatch?.destination || (bus.destination && bus.destination.includes(lineMatch.destination));
        });

    } catch (error) {
        console.error(`Error in getBusLocation for lines ${lineParams}:`, error);
        return []; // Return empty array on failure to prevent crashes
    }
}


export async function getAllBusStops(): Promise<StmBusStop[]> {
    // Cache for 24 hours
    if (allStopsCache.stops.length > 0 && Date.now() < allStopsCache.expiresAt) {
        return allStopsCache.stops;
    }

    try {
        const path = '/buses/busstops';
        const data = await stmApiFetch(path);

        if (!Array.isArray(data)) {
            console.error('Failed to fetch bus stops, response was not an array.');
            return [];
        }

        allStopsCache.stops = data;
        allStopsCache.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        return data;

    } catch (error) {
        console.error("Error fetching all bus stops:", error);
        return [];
    }
}


export async function findClosestStmStop(lat: number, lng: number, allStops: StmBusStop[]): Promise<StmBusStop | null> {
    if (allStops.length === 0) {
        console.warn("findClosestStmStop called with empty stops list.");
        return null;
    }
    
    let closestStop: StmBusStop | null = null;
    let minDistance = Infinity;
    const searchRadius = 300; // 300 meters radius

    for (const stop of allStops) {
        const stopCoords = { lat: stop.location.coordinates[1], lng: stop.location.coordinates[0] };
        const distance = haversineDistance({ lat, lng }, stopCoords);

        if (distance < minDistance && distance <= searchRadius) {
            minDistance = distance;
            closestStop = stop;
        }
    }
    return closestStop;
}

export async function getLineRoute(line: string): Promise<StmLineRoute | null> {
    const path = `/buses/line/${line}/route`;
    try {
        const data = await stmApiFetch(path);
        if (!data || !Array.isArray(data.route) || data.route.length === 0) {
            console.warn(`Could not get route for line ${line}`);
            return null;
        }
        return data as StmLineRoute;
    } catch (error) {
        console.error(`Error in getLineRoute for line ${line}:`, error);
        return null;
    }
}

export async function getUpcomingBuses(busstopId: number, lines: string[] = []): Promise<UpcomingBus[]> {
    let path = `/buses/busstops/${busstopId}/arrivals`;
    if (lines.length > 0) {
        path += `?lines=${lines.join(',')}`;
    }

    try {
        const data = await stmApiFetch(path);
        if (!Array.isArray(data)) {
            return [];
        }
        return data as UpcomingBus[];
    } catch (error) {
        console.error(`Error fetching upcoming buses for stop ${busstopId}:`, error);
        return [];
    }
}

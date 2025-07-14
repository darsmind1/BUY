
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

const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.transportepublico.montevideo.gub.uy/api';

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
    const makeRequest = async (isRetry = false) => {
        const accessToken = isRetry ? await getNewAccessToken() : await getAccessToken();
        const url = `${STM_API_BASE_URL}${path}`;

        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
    };

    let response = await makeRequest();
    
    // If authentication fails (401 or 403), our token is likely invalid.
    // Force a new token and retry once.
    if (response.status === 401 || response.status === 403) {
        console.warn(`STM API authentication failed with status ${response.status} for path ${path}. Forcing new token and retrying.`);
        response = await makeRequest(true);
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

export async function getBusLocation(lines: {line: string, destination?: string | null}[]): Promise<BusLocation[]> {
    const uniqueLineNumbers = [...new Set(lines.map(l => l.line))];
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

        const allBuses: BusLocation[] = data.map((bus: any) => ({
            ...bus,
            line: (bus.line?.value ?? bus.line).toString(),
            id: (bus.id)?.toString(),
            lineVariantId: bus.lineVariantId,
            destination: bus.destination
        }));
        
        const linesWithDestinations = lines.filter(l => l.destination);
        if (linesWithDestinations.length === 0) {
            return allBuses;
        }

        return allBuses.filter(bus => {
            return lines.some(requestedLine => {
                if (bus.line !== requestedLine.line) {
                    return false;
                }
                if (!requestedLine.destination || !bus.destination) {
                    return true;
                }
                return bus.destination.toLowerCase().includes(requestedLine.destination.toLowerCase());
            });
        });

    } catch (error) {
        console.error(`Error in getBusLocation for lines ${lineParams}:`, error);
        return []; // Return empty array on failure to prevent crashes
    }
}


export async function getAllBusStops(): Promise<StmBusStop[]> {
    try {
        // This response is cached for a day due to next: { revalidate }
        const data: StmBusStop[] = await stmApiFetch(`/buses/busstops`, { next: { revalidate: 3600 * 24 } });
        return data;
    } catch (error) {
        console.error('Error in getAllBusStops:', error);
        throw error;
    }
}

export async function findClosestStmStop(lat: number, lng: number): Promise<StmBusStop | null> {
    try {
        const allStops = await getAllBusStops();
        if (allStops.length === 0) {
            return null;
        }

        let closestStop: StmBusStop | null = null;
        let minDistance = Infinity;

        for (const stop of allStops) {
            const stopCoords = {
                lat: stop.location.coordinates[1],
                lng: stop.location.coordinates[0],
            };
            const distance = haversineDistance({ lat, lng }, stopCoords);

            if (distance < minDistance) {
                minDistance = distance;
                closestStop = stop;
            }
        }
        
        // Only return if the stop is within a reasonable distance (e.g., 500 meters)
        if (closestStop && minDistance < 500) {
            return closestStop;
        }

        return null;

    } catch (error) {
        console.error(`Error finding closest stop locally for coords ${lat},${lng}:`, error);
        return null;
    }
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

export async function getUpcomingBuses(busstopId: number, lines: string[]): Promise<UpcomingBus[]> {
    if (lines.length === 0) {
        return [];
    }
    const path = `/buses/busstops/${busstopId}/upcomingbuses?lines=${lines.join(',')}&amountperline=1`;

    try {
        const data = await stmApiFetch(path, { cache: 'no-store' });
        if (!Array.isArray(data)) {
            console.warn(`Upcoming buses response for stop ${busstopId} was not an array.`);
            return [];
        }
        return data as UpcomingBus[];
    } catch (error) {
        console.error(`Error in getUpcomingBuses for stop ${busstopId} and lines '${lines.join(',')}':`, error);
        return [];
    }
}

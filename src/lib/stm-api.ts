
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
            next: { revalidate: 0 }
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
        
        // If no specific destinations are provided, return all buses for the lines
        const linesWithDestinations = lines.filter(l => l.destination);
        if (linesWithDestinations.length === 0) {
            return allBuses;
        }

        // Filter buses by matching their destination with the requested destinations
        return allBuses.filter(bus => {
            // A bus is relevant if it matches any of the line-destination pairs requested
            return lines.some(requestedLine => {
                if (bus.line !== requestedLine.line) {
                    return false;
                }
                // If the requested line has no destination, we can't filter by it, so we assume it's not a match for this specific filter
                // (it will be caught by another entry if there's a line-only request)
                if (!requestedLine.destination || !bus.destination) {
                    return false; 
                }
                 // Check if the bus destination string includes the destination from Google.
                 // This is more flexible than an exact match. e.g. "Pza. España" includes "España"
                return bus.destination.toLowerCase().includes(requestedLine.destination.toLowerCase());
            });
        });

    } catch (error) {
        console.error(`Error in getBusLocation for lines ${lineParams}:`, error);
        return []; // Return empty array on failure to prevent crashes
    }
}


export async function findClosestStmStop(lat: number, lng: number, line?: string): Promise<StmBusStop | null> {
    const radius = 500; // Use a larger radius for more flexibility

    // First attempt: Find stops for the specific line within the radius
    if (line) {
        try {
            const pathWithLine = `/buses/busstops?latitude=${lat}&longitude=${lng}&radius=${radius}&lines=${line}`;
            const stopsForLine: StmBusStop[] = await stmApiFetch(pathWithLine);

            if (Array.isArray(stopsForLine) && stopsForLine.length > 0) {
                // If we found stops for the line, return the geographically closest one
                return stopsForLine.reduce((closest, current) => {
                    const closestDist = haversineDistance({lat, lng}, {lat: closest.location.coordinates[1], lng: closest.location.coordinates[0]});
                    const currentDist = haversineDistance({lat, lng}, {lat: current.location.coordinates[1], lng: current.location.coordinates[0]});
                    return currentDist < closestDist ? current : closest;
                });
            }
        } catch (error) {
            console.warn(`Could not find a stop for line ${line} at ${lat},${lng}. Will try without line filter. Error:`, error);
        }
    }

    // Fallback or if no line was provided: Find the closest stop regardless of the line
    try {
        const pathWithoutLine = `/buses/busstops?latitude=${lat}&longitude=${lng}&radius=${radius}`;
        const nearbyStops: StmBusStop[] = await stmApiFetch(pathWithoutLine);

        if (!Array.isArray(nearbyStops) || nearbyStops.length === 0) {
            return null;
        }

        // Return the absolute closest stop from the results
        return nearbyStops.reduce((closest, current) => {
            const closestDist = haversineDistance({lat, lng}, {lat: closest.location.coordinates[1], lng: closest.location.coordinates[0]});
            const currentDist = haversineDistance({lat, lng}, {lat: current.location.coordinates[1], lng: current.location.coordinates[0]});
            return currentDist < closestDist ? current : closest;
        });
    } catch (error) {
        console.error(`Error finding any closest stop for coords ${lat},${lng}:`, error);
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

export async function getUpcomingBuses(busstopId: number, line: string, lineVariantId?: number | null): Promise<UpcomingBus | null> {
    let path = `/buses/busstops/${busstopId}/upcomingbuses?`;
    
    const params = new URLSearchParams();
    
    // The "lines" parameter is mandatory.
    params.append('lines', line);

    // Prioritize lineVariantId for more specific queries, but always include lines as a fallback/requirement.
    if (lineVariantId) {
        params.append('lineVariantIds', lineVariantId.toString());
    } 
    
    params.append('amountperline', '1');
    
    path += params.toString();

    try {
        const data = await stmApiFetch(path);
        // The API returns an array, we want the first element
        if (Array.isArray(data) && data.length > 0) {
            return data[0] as UpcomingBus;
        }
        return null;
    } catch (error) {
        console.error(`Error in getUpcomingBuses for stop ${busstopId} and params '${params.toString()}':`, error);
        return null;
    }
}

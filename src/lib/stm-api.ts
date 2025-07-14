
'use server';

import config from './config';

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

export interface UpcomingBus {
    line: string;
    busstopId: number;
    arrivalTime: number; // minutes
    busId: number;
    destination: string;
}

export interface BusLocation {
    id: string;
    timestamp: string;
    line: string;
    location: {
        coordinates: [number, number]; // [lng, lat]
    };
    access?: string;
    thermalConfort?: string;
}

export interface BusArrival {
    bus: BusLocation | null;
    eta: number; // in seconds
    lastUpdate: number;
}

export interface StmBusStop {
    busstopId: number;
    location: {
        coordinates: [number, number];
    };
    name: string;
}

export interface StmLineInfo {
    line: number;
    description: string;
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
      if (path.includes('/buses/busstops') && !path.includes('upcomingbuses') && retries > 0) {
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
            console.warn(`STM API request to ${path} resulted in a 404 Not Found. This likely means the requested resource (e.g., line/stop combination) doesn't exist. Returning empty array.`);
            return []; // Gracefully handle 404s as "no data"
        }
      const errorText = await response.text();
      console.error(`STM API request to ${path} failed:`, response.status, errorText);
      throw new Error(`STM API request failed for ${path}: ${response.status} ${errorText}`);
    }
    
    return await response.json();

  } catch (error) {
    console.error(`Exception during STM API fetch for path ${path}:`, error);
    return null;
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
            return []; // API returned an empty object, treat as no results.
        }
        console.warn(`STM API response for ${path} was not an array, returning empty array to avoid crash:`, data);
        return [];
    }

    return data.map((bus: any) => {
        const busLine = typeof bus.line === 'object' && bus.line !== null && bus.line.value ? bus.line.value : bus.line;
        return {
            ...bus,
            line: busLine.toString(),
            id: bus.id?.toString(), // Ensure id is a string
            access: bus.access,
            thermalConfort: bus.thermalConfort,
        };
    }) as BusLocation[];
}

export async function getUpcomingBuses(busstopId: number, lines?: string[], amountPerLine?: number): Promise<UpcomingBus[]> {
    if (!busstopId) return [];
    
    const params = new URLSearchParams();
    if (lines && lines.length > 0) {
        params.append('lines', lines.join(','));
    }
    if (amountPerLine) {
        params.append('amountperline', amountPerLine.toString());
    }

    const queryString = params.toString();
    let path = `/buses/busstops/${busstopId}/upcomingbuses`;
    if (queryString) {
        path += `?${queryString}`;
    }

    const data = await stmApiFetch(path);

    if (!Array.isArray(data)) {
         console.warn(`STM API upcomingbuses response for stop ${busstopId} was not an array.`, data);
        return [];
    }

    return data as UpcomingBus[];
}


export async function getAllBusStops(): Promise<StmBusStop[] | null> {
    const data = await stmApiFetch('/buses/busstops');
    if (data === null) {
      return null;
    }
    return (Array.isArray(data) ? data : []) as StmBusStop[];
}

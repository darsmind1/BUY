
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

export interface BusLocation {
    id: string;
    timestamp: string;
    line: string;
    destination?: string;
    location: {
        type: 'Point',
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

async function stmApiFetch(path: string, options: RequestInit = {}, retries = 1): Promise<any> {
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

    if (!response.ok) {
        if (response.status >= 500 && retries > 0) {
            console.warn(`STM API server error for path ${path}. Status: ${response.status}. Retrying... (${retries - 1} left)`);
            await delay(500);
            return stmApiFetch(path, options, retries - 1);
        }
        const errorText = await response.text();
        console.error(`STM API request to ${path} failed with status ${response.status}: ${errorText}`);
        return [];
    }

    if (response.status === 204) {
      return []; 
    }
    
    const text = await response.text();
    if (!text.trim()) {
        return [];
    }

    return JSON.parse(text);

  } catch (error) {
    console.error(`Exception during STM API fetch for path ${path}:`, error);
    if (retries > 0) {
      console.warn(`Retrying after exception... (${retries - 1} left)`);
      await delay(500);
      return stmApiFetch(path, options, retries - 1);
    }
    return [];
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
    
    const data = await stmApiFetch(path);

    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
            return [];
        }
        console.warn(`STM API response for ${path} was not an array, returning empty array to avoid crash:`, data);
        return [];
    }

    const allBuses = data.map((bus: any) => {
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

    if (destination) {
        return allBuses.filter(bus => bus.destination?.toUpperCase().includes(destination.toUpperCase()));
    }

    return allBuses;
}

export async function getArrivalsForStop(stopId: number): Promise<BusArrival[] | null> {
    if (!stopId) return null;
    let path = `/buses/busstops/${stopId}/arrivals`;
    
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

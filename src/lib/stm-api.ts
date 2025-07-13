
'use server';

import config from './config';
import type { BusLocation, StmBusStop } from './types';
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getAccessToken(): Promise<string> {
  const credentials = config.stm.credentials;
  if (credentials.length === 0) {
    console.error("CRITICAL: No STM credentials configured.");
    throw new Error("No STM credentials configured.");
  }
  
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
    
    // Handle specific status codes
    if (response.status === 204) {
       console.warn(`Received 204 No Content for ${path}. Returning empty array.`);
       return [];
    }
    if (response.status === 429) {
      console.warn(`STM API rate limit exceeded for path ${path}. Returning null to avoid crash.`);
      return null;
    }
    if (response.status === 404) {
        console.warn(`STM API request to ${path} resulted in a 404 Not Found. Returning empty array.`);
        return [];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`STM API request to ${path} failed:`, response.status, errorText);
      throw new Error(`STM API request failed for ${path}: ${response.status} ${errorText}`);
    }
    
    return await response.json();

  } catch (error) {
    console.error(`Exception during STM API fetch for path ${path}:`, error);
    // Re-throw the error so the calling server action fails clearly.
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

export async function findClosestStmStop(lat: number, lng: number): Promise<StmBusStop | null> {
    const radius = 200; // Search within a 200-meter radius
    const path = `/buses/busstops?latitude=${lat}&longitude=${lng}&radius=${radius}`;
    const nearbyStops = await stmApiFetch(path);

    if (!Array.isArray(nearbyStops) || nearbyStops.length === 0) {
        return null;
    }

    let closestStop: StmBusStop | null = null;
    let minDistance = Infinity;

    nearbyStops.forEach(stop => {
        const stopCoords = { lat: stop.location.coordinates[1], lng: stop.location.coordinates[0] };
        const distance = haversineDistance({ lat, lng }, stopCoords);
        if (distance < minDistance) {
            minDistance = distance;
            closestStop = stop;
        }
    });

    return closestStop;
}

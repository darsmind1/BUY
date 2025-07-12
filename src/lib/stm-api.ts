
'use server';

import config from './config';

// Validar credenciales al inicio. Si no están, el servidor no debería ni arrancar.
if (config.stm.credentials.length === 0) {
  const errorMessage = 'CRITICAL: No STM API credentials found. Please check your .env file for STM_CLIENT_ID_1, STM_CLIENT_SECRET_1, etc.';
  console.error(errorMessage);
  // No lanzamos error para no bloquear el build, pero la API no funcionará.
}


interface StmToken {
  access_token: string;
  expires_in: number;
}

export interface BusLocation {
    id: string;
    timestamp: string;
    line: string;
    location: {
        coordinates: [number, number]; // [lng, lat]
    };
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

// Cache tokens for each credential set. The key is the index in the config array.
let cachedTokens = new Map<number, { token: string; expiresAt: number }>();
let credentialIndex = 0;

const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

async function getAccessToken(): Promise<string> {
  if (config.stm.credentials.length === 0) {
      throw new Error("No STM credentials configured.");
  }
  
  // Round-robin selection of credentials
  const currentIndex = credentialIndex;
  credentialIndex = (credentialIndex + 1) % config.stm.credentials.length;
  
  const selectedCredential = config.stm.credentials[currentIndex];
  
  const now = Date.now();
  const cachedToken = cachedTokens.get(currentIndex);

  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  
  try {
    const response = await fetch(STM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: selectedCredential.clientId,
        client_secret: selectedCredential.clientSecret,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CRITICAL: Error fetching STM token for client ID ending in ...${selectedCredential.clientId.slice(-4)}. Status: ${response.status}. Body: ${errorText}.`);
      throw new Error(`Failed to fetch STM token: ${response.status} ${errorText}`);
    }

    const tokenData: StmToken = await response.json();

    const newCachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in - 60) * 1000,
    };
    
    cachedTokens.set(currentIndex, newCachedToken);

    return newCachedToken.token;
  } catch (error) {
    console.error(`CRITICAL: Network or other exception while fetching STM access token for client ID ...${selectedCredential.clientId.slice(-4)}.`, error);
    cachedTokens.delete(currentIndex);
    throw new Error(`Exception fetching access token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function stmApiFetch(path: string, options: RequestInit = {}): Promise<any[]> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error(`STM API fetch for path ${path} failed because no access token could be obtained.`);
      throw new Error('Could not obtain STM access token.');
    }

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
      return [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`STM API request to ${path} failed:`, response.status, errorText);
      throw new Error(`STM API request failed for ${path}: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();

    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
            return []; // API returned an empty object, treat as no results.
        }
        console.warn(`STM API response for ${path} was not an array, returning empty array to avoid crash:`, data);
        return [];
    }
    
    return data;

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

export async function getBusLocation(line: string): Promise<BusLocation[]> {
    if (!line) return [];
    const data = await stmApiFetch(`/buses?lines=${line}`);
    // The check for data being null is no longer needed as stmApiFetch will throw on error.
    return data.map((bus: any) => {
        const busLine = typeof bus.line === 'object' && bus.line !== null && bus.line.value ? bus.line.value : bus.line;
        return {
            ...bus,
            line: busLine.toString(),
            id: bus.id?.toString() // Ensure id is a string
        };
    }) as BusLocation[];
}

export async function getAllBusStops(): Promise<StmBusStop[]> {
    const data = await stmApiFetch('/buses/busstops');
    return data as StmBusStop[];
}

export async function getLinesForBusStop(busstopId: number): Promise<StmLineInfo[]> {
    const data = await stmApiFetch(`/buses/busstops/${busstopId}/lines`);
    return data as StmLineInfo[];
}

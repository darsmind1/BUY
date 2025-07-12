
'use server';

import config from './config';

// Validar credenciales al inicio.
if (config.stm.credentials.length === 0) {
  const errorMessage = 'CRITICAL: No STM API credentials found. Please check your environment variables for STM_CLIENT_ID_1, STM_CLIENT_SECRET_1, etc.';
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
const cachedTokens = new Map<number, { token: string; expiresAt: number }>();
let currentCredentialIndex = 0;

const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

async function getAccessToken(): Promise<string> {
  const credentialsCount = config.stm.credentials.length;
  if (credentialsCount === 0) {
    console.error("CRITICAL: No STM credentials configured.");
    throw new Error("No STM credentials configured.");
  }

  // Check cache for the current working credential
  const now = Date.now();
  const cachedToken = cachedTokens.get(currentCredentialIndex);
  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // Iterate through all credentials if the cached one is expired or doesn't exist
  for (let i = 0; i < credentialsCount; i++) {
    const credentialIndexToTry = (currentCredentialIndex + i) % credentialsCount;
    const selectedCredential = config.stm.credentials[credentialIndexToTry];

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

      if (response.ok) {
        const tokenData: StmToken = await response.json();
        const newCachedToken = {
          token: tokenData.access_token,
          expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000, // 60-second buffer
        };
        
        // Success! Update cache and set this as the current working credential index
        cachedTokens.set(credentialIndexToTry, newCachedToken);
        currentCredentialIndex = credentialIndexToTry;
        return newCachedToken.token;
      }

      // If response is not ok, log it and the loop will try the next credential
      const errorText = await response.text();
      console.error(`Failed to fetch STM token for client ID ending in ...${selectedCredential.clientId.slice(-4)}. Status: ${response.status}. Body: ${errorText}. Trying next credential...`);
      cachedTokens.delete(credentialIndexToTry); // Invalidate cache for this credential

    } catch (error) {
      console.error(`CRITICAL: Network or other exception while fetching STM access token for client ID ...${selectedCredential.clientId.slice(-4)}. Trying next credential...`, error);
      cachedTokens.delete(credentialIndexToTry); // Invalidate cache
    }
  }

  // If the loop completes without returning, all credentials have failed.
  console.error("CRITICAL: All STM credentials failed to fetch an access token.");
  throw new Error("All configured STM credentials failed.");
}


async function stmApiFetch(path: string, options: RequestInit = {}): Promise<any> {
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

export async function getBusLocation(line: string): Promise<BusLocation[]> {
    if (!line) return [];
    const data = await stmApiFetch(`/buses?lines=${line}`);

    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
            return []; // API returned an empty object, treat as no results.
        }
        console.warn(`STM API response for /buses?lines=${line} was not an array, returning empty array to avoid crash:`, data);
        return [];
    }

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
    return (Array.isArray(data) ? data : []) as StmBusStop[];
}

export async function getLinesForBusStop(busstopId: number): Promise<StmLineInfo[]> {
    const data = await stmApiFetch(`/buses/busstops/${busstopId}/lines`);
    return (Array.isArray(data) ? data : []) as StmLineInfo[];
}


'use server';

interface StmToken {
  access_token: string;
  expires_in: number;
}

export interface BusLocation {
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
}

export interface ArrivalInfo {
    eta: number; // seconds
    distance: number; // meters
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

const STM_CLIENT_ID = "d7916e2b";
const STM_CLIENT_SECRET = "164c5cf512e692dbfcc2fbda1f0ec0a1";

async function getAccessToken(): Promise<string | null> {
  const now = Date.now();

  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  if (!STM_CLIENT_ID || !STM_CLIENT_SECRET || STM_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    console.error('STM API credentials are not set. Please add them to src/lib/stm-api.ts');
    return null;
  }

  try {
    const response = await fetch(STM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: STM_CLIENT_ID,
        client_secret: STM_CLIENT_SECRET,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching STM token:', response.status, errorText);
      throw new Error(`Failed to fetch access token, status: ${response.status}`);
    }

    const tokenData: StmToken = await response.json();

    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in - 60) * 1000,
    };

    return cachedToken.token;
  } catch (error) {
    console.error('Exception while fetching STM access token:', error);
    cachedToken = null;
    return null;
  }
}

async function stmApiFetch(path: string, options: RequestInit = {}) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Could not retrieve access token for STM API.');
    }

    const url = `${STM_API_BASE_URL}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`STM API request to ${path} failed:`, response.status, await response.text());
      return null;
    }
    
    if (response.status === 204) {
      return [];
    }
    
    const data = await response.json();

    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) {
        return [];
    }

    return data;
  } catch (error) {
    console.error(`Exception during STM API fetch for path ${path}:`, error);
    return null;
  }
}

export async function getBusLocation(line: string): Promise<BusLocation[] | null> {
    const data = await stmApiFetch(`/buses?lines=${line}`);
    if (data && Array.isArray(data)) {
        return data as BusLocation[];
    }
    return null;
}

export async function getAllBusStops(): Promise<StmBusStop[] | null> {
    const data = await stmApiFetch('/buses/busstops');
    if (data && Array.isArray(data)) {
        return data as StmBusStop[];
    }
    return null;
}

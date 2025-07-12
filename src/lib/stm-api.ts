
'use server';

import dotenv from 'dotenv';
dotenv.config();

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

let cachedToken: { token: string; expiresAt: number } | null = null;


const STM_TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';
const STM_API_BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

const STM_CLIENT_ID = process.env.STM_CLIENT_ID;
const STM_CLIENT_SECRET = process.env.STM_CLIENT_SECRET;

if (!STM_CLIENT_ID || !STM_CLIENT_SECRET) {
  console.error('CRITICAL: STM API credentials are not configured in environment variables. Please create a .env file in the project root with STM_CLIENT_ID and STM_CLIENT_SECRET.');
}

async function getAccessToken(): Promise<string | null> {
  const now = Date.now();

  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  
  if (!STM_CLIENT_ID || !STM_CLIENT_SECRET) {
    console.error('CRITICAL: STM API credentials are not set. Cannot fetch access token.');
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
      console.error('CRITICAL: Error fetching STM token:', response.status, errorText);
      throw new Error(`Failed to fetch access token, status: ${response.status}`);
    }

    const tokenData: StmToken = await response.json();

    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in - 60) * 1000,
    };

    return cachedToken.token;
  } catch (error) {
    console.error('CRITICAL: Exception while fetching STM access token.', error);
    cachedToken = null;
    return null;
  }
}

async function stmApiFetch(path: string, options: RequestInit = {}) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error(`STM API fetch for path ${path} failed because no access token could be obtained.`);
      return null;
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
      console.error(`STM API request to ${path} failed:`, response.status, await response.text());
      return null;
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

export async function checkApiConnection(): Promise<boolean> {
    const token = await getAccessToken();
    return token !== null;
}

export async function getBusLocation(line: string): Promise<BusLocation[] | null> {
    const data = await stmApiFetch(`/buses?lines=${line}`);
    if (data && Array.isArray(data)) {
        return data.map((bus: any) => {
            const busLine = typeof bus.line === 'object' && bus.line !== null && bus.line.value ? bus.line.value : bus.line;
            return {
                ...bus,
                line: busLine.toString(),
            };
        }) as BusLocation[];
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

export async function getLinesForBusStop(busstopId: number): Promise<StmLineInfo[] | null> {
    const data = await stmApiFetch(`/buses/busstops/${busstopId}/lines`);
    if (data && Array.isArray(data)) {
        return data as StmLineInfo[];
    }
    return null;
}

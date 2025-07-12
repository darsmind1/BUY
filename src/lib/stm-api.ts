// @ts-nocheck
'use server';

interface StmToken {
    access_token: string;
    expires_in: number;
}

interface UpcomingArrival {
    line: string;
    arribos: { minutos: number; distancia: number }[];
}

interface StmArrivalInfo {
    eta: number; // in seconds
    distance: number; // in meters
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    const now = Date.now();

    if (cachedToken && now < cachedToken.expiresAt) {
        return cachedToken.token;
    }

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': process.env.STM_CLIENT_ID!,
                'client_secret': process.env.STM_CLIENT_SECRET!,
            }),
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error fetching STM token:", response.status, errorText);
            throw new Error(`Failed to fetch access token, status: ${response.status}`);
        }

        const tokenData: StmToken = await response.json();
        
        cachedToken = {
            token: tokenData.access_token,
            expiresAt: now + (tokenData.expires_in - 60) * 1000, // Refresh 1 minute before expiry
        };
        
        return cachedToken.token;

    } catch (error) {
        console.error("Exception while fetching STM access token:", error);
        cachedToken = null;
        throw error;
    }
}

async function stmApiFetch(path: string, options: RequestInit = {}) {
    try {
        const accessToken = await getAccessToken();
        const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/transportepublico${path}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`STM API request to ${path} failed:`, response.status, errorText);
            return null;
        }

        if (response.status === 204) { // No Content
            return [];
        }

        return await response.json();

    } catch (error) {
        console.error(`Exception during STM API fetch for path ${path}:`, error);
        return null;
    }
}

async function findStopByLocation(lat: number, lon: number): Promise<number | null> {
    const stops = await stmApiFetch(`/buses/busstops?lat=${lat}&lon=${lon}&dist=200`);
    if (stops && Array.isArray(stops) && stops.length > 0) {
        // Return the first stop found, which is usually the closest
        return stops[0].busstopId;
    }
    return null;
}

export async function getArrivals(line: string, stopLat: number, stopLon: number): Promise<StmArrivalInfo | null> {
    const stopId = await findStopByLocation(stopLat, stopLon);

    if (!stopId) {
        console.error(`Could not find a valid STM bus stop ID for location ${stopLat}, ${stopLon}`);
        return null;
    }

    const upcomingData: UpcomingArrival[] | null = await stmApiFetch(`/buses/busstops/${stopId}/upcomingbuses?lines=${line}`);
    
    if (!upcomingData || !Array.isArray(upcomingData) || upcomingData.length === 0) {
        return null;
    }

    const lineArrivals = upcomingData.find(arrivalInfo => arrivalInfo.line === line);

    if (lineArrivals && lineArrivals.arribos && lineArrivals.arribos.length > 0) {
        const firstArrival = lineArrivals.arribos[0];
        return {
            eta: firstArrival.minutos, // This is in seconds as per user feedback
            distance: firstArrival.distancia,
        };
    }
    
    return null;
}


// @ts-nocheck
'use server';

interface StmToken {
    access_token: string;
    expires_in: number;
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
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
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
            expiresAt: now + (tokenData.expires_in - 60) * 1000,
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
        const url = `${process.env.NEXT_PUBLIC_BASE_URL}${path}`;

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

        if (response.status === 204) {
            return [];
        }

        return await response.json();

    } catch (error) {
        console.error(`Exception during STM API fetch for path ${path}:`, error);
        return null;
    }
}

/**
 * Gets the real-time arrivals for a specific line at a specific stop location by finding the closest bus.
 * @param line The bus line number.
 * @param stopLat Latitude of the bus stop.
 * @param stopLon Longitude of the bus stop.
 * @returns A promise that resolves to an object containing eta and distance of the closest bus.
 */
export async function getArrivals(line: string, stopLat: number, stopLon: number) {
    if (!line || stopLat === undefined || stopLon === undefined) return null;

    const buses = await stmApiFetch(`/buses?lines=${line}`);

    if (!buses || !Array.isArray(buses) || buses.length === 0) {
        return null;
    }

    let closestBus = null;
    let minDistance = Infinity;

    for (const bus of buses) {
        const busLat = bus.location.coordinates[1];
        const busLon = bus.location.coordinates[0];

        // Simple distance calculation (Haversine would be more accurate but this is a good approximation for short distances)
        const distance = Math.sqrt(Math.pow(busLat - stopLat, 2) + Math.pow(busLon - stopLon, 2));

        if (distance < minDistance) {
            minDistance = distance;
            closestBus = bus;
        }
    }

    if (!closestBus) {
        return null;
    }
    
    // Average speed of a bus in Montevideo is around 15 km/h (or 4.16 m/s)
    // The distance is in degrees, so we need to convert it to meters
    // 1 degree of latitude is approx 111.32 km
    // 1 degree of longitude at Montevideo's latitude (-34.9) is approx 91.8 km
    const distanceInMeters = Math.sqrt(
        Math.pow((closestBus.location.coordinates[1] - stopLat) * 111320, 2) +
        Math.pow((closestBus.location.coordinates[0] - stopLon) * 91800, 2)
    );

    const averageSpeedMetersPerSecond = 4.16;
    const etaInSeconds = distanceInMeters / averageSpeedMetersPerSecond;

    return {
        eta: etaInSeconds,
        distance: distanceInMeters,
    };
}

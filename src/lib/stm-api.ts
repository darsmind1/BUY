// @ts-nocheck
'use server';

interface StmToken {
    access_token: string;
    expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

// Function to get the access token, cached for its expiration time.
async function getAccessToken(): Promise<string> {
    const now = Date.now();

    if (cachedToken && now < cachedToken.expiresAt) {
        return cachedToken.token;
    }

    try {
        console.log("Fetching new STM API access token...");
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': process.env.STM_CLIENT_ID,
                'client_secret': process.env.STM_CLIENT_SECRET,
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
            // We set expiration 60 seconds before it actually expires to be safe
            expiresAt: now + (tokenData.expires_in - 60) * 1000,
        };
        
        console.log("Successfully fetched new STM API access token.");
        return cachedToken.token;

    } catch (error) {
        console.error("Exception while fetching STM access token:", error);
        cachedToken = null; // Reset cache on error
        throw error;
    }
}


async function stmApiFetch(path: string, options: RequestInit = {}) {
    try {
        const accessToken = await getAccessToken();
        const url = `/api/transportepublico${path}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
            cache: 'no-store', // Use cache: 'no-store' for real-time data
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

/**
 * Finds the closest bus stop to a given location.
 * @param lat Latitude of the location.
 * @param lon Longitude of the location.
 * @returns A promise that resolves to an array of stop data or null.
 */
export async function findStopByLocation(lat: number, lon: number) {
    if (lat === undefined || lon === undefined) return null;
    
    let stops = await stmApiFetch(`/buses/busstops?lat=${lat}&lon=${lon}&dist=200`);
    
    // If no stops are found, try again with a larger radius
    if (!stops || stops.length === 0) {
        console.log(`No stop found at 200m for ${lat}, ${lon}. Retrying with 500m.`);
        stops = await stmApiFetch(`/buses/busstops?lat=${lat}&lon=${lon}&dist=500`);
    }

    return stops;
}


/**
 * Gets the real-time arrivals for a specific line at a specific stop.
 * @param line The bus line number.
 * @param stopId The ID of the bus stop.
 * @returns A promise that resolves to an object containing line info and arrivals.
 */
export async function getArrivals(line: string, stopId: number) {
    if (!line || !stopId) return null;

    const upcomingBuses = await stmApiFetch(`/buses/busstops/${stopId}/upcomingbuses?lines=${line}`);

    if (upcomingBuses && Array.isArray(upcomingBuses) && upcomingBuses.length > 0) {
        // The API returns an array of lines. We need to find the one we're interested in.
        const arrivalForLine = upcomingBuses.find(bus => bus.line === String(line));
        
        // Check if that line has upcoming arrivals in the 'arribos' array.
        if (arrivalForLine && arrivalForLine.arribos && Array.isArray(arrivalForLine.arribos) && arrivalForLine.arribos.length > 0) {
            // Return the line info and its arrivals
            return arrivalForLine;
        }
    }
    
    // Return null if no upcoming buses found or no arrivals for the specific line
    return null;
}

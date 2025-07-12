// @ts-nocheck
'use server';

import { unstable_cache } from "next/cache";

interface StmToken {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

// Function to get the access token, cached for its expiration time.
const getAccessToken = unstable_cache(
    async (): Promise<string> => {
        try {
            console.log("Fetching new STM API access token...");
            const response = await fetch(process.env.STM_TOKEN_URL, {
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
            console.log("Successfully fetched new STM API access token.");
            return tokenData.access_token;
        } catch (error) {
            console.error("Exception while fetching STM access token:", error);
            throw error;
        }
    },
    ['stm_access_token'],
    // We revalidate a bit before the token actually expires to avoid issues.
    { revalidate: 3500 }
);


async function stmApiFetch(path: string, options: RequestInit = {}) {
    const accessToken = await getAccessToken();
    const url = `/api/transportepublico${path}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
            next: { revalidate: 0 } // No cache for API calls
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
 * Gets the real-time locations for all buses of a specific line.
 * @param linea The bus line number.
 * @returns A promise that resolves to the API response or null if an error occurs.
 */
export async function getBusLocationsByLine(linea: number) {
    if (!linea) return null;
    return stmApiFetch(`/buses?lines=${linea}`);
}

/**
 * Finds the closest bus stop to a given location.
 * @param lat Latitude of the location.
 * @param lon Longitude of the location.
 * @returns A promise that resolves to an array of stop data or null.
 */
export async function findStopByLocation(lat: number, lon: number) {
    if (lat === undefined || lon === undefined) return null;
     // The API expects a short distance to find the *closest* stop.
    return stmApiFetch(`/buses/busstops?lat=${lat}&lon=${lon}&dist=50`);
}


/**
 * Gets the real-time arrivals for a specific line at a specific stop.
 * @param line The bus line number.
 * @param stopId The ID of the bus stop.
 * @returns A promise that resolves to an array of arrival data or null.
 */
export async function getArrivals(line: number, stopId: number) {
    if (!line || !stopId) return null;

    const upcomingBuses = await stmApiFetch(`/buses/busstops/${stopId}/upcomingbuses?lines=${line}`);

    if (upcomingBuses && Array.isArray(upcomingBuses) && upcomingBuses.length > 0) {
        // The API returns an array of lines. We need to find the one we're interested in.
        const arrivalForLine = upcomingBuses.find(bus => bus.line === String(line));
        
        // Check if that line has upcoming arrivals in the 'arribos' array.
        if (arrivalForLine && arrivalForLine.arribos && Array.isArray(arrivalForLine.arribos) && arrivalForLine.arribos.length > 0) {
            // Return the first upcoming bus from the 'arribos' list.
            return [arrivalForLine.arribos[0]];
        }
    }
    
    // Return empty array if no upcoming buses found or no arrivals for the specific line
    return [];
}

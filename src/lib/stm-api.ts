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

async function stmApiFetch(path: string) {
    const accessToken = await getAccessToken();
    const url = `${process.env.STM_API_BASE_URL}${path}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`STM API request to ${path} failed:`, response.status, errorText);
            throw new Error(`API request failed with status ${response.status}`);
        }

        if (response.status === 204) { // No Content
            return null;
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
    return stmApiFetch(`/buses?linea=${linea}`);
}
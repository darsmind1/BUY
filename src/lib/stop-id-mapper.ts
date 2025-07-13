
// This file is a simple placeholder for a future, more robust mapping system.
// In a real application, this would likely be a database or a more extensive static file.

// This is a VERY small subset of stops for demonstration purposes.
const stopNameMap: Record<string, number> = {
  "Av. 8 de Octubre y Bv. José Batlle y Ordóñez": 2988,
  "Av. 8 de Octubre y Comercio": 3060,
  "Av. 18 de Julio y Dr. Pablo de María": 4022,
  "Av. 18 de Julio y Ejido": 3939,
  "Av. Gral. Flores y Av. Gral. San Martín": 2296,
  "Av. Millán y Clemenceau": 1826,
  "Bv. Gral. Artigas y Av. Millán": 1696,
  "Terminal Tres Cruces": 2981,
  "Av. Italia y Bv. Gral. Artigas": 2102,
  "Av. Rivera y Bv. Gral. Artigas": 3288,
  // This helps map variations like "y" vs "&"
  "Av 8 de Octubre y Bv José Batlle y Ordoñez": 2988,
  "Av 18 de Julio y Dr Pablo de Maria": 4022,
  "Av 18 de Julio y Ejido": 3939,
  "Av Gral Flores y Av Gral San Martin": 2296,
  "Av Millan y Clemenceau": 1826,
  "Bv Gral Artigas y Av Millan": 1696,
  "Av Italia y Bv Gral Artigas": 2102,
  "Av Rivera y Bv Gral Artigas": 3288,
};

/**
 * Tries to find a corresponding STM bus stop ID from a stop name provided by Google.
 * This is a workaround for the discrepancy between Google's stop names and STM's IDs.
 * @param stopName - The name of the stop, usually from Google Directions API.
 * @returns The STM bus stop ID number, or null if not found.
 */
export function getStopIdFromStopName(stopName: string): number | null {
  const normalizedStopName = stopName.replace(/ y /g, ' & ').replace(/\./g, '');
  
  // Try direct match first
  if (stopNameMap[stopName]) {
    return stopNameMap[stopName];
  }
  
  // Try finding a key that is contained within the stop name
  const key = Object.keys(stopNameMap).find(k => normalizedStopName.includes(k.replace(/ y /g, ' & ').replace(/\./g, '')));
  
  return key ? stopNameMap[key] : null;
}

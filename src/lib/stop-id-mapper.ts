
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
  "Av. Gral. Rivera y Bv. Gral. Artigas": 3288, // Variation
  "Mercedes y Dr Javier Barrios Amorin": 3940,
  "Mercedes y Ejido": 3941,
  "Yaguaron y Av 18 de Julio": 3942,
  "Av 18 de Julio y Andes": 4204,
  "Av 18 de Julio y Convencion": 4205,
  "Plaza Independencia": 4060,
  "Ciudadela y Rincon": 4721,
  "Buenos Aires y Misiones": 4720,
  "Cerrito y Colon": 4719,
};

/**
 * Tries to find a corresponding STM bus stop ID from a stop name provided by Google.
 * This is a workaround for the discrepancy between Google's stop names and STM's IDs.
 * It's intentionally flexible to handle variations.
 * @param stopName - The name of the stop, usually from Google Directions API.
 * @returns The STM bus stop ID number, or null if not found.
 */
export function getStopIdFromStopName(stopName: string): number | null {
  // Normalize the input name: remove dots, convert to lowercase, and handle '&' vs 'y'
  const normalizedStopName = stopName
    .replace(/\./g, '')
    .toLowerCase()
    .replace(/ y | & /g, ' y ');

  // Try for a direct, exact match first after normalization
  for (const key in stopNameMap) {
    const normalizedKey = key
      .replace(/\./g, '')
      .toLowerCase()
      .replace(/ y | & /g, ' y ');
    if (normalizedKey === normalizedStopName) {
      return stopNameMap[key];
    }
  }

  // If no exact match, try a more lenient search: check if a known stop name is part of the Google stop name.
  // This helps with cases where Google adds extra info like " (esquina...)"
  for (const key in stopNameMap) {
    const normalizedKey = key
      .replace(/\./g, '')
      .toLowerCase()
      .replace(/ y | & /g, ' y ');

    if (normalizedStopName.includes(normalizedKey)) {
      return stopNameMap[key];
    }
  }

  return null;
}

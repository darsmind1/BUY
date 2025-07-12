import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the distance between two geographical coordinates using the Haversine formula.
 * @param coords1 - The first coordinate object { lat: number, lng: number }.
 * @param coords2 - The second coordinate object { lat: number, lng: number }.
 * @returns The distance in meters.
 */
export function haversineDistance(
  coords1: { lat: number, lng: number },
  coords2: { lat: number, lng: number }
): number {
  const R = 6371e3; // Earth's radius in metres
  const φ1 = coords1.lat * Math.PI / 180; // φ, λ in radians
  const φ2 = coords2.lat * Math.PI / 180;
  const Δφ = (coords2.lat - coords1.lat) * Math.PI / 180;
  const Δλ = (coords2.lng - coords1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}


'use server';
/**
 * @fileOverview Un flujo para calcular el tiempo estimado de arribo usando Google Distance Matrix API.
 *
 * - calculateArrival - Una función que estima el tiempo de viaje entre dos puntos.
 * - CalculateArrivalInput - El tipo de entrada para la función calculateArrival.
 * - CalculateArrivalOutput - El tipo de retorno para la función calculateArrival.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const CalculateArrivalInputSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  destination: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});
export type CalculateArrivalInput = z.infer<typeof CalculateArrivalInputSchema>;

const CalculateArrivalOutputSchema = z.object({
  durationMinutes: z.number().optional(),
});
export type CalculateArrivalOutput = z.infer<
  typeof CalculateArrivalOutputSchema
>;

async function getTravelTime(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | undefined> {
  if (!googleMapsApiKey) {
    console.error('Google Maps API Key is not configured.');
    return undefined;
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${googleMapsApiKey}&mode=driving`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (
      data.status === 'OK' &&
      data.rows[0]?.elements[0]?.status === 'OK'
    ) {
      const durationSeconds = data.rows[0].elements[0].duration.value;
      return Math.round(durationSeconds / 60);
    } else {
      console.warn('Distance Matrix API could not calculate duration:', data.status, data.error_message);
      return undefined;
    }
  } catch (error) {
    console.error('Error calling Distance Matrix API:', error);
    return undefined;
  }
}

export const calculateArrivalFlow = ai.defineFlow(
  {
    name: 'calculateArrivalFlow',
    inputSchema: CalculateArrivalInputSchema,
    outputSchema: CalculateArrivalOutputSchema,
  },
  async (input) => {
    const durationMinutes = await getTravelTime(input.origin, input.destination);
    return { durationMinutes };
  }
);

export async function calculateArrival(
  input: CalculateArrivalInput
): Promise<CalculateArrivalOutput> {
  return calculateArrivalFlow(input);
}

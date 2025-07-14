
'use server';

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export async function getFormattedAddress(lat: number, lng: number): Promise<string> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}&language=es&result_type=street_address`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch formatted address from Google Geocoding API');
      return 'Dirección no disponible';
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      // Find the most specific result, often the first one of type 'street_address'
      const streetAddressResult = data.results.find((r: any) => r.types.includes('street_address'));
      
      if (streetAddressResult) {
        // Extract street name and number
        const streetNumberComponent = streetAddressResult.address_components.find((c: any) => c.types.includes('street_number'));
        const routeComponent = streetAddressResult.address_components.find((c: any) => c.types.includes('route'));

        if (routeComponent && streetNumberComponent) {
          return `${routeComponent.long_name} ${streetNumberComponent.long_name}`;
        }
        // Fallback to the formatted address if components are not as expected
        return streetAddressResult.formatted_address.split(',')[0];
      }

      // Fallback to the first result's formatted address
      return data.results[0].formatted_address.split(',')[0];
    } else {
      console.warn(`Geocoding API returned status: ${data.status}`);
      return 'Ubicación aproximada';
    }
  } catch (error) {
    console.error('Error calling Google Geocoding API:', error);
    return 'Error al obtener dirección';
  }
}

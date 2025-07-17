
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock, Wifi, Accessibility, Snowflake, Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import { StopMarker } from '@/components/map-view';

const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";

async function getFormattedAddress(lat: number, lng: number): Promise<string> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}&language=es&result_type=street_address`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch formatted address from Google Geocoding API');
      return 'Dirección no disponible';
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const streetAddressResult = data.results.find((r: any) => r.types.includes('street_address'));
      
      if (streetAddressResult) {
        const streetNumberComponent = streetAddressResult.address_components.find((c: any) => c.types.includes('street_number'));
        const routeComponent = streetAddressResult.address_components.find((c: any) => c.types.includes('route'));

        if (routeComponent && streetNumberComponent) {
          return `${routeComponent.long_name} ${streetNumberComponent.long_name}`;
        }
        return streetAddressResult.formatted_address.split(',')[0];
      }
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


interface RouteDetailsPanelProps {
  route?: google.maps.DirectionsRoute;
  busLocations?: BusLocation[];
  isGoogleMapsLoaded: boolean;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  lastBusUpdate?: Date | null;
  isBusLoading?: boolean;
  isTramoEspecial?: boolean;
  tramoEspecial?: [number, number][];
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapStyle = [
    { elementType: "geometry", stylers: [{ color: "#F0F4F8" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#212F3D" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", stylers: [{ "visibility": "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e0e8f0" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e0e8f0" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dcec" }] },
];

const mapOptions: google.maps.MapOptions = {
    styles: mapStyle,
    disableDefaultUI: true,
    zoomControl: false,
    rotateControl: true,
    gestureHandling: 'auto',
};


const RouteDetailMap = ({ 
  isLoaded, 
  userLocation, 
  selectedRoute,
  busLocations 
} : {
  isLoaded: boolean;
  userLocation: google.maps.LatLngLiteral | null;
  selectedRoute: google.maps.DirectionsRoute | null;
  busLocations: BusLocation[];
}) => {
  const [userMarkerIcon, setUserMarkerIcon] = useState<google.maps.Symbol | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const hasCenteredRef = useRef(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    hasCenteredRef.current = false;
  }, []);

  useEffect(() => {
    if (isLoaded && window.google) {
      setUserMarkerIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
      });
    }
  }, [isLoaded]);

  useEffect(() => {
      const map = mapRef.current;
      if (map && userLocation && !hasCenteredRef.current) {
          map.panTo(userLocation);
          map.setZoom(16.5);
          hasCenteredRef.current = true;
      }
  }, [userLocation, mapRef, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const transitPolylineOptions: google.maps.PolylineOptions = { strokeColor: '#A40034', strokeOpacity: 0.7, strokeWeight: 5 };
  const walkingPolylineOptions: google.maps.PolylineOptions = { strokeColor: '#4A4A4A', strokeOpacity: 0, strokeWeight: 2, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 2, scale: 2, strokeColor: '#4A4A4A' }, offset: '0', repeat: '10px' }] };
  
  const firstTransitStep = selectedRoute?.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT');
  const departureStopLocation = firstTransitStep?.transit?.departure_stop.location;

  return (
    <GoogleMap
      onLoad={onLoad}
      mapContainerStyle={mapContainerStyle}
      center={userLocation || { lat: -34.90, lng: -56.16 }}
      zoom={16.5}
      options={mapOptions}
    >
      {selectedRoute && selectedRoute.legs[0].steps.map((step, index) => (
        <Polyline
          key={index}
          path={step.path}
          options={step.travel_mode === 'WALKING' ? walkingPolylineOptions : transitPolylineOptions}
        />
      ))}
      
      {userLocation && userMarkerIcon && <Marker position={userLocation} icon={userMarkerIcon} zIndex={101} />}

      {departureStopLocation && (
        <StopMarker position={{ lat: departureStopLocation.lat(), lng: departureStopLocation.lng() }} />
      )}

      {busLocations.map((bus) => (
        <Marker 
          key={`${bus.line}-${bus.location.coordinates[1]}-${bus.location.coordinates[0]}`}
          position={{ lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] }}
          zIndex={100}
          icon={{
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="24">
                      <rect x="0" y="0" width="100%" height="100%" rx="8" ry="8" fill="#212F3D" stroke="#ffffff" stroke-width="2"/>
                      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff">${bus.line}</text>
                  </svg>
              `)}`,
              scaledSize: new window.google.maps.Size(40, 24),
              anchor: new window.google.maps.Point(20, 12),
          }}
        />
      ))}
    </GoogleMap>
  )
}

const StepIcon = ({ type }: { type: 'WALKING' | 'TRANSIT' }) => {
  if (type === 'WALKING') {
    return <Footprints className="h-5 w-5 text-primary" />;
  }
  return <Bus className="h-5 w-5 text-primary" />;
};

const getBusLines = (steps: google.maps.DirectionsStep[]) => {
  const busLines = new Set<string>();
  steps.forEach(step => {
    if (step.travel_mode === 'TRANSIT' && step.transit) {
      busLines.add(step.transit.line.short_name || step.transit.line.name);
    }
  });
  return Array.from(busLines);
}

const getTotalDuration = (legs: google.maps.DirectionsLeg[]) => {
  let totalSeconds = 0;
  legs.forEach(leg => {
    if (leg.duration) {
      totalSeconds += leg.duration.value;
    }
  });
  return Math.round(totalSeconds / 60);
}

const AddressDisplay = ({ prefix, location, fallbackAddress }: { prefix: string; location: google.maps.LatLng | null; fallbackAddress: string }) => {
    const [address, setAddress] = useState<string | null>(null);

    useEffect(() => {
        const fetchAddress = async () => {
            if (location) {
                const formattedAddr = await getFormattedAddress(location.lat(), location.lng());
                setAddress(formattedAddr);
            } else if (fallbackAddress === 'Mi ubicación actual') {
                 setAddress('Tu ubicación actual');
            } else {
                // If location is null but there's a fallback address from Google, use that initially
                const parts = fallbackAddress.split(',');
                setAddress(parts[0]);
            }
        };
        fetchAddress();
    }, [location, fallbackAddress]);
    
    if (address === null) {
        return (
             <p className="text-xs text-muted-foreground h-4 bg-muted/50 rounded animate-pulse w-3/4"></p>
        );
    }
    
    return (
        <p className="text-xs text-muted-foreground">
            {prefix}: <span className="font-semibold text-foreground">{address}</span>
        </p>
    )
}

const BusFeatures = ({ bus }: { bus: BusLocation }) => {
    const hasAccessibility = bus.access === "PLATAFORMA ELEVADORA";
    const hasAC = bus.thermalConfort === "Aire Acondicionado";

    if (!hasAccessibility && !hasAC) return null;

    return (
        <div className="flex items-center gap-4 pt-2">
            {hasAccessibility && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Accessibility className="h-4 w-4" />
                    <span>Accesible</span>
                </div>
            )}
            {hasAC && (
                 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Snowflake className="h-4 w-4" />
                    <span>Aire Acond.</span>
                </div>
            )}
        </div>
    )
}

export default function RouteDetailsPanel({ 
  route, 
  busLocations = [],
  isGoogleMapsLoaded,
  directionsResponse,
  routeIndex,
  userLocation,
  lastBusUpdate,
  isBusLoading,
  isTramoEspecial = false,
  tramoEspecial = [],
}: RouteDetailsPanelProps) {
  if (isTramoEspecial) {
    // Panel especial para tramo manual
    return (
      <div className="flex flex-col gap-4 h-full animate-in fade-in duration-500">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 min-h-[1.5em]">
          {isBusLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualizando...
            </>
          ) : lastBusUpdate ? (
            <>
              Actualizado hace {Math.floor((Date.now() - lastBusUpdate.getTime()) / 1000)} segundos
            </>
          ) : null}
        </div>
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
          <div className="md:hidden">
            <div className="flex items-center gap-2 p-4 pb-2 text-sm font-medium text-primary">
              <Bus className="h-4 w-4" />
              <span>Tramo especial: Buenos Aires - Ituzaingó</span>
            </div>
            <div className="relative h-[200px] bg-muted">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={{ lat: -34.90514509476023, lng: -56.19996327179591 }}
                zoom={16}
                options={mapOptions}
              >
                {tramoEspecial.length > 1 && (
                  <Polyline
                    path={tramoEspecial.map(([lat, lng]) => ({ lat, lng }))}
                    options={{
                      strokeColor: "#A40034",
                      strokeOpacity: 0.9,
                      strokeWeight: 6,
                      zIndex: 10,
                    }}
                  />
                )}
                {busLocations.map((bus) => (
                  <Marker 
                    key={bus.id || `${bus.line}-${bus.location?.coordinates?.join('-')}-${bus.timestamp || Math.random()}`}
                    position={{ lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] }}
                    zIndex={100}
                    icon={{
                        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                            <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"24\">
                                <rect x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" rx=\"8\" ry=\"8\" fill=\"#212F3D\" stroke=\"#ffffff\" stroke-width=\"2\"/>
                                <text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"12\" font-weight=\"bold\" fill=\"#ffffff\">${bus.line}</text>
                            </svg>
                        `)}`,
                        scaledSize: new window.google.maps.Size(40, 24),
                        anchor: new window.google.maps.Point(20, 12),
                    }}
                  />
                ))}
              </GoogleMap>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bus className="h-5 w-5 text-primary" />
                  <span>Tramo especial: Buenos Aires - Ituzaingó</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <p className="text-xs text-muted-foreground">Solo se muestran los ómnibus que están circulando actualmente sobre este tramo especial.</p>
                {busLocations.length === 0 && (
                  <p className="text-xs text-warning-foreground">No hay buses en tiempo real sobre el tramo en este momento.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  if (!route) return null;
  const leg = route.legs[0];
  const busLines = getBusLines(leg.steps);
  const duration = getTotalDuration(route.legs);
  const isBusLive = busLocations.length > 0;
  const liveBusData = isBusLive ? busLocations[0] : null; 
  if (!leg) return null;

  return (
    <div className="flex flex-col gap-4 h-full animate-in fade-in duration-500">
      {/* Indicador de actualización en tiempo real */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 min-h-[1.5em]">
        {isBusLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Actualizando...
          </>
        ) : lastBusUpdate ? (
          <>
            Actualizado hace {Math.floor((Date.now() - lastBusUpdate.getTime()) / 1000)} segundos
          </>
        ) : null}
      </div>
      <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
        <div className="md:hidden">
            {isBusLive && (
                <div className="flex items-center gap-2 p-4 pb-2 text-sm font-medium text-green-400">
                    <Wifi className="h-4 w-4" />
                    <span>Bus en el mapa</span>
                </div>
            )}
            <div className="relative h-[200px] bg-muted">
              <RouteDetailMap 
                isLoaded={isGoogleMapsLoaded}
                userLocation={userLocation}
                selectedRoute={route}
                busLocations={busLocations}
              />
            </div>
        </div>
        <div className="p-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                    {busLines.map((bus) => (
                      <Badge key={bus} variant="outline" className="text-sm font-mono">{bus}</Badge>
                    ))}
                    {busLines.length === 0 && leg.steps.some(s => s.travel_mode === 'WALKING') && (
                      <Badge variant="outline" className="text-sm">A pie</Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 text-sm font-normal">
                  <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{duration} min</span>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
               <AddressDisplay prefix="Desde" location={leg.start_location} fallbackAddress={leg.start_address} />
               <AddressDisplay prefix="Hasta" location={leg.end_location} fallbackAddress={leg.end_address} />
              {liveBusData && <BusFeatures bus={liveBusData} />}
            </CardContent>
          </Card>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground px-1">Indicaciones</h3>
            <Accordion type="multiple" className="w-full space-y-1">
              {leg.steps.map((step, index) => {
                const hasDetailedWalkingSteps = step.travel_mode === 'WALKING' && step.steps && step.steps.length > 0;
                
                if (hasDetailedWalkingSteps) {
                  return (
                    <AccordionItem value={`item-${index}`} key={index} className="border-none">
                       <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                         <div className="mt-0.5">
                            <StepIcon type={step.travel_mode} />
                         </div>
                         <AccordionTrigger className="flex-1 text-left p-0 hover:no-underline">
                            <div className="flex-1 space-y-0.5">
                              <p className="font-medium text-xs leading-tight" dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
                              <p className="text-xs text-muted-foreground">{step.duration?.text}</p>
                            </div>
                         </AccordionTrigger>
                       </div>
                      <AccordionContent className="py-2 pl-10 pr-4 border-l ml-4">
                          <div className="space-y-2 text-xs">
                            {step.steps!.map((subStep, subIndex) => (
                               <p key={subIndex} dangerouslySetInnerHTML={{ __html: subStep.instructions || '' }} />
                            ))}
                          </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                }

                return (
                  <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className="mt-0.5">
                          <StepIcon type={step.travel_mode} />
                      </div>
                      <div className="flex-1 space-y-0.5">
                          <p className="font-medium text-xs leading-tight" dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
                          <p className="text-xs text-muted-foreground">{step.duration?.text}</p>
                      </div>
                      {step.travel_mode === 'TRANSIT' && step.transit && (
                        <Badge variant="default" className="font-mono text-xs">{step.transit.line.short_name || step.transit.line.name}</Badge>
                      )}
                  </div>
                )
              })}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}

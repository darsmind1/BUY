
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock, Wifi, Snowflake, Accessibility } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import MapView from './map-view';
import { useEffect, useState } from 'react';
import { getFormattedAddress } from '@/lib/google-maps-api';


interface RouteDetailsPanelProps {
  route: google.maps.DirectionsRoute;
  busLocations?: BusLocation[];
  isGoogleMapsLoaded: boolean;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  onToggleMap: () => void;
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
}: RouteDetailsPanelProps) {
  const leg = route.legs[0];
  const busLines = getBusLines(leg.steps);
  const duration = getTotalDuration(route.legs);

  const isBusLive = busLocations.length > 0;
  const liveBusData = isBusLive ? busLocations[0] : null; 
  
  if (!leg) return null;

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
        <div className="md:hidden">
            {isBusLive && (
                <div className="flex items-center gap-2 p-4 pb-2 text-sm font-medium text-green-400">
                    <Wifi className="h-4 w-4" />
                    <span>Bus en el mapa</span>
                </div>
            )}
            <div className="relative h-[200px] bg-muted touch-none">
                <MapView 
                    isLoaded={isGoogleMapsLoaded}
                    directionsResponse={directionsResponse}
                    routeIndex={routeIndex}
                    userLocation={userLocation}
                    selectedRoute={route}
                    busLocations={busLocations}
                    view="details"
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
  );
}

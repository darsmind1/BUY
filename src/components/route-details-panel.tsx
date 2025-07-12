
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock, Wifi, Map, Snowflake, Wheelchair } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { Button } from './ui/button';

interface RouteDetailsPanelProps {
  route: google.maps.DirectionsRoute;
  busLocations?: BusLocation[];
  // Props for embedded map on mobile
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

const AddressText = ({ prefix, fullAddress }: { prefix: string, fullAddress: string }) => {
    if (!fullAddress) {
        return (
            <p className="text-xs text-muted-foreground">
                {prefix}: <span className="font-semibold text-foreground">Ubicación actual</span>
            </p>
        );
    }
    const parts = fullAddress.split(',');
    const mainAddress = parts[0];
    const rest = parts.slice(1, -2).join(',').trim(); // Omit last 2 parts (usually Montevideo, Uruguay)
    
    return (
        <p className="text-xs text-muted-foreground">
            {prefix}: <span className="font-semibold text-foreground">{mainAddress}</span>{rest && `, ${rest}`}
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
                    <Wheelchair className="h-4 w-4" />
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
  onToggleMap
}: RouteDetailsPanelProps) {
  const leg = route.legs[0];
  const busLines = getBusLines(leg.steps);
  const duration = getTotalDuration(route.legs);

  const isBusLive = busLocations.length > 0;
  const liveBusData = isBusLive ? busLocations[0] : null; // Assuming we care about the first bus in the list
  
  if (!leg) return null;

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
       <div className="relative h-[200px] md:hidden">
            <div className="absolute inset-0 bg-muted">
                 <p className="flex items-center justify-center h-full text-muted-foreground text-sm">Cargando mapa...</p>
            </div>
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <Button onClick={onToggleMap}>
                    <Map className="mr-2 h-4 w-4" />
                    Ver mapa completo
                </Button>
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
                {isBusLive && (
                  <div className="flex items-center gap-1.5 text-green-400 animate-pulse">
                      <Wifi className="h-4 w-4" />
                      <span className="text-xs font-medium">En el mapa</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{duration} min</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <AddressText prefix="Desde" fullAddress={leg.start_address} />
            <AddressText prefix="Hasta" fullAddress={leg.end_address} />
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

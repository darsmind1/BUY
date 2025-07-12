
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock, Wifi } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import MapView from './map-view';

interface RouteDetailsPanelProps {
  route: google.maps.DirectionsRoute;
  busLocations?: BusLocation[];
  // Props for embedded map on mobile
  apiKey: string;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
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
    const parts = fullAddress.split(',');
    const street = parts[0];
    const rest = parts.slice(1).join(',');
    return (
        <p className="text-xs text-muted-foreground">
            {prefix}: <span className="font-semibold text-foreground">{street}</span>{rest && `, ${rest}`}
        </p>
    )
}

export default function RouteDetailsPanel({ 
  route, 
  busLocations = [],
  apiKey,
  directionsResponse,
  routeIndex,
  userLocation
}: RouteDetailsPanelProps) {
  const leg = route.legs[0];
  const busLines = getBusLines(leg.steps);
  const duration = getTotalDuration(route.legs);

  const isBusLive = busLocations.length > 0 && busLines.some(line => busLocations.some(bus => bus.line === line));
  
  if (!leg) return null;

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
      <div className="md:hidden">
          <MapView 
            containerClassName="h-[250px] w-full"
            apiKey={apiKey}
            directionsResponse={directionsResponse}
            routeIndex={routeIndex}
            userLocation={userLocation}
            selectedRoute={route}
            busLocations={busLocations}
          />
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
                  <div className="flex items-center gap-1.5 text-blue-400">
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

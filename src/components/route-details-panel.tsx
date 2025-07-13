
"use client";

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Footprints, Bus, Clock, Wifi, Accessibility, Snowflake, Eye } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import type { RouteOption } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from './ui/button';

interface RouteDetailsPanelProps {
  route: RouteOption;
  busLocations?: BusLocation[];
  googleMapsApiKey: string;
  onCenterOnRoute: () => void;
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

const StaticMapPreview = ({ route, apiKey, onCenterOnRoute }: { route: RouteOption, apiKey: string, onCenterOnRoute: () => void }) => {
    const routeData = route.gmapsRoute.routes[route.routeIndex];
    if (!routeData || !routeData.legs[0]) return null;

    const leg = routeData.legs[0];
    const origin = leg.start_location.toUrlValue();
    const destination = leg.end_location.toUrlValue();
    const busPath = routeData.overview_path.map(p => p.toUrlValue()).join('|');

    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x200&scale=2&maptype=roadmap&language=es&region=UY&markers=color:blue|label:A|${origin}&markers=color:red|label:B|${destination}&path=color:0xA40034|weight:4|${busPath}&key=${apiKey}`;

    return (
        <div className="relative mb-4 overflow-hidden rounded-lg aspect-[16/7] w-full bg-muted group">
             <Image 
                src={mapUrl}
                alt="Mapa de la ruta" 
                fill
                className="object-cover"
                unoptimized
             />
             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="secondary" onClick={onCenterOnRoute}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver en el mapa
                </Button>
             </div>
        </div>
    )
}


export default function RouteDetailsPanel({ 
  route, 
  busLocations = [],
  googleMapsApiKey,
  onCenterOnRoute
}: RouteDetailsPanelProps) {

  const duration = Math.round(route.duration / 60);
  const routeData = route.gmapsRoute.routes[route.routeIndex];
  const leg = routeData?.legs[0];
  
  if (!leg) return null;

  const isBusLive = busLocations.length > 0;
  const liveBusData = isBusLive ? busLocations[0] : null; 
  
  if (!route || !route.transitDetails) return null;

  const transitStep = leg.steps.find(s=>s.travel_mode === 'TRANSIT' && s.transit);

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
        
        <StaticMapPreview route={route} apiKey={googleMapsApiKey} onCenterOnRoute={onCenterOnRoute} />

        {isBusLive && (
            <div className="flex items-center gap-2 px-1 text-sm font-medium text-green-400">
                <Wifi className="h-4 w-4 animate-pulse-green" />
                <span>Bus en el mapa (tiempo real)</span>
            </div>
        )}

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-base font-mono py-1 px-3">{route.transitDetails.line.name}</Badge>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Duración total: ~{duration} min</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
                Hacia <span className="font-bold text-foreground">{route.transitDetails.headsign}</span>
            </div>
            {liveBusData && <BusFeatures bus={liveBusData} />}
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground px-1">Indicaciones del Viaje</h3>
          <div className="w-full space-y-1">
            {route.walkingSteps.length > 0 && (
                <Card>
                    <CardContent className="p-0">
                         <Accordion type="single" collapsible>
                            <AccordionItem value="item-1" className="border-b-0">
                                <AccordionTrigger className="flex items-center gap-3 p-3 text-sm hover:no-underline">
                                     <Footprints className="h-5 w-5 text-primary shrink-0" />
                                     <div className="flex-1 text-left">
                                         <p className="font-medium">Caminar a la parada {route.transitDetails.departureStop.name}</p>
                                         <p className="text-xs text-muted-foreground">{Math.round(route.walkingDuration / 60)} min a pie</p>
                                     </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-2">
                                    <div className="px-3 space-y-2 border-t pt-3">
                                        {route.walkingSteps.flatMap(ws => ws.steps || []).map((step, index) => (
                                            <div key={index} className="flex items-start gap-3 text-xs">
                                                <Footprints className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <p className="flex-1" dangerouslySetInnerHTML={{ __html: step.instructions }}></p>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            )}

            {transitStep && (
              <Card>
                   <CardContent className="flex items-center gap-3 p-3 text-sm">
                       <Bus className="h-5 w-5 text-primary shrink-0" />
                       <div className="flex-1 text-left">
                           <p className="font-medium">Tomar el bus <strong>{route.transitDetails.line.name}</strong></p>
                           <p className="text-xs text-muted-foreground">{route.transitDetails.numStops} paradas ({transitStep.duration?.text})</p>
                           <p className="text-xs text-muted-foreground pt-1">Bajar en: {route.transitDetails.arrivalStop.name}</p>
                       </div>
                   </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

    
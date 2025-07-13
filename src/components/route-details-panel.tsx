
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Footprints, Bus, Clock, Wifi, Accessibility, Snowflake } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import type { RouteOption } from '@/lib/types';
import { getFormattedAddress } from '@/lib/google-maps-api';
import { useEffect, useState } from 'react';

interface RouteDetailsPanelProps {
  route: RouteOption;
  busLocations?: BusLocation[];
  userLocation: google.maps.LatLngLiteral | null;
}

const StepIcon = ({ type }: { type: 'WALKING' | 'TRANSIT' }) => {
  if (type === 'WALKING') {
    return <Footprints className="h-5 w-5 text-primary" />;
  }
  return <Bus className="h-5 w-5 text-primary" />;
};

const AddressDisplay = ({ prefix, location, fallbackAddress }: { prefix: string; location: google.maps.LatLng | google.maps.LatLngLiteral | null; fallbackAddress: string }) => {
    const [address, setAddress] = useState<string | null>(null);

    useEffect(() => {
        const fetchAddress = async () => {
            if (location) {
                const lat = 'lat' in location ? location.lat : location.lat;
                const lng = 'lng' in location ? location.lng : location.lng;
                const formattedAddr = await getFormattedAddress(lat, lng);
                setAddress(formattedAddr);
            } else {
                setAddress(fallbackAddress.split(',')[0]);
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
  userLocation,
}: RouteDetailsPanelProps) {

  const duration = Math.round(route.duration / 60);
  const leg = route.gmapsRoute.legs[0];
  
  const isBusLive = busLocations.length > 0;
  const liveBusData = isBusLive ? busLocations[0] : null; 
  
  if (!route || !route.transitDetails) return null;

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500">
        {isBusLive && (
            <div className="flex items-center gap-2 px-4 text-sm font-medium text-green-400">
                <Wifi className="h-4 w-4" />
                <span>Bus en el mapa</span>
            </div>
        )}

      <div className="p-4 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                 <Badge variant="outline" className="text-sm font-mono">{route.transitDetails.line.name}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm font-normal">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>~{duration} min</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
             <AddressDisplay prefix="Desde" location={userLocation} fallbackAddress={"Tu ubicación"} />
             <AddressDisplay prefix="Hasta" location={leg.end_location.toJSON()} fallbackAddress={leg.end_address} />
            {liveBusData && <BusFeatures bus={liveBusData} />}
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground px-1">Indicaciones</h3>
          <div className="w-full space-y-1">
            {leg.steps.map((step, index) => (
               <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                   <div className="mt-0.5"><StepIcon type={step.travel_mode as 'WALKING' | 'TRANSIT'} /></div>
                   <div className="flex-1 space-y-0.5">
                        {step.travel_mode === 'TRANSIT' && step.transit ? (
                            <>
                                <p className="font-medium text-xs leading-tight">Toma el bus línea <strong>{step.transit.line.short_name}</strong> hacia <strong>{step.transit.headsign}</strong></p>
                                <p className="text-xs text-muted-foreground">Viaje de {step.transit.num_stops} paradas ({step.duration?.text})</p>
                                <p className="text-xs text-muted-foreground pt-1">Baja en la parada {step.transit.arrival_stop.name}</p>
                            </>
                        ) : (
                             <p className="font-medium text-xs leading-tight" dangerouslySetInnerHTML={{ __html: step.instructions }}></p>
                        )}
                        <p className="text-xs text-muted-foreground">{step.duration?.text}</p>
                   </div>
                   {step.travel_mode === 'TRANSIT' && step.transit && (
                     <Badge variant="default" className="font-mono text-xs">{step.transit.line.short_name}</Badge>
                   )}
               </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

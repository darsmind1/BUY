
"use client";

import React, { useEffect, useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Bus, Wifi, Loader2 } from 'lucide-react';
import { getUpcomingBuses, findClosestStmStop, BusLocation } from '@/lib/stm-api';
import type { UpcomingBus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsResult[];
  onRouteSelect: (route: google.maps.DirectionsResult) => void;
  isApiConnected: boolean;
  busLocations: BusLocation[]; // We might not need this here if getUpcomingBuses is reliable
}


const RouteOptionCard = memo(({ route, onRouteSelect, isApiConnected, index }: { route: google.maps.DirectionsResult, onRouteSelect: (route: google.maps.DirectionsResult) => void, isApiConnected: boolean, index: number }) => {
    const leg = route.routes[0].legs[0];
    const firstBusStep = leg.steps.find(step => step.travel_mode === 'TRANSIT');
    const [arrival, setArrival] = useState<UpcomingBus | null | 'loading'>('loading');

    useEffect(() => {
        let isMounted = true;
        
        const fetchArrival = async () => {
            if (!isApiConnected || !firstBusStep || !firstBusStep.transit) {
                setArrival(null);
                return;
            }
            
            setArrival('loading');

            try {
                const departureStopCoords = firstBusStep.transit.departure_stop.location.toJSON();
                const line = firstBusStep.transit.line.short_name;
                
                // 1. Find the closest STM stop ID
                const stmStop = await findClosestStmStop(departureStopCoords.lat, departureStopCoords.lng);
                
                if (stmStop && line) {
                    // 2. Get upcoming buses for that stop and line
                    const arrivals = await getUpcomingBuses(stmStop.busstopId, [line]);
                    if (isMounted) {
                        setArrival(arrivals.length > 0 ? arrivals[0] : null);
                    }
                } else {
                    if (isMounted) setArrival(null);
                }

            } catch (error) {
                console.error(`Failed to fetch arrivals for route ${index}`, error);
                if (isMounted) {
                    setArrival(null);
                }
            }
        };

        fetchArrival();

        // Refresh arrivals every 30 seconds
        const intervalId = setInterval(fetchArrival, 30000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [firstBusStep, isApiConnected, index]);

    const getArrivalColorClass = (eta: number) => {
        if (eta <= 5) return 'text-green-400';
        if (eta <= 10) return 'text-yellow-400';
        return 'text-red-500';
    };

    return (
        <Card className="hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => onRouteSelect(route)}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            {leg.steps.map((step, i) => (
                                <React.Fragment key={i}>
                                    <div className="flex items-center gap-1.5">
                                        {step.travel_mode === 'WALKING' ? <User className="h-4 w-4 text-muted-foreground" /> : <Bus className="h-4 w-4 text-muted-foreground" />}
                                        <span className="text-sm">{step.duration?.text}</span>
                                    </div>
                                    {i < leg.steps.length - 1 && <span className="text-muted-foreground text-xs">&gt;</span>}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{leg.duration?.text}</span>
                            <span className="text-sm text-muted-foreground">({leg.distance?.text})</span>
                        </div>
                    </div>
                    <div className="text-right">
                        {arrival === 'loading' && isApiConnected && (
                             <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Buscando...</span>
                            </div>
                        )}
                        {arrival && arrival !== 'loading' && (
                             <div className={cn("flex items-center gap-1.5 text-xs font-bold", getArrivalColorClass(arrival.arrival.minutes))}>
                                <Wifi className="h-3.5 w-3.5" />
                                <span>
                                    {arrival.arrival.minutes <= 0 ? "Llegando" : `${arrival.arrival.minutes} min`}
                                </span>
                             </div>
                        )}
                         {arrival === null && isApiConnected && (
                             <p className="text-xs text-muted-foreground italic">Sin arribos</p>
                         )}
                         {!isApiConnected && firstBusStep?.transit?.departure_time && (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Sale {firstBusStep.transit.departure_time.text}</span>
                            </div>
                         )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
RouteOptionCard.displayName = 'RouteOptionCard';


export default function RouteOptionsList({ routes, onRouteSelect, isApiConnected, busLocations }: RouteOptionsListProps) {
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
      <ScrollArea className="h-[calc(100dvh-150px)] md:h-auto">
        <div className="p-4 space-y-3">
          {routes.map((route, index) => (
            <RouteOptionCard 
                key={index} 
                route={route} 
                onRouteSelect={onRouteSelect} 
                isApiConnected={isApiConnected}
                index={index}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

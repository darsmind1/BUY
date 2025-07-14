
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Wifi, MapPin, Loader2 } from 'lucide-react';
import type { StmLineRoute, UpcomingBus, StmLineRouteStop } from '@/lib/types';
import { getUpcomingBuses } from '@/lib/stm-api';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RouteStopsListProps {
  lineRoute: StmLineRoute;
  isApiConnected: boolean;
}

const StopItem = ({ stop, line, isApiConnected }: { stop: StmLineRouteStop, line: string, isApiConnected: boolean }) => {
    const [arrival, setArrival] = useState<UpcomingBus | null | 'loading'>('loading');

    useEffect(() => {
        let isMounted = true;
        
        const fetchArrival = async () => {
            if (!isApiConnected) {
                setArrival(null);
                return;
            }
            try {
                const arrivals = await getUpcomingBuses(stop.stopId, [line]);
                if (isMounted) {
                    setArrival(arrivals.length > 0 ? arrivals[0] : null);
                }
            } catch (error) {
                console.error(`Failed to fetch arrivals for stop ${stop.stopId}`, error);
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
    }, [stop.stopId, line, isApiConnected]);

    const getArrivalColorClass = (eta: number) => {
        if (eta <= 5) return 'text-green-400';
        if (eta <= 10) return 'text-yellow-400';
        return 'text-red-500';
    };

    return (
        <div className="flex items-center gap-4 py-3 border-b">
            <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
                <p className="text-sm font-medium leading-tight">{stop.name}</p>
                <p className="text-xs text-muted-foreground">Parada: {stop.stopId}</p>
            </div>
            <div className="text-right">
                {arrival === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                 {!isApiConnected && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Ver horario</span>
                    </div>
                 )}
            </div>
        </div>
    );
};


export default function RouteStopsList({ lineRoute, isApiConnected }: RouteStopsListProps) {
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
      <div className="p-4 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-start justify-between text-base">
                Destino: {lineRoute.description}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <ScrollArea className="h-[calc(100dvh-200px)] md:h-auto">
                <div className="px-6">
                    {lineRoute.route.map((stop) => (
                        <StopItem 
                            key={stop.stopId} 
                            stop={stop} 
                            line={lineRoute.line} 
                            isApiConnected={isApiConnected}
                        />
                    ))}
                </div>
             </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

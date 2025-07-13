
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, Wifi, Info } from 'lucide-react';
import { getArrivalsForStop, BusArrival } from '@/lib/stm-api';
import type { RouteOption } from '@/lib/types';

interface RouteOptionsListProps {
  routes: RouteOption[];
  onSelectRoute: (route: RouteOption) => void;
  isApiConnected: boolean;
}

interface BusArrivalsState {
    [routeId: string]: {
      arrival: BusArrival | null;
      isLoading: boolean;
    };
}

const ArrivalInfoLegend = () => {
  return (
      <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground space-y-2">
         <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4" />
              <span>Leyenda de Arribos</span>
         </div>
        <div className="flex items-center gap-2">
           <Wifi className="h-3.5 w-3.5 text-green-400 animate-pulse-green" />
           <span>En tiempo real (bus con GPS activo)</span>
        </div>
         <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Horario programado (bus sin GPS)</span>
         </div>
      </div>
    
  )
}

const RouteOptionItem = ({ 
  route, 
  index, 
  onSelectRoute,
  arrivalData,
}: { 
  route: RouteOption, 
  index: number, 
  onSelectRoute: (route: RouteOption) => void,
  arrivalData?: { arrival: BusArrival | null, isLoading: boolean },
}) => {
  
  const getArrivalText = () => {
    if (!arrivalData || !arrivalData.arrival) return "Horario programado";
    const { arrival, isLoading } = arrivalData;

    if (isLoading) return "Buscando arribo...";

    const arrivalMinutes = Math.round(arrival.eta / 60);

    if (arrival.eta === -1) {
       return "Horario programado";
    }
    if (arrivalMinutes < 1) {
      return `Llegando`;
    }
    return `Llega en ${arrivalMinutes} min`;
  };

  const isRealTime = arrivalData?.arrival?.eta ?? -1 > -1;
  const arrivalText = getArrivalText();
  const walkingDuration = Math.round(route.walkingDuration / 60);
  const totalDuration = Math.round(route.duration / 60);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300 animate-in fade-in-0"
      onClick={() => onSelectRoute(route)}
      style={{ animationDelay: `${index * 100}ms`}}
    >
      <CardContent className="p-4 flex items-center">
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between">
             <div className="flex flex-col gap-1.5">
                <Badge variant="secondary" className="font-mono text-lg">{route.transitDetails.line.name}</Badge>
                <span className="text-sm text-muted-foreground">hacia {route.transitDetails.headsign}</span>
             </div>
             <div className="text-right">
                <p className="font-bold text-lg">~{totalDuration} min</p>
                <p className="text-xs text-muted-foreground">Total</p>
             </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3 mt-1">
              { isRealTime ? (
                 <div className="flex items-center gap-2 font-medium text-green-400">
                    <Wifi className="h-4 w-4 animate-pulse-green" />
                    <span>{arrivalText}</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{arrivalText}</span>
                 </div>
               )
            }
            <div className="flex items-center gap-2">
              <Footprints className="h-4 w-4" />
              <span>{walkingDuration > 0 ? `${walkingDuration} min a pie` : 'Menos de 1 min a pie'}</span>
            </div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground ml-4" />
      </CardContent>
    </Card>
  )
}

export default function RouteOptionsList({ routes, onSelectRoute, isApiConnected }: RouteOptionsListProps) {
  const [busArrivals, setBusArrivals] = useState<BusArrivalsState>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isApiConnected || routes.length === 0) {
        return;
    }

    const fetchAllArrivals = async () => {
        const arrivalPromises = routes.map(async (route) => {
            setBusArrivals(prev => ({ ...prev, [route.id]: { arrival: null, isLoading: true } }));

            const stopId = route.transitDetails.departureStop.stopId;
            if (!stopId) {
                console.warn(`No Stop ID for stop name: "${route.transitDetails.departureStop.name}"`);
                return { routeId: route.id, arrival: null };
            }

            const lineName = route.transitDetails.line.name;
            
            try {
                const arrivals = await getArrivalsForStop(stopId);
                if (!arrivals) return { routeId: route.id, arrival: null };

                const nextRealtimeArrival = arrivals.find(a => 
                    a.bus && 
                    a.eta > 0 &&
                    a.bus.line === lineName &&
                    a.bus.destination?.toUpperCase().includes(route.transitDetails.headsign.toUpperCase())
                );
                
                if (nextRealtimeArrival) {
                    return { routeId: route.id, arrival: nextRealtimeArrival };
                }
                
                const nextScheduledArrival = arrivals.find(a => a.eta === -1 && a.bus?.line === lineName);
                return { routeId: route.id, arrival: nextScheduledArrival || null };

            } catch (error) {
                console.error(`Error fetching bus arrivals for route ${route.id}:`, error);
                return { routeId: route.id, arrival: null };
            }
        });

        const results = await Promise.all(arrivalPromises);
        const newArrivals: BusArrivalsState = {};
        
        results.forEach(result => {
            if (result) {
                newArrivals[result.routeId] = { arrival: result.arrival, isLoading: false };
            }
        });
        
        setBusArrivals(prev => ({ ...prev, ...newArrivals }));
    };

    fetchAllArrivals();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchAllArrivals, 30000);

    return () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };

  }, [routes, isApiConnected]);


  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {isApiConnected && routes.length > 0 && (
        <ArrivalInfoLegend />
      )}
      {routes.map((route, index) => (
        <RouteOptionItem 
            key={route.id}
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            arrivalData={busArrivals[route.id]}
        />
      ))}
    </div>
  );
}

    
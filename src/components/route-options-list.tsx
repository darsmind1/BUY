
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, Wifi, Loader2, Info, Bus } from 'lucide-react';
import { getArrivalsForStop, BusArrival, StmRouteOption } from '@/lib/stm-api';
import { haversineDistance } from '@/lib/utils';

interface RouteOptionsListProps {
  routes: StmRouteOption[];
  onSelectRoute: (route: StmRouteOption) => void;
  isApiConnected: boolean;
}

interface BusArrivalsState {
    [routeLineAndStop: string]: BusArrival | null;
}

const ArrivalInfoLegend = () => {
  return (
      <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground space-y-2">
         <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4" />
              <span>Leyenda de arribos</span>
         </div>
        <div className="flex items-center gap-2">
           <Wifi className="h-3.5 w-3.5 text-green-400 animate-pulse-green" />
           <span>En tiempo real (bus con GPS)</span>
        </div>
         <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Horario programado para la línea</span>
         </div>
      </div>
    
  )
}

const RouteOptionItem = ({ 
  route, 
  index, 
  onSelectRoute,
  arrivalInfo,
}: { 
  route: StmRouteOption, 
  index: number, 
  onSelectRoute: (route: StmRouteOption) => void,
  arrivalInfo: BusArrival | null,
}) => {
  
  const getArrivalText = () => {
    if (!arrivalInfo) return null;
    if (arrivalInfo.eta === -1) return "Horario programado"; // Scheduled
    const arrivalMinutes = Math.round(arrivalInfo.eta / 60);
    if (arrivalMinutes <= 1) {
      return `Llegando`;
    }
    return `Llega en ${arrivalMinutes} min`;
  };

  const arrivalText = getArrivalText();
    
  const walkingDistance = Math.round(haversineDistance(route.userLocation, {lat: route.departureStop.location.coordinates[1], lng: route.departureStop.location.coordinates[0]}));

  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300 animate-in fade-in-0"
      onClick={() => onSelectRoute(route)}
      style={{ animationDelay: `${index * 100}ms`}}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2">
             <Badge variant="secondary" className="font-mono">{route.line}</Badge>
             <span className="text-sm text-muted-foreground truncate">hacia {route.destination}</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4" />
                <span>{walkingDistance} m a parada {route.departureStop.busstopId}</span>
              </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {arrivalInfo ? (
              arrivalInfo.eta > -1 ? (
                <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                    <Wifi className="h-3.5 w-3.5 animate-pulse-green" />
                    <span>{arrivalText}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{arrivalText}</span>
                </div>
              )
            ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bus className="h-3.5 w-3.5" />
                    <span>~{route.duration} min de viaje</span>
                </div>
            )}

          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
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
            const key = `${route.line}-${route.departureStop.busstopId}`;
            try {
                const arrivals = await getArrivalsForStop(route.departureStop.busstopId, route.line);
                if (!arrivals) return { key, arrival: null };

                const nextArrival = arrivals.find(a => 
                    a.bus && 
                    a.bus.destination && 
                    a.bus.destination.toUpperCase().includes(route.destination.toUpperCase()) &&
                    a.eta > 0
                );
                
                // If no real-time arrival, check for a scheduled one as fallback
                if (!nextArrival) {
                    const scheduled = arrivals.find(a => a.eta === -1);
                     return { key, arrival: scheduled || null };
                }

                return { key, arrival: nextArrival || null };
            } catch (error) {
                console.error(`Error fetching bus arrivals for route ${key}:`, error);
                return { key, arrival: null };
            }
        });

        const results = await Promise.all(arrivalPromises);
        const newArrivals: BusArrivalsState = {};
        
        results.forEach(result => {
            if (result) {
                newArrivals[result.key] = result.arrival;
            }
        });
        
        setBusArrivals(newArrivals);
    };

    fetchAllArrivals(); // Initial fetch
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchAllArrivals, 30000); // Poll every 30 seconds

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
            key={`${route.line}-${route.departureStop.busstopId}`}
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            arrivalInfo={busArrivals[`${route.line}-${route.departureStop.busstopId}`] ?? null}
        />
      ))}
    </div>
  );
}


    
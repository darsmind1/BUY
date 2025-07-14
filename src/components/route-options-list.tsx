
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Footprints, ChevronsRight, Wifi, Info, AlertTriangle } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import type { ArrivalInfo, StmInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { haversineDistance } from '@/lib/utils';

const ArrivalInfoLegend = () => {
  return (
      <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground space-y-2">
         <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4" />
              <span>Leyenda de Arribos</span>
         </div>
        <div className="flex items-center gap-2">
           <Wifi className="h-3.5 w-3.5 text-primary" />
           <span>Tiempo real:</span>
           <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-foreground">Próximo</span>
           </div>
          <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-foreground">En minutos</span>
           </div>
          <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-foreground">Demorado</span>
           </div>
        </div>
         <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Horario programado (sin datos en tiempo real)</span>
         </div>
      </div>
    
  )
}

const getArrivalText = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return null;
    const arrivalMinutes = Math.round(arrivalInfo.eta);
    if (arrivalMinutes <= 0) return "Llegando";
    return `Llega en ${arrivalMinutes} min`;
};
  
const getArrivalColorClass = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return 'text-primary';
    const arrivalMinutes = arrivalInfo.eta;
    if (arrivalMinutes <= 5) return 'text-green-400';
    if (arrivalMinutes <= 10) return 'text-yellow-400';
    return 'text-red-500';
};


const RouteOptionItem = ({ 
  route, 
  index, 
  onSelectRoute,
  arrivalInfo,
  stmInfo
}: { 
  route: google.maps.DirectionsRoute, 
  index: number, 
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => void,
  arrivalInfo: ArrivalInfo | null,
  stmInfo: StmInfo[]
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const leg = route.legs[0];
  
  const firstTransitStep = leg.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
  const scheduledDepartureTimeValue = firstTransitStep?.transit?.departure_time?.value;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update time every minute
    return () => clearInterval(timer);
  }, []);

  const getScheduledArrivalInMinutes = () => {
      if (!scheduledDepartureTimeValue) return null;
      const departureTime = new Date(scheduledDepartureTimeValue);
      const diffMs = departureTime.getTime() - currentTime.getTime();
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins <= 0) {
          return "Saliendo ahora";
      }
      return `Sale en ${diffMins} min`;
  };

  const arrivalText = getArrivalText(arrivalInfo);
  const scheduledText = getScheduledArrivalInMinutes();
    
  const renderableSteps = leg.steps.filter(step => step.travel_mode === 'TRANSIT' || (step.distance && step.distance.value > 0));
  const totalDuration = getTotalDuration(route.legs);
  
  return (
    <Card 
      className="hover:shadow-md hover:border-primary/50 transition-all duration-300 animate-in fade-in-0"
      style={{ animationDelay: `${index * 100}ms`}}
    >
      <CardContent 
        className="p-4 space-y-3 cursor-pointer"
        onClick={() => onSelectRoute(route, index, stmInfo)}
      >
        <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {renderableSteps.map((step, stepIndex) => {
                  const isLastStep = stepIndex === renderableSteps.length - 1;
                  if (step.travel_mode === 'TRANSIT') {
                    const lineToShow = step.transit?.line.short_name;
                    return (
                      <React.Fragment key={stepIndex}>
                        <Badge variant="secondary" className="font-mono">{lineToShow}</Badge>
                         {!isLastStep && <ChevronsRight className="h-4 w-4 text-muted-foreground" />}
                      </React.Fragment>
                    );
                  }
                  if (step.travel_mode === 'WALKING') {
                     return (
                      <React.Fragment key={stepIndex}>
                        <Footprints className="h-4 w-4 text-muted-foreground" />
                         {!isLastStep && <ChevronsRight className="h-4 w-4 text-muted-foreground" />}
                      </React.Fragment>
                     )
                  }
                  return null;
                })}
               {leg.steps.every(s => s.travel_mode === 'WALKING') && (
                <div className="flex items-center gap-2">
                  <Footprints className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Solo a pie</span>
                </div>
              )}
            </div>
             <div className="flex items-center gap-1 whitespace-nowrap text-muted-foreground pl-2" style={{ fontSize: '11px' }}>
                <Clock className="h-3.5 w-3.5" />
                <span>{totalDuration} min</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {arrivalInfo && arrivalText ? (
              <div className={cn("flex items-center gap-2 text-xs font-medium", getArrivalColorClass(arrivalInfo))}>
                  <Wifi className="h-3 w-3" />
                  <span>{arrivalText}</span>
              </div>
            ) : scheduledText ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{scheduledText}</span>
              </div>
            ) : firstTransitStep ? (
              <Badge variant="outline-secondary" className="text-xs">Sin arribos</Badge>
            ) : null}
          </div>
      </CardContent>
    </Card>
  )
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

export default function RouteOptionsList({ 
  routes, 
  onSelectRoute, 
  isApiConnected,
  busLocations
}: {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => void;
  isApiConnected: boolean;
  busLocations: BusLocation[];
}) {
  const [stmInfoByRoute, setStmInfoByRoute] = useState<Record<number, StmInfo[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Initialize stmInfo when routes first load to have a baseline
  useEffect(() => {
    const initialStmInfo: Record<number, StmInfo[]> = {};
    routes.forEach((route, index) => {
        initialStmInfo[index] = (route.legs[0]?.steps || [])
            .filter(step => step.travel_mode === 'TRANSIT' && step.transit)
            .map(step => ({
                stopId: null,
                line: step.transit!.line.short_name!,
                lineVariantId: null,
                lineDestination: step.transit!.headsign || null,
                departureStopLocation: {
                    lat: step.transit!.departure_stop.location!.lat(),
                    lng: step.transit!.departure_stop.location!.lng()
                },
                arrival: null,
            }));
    });
    setStmInfoByRoute(initialStmInfo);
    setIsLoading(false);
  }, [routes]);


  // Effect to calculate ETA based on live bus locations
  useEffect(() => {
    let isMounted = true;
    if (routes.length === 0 || !isApiConnected || busLocations.length === 0) {
      return;
    }

    const fetchAllEtas = async () => {
        const etaPromises = routes.map(async (route, index) => {
            const firstTransitStep = route.legs[0]?.steps.find(
                (step) => step.travel_mode === 'TRANSIT' && step.transit
            );

            if (!firstTransitStep) {
                return { index, arrival: null };
            }

            const line = firstTransitStep.transit!.line.short_name!;
            const destination = firstTransitStep.transit!.headsign;
            const stopLocation = {
                lat: firstTransitStep.transit!.departure_stop.location!.lat(),
                lng: firstTransitStep.transit!.departure_stop.location!.lng(),
            };

            const relevantBuses = busLocations.filter(b => 
                b.line === line &&
                (!destination || b.destination?.toLowerCase().includes(destination.toLowerCase()))
            );

            if (relevantBuses.length === 0) {
                return { index, arrival: null };
            }
            
            // Find the closest bus to the stop from the relevant buses
            let closestBus: BusLocation | null = null;
            let minDistance = Infinity;

            relevantBuses.forEach(bus => {
                const busCoords = { lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] };
                const distance = haversineDistance(busCoords, stopLocation);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestBus = bus;
                }
            });


            if (closestBus) {
                try {
                    const res = await fetch('/api/eta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            busLocation: { lat: closestBus.location.coordinates[1], lng: closestBus.location.coordinates[0] },
                            stopLocation: stopLocation
                        })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        if (data.eta !== null) {
                            const etaMinutes = Math.round(data.eta / 60);
                            return { 
                                index,
                                arrival: {
                                    eta: etaMinutes,
                                    timestamp: new Date().toISOString()
                                }
                            };
                        }
                    }
                } catch (error) {
                    console.error("Error fetching ETA for line", line, error);
                }
            }

            return { index, arrival: null };
        });

        const allEtaResults = await Promise.all(etaPromises);
        
        if (isMounted) {
            setStmInfoByRoute(prevStmInfo => {
                const newStmInfo = { ...prevStmInfo };
                allEtaResults.forEach(result => {
                    if (newStmInfo[result.index] && newStmInfo[result.index][0]) {
                        newStmInfo[result.index][0].arrival = result.arrival;
                    }
                });
                return newStmInfo;
            });
        }
    };
    
    fetchAllEtas();

    return () => { isMounted = false };
  }, [routes, isApiConnected, busLocations]);
  
  const hasTransitRoutes = routes.some(r => r.legs[0].steps.some(s => s.travel_mode === 'TRANSIT'));

  const getFirstArrival = (stmInfo: StmInfo[]): ArrivalInfo | null => {
      const firstStepInfo = stmInfo[0];
      return firstStepInfo?.arrival ?? null;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[108px] w-full rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {isApiConnected && hasTransitRoutes && (
        <ArrivalInfoLegend />
      )}
      {!isApiConnected && hasTransitRoutes && (
        <Alert variant="warning" className="text-xs">
           <AlertTriangle className="h-4 w-4" />
           <p>No se pudo conectar con el servicio de buses. Los horarios en tiempo real no están disponibles.</p>
        </Alert>
      )}
      {routes.map((route, index) => (
        <RouteOptionItem 
          key={index} 
          route={route} 
          index={index} 
          onSelectRoute={onSelectRoute}
          arrivalInfo={getFirstArrival(stmInfoByRoute[index] ?? [])}
          stmInfo={stmInfoByRoute[index] ?? []}
        />
      ))}
    </div>
  );
}

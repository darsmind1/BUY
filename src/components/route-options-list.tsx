
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info } from 'lucide-react';
import { getBusLocation, BusLocation, getAllBusStops, StmBusStop, getLinesForBusStop } from '@/lib/stm-api';
import { haversineDistance } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void;
  isApiConnected: boolean;
}

type Freshness = 'fresh' | 'stale' | 'old' | null;

interface BusArrivalInfo {
    eta: number; // in seconds
    distance: number; // in meters
}

interface StmStopMapping {
  [routeIndex: number]: number | null; // routeIndex -> stmBusStopId
}

const REALTIME_INFO_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

const ArrivalInfoLegend = () => {
  return (
      <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground space-y-2">
         <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4" />
              <span>Señales Recibidas</span>
         </div>
        <div className="flex items-center gap-2">
           <Wifi className="h-3.5 w-3.5 text-primary" />
 <span>Tiempo real:</span>
 <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-400" />
 <span className="text-foreground">Confiable</span>
 </div>
          <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
 <span className="text-foreground">Demora</span>
 </div>
          <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500" />
 <span className="text-foreground">Antigua</span>
 </div>
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
  stmStopId,
  isApiConnected
}: { 
  route: google.maps.DirectionsRoute, 
  index: number, 
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void,
  stmStopId: number | null,
  isApiConnected: boolean
}) => {
  const [arrivalInfo, setArrivalInfo] = useState<BusArrivalInfo | null>(null);
  const [isLoadingArrival, setIsLoadingArrival] = useState(true);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const leg = route.legs[0];
  
  const firstTransitStep = leg.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
  const googleTransitLine = firstTransitStep?.transit?.line.short_name;
  const scheduledDepartureTimeValue = firstTransitStep?.transit?.departure_time?.value;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update time every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const fetchArrival = async (isInitialFetch = false) => {
        if (!isMounted || !firstTransitStep || !googleTransitLine || stmStopId === null || !isApiConnected) {
            if(isInitialFetch) setIsLoadingArrival(false);
            return;
        }

        if(isInitialFetch) setIsLoadingArrival(true);

        try {
            const linesForStop = await getLinesForBusStop(stmStopId);
            const isLineValidForStop = linesForStop?.some(line => line.line.toString() === googleTransitLine);

            if (!isLineValidForStop) {
                if(isInitialFetch) setIsLoadingArrival(false);
                return;
            }
            
            const buses = await getBusLocation(googleTransitLine);
            if (!isMounted) return;

            if (buses && buses.length > 0) {
                let nearestBusDistance = Infinity;
                let nearestBus: BusLocation | null = null;
                
                const stmStopLocation = firstTransitStep.transit!.departure_stop.location;
                const stmStopCoords = { lat: stmStopLocation.lat(), lng: stmStopLocation.lng() };

                buses.forEach(bus => {
                    const busCoords = { lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] };
                    const distance = haversineDistance(stmStopCoords, busCoords);
                    if (distance < nearestBusDistance) {
                        nearestBusDistance = distance;
                        nearestBus = bus;
                    }
                });

                if (nearestBus) {
                    const averageSpeedMetersPerSecond = 4.5; // ~16 km/h
                    const etaSeconds = nearestBusDistance / averageSpeedMetersPerSecond;
                    
                    setArrivalInfo({
                        distance: nearestBusDistance,
                        eta: etaSeconds,
                    });
                    setLastRealtimeUpdate(Date.now());
                }
            } 
        } catch (error) {
            console.error("Error fetching bus arrival info:", error);
        } finally {
            if(isMounted && isInitialFetch) setIsLoadingArrival(false);
        }
    };
    
    if (stmStopId !== null && isApiConnected) {
      const initialFetchTimeoutId = setTimeout(() => {
        if(isMounted) {
            fetchArrival(true);
            intervalId = setInterval(() => fetchArrival(false), 20000); 
        }
      }, index * 300); 

      return () => {
        isMounted = false;
        clearTimeout(initialFetchTimeoutId);
        if (intervalId) clearInterval(intervalId);
      };

    } else {
        setIsLoadingArrival(false);
    }

  }, [firstTransitStep, googleTransitLine, stmStopId, index, isApiConnected]);

  const getArrivalText = () => {
    if (!arrivalInfo) return null;

    const arrivalSeconds = arrivalInfo.eta;
    if (arrivalSeconds < 60) {
      return `Llegando`;
    }
    const arrivalMinutes = Math.round(arrivalSeconds / 60);
    return `A ${arrivalMinutes} min`;
  };

  const getArrivalColorClass = () => {
    if (!arrivalInfo) return 'text-primary';
    
    const etaSeconds = arrivalInfo.eta;

    if (etaSeconds <= 180) { // 3 minutes or less
        return 'text-green-500';
    } else if (etaSeconds > 180 && etaSeconds < 600) { // More than 3 mins, up to 10 mins
        return 'text-yellow-500';
    } else { // 10 minutes or more
        return 'text-red-500';
    }
  };

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


  const arrivalText = getArrivalText();
  const scheduledText = getScheduledArrivalInMinutes();
  
  const isRealtimeStale = lastRealtimeUpdate === null || (Date.now() - lastRealtimeUpdate > REALTIME_INFO_TIMEOUT_MS);
  const showRealtime = arrivalInfo !== null && !isRealtimeStale;

  const renderableSteps = leg.steps.filter(step => step.travel_mode === 'TRANSIT' || (step.travel_mode === 'WALKING' && step.distance && step.distance.value > 0));

  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300"
      onClick={() => onSelectRoute(route, index)}
      style={{ animationDelay: `${index * 100}ms`}}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
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
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{getTotalDuration(route.legs)} min</span>
            </div>
            {isApiConnected && isLoadingArrival && firstTransitStep && (
                 <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                    <Wifi className="h-3 w-3" />
                    <span>Buscando...</span>
                </div>
            )}
             {!isLoadingArrival && showRealtime && arrivalText && (
              <div className={cn("flex items-center gap-2 text-xs font-medium", getArrivalColorClass())}>
                  <Wifi className="h-3 w-3" />
                  <span>{arrivalText}</span>
              </div>
            )}
            {!isLoadingArrival && !showRealtime && scheduledText && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{scheduledText}</span>
                </div>
            )}
            {!isLoadingArrival && !showRealtime && !scheduledText && firstTransitStep && isApiConnected && (
                <Badge variant="outline-secondary" className="text-xs">Sin arribos</Badge>
            )}
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
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

export default function RouteOptionsList({ routes, onSelectRoute, isApiConnected }: RouteOptionsListProps) {
  const [stmStopMappings, setStmStopMappings] = useState<StmStopMapping | null>(null);
  const [isMappingStops, setIsMappingStops] = useState(true);

  useEffect(() => {
    const mapStops = async () => {
        if (!isApiConnected) {
            setIsMappingStops(false);
            setStmStopMappings({});
            return;
        }

      setIsMappingStops(true);
      const allStops = await getAllBusStops();
      if (!allStops || allStops.length === 0) {
        console.error("Could not fetch STM bus stops for mapping.");
        setIsMappingStops(false);
        setStmStopMappings({}); // Set to empty object to allow rendering items
        return;
      }
      
      const newMappings: StmStopMapping = {};

      routes.forEach((route, index) => {
        const firstTransitStep = route.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
        if (firstTransitStep?.transit?.departure_stop?.location) {
          const departureStopGoogleLocation = {
            lat: firstTransitStep.transit.departure_stop.location.lat(),
            lng: firstTransitStep.transit.departure_stop.location.lng()
          };

          let closestStmStop: StmBusStop | null = null;
          let minDistance = Infinity;

          allStops.forEach(stop => {
              const stopCoords = { lat: stop.location.coordinates[1], lng: stop.location.coordinates[0] };
              const distance = haversineDistance(departureStopGoogleLocation, stopCoords);
              if (distance < minDistance) {
                  minDistance = distance;
                  closestStmStop = stop;
              }
          });

          // If closest stop is more than 200m away, it's likely not the same one.
          if (closestStmStop && minDistance <= 200) {
            newMappings[index] = closestStmStop.busstopId;
          } else {
            newMappings[index] = null;
          }
        } else {
          newMappings[index] = null; // No transit step for this route
        }
      });
      
      setStmStopMappings(newMappings);
      setIsMappingStops(false);
    };

    mapStops();
  }, [routes, isApiConnected]);


  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {isMappingStops && isApiConnected && (
         <div className="flex flex-col items-center justify-center space-y-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Verificando paradas...</p>
         </div>
      )}
      {!isMappingStops && isApiConnected && (
        <ArrivalInfoLegend />
      )}
      {!isMappingStops && stmStopMappings && routes.map((route, index) => (
        <RouteOptionItem 
            key={index} 
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            stmStopId={stmStopMappings?.[index] ?? null}
            isApiConnected={isApiConnected}
        />
      ))}
       {!isApiConnected && routes.map((route, index) => (
         <RouteOptionItem 
            key={index} 
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            stmStopId={null}
            isApiConnected={false}
        />
      ))}
    </div>
  );
}

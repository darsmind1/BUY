"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info, AlertTriangle } from 'lucide-react';
import { getBusLocation } from '@/lib/stm-api';
import type { ArrivalInfo, StmInfo, BusLocation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';

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

const getArrivalText = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return null;
    if (arrivalInfo.eta < 60) return "Llegando";
    const arrivalMinutes = Math.round(arrivalInfo.eta / 60);
    return `Llega en ${arrivalMinutes} min`;
};
  
const getSignalAge = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return null;
    const now = new Date().getTime();
    const signalTimestamp = new Date(arrivalInfo.timestamp).getTime();
    return (now - signalTimestamp) / 1000; // age in seconds
};

const getArrivalColorClass = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return 'text-primary';
    
    const signalAge = getSignalAge(arrivalInfo);
    if (signalAge === null) return 'text-primary';

    if (signalAge <= 60) return 'text-green-400'; // Under 1 min old
    if (signalAge <= 120) return 'text-yellow-400'; // 1-2 mins old
    return 'text-red-500'; // Over 2 mins old
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
  isGoogleMapsLoaded,
}: {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => void;
  isApiConnected: boolean;
  isGoogleMapsLoaded: boolean;
}) {
  const [stmInfoByRoute, setStmInfoByRoute] = useState<Record<number, StmInfo[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const findArrivalForStop = useCallback(async (line: string, lineDestination: string, stopLocation: google.maps.LatLngLiteral, liveBuses: BusLocation[]): Promise<ArrivalInfo | null> => {
      const normalize = (str: string) => str.toUpperCase().replace(/\s/g, '');
      const normalizedDestination = normalize(lineDestination);

      const liveBus = liveBuses.find(l => {
        const busDestination = l.destination || '';
        return l.line === line && normalize(busDestination).includes(normalizedDestination);
      });

      if (liveBus) {
        try {
          const response = await fetch('/api/eta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              busLocation: { lat: liveBus.location.coordinates[1], lng: liveBus.location.coordinates[0] },
              stopLocation: stopLocation
            }),
          });
          if (!response.ok) return null;
          const data = await response.json();
          if (data.eta !== null) {
            return { eta: data.eta, timestamp: liveBus.timestamp };
          }
        } catch (error) {
          console.error("Error fetching ETA:", error);
          return null;
        }
      }
      return null;
  }, []);

  // Effect for initial data setup
  useEffect(() => {
    if (!isGoogleMapsLoaded || !isApiConnected) {
        setIsLoading(false);
        return;
    };

    const mapStopsAndLines = async () => {
      setIsLoading(true);

      const allRoutesStmInfoPromises = routes.map(async (route, index) => {
        const transitSteps = route.legs[0]?.steps.filter(step => step.travel_mode === 'TRANSIT' && step.transit);
        
        const stmInfoForRoutePromises = transitSteps.map(async (step) => {
           const googleTransitLine = step.transit?.line.short_name;
           const departureStopLocation = step.transit?.departure_stop?.location;
           const lineDestination = step.transit?.headsign || null;

           if (departureStopLocation && googleTransitLine) {
             const { lat, lng } = { lat: departureStopLocation.lat(), lng: departureStopLocation.lng() };
             return {
               line: googleTransitLine,
               lineDestination,
               departureStopLocation: { lat, lng },
               arrival: null,
             };
           }
           return null;
        });
        
        const stmInfoForRoute = (await Promise.all(stmInfoForRoutePromises)).filter(Boolean) as StmInfo[];
        return { index, stmInfo: stmInfoForRoute };
      });
      
      const stmInfoResults = await Promise.all(allRoutesStmInfoPromises);
      const newStmInfo: Record<number, StmInfo[]> = {};
      stmInfoResults.forEach(result => {
        newStmInfo[result.index] = result.stmInfo;
      });
      setStmInfoByRoute(newStmInfo);
      setIsLoading(false);
    };

    mapStopsAndLines();
  }, [routes, isApiConnected, isGoogleMapsLoaded]);


  // Effect for fetching and updating real-time data periodically
  useEffect(() => {
    if (isLoading || !isApiConnected || !isGoogleMapsLoaded || Object.keys(stmInfoByRoute).length === 0) {
      return;
    }

    const fetchAllArrivals = async () => {
      const linesToFetch = [...new Set(Object.values(stmInfoByRoute).flat().map(info => info.line))].filter(Boolean) as string[];
      if (linesToFetch.length === 0) return;

      try {
        const locations = await getBusLocation(linesToFetch);
        
        const newStmInfo: Record<number, StmInfo[]> = {};
        for (const routeIndexStr of Object.keys(stmInfoByRoute)) {
            const routeIndex = parseInt(routeIndexStr, 10);
            const infoList = stmInfoByRoute[routeIndex];
            const updatedInfoListPromises = infoList.map(async info => {
                const newInfo = { ...info };
                if (newInfo.departureStopLocation && newInfo.lineDestination) {
                    const newArrival = await findArrivalForStop(newInfo.line, newInfo.lineDestination, newInfo.departureStopLocation, locations);
                    const oldSignalAge = getSignalAge(newInfo.arrival);
                    if (newArrival) {
                        newInfo.arrival = newArrival;
                    } else if (oldSignalAge === null || oldSignalAge > 90) {
                        newInfo.arrival = null;
                    }
                }
                return newInfo;
            });
            newStmInfo[routeIndex] = await Promise.all(updatedInfoListPromises);
        }
        setStmInfoByRoute(newStmInfo);

      } catch (error) {
        console.error(`Error fetching bus locations:`, error);
      }
    };

    fetchAllArrivals(); // Initial fetch
    const intervalId = setInterval(fetchAllArrivals, 20000); // Update every 20 seconds

    return () => clearInterval(intervalId);
  }, [isLoading, stmInfoByRoute, isApiConnected, isGoogleMapsLoaded, findArrivalForStop]);
  

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Calculando mejores opciones...</p>
      </div>
    );
  }
  
  const hasTransitRoutes = routes.some(r => r.legs[0].steps.some(s => s.travel_mode === 'TRANSIT'));

  const getFirstArrival = (stmInfo: StmInfo[]): ArrivalInfo | null => {
      const firstStepInfo = stmInfo[0];
      return firstStepInfo?.arrival ?? null;
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

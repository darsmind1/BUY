
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info, Bus, MapPin, AlertTriangle } from 'lucide-react';
import { findClosestStmStop, getUpcomingBuses } from '@/lib/stm-api';
import type { ArrivalInfo, StmInfo, UpcomingBus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert } from '@/components/ui/alert';

interface AlternativeLineInfo {
    line: string;
    destination: string | null;
    arrival: ArrivalInfo | null;
}

interface TransferInfo {
    stopName: string;
    stopLocation: google.maps.LatLngLiteral;
    mainTransferLine: string | null;
    mainTransferLineDestination: string | null;
    alternativeLines: AlternativeLineInfo[];
}


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
    if (arrivalInfo.eta <= 0) return "Llegando";
    return `Llega en ${arrivalInfo.eta} min`;
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
  stmInfo,
}: { 
  route: google.maps.DirectionsRoute, 
  index: number, 
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => void,
  arrivalInfo: ArrivalInfo | null,
  stmInfo: StmInfo[],
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
      <CardContent className="p-4 space-y-3">
        <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => onSelectRoute(route, index, stmInfo)}
        >
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
          <div className="flex items-center gap-4 text-sm text-muted-foreground cursor-pointer" onClick={() => onSelectRoute(route, index, stmInfo)}>
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

  // Effect for initial data setup (stops, lines, etc.) and periodic updates
  useEffect(() => {
    if (!isGoogleMapsLoaded) {
        setIsLoading(false);
        return;
    }
    
    // 1. Initialize with basic structure from Google Directions
    const initialStmInfo: Record<number, StmInfo[]> = {};
    routes.forEach((route, index) => {
        const transitSteps = route.legs[0]?.steps.filter(step => step.travel_mode === 'TRANSIT' && step.transit);
        initialStmInfo[index] = transitSteps.map(step => ({
            stopId: null,
            line: step.transit!.line.short_name!,
            lineDestination: step.transit!.headsign || null,
            departureStopLocation: { lat: step.transit!.departure_stop.location!.lat(), lng: step.transit!.departure_stop.location!.lng() },
            arrival: null,
        }));
    });
    setStmInfoByRoute(initialStmInfo);
    setIsLoading(false);


    const fetchAllArrivals = async () => {
        if (!isApiConnected) return;

        // 2. Asynchronously enrich with real-time data
        routes.forEach(async (route, index) => {
            const transitSteps = route.legs[0]?.steps.filter(step => step.travel_mode === 'TRANSIT' && step.transit);
            if (!transitSteps || transitSteps.length === 0) return;

            const updatedStmInfoForRoute = await Promise.all(transitSteps.map(async (step) => {
                const googleTransitLine = step.transit!.line.short_name!;
                const departureStopLocation = step.transit!.departure_stop.location!;
                
                const { lat, lng } = { lat: departureStopLocation.lat(), lng: departureStopLocation.lng() };
                
                // Find the corresponding STM stop
                const closestStop = await findClosestStmStop(lat, lng);
                
                let arrival: ArrivalInfo | null = null;
                if (closestStop) {
                    // If stop is found, get the upcoming bus for the specific line
                    const upcomingBus = await getUpcomingBuses(closestStop.busstopId, googleTransitLine);
                    if (upcomingBus && upcomingBus.arrival) {
                        arrival = {
                            eta: upcomingBus.arrival.minutes,
                            timestamp: upcomingBus.arrival.lastUpdate,
                        };
                    }
                }

                // Return the enriched info for this step
                return {
                    stopId: closestStop?.busstopId ?? null,
                    line: googleTransitLine,
                    lineDestination: step.transit!.headsign || null,
                    departureStopLocation: { lat, lng },
                    arrival,
                };
            }));
            
            // Update the state for the specific route with the new info
            setStmInfoByRoute(prev => ({
              ...prev,
              [index]: updatedStmInfoForRoute
            }));
        });
    };

    fetchAllArrivals(); // Initial fetch
    const intervalId = setInterval(fetchAllArrivals, 30000); // Update every 30 seconds

    return () => clearInterval(intervalId);

  }, [routes, isApiConnected, isGoogleMapsLoaded]);

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
      if (!stmInfo || stmInfo.length === 0) return null;
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


"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info } from 'lucide-react';
import { getBusLocation, findClosestStmStop } from '@/lib/stm-api';
import type { ArrivalInfo, StmInfo, BusArrivalsState } from '@/lib/types';
import { cn } from '@/lib/utils';


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
  arrivalInfo,
  stmInfo
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

  const getArrivalText = () => {
    if (!arrivalInfo) return null;
    if (arrivalInfo.eta < 60) return "Llegando";
    const arrivalMinutes = Math.round(arrivalInfo.eta / 60);
    return `Llega en ${arrivalMinutes} min`;
  };
  
  const getSignalAge = () => {
    if (!arrivalInfo) return null;
    const now = new Date().getTime();
    const signalTimestamp = new Date(arrivalInfo.timestamp).getTime();
    return (now - signalTimestamp) / 1000; // age in seconds
  };
  
  const getArrivalColorClass = () => {
    const signalAge = getSignalAge();
    if (signalAge === null) return 'text-primary'; // Default color
  
    if (signalAge < 90) return 'text-green-400'; // Fresh signal
    if (signalAge < 180) return 'text-yellow-400'; // Slightly delayed signal
    return 'text-red-500'; // Old signal
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
    
  const renderableSteps = leg.steps.filter(step => step.travel_mode === 'TRANSIT' || (step.distance && step.distance.value > 0));
  const totalDuration = getTotalDuration(route.legs);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300 animate-in fade-in-0"
      onClick={() => onSelectRoute(route, index, stmInfo)}
      style={{ animationDelay: `${index * 100}ms`}}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between">
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
             <div className="flex items-center gap-1 whitespace-nowrap text-muted-foreground" style={{ fontSize: '11px' }}>
                <Clock className="h-3.5 w-3.5" />
                <span>{totalDuration} min</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {arrivalInfo && arrivalText ? (
              <div className={cn("flex items-center gap-2 text-xs font-medium", getArrivalColorClass())}>
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
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground ml-4" />
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
  const [busArrivals, setBusArrivals] = useState<BusArrivalsState>({});

  useEffect(() => {
    if (!isGoogleMapsLoaded) return;

    const mapStopsAndFetchArrivals = async () => {
      if (!isApiConnected) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const allRoutesStmInfoPromises = routes.map(async (route, index) => {
        const transitSteps = route.legs[0]?.steps.filter(step => step.travel_mode === 'TRANSIT' && step.transit);

        if (!transitSteps || transitSteps.length === 0) {
          return { index, stmInfo: [] };
        }
        
        const stmInfoForRoutePromises = transitSteps.map(async (step) => {
           const googleTransitLine = step.transit?.line.short_name;
           const departureStopLocation = step.transit?.departure_stop?.location;
           const lineDestination = step.transit?.headsign || step.transit?.line.name?.split(' - ')[1] || null;

           if (departureStopLocation && googleTransitLine) {
             const { lat, lng } = { lat: departureStopLocation.lat(), lng: departureStopLocation.lng() };
             const closestStop = await findClosestStmStop(lat, lng);
             return {
               stopId: closestStop?.busstopId ?? null,
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

    mapStopsAndFetchArrivals();
  }, [routes, isApiConnected, isGoogleMapsLoaded]);


  useEffect(() => {
    if (!isApiConnected || Object.keys(stmInfoByRoute).length === 0 || !isGoogleMapsLoaded) {
      return;
    }

    const fetchAllArrivals = async () => {
      const linesToFetch = Object.values(stmInfoByRoute).flat().map(info => ({
        line: info.line,
        destination: info.lineDestination,
      }));

      if (linesToFetch.length === 0) return;

      try {
        const locations = await getBusLocation(linesToFetch);
        const newArrivals: BusArrivalsState = {};
        const newStmInfoByRoute: Record<number, StmInfo[]> = { ...stmInfoByRoute };

        Object.entries(stmInfoByRoute).forEach(([routeIndexStr, infos]) => {
          const routeIndex = parseInt(routeIndexStr);
          let firstArrival: ArrivalInfo | null = null;

          const updatedInfos = infos.map(info => {
              const liveBus = locations.find(l => l.line === info.line && l.direction === (info.lineDestination?.includes('Entrante') ? 1 : 2));
              if (liveBus && info.departureStopLocation) {
                 const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                  new window.google.maps.LatLng(liveBus.location.coordinates[1], liveBus.location.coordinates[0]),
                  new window.google.maps.LatLng(info.departureStopLocation)
                );
                const eta = distance / 8.33; // ETA based on average speed (e.g., 30km/h = 8.33m/s)
                const arrivalData = { eta, timestamp: liveBus.timestamp };
                if (!firstArrival) {
                  firstArrival = arrivalData;
                }
                return { ...info, arrival: arrivalData };
              }
              return info;
          });
          
          newArrivals[routeIndex] = firstArrival;
          newStmInfoByRoute[routeIndex] = updatedInfos;
        });

        setBusArrivals(prev => ({ ...prev, ...newArrivals }));
        setStmInfoByRoute(newStmInfoByRoute);

      } catch (error) {
        console.error(`Error fetching bus locations:`, error);
      }
    };

    fetchAllArrivals();
    const intervalId = setInterval(fetchAllArrivals, 30000);

    return () => clearInterval(intervalId);
  }, [stmInfoByRoute, isApiConnected, isGoogleMapsLoaded]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Calculando mejores opciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {isApiConnected && routes.some(r => r.legs[0].steps.some(s => s.travel_mode === 'TRANSIT')) && (
        <ArrivalInfoLegend />
      )}
      {routes.map((route, index) => (
        <RouteOptionItem 
          key={index} 
          route={route} 
          index={index} 
          onSelectRoute={onSelectRoute}
          arrivalInfo={busArrivals[index] ?? null}
          stmInfo={stmInfoByRoute[index] ?? []}
        />
      ))}
    </div>
  );
}

    
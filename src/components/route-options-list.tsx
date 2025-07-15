"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info } from 'lucide-react';
import { StmBusStop, getAllBusStops, UpcomingBus, getUpcomingBuses } from '@/lib/stm-api';
import { haversineDistance, cn } from '@/lib/utils';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stopId: number | null, lineDestination: string | null) => void;
  isApiConnected: boolean;
}

interface StmInfo {
  stopId: number | null;
  line: string | undefined;
  lineDestination: string | null;
  departureStopLocation: google.maps.LatLng | null;
}

interface StmStopMapping {
  [routeIndex: number]: StmInfo;
}

interface ArrivalInfo {
  bus: UpcomingBus;
  // eta is now arrivalTime in minutes from the API
}

interface BusArrivalsState {
    [routeIndex: number]: ArrivalInfo | null;
}

const ArrivalInfoLegend = () => {
  return (
      <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground space-y-2">
         <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4" />
              <span>Leyenda de arribos</span>
         </div>
        <div className="flex items-center gap-2">
           <Wifi className="h-3.5 w-3.5 text-primary" />
           <span>Arribo en tiempo real.</span>
        </div>
         <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Horario programado de la línea.</span>
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
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stopId: number | null, lineDestination: string | null) => void,
  arrivalInfo: ArrivalInfo | null,
  stmInfo: StmInfo | null,
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
    if (!arrivalInfo?.bus.arrivalTime) return null;
    const arrivalMinutes = arrivalInfo.bus.arrivalTime;
    if (arrivalMinutes <= 1) {
      return `Llegando`;
    }
    return `Llega en ${arrivalMinutes} min`;
  };

  const getArrivalColorClass = () => {
    if (!arrivalInfo?.bus.arrivalTime) return 'text-primary';
    const arrivalMinutes = arrivalInfo.bus.arrivalTime;
    if (arrivalMinutes < 5) {
        return 'text-green-400';
    } else if (arrivalMinutes <= 10) {
        return 'text-yellow-400';
    } else {
        return 'text-red-500';
    }
  };

  const getScheduledArrival = () => {
      if (!scheduledDepartureTimeValue) return null;
      const departureTime = new Date(scheduledDepartureTimeValue);
      const diffMs = departureTime.getTime() - currentTime.getTime();
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins <= 0) {
          return { prefix: 'Saliendo', time: 'ahora' };
      }
      return { prefix: 'Sale en', time: `${diffMins} min` };
  };

  const arrivalText = getArrivalText();
  const scheduledArrival = getScheduledArrival();
    
  const renderableSteps = leg.steps.filter(step => step.travel_mode === 'TRANSIT' || (step.distance && step.distance.value > 0));

  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300 animate-in fade-in-0"
      onClick={() => onSelectRoute(route, index, stmInfo?.stopId ?? null, stmInfo?.lineDestination ?? null)}
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
            
            {arrivalText ? (
              <div className={cn("flex items-center gap-2 text-xs font-medium", getArrivalColorClass())}>
                  <Wifi className="h-3 w-3" />
                  <span>{arrivalText}</span>
              </div>
            ) : scheduledArrival ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {scheduledArrival.prefix}{' '}
                  <span className={cn(arrivalInfo ? "text-green-400 font-medium" : "")}>
                    {scheduledArrival.time}
                  </span>
                </span>
              </div>
            ) : firstTransitStep ? (
              <Badge variant="outline-secondary" className="text-xs">Sin arribos</Badge>
            ) : null}

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
  const [busArrivals, setBusArrivals] = useState<BusArrivalsState>({});

  const mapStops = useCallback(async (allStops: StmBusStop[]) => {
      const newMappings: StmStopMapping = {};

      for (const [index, route] of routes.entries()) {
        const firstTransitStep = route.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
        const googleTransitLine = firstTransitStep?.transit?.line.short_name;
        const departureStopLocation = firstTransitStep?.transit?.departure_stop?.location || null;
        const lineDestination = firstTransitStep?.transit?.line.name?.split(' - ')[1] || null;

        if (departureStopLocation && googleTransitLine) {
          const departureStopGoogleLocation = {
            lat: departureStopLocation.lat(),
            lng: departureStopLocation.lng()
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
          
          newMappings[index] = {
              stopId: (closestStmStop && minDistance <= 200) ? closestStmStop.busstopId : null,
              line: googleTransitLine,
              lineDestination: lineDestination,
              departureStopLocation: departureStopLocation
          };
        } else {
          newMappings[index] = { stopId: null, line: googleTransitLine, lineDestination: lineDestination, departureStopLocation: null };
        }
      }
      
      setStmStopMappings(newMappings);
      setIsMappingStops(false);
  }, [routes]);
  
  useEffect(() => {
    const processStops = async () => {
      if (!isApiConnected) {
          setIsMappingStops(false);
          setStmStopMappings({});
          return;
      }
      
      setIsMappingStops(true);
      const allStops = await getAllBusStops();

      if (!allStops || allStops.length === 0) {
        setIsMappingStops(false);
        setStmStopMappings({});
        return;
      }

      await mapStops(allStops);
    }

    processStops();
  }, [isApiConnected, routes, mapStops]);


  useEffect(() => {
    const fetchAllArrivals = async () => {
      if (!isApiConnected || !stmStopMappings) {
        return;
      }

      // Group routes by bus stop ID to make fewer API calls
      const stopsToQuery: { [stopId: number]: string[] } = {};
      const routeIndicesByStop: { [stopId: number]: number[] } = {};

      Object.entries(stmStopMappings).forEach(([routeIndex, info]) => {
          if (info.stopId && info.line) {
              if (!stopsToQuery[info.stopId]) {
                  stopsToQuery[info.stopId] = [];
                  routeIndicesByStop[info.stopId] = [];
              }
              if (!stopsToQuery[info.stopId].includes(info.line)) {
                  stopsToQuery[info.stopId].push(info.line);
              }
              routeIndicesByStop[info.stopId].push(parseInt(routeIndex));
          }
      });
      
      const newArrivals: BusArrivalsState = {};
      const arrivalPromises = Object.entries(stopsToQuery).map(async ([stopId, lines]) => {
          const stopIdNum = parseInt(stopId);
          try {
              const upcomingBuses = await getUpcomingBuses(stopIdNum, lines, 2);
              
              if (upcomingBuses && upcomingBuses.length > 0) {
                  routeIndicesByStop[stopIdNum].forEach(routeIndex => {
                      const routeLine = stmStopMappings[routeIndex]?.line;
                      const bestUpcomingBus = upcomingBuses.find(bus => bus.line === routeLine);
                      if (bestUpcomingBus) {
                          newArrivals[routeIndex] = { bus: bestUpcomingBus };
                      } else {
                           newArrivals[routeIndex] = null;
                      }
                  });
              }
          } catch (error) {
              console.error(`Error fetching upcoming buses for stop ${stopId}:`, error);
          }
      });

      await Promise.allSettled(arrivalPromises);
      setBusArrivals(prev => ({ ...prev, ...newArrivals }));
    };

    if (stmStopMappings) {
        const intervalId = setInterval(fetchAllArrivals, 30000); // Refresh every 30 seconds
        fetchAllArrivals(); // Initial fetch
        return () => clearInterval(intervalId); // Cleanup on unmount or when dependencies change
    }
  }, [stmStopMappings, isApiConnected]);


  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {isMappingStops && isApiConnected && (
         <div className="flex flex-col items-center justify-center space-y-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Verificando paradas y líneas...</p>
         </div>
      )}
      {!isMappingStops && isApiConnected && routes.some(r => r.legs[0].steps.some(s => s.travel_mode === 'TRANSIT')) && (
        <ArrivalInfoLegend />
      )}
      {!isMappingStops && routes.map((route, index) => (
        <RouteOptionItem 
            key={index} 
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            arrivalInfo={busArrivals[index] ?? null}
            stmInfo={stmStopMappings ? stmStopMappings[index] : null}
        />
      ))}
    </div>
  );
}

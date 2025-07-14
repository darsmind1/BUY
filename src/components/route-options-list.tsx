
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info } from 'lucide-react';
import { getBusLocation, StmBusStop, getAllBusStops, getLinesForBusStop, BusLocation } from '@/lib/stm-api';
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
    bus: BusLocation;
    eta: number; // calculated ETA in seconds
}

interface BusArrivalsState {
    [routeIndex: number]: ArrivalInfo | null;
}

const AVERAGE_BUS_SPEED_M_PER_S = 8.33; // Approx 30 km/h

const calculateEta = (busLocation: { lat: number, lng: number }, stopLocation: { lat: number, lng: number }): number => {
    const distance = haversineDistance(busLocation, stopLocation);
    // This is a simple linear distance ETA, not accounting for traffic or route, but it's a good proxy.
    return distance / AVERAGE_BUS_SPEED_M_PER_S;
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
  isApiConnected: boolean,
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
    if (!arrivalInfo) return null;
    const arrivalMinutes = Math.round(arrivalInfo.eta / 60);
    if (arrivalMinutes <= 1) {
      return `Llegando`;
    }
    return `Llega en ${arrivalMinutes} min`;
  };

  const getArrivalColorClass = () => {
    if (!arrivalInfo) return 'text-primary';
    const arrivalMinutes = Math.round(arrivalInfo.eta / 60);
    if (arrivalMinutes < 5) {
        return 'text-green-400';
    } else if (arrivalMinutes <= 10) {
        return 'text-yellow-400';
    } else {
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
        setStmStopMappings({});
        return;
      }
      
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
    };

    mapStops();
  }, [routes, isApiConnected]);


  useEffect(() => {
    if (!isApiConnected || !stmStopMappings) {
        return;
    }

    const fetchAllArrivals = async () => {
        const arrivalPromises = Object.entries(stmStopMappings).map(async ([routeIndex, info]) => {
            if (info.line && info.departureStopLocation) {
                try {
                    const busLocations = await getBusLocation(info.line, info.lineDestination ?? undefined);
                    if (busLocations && busLocations.length > 0) {
                        
                        const googleStopLocation = { lat: info.departureStopLocation.lat(), lng: info.departureStopLocation.lng() };
                        let closestBus: BusLocation | null = null;
                        let minDistance = Infinity;

                        busLocations.forEach(bus => {
                            const busCoords = { lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] };
                            const distance = haversineDistance(busCoords, googleStopLocation);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestBus = bus;
                            }
                        });

                        if (closestBus) {
                             const eta = calculateEta({ lat: closestBus.location.coordinates[1], lng: closestBus.location.coordinates[0] }, googleStopLocation);
                             return { routeIndex: parseInt(routeIndex), arrival: { bus: closestBus, eta } };
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching bus locations for route ${routeIndex}:`, error);
                }
            }
            return { routeIndex: parseInt(routeIndex), arrival: null };
        });

        const results = await Promise.allSettled(arrivalPromises);
        const newArrivals: BusArrivalsState = {};
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const { routeIndex, arrival } = result.value;
                newArrivals[routeIndex] = arrival;
            } else if (result.status === 'rejected') {
                console.error("A promise for fetching bus locations was rejected:", result.reason);
            }
        });
        
        setBusArrivals(prev => ({...prev, ...newArrivals}));
    };

    fetchAllArrivals();
    const intervalId = setInterval(fetchAllArrivals, 30000);

    return () => clearInterval(intervalId);

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
            isApiConnected={isApiConnected}
            arrivalInfo={busArrivals[index] ?? null}
            stmInfo={stmStopMappings ? stmStopMappings[index] : null}
        />
      ))}
    </div>
  );
}


"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi } from 'lucide-react';
import { getArrivals, getAllBusStops } from '@/lib/stm-api';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void;
}

interface StmLineArrivalInfo {
    line: string;
    eta: number;
    distance: number;
}

interface StmBusStop {
    busstopId: number;
    location: {
        coordinates: [number, number]; // [lng, lat]
    };
}

function haversineDistance(
  coords1: { lat: number, lng: number },
  coords2: { lat: number, lng: number }
): number {
  const R = 6371e3; // metres
  const φ1 = coords1.lat * Math.PI / 180;
  const φ2 = coords2.lat * Math.PI / 180;
  const Δφ = (coords2.lat - coords1.lat) * Math.PI / 180;
  const Δλ = (coords2.lng - coords1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

const RouteOptionItem = ({ route, index, onSelectRoute, allStops }: { route: google.maps.DirectionsRoute, index: number, onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void, allStops: StmBusStop[] }) => {
  const [stmLineInfo, setStmLineInfo] = useState<StmLineArrivalInfo | null>(null);
  const [isLoadingArrival, setIsLoadingArrival] = useState(true);
  const leg = route.legs[0];
  const duration = getTotalDuration(route.legs);
  
  const firstTransitStep = leg.steps.find(step => step.travel_mode === 'TRANSIT');
  const googleTransitLine = firstTransitStep?.transit?.line.short_name;

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const fetchArrival = async () => {
      if (!isMounted || !firstTransitStep || !googleTransitLine || !firstTransitStep.transit?.departure_stop.location || allStops.length === 0) {
        setIsLoadingArrival(false);
        return;
      }
      
      setIsLoadingArrival(true);

      const departureStopLocation = {
          lat: firstTransitStep.transit.departure_stop.location.lat(),
          lng: firstTransitStep.transit.departure_stop.location.lng()
      };
      
      let nearestStop: StmBusStop | null = null;
      let minDistance = Infinity;

      allStops.forEach(stop => {
        const stopCoords = { lat: stop.location.coordinates[1], lng: stop.location.coordinates[0] };
        const distance = haversineDistance(departureStopLocation, stopCoords);
        if (distance < minDistance) {
          minDistance = distance;
          nearestStop = stop;
        }
      });
      
      if (!nearestStop) {
          if(isMounted) setIsLoadingArrival(false);
          return;
      }

      try {
        const arrivalData = await getArrivals(nearestStop.busstopId, googleTransitLine);
        if (isMounted) {
            if (arrivalData) {
                console.log("STM Arrival Info:", arrivalData);
                setStmLineInfo(arrivalData);
            } else {
                setStmLineInfo(null);
            }
        }
      } catch (error) {
        console.error("Error fetching arrivals:", error);
        if(isMounted) setStmLineInfo(null);
      } finally {
        if(isMounted) setIsLoadingArrival(false);
      }
    };

    fetchArrival();
    
    intervalId = setInterval(fetchArrival, 20000); // 20 seconds

    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };

  }, [firstTransitStep, googleTransitLine, allStops]);

  const getArrivalText = () => {
    if (!stmLineInfo) return null;

    const arrivalSeconds = stmLineInfo.eta;
    if (arrivalSeconds < 60) {
      return `Llegando`;
    }
    const arrivalMinutes = Math.round(arrivalSeconds / 60);
    return `A ${arrivalMinutes} min`;
  };

  const arrivalText = getArrivalText();
  const displayLine = stmLineInfo?.line || googleTransitLine;

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
              {leg.steps.map((step, stepIndex) => {
                if (step.travel_mode === 'TRANSIT') {
                  return (
                    <React.Fragment key={stepIndex}>
                      <Badge variant="secondary" className="font-mono">{step.transit?.line.short_name}</Badge>
                      {stepIndex < leg.steps.length - 1 && leg.steps[stepIndex+1].travel_mode ==='TRANSIT' && <ChevronsRight className="h-4 w-4 text-muted-foreground" />}
                    </React.Fragment>
                  );
                }
                if (step.travel_mode === 'WALKING') {
                   return (
                    <React.Fragment key={stepIndex}>
                      <Footprints className="h-4 w-4 text-muted-foreground" />
                       {stepIndex < leg.steps.length - 1 && <ChevronsRight className="h-4 w-4 text-muted-foreground" />}
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
            {isLoadingArrival && firstTransitStep && (
                 <div className="flex items-center gap-2 text-xs text-blue-400">
                    <Wifi className="h-3 w-3 animate-pulse" />
                    <span>Buscando...</span>
                </div>
            )}
            {!isLoadingArrival && arrivalText && (
              <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                  <Wifi className="h-3 w-3" />
                  <span>{arrivalText}</span>
              </div>
            )}
            {!isLoadingArrival && !arrivalText && firstTransitStep && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wifi className="h-3 w-3" />
                    <span>Sin arribos</span>
                </div>
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

export default function RouteOptionsList({ routes, onSelectRoute }: RouteOptionsListProps) {
    const [allStops, setAllStops] = useState<StmBusStop[]>([]);

    useEffect(() => {
        getAllBusStops()
            .then(stops => {
                if (stops) {
                    setAllStops(stops);
                }
            })
            .catch(err => console.error("Could not load bus stops", err));
    }, []);

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {routes.map((route, index) => (
        <RouteOptionItem 
            key={index} 
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            allStops={allStops}
        />
      ))}
    </div>
  );
}

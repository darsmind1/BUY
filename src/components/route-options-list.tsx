
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi } from 'lucide-react';
import { getBusLocation } from '@/lib/stm-api';
import { haversineDistance } from '@/lib/utils';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void;
}

interface BusArrivalInfo {
    eta: number; // in seconds
    distance: number; // in meters
}

const RouteOptionItem = ({ route, index, onSelectRoute }: { route: google.maps.DirectionsRoute, index: number, onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void }) => {
  const [arrivalInfo, setArrivalInfo] = useState<BusArrivalInfo | null>(null);
  const [isLoadingArrival, setIsLoadingArrival] = useState(true);
  const leg = route.legs[0];
  const duration = getTotalDuration(route.legs);
  
  const firstTransitStep = leg.steps.find(step => step.travel_mode === 'TRANSIT');
  const googleTransitLine = firstTransitStep?.transit?.line.short_name;

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const fetchArrival = async (isInitialFetch = false) => {
      if (!isMounted || !firstTransitStep || !googleTransitLine || !firstTransitStep.transit?.departure_stop.location) {
        if(isInitialFetch) setIsLoadingArrival(false);
        return;
      }
      
      if(isInitialFetch) setIsLoadingArrival(true);

      const departureStopLocation = {
          lat: firstTransitStep.transit.departure_stop.location.lat(),
          lng: firstTransitStep.transit.departure_stop.location.lng()
      };

      try {
        const buses = await getBusLocation(googleTransitLine);

        if (isMounted && buses && buses.length > 0) {
            let nearestBusDistance = Infinity;
            
            buses.forEach(bus => {
                const busCoords = { lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] };
                const distance = haversineDistance(departureStopLocation, busCoords);
                if (distance < nearestBusDistance) {
                    nearestBusDistance = distance;
                }
            });

            if (nearestBusDistance !== Infinity) {
                // Average bus speed in Montevideo is ~15-20 km/h -> ~4.2-5.5 m/s. Let's use ~4.5 m/s.
                const averageSpeedMetersPerSecond = 4.5;
                const etaSeconds = nearestBusDistance / averageSpeedMetersPerSecond;
                
                setArrivalInfo({
                    distance: nearestBusDistance,
                    eta: etaSeconds,
                });

            } else {
                 setArrivalInfo(null);
            }

        } else if (isMounted) {
            setArrivalInfo(null);
        }

      } catch (error) {
        console.error("Error fetching bus locations:", error);
        if(isMounted) setArrivalInfo(null);
      } finally {
        if(isMounted && isInitialFetch) setIsLoadingArrival(false);
      }
    };

    fetchArrival(true);
    
    intervalId = setInterval(() => fetchArrival(false), 20000); 

    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };

  }, [firstTransitStep, googleTransitLine]);

  const getArrivalText = () => {
    if (!arrivalInfo) return null;

    const arrivalSeconds = arrivalInfo.eta;
    if (arrivalSeconds < 60) {
      return `Llegando`;
    }
    const arrivalMinutes = Math.round(arrivalSeconds / 60);
    return `A ${arrivalMinutes} min`;
  };

  const arrivalText = getArrivalText();

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
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {routes.map((route, index) => (
        <RouteOptionItem 
            key={index} 
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
        />
      ))}
    </div>
  );
}

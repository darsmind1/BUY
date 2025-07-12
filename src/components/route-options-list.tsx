
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi } from 'lucide-react';
import { getArrivals } from '@/lib/stm-api';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void;
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

interface StmArrivalInfo {
  eta: number;
  distance: number;
}

const RouteOptionItem = ({ route, index, onSelectRoute }: { route: google.maps.DirectionsRoute, index: number, onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void }) => {
  const [arrivalInfo, setArrivalInfo] = useState<StmArrivalInfo | null>(null);
  const [isLoadingArrival, setIsLoadingArrival] = useState(true);
  const leg = route.legs[0];
  const duration = getTotalDuration(route.legs);
  
  const firstTransitStep = leg.steps.find(step => step.travel_mode === 'TRANSIT');
  const transitLine = firstTransitStep?.transit?.line.short_name;

  useEffect(() => {
    const fetchArrival = async () => {
      if (!firstTransitStep || !transitLine || !firstTransitStep.transit?.departure_stop.location) {
        setIsLoadingArrival(false);
        return;
      }
      
      setIsLoadingArrival(true);

      const stopLocation = firstTransitStep.transit.departure_stop.location;

      try {
        const arrivalData = await getArrivals(transitLine, stopLocation.lat(), stopLocation.lng());
        setArrivalInfo(arrivalData);
      } catch (error) {
        console.error("Error fetching arrivals:", error);
        setArrivalInfo(null);
      } finally {
        setIsLoadingArrival(false);
      }
    };

    fetchArrival();
    
    const intervalId = setInterval(fetchArrival, 15000);

    return () => clearInterval(intervalId);

  }, [firstTransitStep, transitLine]);

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
              <span>{duration} min</span>
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


export default function RouteOptionsList({ routes, onSelectRoute }: RouteOptionsListProps) {
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {routes.map((route, index) => (
        <RouteOptionItem key={index} route={route} index={index} onSelectRoute={onSelectRoute} />
      ))}
    </div>
  );
}

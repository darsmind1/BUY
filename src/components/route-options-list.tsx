"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bus, Footprints, Clock, AlertTriangle } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { cn, haversineDistance } from "@/lib/utils";
import type { StmBusStop, UpcomingBus, StmInfo } from "@/lib/types";
import { getUpcomingBuses, findClosestStmStop } from "@/lib/stm-api";
import { Badge } from "./ui/badge";

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => void;
  isApiConnected: boolean;
  allStops: StmBusStop[];
}

function UpcomingBusEta({ 
    departureStopLocation, 
    line, 
    lineVariantId,
    allStops
}: { 
    departureStopLocation: google.maps.LatLng | null;
    line: string | null;
    lineVariantId: number | null;
    allStops: StmBusStop[];
}) {
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEta = useCallback(async () => {
    if (!departureStopLocation || !line || allStops.length === 0) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    try {
      const stmStop = await findClosestStmStop(departureStopLocation.lat(), departureStopLocation.lng(), allStops);
      
      if (stmStop) {
        const upcomingBuses = await getUpcomingBuses(stmStop.busstopId, [line]);
        if (upcomingBuses.length > 0) {
          // Try to find the exact variant first, otherwise take any bus on the line
          const nextBus = upcomingBuses.find(b => b.lineVariantId === lineVariantId) || upcomingBuses.find(b => b.line === line);
          setEta(nextBus ? nextBus.arrival.minutes : null);
        } else {
          setEta(null);
        }
      } else {
        setEta(null);
      }
    } catch (error) {
      console.error("Failed to fetch ETA for route option", error);
      setEta(null);
    } finally {
      setLoading(false);
    }
  }, [departureStopLocation, line, lineVariantId, allStops]);

  useEffect(() => {
    fetchEta();
    const intervalId = setInterval(fetchEta, 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId);
  }, [fetchEta]);

  if (loading) {
    return <Skeleton className="h-5 w-24" />;
  }

  if (eta !== null) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-1 md:text-sm">
        <Clock size={14} className="flex-shrink-0" />
        <span className="truncate">{eta <= 1 ? "Llegando" : `Próximo en ${eta} min`}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 md:text-sm">
        <Clock size={14} className="flex-shrink-0"/>
        <span className="truncate">Sin arribo en vivo</span>
    </div>
  );
}

function RouteOptionCard({ route, onSelect, isApiConnected, allStops }: { route: google.maps.DirectionsRoute, onSelect: () => void, isApiConnected: boolean, allStops: StmBusStop[] }) {
    const leg = route.legs[0];
    const transitSteps = leg.steps.filter(step => step.travel_mode === 'TRANSIT' && step.transit);
    const firstTransitStep = transitSteps[0]?.transit;

    return (
        <button 
            onClick={onSelect} 
            className="w-full text-left bg-card p-4 rounded-lg border hover:border-primary hover:shadow-md transition-all duration-200 space-y-3"
        >
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <span className="font-semibold text-lg">{leg.duration?.text}</span>
                    {isApiConnected && firstTransitStep && firstTransitStep.departure_stop.location ? (
                       <UpcomingBusEta 
                         departureStopLocation={firstTransitStep.departure_stop.location}
                         line={firstTransitStep.line.short_name || null}
                         lineVariantId={null} // Simplified for list view
                         allStops={allStops}
                       />
                    ) : (
                       <span className="text-xs text-muted-foreground mt-1">{leg.departure_time?.text}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 -mt-1">
                  {leg.steps.map((step, index) => {
                      if (step.travel_mode === 'WALKING') {
                          return <Footprints key={index} className="h-5 w-5 text-muted-foreground" />
                      }
                      if (step.travel_mode === 'TRANSIT' && step.transit) {
                          return (
                              <Badge key={index} variant="secondary" className="font-bold">
                                  <Bus size={12} className="mr-1"/>
                                  {step.transit.line.short_name}
                              </Badge>
                          )
                      }
                      return null;
                  }).reduce((prev, curr, index) => {
                      if (index === 0) return [curr];
                      return [...prev, <span key={`sep-${index}`} className="text-muted-foreground/50 text-sm">&gt;</span>, curr]
                  }, [] as React.ReactNode[])}
                </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
                {leg.distance?.text} &middot; {route.summary || 'Ruta estándar'}
            </div>
        </button>
    );
}

export default function RouteOptionsList({ routes, onSelectRoute, isApiConnected, allStops }: RouteOptionsListProps) {

  const handleSelect = (route: google.maps.DirectionsRoute, index: number) => {
    // Extract STM-relevant information from the selected route
    const stmInfo: StmInfo[] = route.legs[0].steps.map((step, stepIndex) => {
        if (step.travel_mode === 'TRANSIT' && step.transit) {
            // The location object from the backend is not a LatLng object, so we convert it.
            const depLoc = step.transit.departure_stop.location;
            const depLatLng = depLoc ? new google.maps.LatLng(depLoc.lat(), depLoc.lng()) : null;

            return {
                stepIndex,
                line: step.transit.line.short_name || null,
                lineDestination: step.transit.headsign || null,
                departureStopLocation: depLatLng ? depLatLng.toJSON() : null,
                arrival: null, // This will be populated in the details view
            };
        }
        return { stepIndex, line: null, lineDestination: null, departureStopLocation: null, arrival: null };
    });

    onSelectRoute(route, index, stmInfo);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {routes.map((route, index) => (
        <RouteOptionCard 
            key={index}
            route={route}
            onSelect={() => handleSelect(route, index)}
            isApiConnected={isApiConnected}
            allStops={allStops}
        />
      ))}
    </div>
  );
}

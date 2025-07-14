
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bus, Clock, User, ArrowRight, Wifi, Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';

interface RouteDetailsPanelProps {
  route: google.maps.DirectionsResult;
  isApiConnected: boolean;
  busLocations: BusLocation[];
}

const getStepIcon = (travelMode: google.maps.TravelMode) => {
    if (travelMode === google.maps.TravelMode.WALKING) return <User className="h-5 w-5" />;
    if (travelMode === google.maps.TravelMode.TRANSIT) return <Bus className="h-5 w-5" />;
    return null;
}

export default function RouteDetailsPanel({ route, isApiConnected, busLocations }: RouteDetailsPanelProps) {
    const leg = route.routes[0].legs[0];

    const [realtimeEtas, setRealtimeEtas] = useState<Record<number, number | null>>({});
    const [loadingEtas, setLoadingEtas] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchAllEtas = async () => {
            if (!isApiConnected) return;

            const etaPromises = leg.steps.map(async (step, index) => {
                if (step.travel_mode !== 'TRANSIT' || !step.transit?.departure_stop?.location) {
                  return;
                }
                
                setLoadingEtas(prev => ({...prev, [index]: true }));

                const line = step.transit.line.short_name;
                const destination = step.transit.headsign;
                const departureStopCoords = step.transit.departure_stop.location.toJSON();

                // Find the closest bus for this specific line and destination that is before the stop
                const relevantBuses = busLocations.filter(bus => 
                    bus.line === line && 
                    (!destination || bus.destination?.toLowerCase().includes(destination.toLowerCase()))
                );

                if (relevantBuses.length > 0) {
                    // This logic is a placeholder. A robust implementation would need to
                    // check if the bus is actually on a path leading to the stop.
                    // For now, we take the one with the smallest ETA from Google.
                    let closestBusEta: number | null = null;

                    const busEtaPromises = relevantBuses.map(bus => 
                        fetch('/api/eta', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                busLocation: { lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] },
                                stopLocation: departureStopCoords
                            })
                        }).then(res => res.json())
                    );
                    
                    const etas = await Promise.all(busEtaPromises);
                    
                    etas.forEach(data => {
                        if (data.eta !== null && (closestBusEta === null || data.eta < closestBusEta)) {
                            closestBusEta = data.eta;
                        }
                    });

                    if (closestBusEta !== null) {
                        setRealtimeEtas(prev => ({ ...prev, [index]: Math.round(closestBusEta! / 60) }));
                    } else {
                        setRealtimeEtas(prev => ({ ...prev, [index]: null }));
                    }
                } else {
                     setRealtimeEtas(prev => ({ ...prev, [index]: null }));
                }
                setLoadingEtas(prev => ({...prev, [index]: false }));
            });

            await Promise.all(etaPromises);
        };

        fetchAllEtas();
        const intervalId = setInterval(fetchAllEtas, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId);

    }, [leg.steps, busLocations, isApiConnected]);


  return (
    <div className="animate-in fade-in-0 slide-in-from-right-4 duration-500">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Tu Viaje</CardTitle>
          <div className="flex items-center gap-4 text-muted-foreground pt-2">
            <Clock className="h-4 w-4" />
            <span>Duración total: {leg.duration?.text}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100dvh-250px)] md:h-auto">
            <div className="px-6 pb-6 space-y-6">
                {leg.steps.map((step, index) => (
                    <div key={index} className="flex gap-4 relative">
                        {index < leg.steps.length -1 && <div className="absolute left-[11px] top-10 h-full w-0.5 bg-border -z-10" />}
                        <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center shrink-0 mt-2 z-0">
                            {getStepIcon(step.travel_mode)}
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <p className="font-semibold" dangerouslySetInnerHTML={{ __html: step.instructions }} />

                            {step.travel_mode === 'TRANSIT' && step.transit && (
                                <div className="space-y-2 py-2">
                                    <div className="flex items-center gap-3">
                                         <Badge variant="outline-secondary">{step.transit.line.short_name}</Badge>
                                         <span className="text-sm font-medium">{step.transit.headsign}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <p>Salida: {step.transit.departure_stop.name}</p>
                                        <p>Llegada: {step.transit.arrival_stop.name}</p>
                                        <p>Paradas: {step.transit.num_stops}</p>
                                    </div>
                                </div>
                            )}

                             <div className="flex items-center text-sm text-muted-foreground gap-4">
                                <span>{step.duration?.text}</span>
                                {step.travel_mode === 'TRANSIT' && (
                                    <>
                                        <span>•</span>
                                        {loadingEtas[index] ? (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                <span>Actualizando...</span>
                                            </div>
                                        ) : realtimeEtas[index] !== null && realtimeEtas[index] !== undefined ? (
                                             <div className="flex items-center gap-1.5 text-xs font-bold text-green-400">
                                                <Wifi className="h-3.5 w-3.5" />
                                                <span>
                                                   {realtimeEtas[index]! <= 0 ? "Llegando" : `En ${realtimeEtas[index]} min`}
                                                </span>
                                             </div>
                                        ) : isApiConnected ? (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                                                <span>No hay info en vivo</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>{step.transit?.departure_time.text}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="flex gap-4">
                     <div className="h-6 w-6 bg-accent rounded-full flex items-center justify-center shrink-0 mt-2 z-0">
                         <ArrowRight className="h-5 w-5 text-accent-foreground" />
                    </div>
                     <div className="flex-1 space-y-1.5 mt-2">
                        <p className="font-semibold">Has llegado a tu destino.</p>
                     </div>
                </div>

            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

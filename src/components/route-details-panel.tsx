"use client";

import { Clock, Bus, Footprints, ChevronDown, CheckCircle2, CircleDotDashed } from "lucide-react";
import { cn, haversineDistance } from "@/lib/utils";
import type { BusLocation, StmInfo } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { useEffect, useState } from "react";


interface RouteDetailsPanelProps {
    route: google.maps.DirectionsRoute;
    stmInfo: StmInfo[];
    busLocations: BusLocation[];
    userLocation: google.maps.LatLngLiteral | null;
}

const getSignalAgeColor = (seconds: number | null) => {
    if (seconds === null) return "bg-gray-400";
    if (seconds < 60) return "bg-green-400"; // Fresh
    if (seconds < 120) return "bg-yellow-400"; // A bit old
    return "bg-red-500"; // Stale
};

const getSignalAge = (timestamp: string | null | undefined): number | null => {
    if (!timestamp) return null;
    const now = new Date().getTime();
    const signalTimestamp = new Date(timestamp).getTime();
    return (now - signalTimestamp) / 1000; // age in seconds
};

function LiveBusIndicator({ line, destination, busLocations, userLocation, departureStopLocation }: { line: string | null, destination: string | null, busLocations: BusLocation[], userLocation: google.maps.LatLngLiteral | null, departureStopLocation: google.maps.LatLng | null }) {
    const [eta, setEta] = useState<number | null>(null);
    const [signalAge, setSignalAge] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchEta = async () => {
            if (!line || !departureStopLocation) return;
            setLoading(true);

            // Find the closest bus of the correct line and destination
            const relevantBuses = busLocations.filter(bus => bus.line === line && (!destination || bus.destination?.includes(destination)));
            
            let closestBus: BusLocation | null = null;
            let minDistance = Infinity;

            relevantBuses.forEach(bus => {
                const busCoords = { lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] };
                const stopCoords = { lat: departureStopLocation.lat(), lng: departureStopLocation.lng() };
                const distance = haversineDistance(busCoords, stopCoords);

                // Basic check to see if bus is heading towards the stop (requires more advanced logic for prod)
                // For now, we assume any bus on the line is a candidate
                if (distance < minDistance) {
                    minDistance = distance;
                    closestBus = bus;
                }
            });

            if (isMounted && closestBus) {
                try {
                    const response = await fetch('/api/eta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            busLocation: { lat: closestBus.location.coordinates[1], lng: closestBus.location.coordinates[0] },
                            stopLocation: { lat: departureStopLocation.lat(), lng: departureStopLocation.lng() }
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setEta(data.eta ? Math.round(data.eta / 60) : null);
                        setSignalAge(getSignalAge(closestBus.timestamp));
                    } else {
                        setEta(null);
                    }
                } catch (error) {
                    console.error("ETA fetch error:", error);
                    setEta(null);
                }
            } else if(isMounted) {
                setEta(null);
            }
            if(isMounted) setLoading(false);
        };

        fetchEta();

        return () => { isMounted = false };

    }, [line, destination, busLocations, departureStopLocation]);

    if (!line) return null;
    if (loading) return <div className="text-xs text-muted-foreground animate-pulse">Buscando bus...</div>;

    if (eta !== null) {
        return (
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mt-2 md:text-sm">
                <div className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-offset-2 ring-offset-background", getSignalAgeColor(signalAge))} />
                <span>{eta <= 1 ? "Llegando" : `Llega en ${eta} min`}</span>
            </div>
        );
    }
    
    return <div className="text-xs text-muted-foreground mt-2">No hay información de bus en vivo.</div>;
}


export default function RouteDetailsPanel({ route, stmInfo, busLocations, userLocation }: RouteDetailsPanelProps) {
    const leg = route.legs[0];
    const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

    const toggleStep = (index: number) => {
        setExpandedSteps(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return (
        <div className="pointer-events-auto bg-card text-card-foreground h-full flex flex-col">
            <header className="p-4 flex-shrink-0 min-w-0">
                <p className="font-semibold text-base text-primary truncate">{leg.end_address}</p>
                <p className="font-body text-sm text-muted-foreground">
                    <span className="font-semibold">{leg.duration?.text}</span> &middot; {leg.distance?.text}
                </p>
            </header>
            <Separator />
            <div className="flex-grow overflow-y-auto p-4 pt-4 md:p-6">
                <ol className="relative border-l-2 border-dashed border-primary/30 ml-3 space-y-4 md:space-y-6">
                    <li className="pl-6 md:pl-8">
                         <span className="absolute -left-[11px] mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary ring-4 ring-background">
                            <CircleDotDashed className="h-3.5 w-3.5 text-secondary-foreground" />
                        </span>
                        <div className="font-body text-sm text-card-foreground font-semibold break-words -mt-1">
                            {leg.start_address}
                        </div>
                    </li>
                    {leg.steps.map((step, index) => {
                        const isExpanded = expandedSteps[index] || false;
                        const isWalk = step.travel_mode === 'WALKING';
                        const isTransit = step.travel_mode === 'TRANSIT';
                        const hasSubSteps = isWalk && step.steps && step.steps.length > 1;
                        
                        const stepStmInfo = stmInfo.find(info => info.stepIndex === index);

                        return (
                            <li key={index} className="pl-6 md:pl-8">
                                <span className="absolute -left-[11px] mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary ring-4 ring-background">
                                    {isWalk ? (
                                        <Footprints className="h-3 w-3 text-primary-foreground" />
                                    ) : (
                                        <Bus className="h-3 w-3 text-primary-foreground" />
                                    )}
                                </span>
                                <div className="flex flex-col min-w-0">
                                    {hasSubSteps ? (
                                        <button
                                            onClick={() => toggleStep(index)}
                                            className="flex items-start justify-between w-full text-left gap-2 cursor-pointer"
                                            aria-expanded={isExpanded}
                                        >
                                            <div className="font-body text-sm text-card-foreground font-normal break-words -mt-1" dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
                                            <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform duration-200 text-muted-foreground mt-0.5", isExpanded && "rotate-180")} />
                                        </button>
                                    ) : (
                                        <div className="font-body text-sm text-card-foreground font-normal break-words -mt-1" dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
                                    )}

                                    <div className="font-body text-xs text-muted-foreground mt-1">{step.distance?.text} &middot; {step.duration?.text}</div>

                                    {hasSubSteps && isExpanded && (
                                        <ol className="relative border-l border-dashed border-muted/50 mt-3 ml-3 space-y-3">
                                            {step.steps!.map((subStep, subIndex) => (
                                                <li key={subIndex} className="pl-6">
                                                    <span className="absolute -left-[5px] mt-2 h-2 w-2 rounded-full bg-muted-foreground ring-2 ring-background"></span>
                                                    <div className="font-body text-sm text-card-foreground font-normal break-words -mt-1" dangerouslySetInnerHTML={{ __html: subStep.instructions || ''}} />
                                                    <div className="font-body text-xs text-muted-foreground mt-0.5">{subStep.distance?.text}</div>
                                                </li>
                                            ))}
                                        </ol>
                                    )}

                                    {isTransit && step.transit && (
                                        <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm space-y-2 border">
                                            <div className="flex items-start gap-2">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    <Badge>
                                                        <Bus size={12} className="mr-1.5"/>
                                                        {step.transit.line.short_name}
                                                    </Badge>
                                                </div>
                                                <div className="min-w-0 break-words flex-1 font-normal">
                                                  <p>{step.transit.line.name}</p>
                                                  <p className="text-xs text-muted-foreground">Destino: {step.transit.headsign}</p>
                                                </div>
                                            </div>
                                            <Separator className="my-2" />
                                            <div className="text-sm">
                                                <p className="break-words"><span className="text-muted-foreground mr-1 font-normal">Bajar en:</span><span className="font-normal">{step.transit.arrival_stop.name}</span></p>
                                                <p className="text-xs text-muted-foreground mt-0.5">({step.transit.num_stops} paradas)</p>
                                            </div>
                                            
                                            {step.transit.departure_stop.location && (
                                                <LiveBusIndicator
                                                    line={stepStmInfo?.line || null}
                                                    destination={stepStmInfo?.lineDestination || null}
                                                    busLocations={busLocations}
                                                    userLocation={userLocation}
                                                    departureStopLocation={step.transit.departure_stop.location}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                    <li className="pl-6 md:pl-8">
                        <span className="absolute -left-[11px] mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent ring-4 ring-background">
                            <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />
                        </span>

                        <div className="font-body text-sm -mt-1 text-card-foreground font-semibold">
                            Llegaste a tu destino.
                        </div>
                    </li>
                </ol>
            </div>
        </div>
    );
}


"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, ChevronsRight, Wifi, Loader2, Info, Bus, MapPin, AlertTriangle } from 'lucide-react';
import { getBusLocation, findClosestStmStop } from '@/lib/stm-api';
import type { ArrivalInfo, StmInfo, BusArrivalsState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getFormattedAddress } from '@/lib/google-maps-api';
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
    if (arrivalInfo.eta < 60) return "Llegando";
    const arrivalMinutes = Math.round(arrivalInfo.eta / 60);
    return `Llega en ${arrivalMinutes} min`;
};
  
const getSignalAge = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return null;
    const now = new Date().getTime();
    const signalTimestamp = new Date(arrivalInfo.timestamp).getTime();
    return (now - signalTimestamp) / 1000; // age in seconds
};

const getArrivalColorClass = (arrivalInfo: ArrivalInfo | null) => {
    if (!arrivalInfo) return 'text-primary';
    
    const age = getSignalAge(arrivalInfo);
    if (age === null) return 'text-primary';
    
    if (age <= 60) return 'text-green-400'; // Less than 1 minute old
    if (age <= 120) return 'text-yellow-400'; // 1 to 2 minutes old
    return 'text-red-500'; // Older than 2 minutes
};


const RouteOptionItem = ({ 
  route, 
  index, 
  onSelectRoute,
  arrivalInfo,
  stmInfo,
  transferInfo
}: { 
  route: google.maps.DirectionsRoute, 
  index: number, 
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => void,
  arrivalInfo: ArrivalInfo | null,
  stmInfo: StmInfo[],
  transferInfo: TransferInfo | null
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
          {transferInfo && (
            <Accordion type="single" collapsible className="w-full -mb-3">
                <AccordionItem value="item-1" className="border-t mt-3 border-dashed">
                    <AccordionTrigger className="text-xs hover:no-underline py-3">
                        <div className="flex flex-col text-left space-y-1.5">
                             <div className="flex items-center gap-2 text-muted-foreground font-medium">
                                <Bus className="h-3.5 w-3.5" />
                                <span>Transbordo en <span className="text-foreground">{transferInfo.stopName.split(',')[0]}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ChevronsRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="text-foreground">
                                    {transferInfo.mainTransferLine}
                                    {transferInfo.alternativeLines.filter(l => l.line !== transferInfo.mainTransferLine).length > 0 && ` y ${transferInfo.alternativeLines.filter(l => l.line !== transferInfo.mainTransferLine).length} ${transferInfo.alternativeLines.filter(l => l.line !== transferInfo.mainTransferLine).length === 1 ? 'opción más' : 'opciones más'}`}
                                </span>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 pr-2 space-y-2">
                        {[
                            { line: transferInfo.mainTransferLine, destination: transferInfo.mainTransferLineDestination, arrival: transferInfo.alternativeLines.find(l => l.line === transferInfo.mainTransferLine && l.destination === transferInfo.mainTransferLineDestination)?.arrival ?? null },
                            ...transferInfo.alternativeLines.filter(l => l.line !== transferInfo.mainTransferLine || l.destination !== transferInfo.mainTransferLineDestination)
                        ].map((alt, altIndex) => {
                            if (!alt.line) return null;
                            const altArrivalText = getArrivalText(alt.arrival);
                            return (
                                <div key={altIndex} className="flex items-center justify-between text-xs ml-5 pl-1.5 border-l border-dashed">
                                    <Badge variant="secondary" className="font-mono">{alt.line}</Badge>
                                    {altArrivalText ? (
                                        <div className={cn("flex items-center gap-1.5 font-medium", getArrivalColorClass(alt.arrival))}>
                                            <Wifi className="h-3 w-3" />
                                            <span>{altArrivalText}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">Sin arribos</span>
                                    )}
                                </div>
                            );
                        })}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          )}
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
  const [transferInfoByRoute, setTransferInfoByRoute] = useState<Record<number, TransferInfo | null>>({});

  const findAlternativeLines = useCallback(async (
        transferStopLocation: google.maps.LatLngLiteral, 
        destination: google.maps.LatLng | string
    ): Promise<{line: string, destination: string | null}[]> => {
    
    return new Promise((resolve) => {
        if (!isGoogleMapsLoaded) return resolve([]);
        const directionsService = new window.google.maps.DirectionsService();

        directionsService.route({
            origin: transferStopLocation,
            destination: destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
                modes: [google.maps.TransitMode.BUS],
            },
            provideRouteAlternatives: true,
            region: 'UY'
        }, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
                const alternativeLines = new Map<string, {line: string, destination: string | null}>();
                result.routes.forEach(route => {
                    route.legs.forEach(leg => {
                        leg.steps.forEach(step => {
                            if (step.travel_mode === 'TRANSIT' && step.transit?.line.short_name) {
                                const line = step.transit.line.short_name;
                                const headsign = step.transit.headsign || null;
                                // Use a composite key to store unique line-destination pairs
                                const key = `${line}-${headsign}`;
                                if (!alternativeLines.has(key)) {
                                    alternativeLines.set(key, { line, destination: headsign });
                                }
                            }
                        })
                    })
                });
                resolve(Array.from(alternativeLines.values()));
            } else {
                resolve([]);
            }
        });
    });
  }, [isGoogleMapsLoaded]);

  // Effect for initial data setup (stops, lines, etc.)
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;

    const mapStopsAndFetchArrivals = async () => {
      setIsLoading(true);

      const allRoutesStmInfoPromises = routes.map(async (route, index) => {
        if (!isApiConnected) return { index, stmInfo: [] };

        const transitSteps = route.legs[0]?.steps.filter(step => step.travel_mode === 'TRANSIT' && step.transit);
        if (!transitSteps || transitSteps.length === 0) return { index, stmInfo: [] };
        
        const stmInfoForRoutePromises = transitSteps.map(async (step) => {
           const googleTransitLine = step.transit?.line.short_name;
           const departureStopLocation = step.transit?.departure_stop?.location;
           const lineDestination = step.transit?.headsign || null;

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

      // Handle transfer info
      const transferInfoPromises = routes.map(async (route, index) => {
        const transitSteps = route.legs[0]?.steps.filter(s => s.travel_mode === 'TRANSIT');
        if (transitSteps.length > 1) { // This indicates a transfer
            const transferStep = transitSteps[1];
            const transferStopLocation = transferStep.transit?.departure_stop.location;
            if (transferStopLocation) {
                const stopLocationLiteral = { lat: transferStopLocation.lat(), lng: transferStopLocation.lng() };
                const stopName = await getFormattedAddress(stopLocationLiteral.lat, stopLocationLiteral.lng);
                
                const mainTransferLine = transferStep.transit?.line.short_name ?? null;
                const mainTransferLineDestination = transferStep.transit?.headsign ?? null;
                
                let alternativeLines: {line: string, destination: string | null}[] = [];
                if (isApiConnected) {
                    alternativeLines = await findAlternativeLines(stopLocationLiteral, route.legs[0].end_location);
                }

                const alternativeLinesInfo: AlternativeLineInfo[] = alternativeLines
                    .map(lineInfo => ({ ...lineInfo, arrival: null }));

                return { index, info: { stopName, stopLocation: stopLocationLiteral, mainTransferLine, mainTransferLineDestination, alternativeLines: alternativeLinesInfo } };
            }
        }
        return { index, info: null };
      });

      const transferResults = await Promise.all(transferInfoPromises);
      const newTransferInfo: Record<number, TransferInfo | null> = {};
      transferResults.forEach(result => {
          newTransferInfo[result.index] = result.info;
      });
      setTransferInfoByRoute(newTransferInfo);

      setIsLoading(false);
    };

    mapStopsAndFetchArrivals();
  }, [routes, isApiConnected, isGoogleMapsLoaded, findAlternativeLines]);


  // Effect for fetching and updating real-time data periodically
  useEffect(() => {
    if (isLoading || !isApiConnected || !isGoogleMapsLoaded || (Object.keys(stmInfoByRoute).length === 0 && Object.keys(transferInfoByRoute).length === 0)) {
      return;
    }

    const fetchAllArrivals = async () => {
      // Collect lines from primary route steps
      const primaryLines = Object.values(stmInfoByRoute).flat().map(info => ({
        line: info.line,
        destination: info.lineDestination,
      }));

      // Collect lines from transfer alternatives
      const transferLines = Object.values(transferInfoByRoute).filter(Boolean).flatMap(info => 
        info!.alternativeLines.map(alt => ({ line: alt.line, destination: alt.destination }))
      );

      const linesToFetch = [...primaryLines, ...transferLines].filter(l => l.line);
      if (linesToFetch.length === 0) return;

      try {
        const locations = await getBusLocation(linesToFetch);
        
        const findArrivalForStop = (
            line: string,
            destination: string | null,
            stopLocation: google.maps.LatLngLiteral
        ): ArrivalInfo | null => {
            if (!isGoogleMapsLoaded) return null;
            const liveBus = locations.find(l => 
                l.line === line && l.destination === destination
            );
            if (liveBus) {
                const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                    new window.google.maps.LatLng(liveBus.location.coordinates[1], liveBus.location.coordinates[0]),
                    new window.google.maps.LatLng(stopLocation)
                );
                // Rough ETA: 30km/h average speed => 8.33 m/s
                const eta = distance / 8.33; 
                return { eta, timestamp: liveBus.timestamp };
            }
            return null;
        }

        // Update primary route arrivals with persistence logic
        setStmInfoByRoute(currentStmInfo => {
            const newStmInfo: Record<number, StmInfo[]> = {};
            for (const routeIndex in currentStmInfo) {
              newStmInfo[routeIndex] = currentStmInfo[routeIndex].map(info => {
                const newInfo = { ...info };
                if (newInfo.departureStopLocation) {
                  const newArrival = findArrivalForStop(newInfo.line, newInfo.lineDestination, newInfo.departureStopLocation);
                  const oldSignalAge = getSignalAge(newInfo.arrival);
                  if (newArrival) {
                    newInfo.arrival = newArrival;
                  } else if (oldSignalAge === null || oldSignalAge > 90) { // Clear if no new signal and old is too old
                    newInfo.arrival = null;
                  }
                  // Otherwise, keep the old (still valid) signal
                }
                return newInfo;
              });
            }
            return newStmInfo;
        });

        // Update transfer alternatives arrivals
        setTransferInfoByRoute(currentTransferInfo => {
            const newTransferInfo: Record<number, TransferInfo | null> = {};
            for (const routeIndex in currentTransferInfo) {
              const currentInfo = currentTransferInfo[routeIndex];
              if (currentInfo) {
                newTransferInfo[routeIndex] = {
                  ...currentInfo,
                  alternativeLines: currentInfo.alternativeLines.map(alt => {
                    const newAlt = { ...alt };
                    const newArrival = findArrivalForStop(alt.line, alt.destination, currentInfo.stopLocation);
                    const oldSignalAge = getSignalAge(newAlt.arrival);
                    if (newArrival) {
                      newAlt.arrival = newArrival;
                    } else if (oldSignalAge === null || oldSignalAge > 90) { // Clear if no new signal and old is too old
                      newAlt.arrival = null;
                    }
                    // Otherwise, keep the old (still valid) signal
                    return newAlt;
                  }),
                };
              } else {
                newTransferInfo[routeIndex] = null;
              }
            }
            return newTransferInfo;
        });

      } catch (error) {
        console.error(`Error fetching bus locations:`, error);
      }
    };

    fetchAllArrivals(); // Initial fetch
    const intervalId = setInterval(fetchAllArrivals, 20000); // Update every 20 seconds

    return () => clearInterval(intervalId);
  }, [isLoading, stmInfoByRoute, transferInfoByRoute, isApiConnected, isGoogleMapsLoaded]);
  

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
          transferInfo={transferInfoByRoute[index] ?? null}
        />
      ))}
    </div>
  );
}

    
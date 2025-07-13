
"use client";

import { useState, useEffect, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Bus, ArrowLeft, Loader2, Map as MapIcon, Eye } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getBusLocation, BusLocation, checkApiConnection, getArrivalsForStop } from '@/lib/stm-api';
import type { RouteOption, BusArrivalInfo } from '@/lib/types';
import { getStopIdFromStopName } from '@/lib/stop-id-mapper';


const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";
const LIBRARIES: ("places" | "marker")[] = ['places', 'marker'];

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [busArrivals, setBusArrivals] = useState<Record<string, BusArrivalInfo>>({});
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const { toast } = useToast();
  
  const { isLoaded: isGoogleMapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: LIBRARIES
  });

  useEffect(() => {
    const verifyApiConnection = async () => {
        const isConnected = await checkApiConnection();
        if (isConnected) {
            setApiStatus('connected');
        } else {
            setApiStatus('error');
            toast({
                variant: "destructive",
                title: "Error de conexión",
                description: "No se pudo conectar con el servicio de buses (STM). Los horarios en tiempo real no estarán disponibles.",
                duration: 10000
            });
        }
    };
    verifyApiConnection();
  }, [toast]);


  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchBusLocations = async () => {
      if (!selectedRoute || !selectedRoute.transitDetails || apiStatus !== 'connected') {
        setBusLocations([]);
        return;
      }
      
      try {
        const locations = await getBusLocation(selectedRoute.transitDetails.line.name, selectedRoute.transitDetails.headsign);
        setBusLocations(locations);
      } catch (error) {
        console.error(`Error fetching locations for line ${selectedRoute.transitDetails.line.name}:`, error);
        setBusLocations([]);
      }
    };
    
    if (view === 'details' && selectedRoute) {
        fetchBusLocations(); 
        intervalId = setInterval(fetchBusLocations, 30000); 
    } else {
        setBusLocations([]);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [view, selectedRoute, apiStatus]);
  
  const fetchAllArrivals = async (routes: RouteOption[]) => {
      if (!isApiConnected || routes.length === 0) {
        setBusArrivals({});
        return;
      }
      
      setBusArrivals(prev => {
        const newArrivals = {...prev};
        routes.forEach(route => {
          newArrivals[route.id] = { isLoading: true, arrival: null };
        });
        return newArrivals;
      });

      const arrivalPromises = routes.map(async (route) => {
          const stopId = route.transitDetails.departureStop.stopId;
          if (!stopId) {
              return { routeId: route.id, data: { arrival: null, isLoading: false } };
          }

          const lineName = route.transitDetails.line.name;
          
          try {
              const arrivals = await getArrivalsForStop(stopId);
              if (!arrivals) return { routeId: route.id, data: { arrival: null, isLoading: false } };

              const nextRealtimeArrival = arrivals.find(a => 
                  a.bus && 
                  a.eta > -1 && 
                  a.bus.line === lineName &&
                  a.bus.destination?.toUpperCase().includes(route.transitDetails.headsign.toUpperCase())
              );
              
              if (nextRealtimeArrival) {
                  return { routeId: route.id, data: { arrival: nextRealtimeArrival, isLoading: false } };
              }
              
              const nextScheduledArrival = arrivals.find(a => 
                a.eta === -1 && 
                a.bus?.line === lineName &&
                a.bus.destination?.toUpperCase().includes(route.transitDetails.headsign.toUpperCase())
              );

              return { routeId: route.id, data: { arrival: nextScheduledArrival || null, isLoading: false } };

          } catch (error) {
              console.error(`Error fetching bus arrivals for route ${route.id}:`, error);
              return { routeId: route.id, data: { arrival: null, isLoading: false } };
          }
      });

      const results = await Promise.all(arrivalPromises);
      
      setBusArrivals(prev => {
          const newArrivals = {...prev};
          results.forEach(result => {
              if (result) {
                  newArrivals[result.routeId] = result.data;
              }
          });
          return newArrivals;
      });
  };

  const handleSearch = async (origin: string, destination: string) => {
    if (!isGoogleMapsLoaded || !window.google) {
        toast({ variant: "destructive", title: "Error", description: "El mapa no está listo. Intenta de nuevo en unos segundos." });
        return;
    }

    let originParam: string | google.maps.LatLng = origin;
    if (origin === 'Mi ubicación actual') {
      if (!currentUserLocation) {
        toast({
            variant: "destructive",
            title: "Error de ubicación",
            description: "No se pudo obtener tu ubicación. Por favor, habilita los permisos e intenta de nuevo.",
        });
        return;
      }
      originParam = new window.google.maps.LatLng(currentUserLocation.lat, currentUserLocation.lng);
    }
    
    setIsLoading(true);
    setRouteOptions([]);
    setSelectedRoute(null);
    setBusLocations([]);
    setDirectionsResult(null);

    const directionsService = new window.google.maps.DirectionsService();
    
    try {
        directionsService.route(
            {
                origin: originParam,
                destination: destination,
                travelMode: window.google.maps.TravelMode.TRANSIT,
                transitOptions: {
                    modes: [google.maps.TransitMode.BUS],
                },
                provideRouteAlternatives: true,
                region: 'UY'
            },
            (result, status) => {
                setIsLoading(false);
                if (status === window.google.maps.DirectionsStatus.OK && result && result.routes.length > 0) {
                    const parsedRoutes: RouteOption[] = result.routes.map((route, index) => {
                       const leg = route.legs[0];
                       if (!leg) return null;

                       const transitStep = leg.steps.find(step => step.travel_mode === "TRANSIT" && step.transit);
                       
                       if (!transitStep || !transitStep.transit) {
                           return null;
                       }

                       const walkingSteps = leg.steps.filter(s => s.travel_mode === "WALKING");
                       const walkingDuration = walkingSteps.reduce((total, step) => total + (step.duration?.value || 0), 0);

                       return {
                           id: `route-${index}`,
                           summary: route.summary || transitStep.transit.line.short_name || 'Ruta de bus',
                           duration: leg.duration?.value || 0,
                           walkingDuration: walkingDuration,
                           gmapsRoute: result, // Store the full DirectionsResult
                           routeIndex: index, // Store the index to identify the route within the result
                           transitDetails: {
                               line: {
                                   name: transitStep.transit.line.short_name || 'N/A',
                                   vehicle: transitStep.transit.line.vehicle.name
                               },
                               departureStop: {
                                   name: transitStep.transit.departure_stop.name,
                                   location: transitStep.transit.departure_stop.location.toJSON(),
                                   stopId: getStopIdFromStopName(transitStep.transit.departure_stop.name)
                               },
                               arrivalStop: {
                                   name: transitStep.transit.arrival_stop.name,
                                   location: transitStep.transit.arrival_stop.location.toJSON()
                               },
                               headsign: transitStep.transit.headsign,
                               numStops: transitStep.transit.num_stops
                           },
                           walkingSteps: walkingSteps
                       };
                    }).filter((route): route is RouteOption => route !== null);

                    if (parsedRoutes.length === 0) {
                        toast({ title: "No se encontraron rutas", description: "No se encontraron líneas de ómnibus directas. Intenta con otras direcciones." });
                    } else {
                        setRouteOptions(parsedRoutes);
                        fetchAllArrivals(parsedRoutes);
                        setView('options');
                        setMobileView('panel');
                    }
                } else {
                    console.error(`Directions request failed due to ${status}`);
                    toast({
                        title: "No se encontraron rutas",
                        description: status === 'ZERO_RESULTS' ? "No hay rutas de ómnibus para este trayecto." : "Hubo un error al buscar la ruta. Verifica las direcciones.",
                        variant: "destructive"
                    });
                }
            }
        );
    } catch(e) {
        setIsLoading(false);
        console.error("Error in handleSearch:", e);
        toast({ variant: "destructive", title: "Error", description: "Ocurrió un error inesperado al buscar la ruta." });
    }
  };


  const handleSelectRoute = (route: RouteOption) => {
    setSelectedRoute(route);
    setDirectionsResult(route.gmapsRoute);
    setView('details');
    setMobileView('map'); // On mobile, switch to map view first
  };

  const handleBack = () => {
    if (mobileView === 'map' && view === 'details') {
      setMobileView('panel'); // From map in details, go back to details panel
      return;
    }
    if (view === 'details') {
      setView('options');
      setSelectedRoute(null);
      setDirectionsResult(null);
      setBusLocations([]);
      setMobileView('panel');
    } else if (view === 'options') {
      setView('search');
      setRouteOptions([]);
      setMobileView('panel');
    }
  };
  
  const getHeaderTitle = () => {
    switch(view) {
      case 'search': return 'Indica tu viaje';
      case 'options': return 'Opciones de Trayecto';
      case 'details': return 'Detalles del Viaje';
      default: return 'BusesUY';
    }
  }

  const handleCenterOnRoute = () => {
    const map = mapRef.current;
    if (!map || !selectedRoute?.gmapsRoute.routes[selectedRoute.routeIndex]) return;

    const route = selectedRoute.gmapsRoute.routes[selectedRoute.routeIndex];
    const bounds = new window.google.maps.LatLngBounds();
    route.legs.forEach(leg => leg.steps.forEach(step => step.path.forEach(point => bounds.extend(point))));
    map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
  };


  const showBackButton = view !== 'search';

  return (
      <div className="flex h-dvh w-full bg-background text-foreground flex-col md:flex-row">
        <aside className={`${mobileView === 'map' ? 'hidden' : 'flex'} w-full md:w-[390px] md:border-r md:shadow-2xl md:flex flex-col h-full bg-card`}>
          <header className="p-4 flex items-center gap-4 flex-shrink-0">
            {showBackButton ? (
                <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Volver">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : (
                <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                  <Bus className="h-5 w-5"/>
                </div>
            )}
            <h1 className="text-xl font-medium tracking-tight flex-1">{getHeaderTitle()}</h1>
            {view !== 'search' && (
              <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileView('map')}>
                  <MapIcon className="h-5 w-5" />
              </Button>
            )}
          </header>
          <Separator />
          
          <main className="flex-1 overflow-y-auto p-4 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {view === 'search' && (
                <RouteSearchForm
                    isGoogleMapsLoaded={isGoogleMapsLoaded}
                    onSearch={handleSearch} 
                    onLocationObtained={setCurrentUserLocation} 
                    isApiChecking={apiStatus === 'checking'}
                    isApiError={apiStatus === 'error'}
                />
              )}
              {view === 'options' && (
                <RouteOptionsList 
                  routes={routeOptions} 
                  onSelectRoute={handleSelectRoute}
                  arrivals={busArrivals}
                />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel 
                  route={selectedRoute}
                  busLocations={busLocations}
                  googleMapsApiKey={googleMapsApiKey}
                  onCenterOnRoute={handleCenterOnRoute}
                />
              )}
          </main>
        </aside>
        
        <div className={`${mobileView === 'panel' && view !== 'search' ? 'hidden' : 'flex'} flex-1 md:flex h-full w-full relative`}>
            {mobileView === 'map' && view !== 'search' && (
              <Button variant="secondary" size="icon" onClick={handleBack} aria-label="Volver al panel" className="absolute top-4 left-4 z-10 shadow-lg md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <MapView 
              isLoaded={isGoogleMapsLoaded}
              directions={directionsResult}
              routeIndex={selectedRoute?.routeIndex}
              userLocation={currentUserLocation}
              busLocations={busLocations}
              view={view}
              mapRef={mapRef}
            />
        </div>
      </div>
  );
}
    

    

"use client";

import { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Bus, ArrowLeft, Loader2, Map } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getBusLocation, BusLocation, checkApiConnection } from '@/lib/stm-api';


const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";
const LIBRARIES: ("places" | "marker")[] = ['places', 'marker'];

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<google.maps.DirectionsRoute | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);
  const [selectedLineDestination, setSelectedLineDestination] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [lastBusUpdate, setLastBusUpdate] = useState<Date | null>(null);
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
    let pollingActive = false;

    const fetchBusLocations = async () => {
      if (!selectedRoute || apiStatus !== 'connected') {
        setBusLocations([]);
        return;
      }
      const firstTransitStep = selectedRoute.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
      if (!firstTransitStep) {
        setBusLocations([]);
        return;
      }
      const lineName = firstTransitStep.transit?.line.short_name;
      if (!lineName) {
         setBusLocations([]);
         return;
      }
      try {
        const locations = await getBusLocation(lineName, selectedLineDestination ?? undefined);
        setBusLocations(locations);
        setLastBusUpdate(new Date());
      } catch (error) {
        console.error(`Error fetching locations for line ${lineName}:`, error);
        setBusLocations([]);
      }
    };

    const startPolling = () => {
      if (!pollingActive) {
        pollingActive = true;
        fetchBusLocations();
        intervalId = setInterval(fetchBusLocations, 15000); // 15s
      }
    };
    const stopPolling = () => {
      pollingActive = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };
    if (view === 'details' && selectedRoute) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      startPolling();
    } else {
      setBusLocations([]);
      stopPolling();
    }
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [view, selectedRoute, selectedLineDestination, apiStatus]);

  useEffect(() => {
    // Location watching is now handled within the search form to streamline the process
    // but we can still watch it here if needed for other components in the future.
    let watchId: number | null = null;

    if (navigator.geolocation) { 
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            // Set the location once for all components that might need it.
            if (!currentUserLocation) {
              setCurrentUserLocation(newLocation);
            }
          },
          (error) => {
            console.error("Error watching position:", error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [currentUserLocation]); // Only run once to set initial location

  const handleSearch = (origin: string, destination: string) => {
    let originParam: string | google.maps.LatLngLiteral = origin;
    if (origin === 'Mi ubicación actual') {
      if (!currentUserLocation) {
        toast({
            variant: "destructive",
            title: "Error de ubicación",
            description: "No se pudo obtener tu ubicación. Por favor, habilita los permisos e intenta de nuevo.",
        });
        return;
      }
      originParam = currentUserLocation;
    }

    if (!originParam || !destination) return;
    
    setDirectionsResponse(null);
    setSelectedRoute(null);
    setSelectedRouteIndex(0);
    setSelectedStopId(null);
    setSelectedLineDestination(null);
    setIsLoading(true);
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: originParam,
        destination: destination,
        travelMode: window.google.maps.TravelMode.TRANSIT,
        transitOptions: {
          modes: [window.google.maps.TransitMode.BUS],
        },
        provideRouteAlternatives: true,
        region: 'UY',
        language: 'es'
      },
      (result, status) => {
        setIsLoading(false);
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResponse(result);
          setView('options');
          setMobileView('panel');
        } else {
          console.error(`Error fetching directions, status: ${status}`);
          let description = "No se pudo calcular la ruta. Intenta con otras direcciones.";
          if (status === 'NOT_FOUND' || status === 'ZERO_RESULTS') {
            description = "No se encontraron rutas de ómnibus para el origen y destino ingresados. Verifica las direcciones o prueba con puntos cercanos.";
          }
          toast({
            variant: "destructive",
            title: "Error al buscar ruta",
            description: description,
          });
        }
      }
    );
  };

  const handleSelectRoute = (route: google.maps.DirectionsRoute, index: number, stopId: number | null, lineDestination: string | null) => {
    setSelectedRoute(route);
    setSelectedRouteIndex(index);
    setSelectedStopId(stopId);
    setSelectedLineDestination(lineDestination);
    setView('details');
    setMobileView('panel');
  };

  const handleBack = () => {
    if (mobileView === 'map') {
      setMobileView('panel');
      return;
    }
    if (view === 'details') {
      setView('options');
      setSelectedRoute(null);
      setSelectedStopId(null);
      setSelectedLineDestination(null);
      setBusLocations([]);
    } else if (view === 'options') {
      setView('search');
      setDirectionsResponse(null);
    }
  };
  
  const getHeaderTitle = () => {
    switch(view) {
      case 'search': return '¿A dónde vamos?';
      case 'options': return 'Opciones de trayecto';
      case 'details': return 'Detalles del viaje';
      default: return 'BusesUY';
    }
  }

  const showBackButton = view !== 'search';

  return (
      <div className="flex h-dvh w-full bg-background text-foreground flex-col md:flex-row">
        <aside className={`${mobileView === 'map' ? 'hidden' : 'flex'} w-full md:w-[390px] md:border-r md:shadow-2xl md:flex flex-col h-full`}>
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
            <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileView('map')}>
                <Map className="h-5 w-5" />
            </Button>
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
              {view === 'options' && directionsResponse && (
                <RouteOptionsList 
                  routes={directionsResponse.routes} 
                  onSelectRoute={handleSelectRoute}
                  isApiConnected={apiStatus === 'connected'}
                />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel 
                  route={selectedRoute}
                  busLocations={busLocations}
                  isGoogleMapsLoaded={isGoogleMapsLoaded}
                  directionsResponse={directionsResponse}
                  routeIndex={selectedRouteIndex}
                  userLocation={currentUserLocation}
                  lastBusUpdate={lastBusUpdate}
                />
              )}
          </main>
        </aside>
        
        <div className={`${mobileView === 'panel' ? 'hidden' : 'flex'} flex-1 md:flex h-full w-full relative`}>
            {mobileView === 'map' && view !== 'search' && (
              <Button variant="secondary" size="icon" onClick={handleBack} aria-label="Volver al panel" className="absolute top-4 left-4 z-10 shadow-lg">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <MapView 
              isLoaded={isGoogleMapsLoaded}
              directionsResponse={directionsResponse} 
              routeIndex={selectedRouteIndex}
              userLocation={currentUserLocation}
              selectedRoute={selectedRoute}
              busLocations={busLocations}
              view={view}
            />
        </div>
      </div>
  );
}
    

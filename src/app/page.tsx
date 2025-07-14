
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Bus, ArrowLeft, Loader2, Map as MapIcon, ArrowRight, List } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getBusLocation, BusLocation, checkApiConnection } from '@/lib/stm-api';
import type { Place } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LIBRARIES: ("places" | "marker" | "geometry")[] = ['places', 'marker', 'geometry'];

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');
  const [routes, setRoutes] = useState<google.maps.DirectionsResult[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
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

  // Effect to update bus locations when routes are available
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateRealtimeData = async () => {
      if (view === 'search' || routes.length === 0 || apiStatus !== 'connected') {
        setBusLocations([]);
        return;
      }
      
      // Extract all unique bus lines from all route options
      const linesToTrack: { line: string; destination: string | null }[] = [];
      routes.forEach(route => {
        route.routes[0]?.legs.forEach(leg => {
          leg.steps.forEach(step => {
            if (step.travel_mode === 'TRANSIT' && step.transit?.line.vehicle.type === 'BUS') {
              const line = step.transit.line.short_name;
              const destination = step.transit.line.headsign;
              if (line && !linesToTrack.some(l => l.line === line && l.destination === destination)) {
                linesToTrack.push({ line, destination });
              }
            }
          });
        });
      });

      if (linesToTrack.length > 0) {
        try {
          const locations = await getBusLocation(linesToTrack);
          setBusLocations(locations);
        } catch (error) {
          console.error(`Error fetching real-time data:`, error);
          setBusLocations([]);
        }
      } else {
        setBusLocations([]);
      }
    };

    if (view !== 'search' && routes.length > 0) {
      updateRealtimeData(); // Initial fetch
      intervalId = setInterval(updateRealtimeData, 20000); // Refresh every 20 seconds
    } else {
      setBusLocations([]);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [view, routes, apiStatus]);


  useEffect(() => {
    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentUserLocation(newLocation);
        },
        (error) => {
          console.log(`Error watching position: ${error.message}`);
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
  }, []);

  const handleSearch = async (origin: Place, destination: Place) => {
    if (!origin.location || !destination.location) return;
    
    setRoutes([]);
    setSelectedRoute(null);
    setBusLocations([]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin.location,
          destination: destination.location,
        }),
      });
      
      const result = await response.json();

      if (!response.ok) {
        console.error("Server error details:", result);
        throw new Error(`Server responded with ${response.status}`);
      }
      
      if (result.routes && result.routes.length > 0) {
        // The Routes API returns an array of routes. We need to wrap each route
        // in a DirectionsResult-like structure for compatibility with our components.
        const directionsResults: google.maps.DirectionsResult[] = result.routes.map((route: any) => ({
          geocoded_waypoints: result.geocoded_waypoints,
          routes: [route],
          request: result.request, // This might not be perfect but good enough for now
        }));
        
        setRoutes(directionsResults);
        setView('options');
        setMobileView('panel');
      } else {
        console.error('No routes found from Routes API', result);
        setRoutes([]);
        toast({
          variant: "destructive",
          title: "Ruta no encontrada",
          description: "No se pudieron encontrar rutas de autobús para el origen y destino seleccionados. Intenta con otras direcciones.",
        });
      }
    } catch(error) {
       console.error('Error fetching from new /api/routes endpoint:', error);
       setRoutes([]);
       toast({
        variant: "destructive",
        title: "Error de Búsqueda",
        description: "Ocurrió un error al buscar la ruta. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRouteSelect = (route: google.maps.DirectionsResult) => {
    setSelectedRoute(route);
    setView('details');
    setMobileView('panel');
  };

  const handleBack = () => {
    if (mobileView === 'map' && (view === 'options' || view === 'details')) {
      setMobileView('panel');
      return;
    }
    
    if (view === 'details') {
      setView('options');
      setSelectedRoute(null);
    } else if (view === 'options') {
      setView('search');
      setRoutes([]);
      setBusLocations([]);
    }
  };
  
  const getHeaderTitle = () => {
    switch(view) {
      case 'search': return 'BUSCAR VIAJE';
      case 'options': return 'OPCIONES DE TRAYECTO';
      case 'details': return `DETALLES DE LA RUTA`;
      default: return 'BusesUY';
    }
  }

  const showBackButton = view !== 'search';

  if (isMobile === undefined) {
    return null; // or a loading skeleton
  }

  return (
      <div className="flex h-dvh w-full bg-background text-foreground flex-col md:flex-row">
        <aside className={`${isMobile && mobileView === 'map' ? 'hidden' : 'flex'} w-full md:w-[390px] md:border-r md:shadow-2xl md:flex flex-col h-full`}>
          <header className="p-4 flex items-center gap-4 flex-shrink-0">
            {showBackButton ? (
              <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Volver">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-sm font-semibold tracking-tight uppercase flex-1">{getHeaderTitle()}</h1>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 flex-1">
                <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                  <Bus className="h-5 w-5" />
                </div>
                <h1 className="text-sm font-semibold tracking-tight uppercase">{getHeaderTitle()}</h1>
              </div>
            )}
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
                  onSearch={handleSearch} 
                  isGoogleMapsLoaded={isGoogleMapsLoaded}
                  currentUserLocation={currentUserLocation}
                />
              )}
              {view === 'options' && (
                  <RouteOptionsList
                    routes={routes}
                    onRouteSelect={handleRouteSelect}
                    isApiConnected={apiStatus === 'connected'}
                    busLocations={busLocations}
                  />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel
                  route={selectedRoute}
                  isApiConnected={apiStatus === 'connected'}
                  busLocations={busLocations}
                />
              )}
          </main>
        </aside>
        
        <div className={`${isMobile && mobileView === 'panel' ? 'hidden' : 'flex'} flex-1 md:flex h-full w-full relative`}>
            {isMobile && mobileView === 'map' && view !== 'search' && (
              <div className="absolute top-4 left-4 right-4 z-10 shadow-lg flex justify-between">
                <Button variant="secondary" size="icon" onClick={() => setMobileView('panel')} aria-label="Volver al panel">
                  <List className="h-5 w-5" />
                </Button>
                <Button variant="secondary" onClick={handleBack} aria-label="Volver a la búsqueda">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    <span>{view === 'details' ? 'Ver Opciones' : 'Nueva Búsqueda'}</span>
                </Button>
              </div>
            )}
            <MapView 
              isLoaded={isGoogleMapsLoaded}
              directions={selectedRoute || routes[0]}
              userLocation={currentUserLocation}
              busLocations={busLocations}
              selectedRoute={selectedRoute}
            />
        </div>
      </div>
  );
}

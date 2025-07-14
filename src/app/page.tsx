"use client";

import { useState, useEffect, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Bus, ArrowLeft, Loader2, Map, ArrowRight } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getBusLocation, BusLocation, checkApiConnection, getLineRoute, getAllBusStops, StmBusStop } from '@/lib/stm-api';
import type { StmLineRoute, StmInfo, Place } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LIBRARIES: ("places" | "marker" | "geometry")[] = ['places', 'marker', 'geometry'];

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<google.maps.DirectionsRoute | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [selectedRouteStmInfo, setSelectedRouteStmInfo] = useState<StmInfo[]>([]);
  const [lineRoutes, setLineRoutes] = useState<Record<string, StmLineRoute | null>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [allStops, setAllStops] = useState<StmBusStop[]>([]);

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
            // Pre-load all bus stops for faster lookups later
            getAllBusStops().then(setAllStops).catch(err => {
              console.error("Failed to preload bus stops", err);
              toast({
                  variant: "destructive",
                  title: "Error de datos",
                  description: "No se pudieron cargar los datos de las paradas de ómnibus.",
              });
            });
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

  // This effect will be responsible for fetching real-time bus locations for the selected route
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const updateRealtimeBusLocations = async () => {
        if (view !== 'details' || !selectedRoute || apiStatus !== 'connected' || selectedRouteStmInfo.length === 0) {
            setBusLocations([]);
            return;
        }

        const linesToFetch = selectedRouteStmInfo
            .map(info => ({
                line: info.line,
                destination: info.lineDestination
            }))
            .filter(item => item.line);

        if (linesToFetch.length > 0) {
            try {
                const locations = await getBusLocation(linesToFetch);
                setBusLocations(locations);
            } catch (error) {
                console.error("Error fetching real-time bus locations:", error);
                setBusLocations([]);
            }
        }
    };
    
    updateRealtimeBusLocations();
    intervalId = setInterval(updateRealtimeBusLocations, 20000); // Refresh every 20 seconds

    return () => {
        if (intervalId) clearInterval(intervalId);
    };
}, [view, selectedRoute, selectedRouteStmInfo, apiStatus]);


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
          if (error.code === error.PERMISSION_DENIED) {
            console.log("El usuario denegó la solicitud de geolocalización.");
          } else {
            console.log(`Error watching position: ${error.message}`);
          }
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
    if (!origin.location || !destination.location) {
        toast({
            variant: "destructive",
            title: "Error de búsqueda",
            description: "Por favor, selecciona un origen y destino válidos desde las sugerencias.",
        });
        return;
    }
    
    setDirectionsResponse(null);
    setSelectedRoute(null);
    setSelectedRouteIndex(0);
    setSelectedRouteStmInfo([]);
    setLineRoutes({});
    setIsLoading(true);

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: origin.location, destination: destination.location }),
      });
      
      const result = await response.json();

      if (!response.ok) {
        console.error("Server error details:", result);
        throw new Error(result.details || `Server responded with ${response.status}`);
      }
      
      if (result.routes && result.routes.length > 0) {
        setDirectionsResponse(result);
        setView('options');
        setMobileView('panel');
      } else {
        toast({
          variant: "destructive",
          title: "Ruta no encontrada",
          description: "No se encontraron rutas de ómnibus para el origen y destino ingresados. Verifica las direcciones o prueba con puntos cercanos.",
        });
      }
    } catch (error) {
      console.error("Failed to fetch directions:", error);
      toast({
        variant: "destructive",
        title: "Error al buscar ruta",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado al buscar la ruta. Por favor, intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRoute = async (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => {
    setSelectedRoute(route);
    setSelectedRouteIndex(index);
    setSelectedRouteStmInfo(stmInfo);

    if (apiStatus === 'connected') {
        const linesWithInfo = stmInfo.map(info => info.line).filter((line): line is string => line !== null);
        const uniqueLines = [...new Set(linesWithInfo)];

        const lineRoutePromises = uniqueLines.map(line => getLineRoute(line));
        const results = await Promise.all(lineRoutePromises);
        
        const newLineRoutes: Record<string, StmLineRoute | null> = {};
        uniqueLines.forEach((line, i) => {
            newLineRoutes[line] = results[i];
        });
        setLineRoutes(newLineRoutes);
    }

    setView('details');
    setMobileView('panel');
  };

  const handleBack = () => {
    if (mobileView === 'map' && view === 'details') {
      setMobileView('panel');
      return;
    }
    if (view === 'details') {
      setView('options');
      setSelectedRoute(null);
      setSelectedRouteStmInfo([]);
      setBusLocations([]);
      setLineRoutes({});
      setMobileView('panel');
    } else if (view === 'options') {
      setView('search');
      setDirectionsResponse(null);
    }
  };
  
  const getHeaderTitle = () => {
    switch(view) {
      case 'search': return '¿A DÓNDE VAMOS?';
      case 'options': return 'OPCIONES DE TRAYECTO';
      case 'details': return 'DETALLES DEL VIAJE';
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
                <Map className="h-5 w-5" />
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
                    currentUserLocation={currentUserLocation}
                />
              )}
              {view === 'options' && directionsResponse && (
                <RouteOptionsList 
                  routes={directionsResponse.routes} 
                  onSelectRoute={handleSelectRoute}
                  isApiConnected={apiStatus === 'connected'}
                  allStops={allStops}
                />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel 
                  route={selectedRoute}
                  stmInfo={selectedRouteStmInfo}
                  busLocations={busLocations}
                  userLocation={currentUserLocation}
                />
              )}
          </main>
        </aside>
        
        <div className={`${isMobile && mobileView === 'panel' ? 'hidden' : 'flex'} flex-1 md:flex h-full w-full relative`}>
            {isMobile && mobileView === 'map' && view !== 'search' && (
              <div className="absolute top-4 left-4 right-4 z-10 shadow-lg flex justify-between">
                <Button variant="secondary" size="icon" onClick={handleBack} aria-label="Volver al panel">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                 {view === 'details' && (
                    <Button variant="secondary" onClick={() => setMobileView('panel')} className="bg-background hover:bg-muted">
                        Ver detalles
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                )}
              </div>
            )}
            <MapView 
              isLoaded={isGoogleMapsLoaded}
              directionsResponse={directionsResponse} 
              routeIndex={selectedRouteIndex}
              userLocation={currentUserLocation}
              selectedRoute={selectedRoute}
              busLocations={busLocations}
              lineRoutes={lineRoutes}
              view={view}
              allStops={allStops}
              stmInfo={selectedRouteStmInfo}
            />
        </div>
      </div>
  );
}

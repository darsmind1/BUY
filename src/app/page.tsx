
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
import { getBusLocation, BusLocation, checkApiConnection, getLineRoute } from '@/lib/stm-api';
import type { StmLineRoute, StmInfo, ArrivalInfo } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";
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

  // Effect to update bus locations for the options or details view
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
  
    const updateRealtimeData = async () => {
      // Don't run if we are in search view, api is down, or maps aren't loaded
      if (view === 'search' || apiStatus !== 'connected' || !isGoogleMapsLoaded || !directionsResponse) {
        setBusLocations([]);
        return;
      }
      
      // Collect all unique lines from all route options
      const linesToFetch = directionsResponse.routes.flatMap(route => 
          route.legs[0].steps
              .filter(step => step.travel_mode === 'TRANSIT' && step.transit?.line.short_name)
              .map(step => ({ line: step.transit!.line.short_name!, destination: step.transit!.headsign }))
      );
      
      const uniqueLines = Array.from(new Map(linesToFetch.map(item => [item.line, item])).values());

      if (uniqueLines.length === 0) {
        setBusLocations([]);
        return;
      }
  
      try {
        const locations = await getBusLocation(uniqueLines);
        setBusLocations(locations);
      } catch (error) {
        console.error(`Error fetching real-time data:`, error);
        setBusLocations([]); // Clear locations on error to avoid stale data
      }
    };
  
    // Run only when we have options or details to show
    if (view === 'options' || view === 'details') {
      updateRealtimeData(); 
      intervalId = setInterval(updateRealtimeData, 20000); // Update every 20 seconds
    } else {
      setBusLocations([]);
    }
  
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [view, apiStatus, isGoogleMapsLoaded, directionsResponse]);


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
    setSelectedRouteStmInfo([]);
    setLineRoutes({});
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

  const handleSelectRoute = async (route: google.maps.DirectionsRoute, index: number, stmInfo: StmInfo[]) => {
    setSelectedRoute(route);
    setSelectedRouteIndex(index);
    setSelectedRouteStmInfo(stmInfo);

    if (apiStatus === 'connected') {
        const lineRoutePromises = stmInfo.map(info => info.line ? getLineRoute(info.line) : Promise.resolve(null));
        const results = await Promise.all(lineRoutePromises);
        
        const newLineRoutes: Record<string, StmLineRoute | null> = {};
        stmInfo.forEach((info, i) => {
            if (info.line) {
                newLineRoutes[info.line] = results[i];
            }
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
      // Don't clear bus locations, they are still relevant for options view
      setLineRoutes({});
      setMobileView('panel');
    } else if (view === 'options') {
      setView('search');
      setDirectionsResponse(null);
      setBusLocations([]); // Clear locations when going back to search
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
                  busLocations={busLocations}
                />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel 
                  route={selectedRoute}
                  busLocations={busLocations}
                  isGoogleMapsLoaded={isGoogleMapsLoaded}
                  userLocation={currentUserLocation}
                  stmInfo={selectedRouteStmInfo}
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
            />
        </div>
      </div>
  );
}

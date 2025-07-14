
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Bus, ArrowLeft, Loader2, Map as MapIcon, ArrowRight, List } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteStopsList from '@/components/route-stops-list'; // NEW
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getBusLocation, BusLocation, checkApiConnection, getLineRoute } from '@/lib/stm-api';
import type { StmLineRoute } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";
const LIBRARIES: ("places" | "marker" | "geometry")[] = ['places', 'marker', 'geometry'];

export default function Home() {
  const [view, setView] = useState<'search' | 'details'>('search');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');
  const [lineRoute, setLineRoute] = useState<StmLineRoute | null>(null);
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

  // Effect to update bus locations when a line route is selected
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
  
    const updateRealtimeData = async () => {
      if (view !== 'details' || apiStatus !== 'connected' || !lineRoute) {
        setBusLocations([]);
        return;
      }
      
      try {
        const locations = await getBusLocation([{ line: lineRoute.line, destination: lineRoute.description }]);
        setBusLocations(locations);
      } catch (error) {
        console.error(`Error fetching real-time data:`, error);
        setBusLocations([]);
      }
    };
  
    if (view === 'details' && lineRoute) {
      updateRealtimeData(); 
      intervalId = setInterval(updateRealtimeData, 20000); 
    } else {
      setBusLocations([]);
    }
  
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [view, apiStatus, lineRoute]);


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

  const handleSearch = async (line: string) => {
    if (!line) return;
    
    setLineRoute(null);
    setBusLocations([]);
    setIsLoading(true);

    const routeData = await getLineRoute(line);

    setIsLoading(false);
    if (routeData) {
      setLineRoute(routeData);
      setView('details');
      setMobileView('panel');
    } else {
      toast({
        variant: "destructive",
        title: "Línea no encontrada",
        description: `No se pudo encontrar el recorrido para la línea ${line}. Por favor, verifica el número e intenta de nuevo.`,
      });
    }
  };

  const handleBack = () => {
    if (mobileView === 'map' && view === 'details') {
      setMobileView('panel');
      return;
    }
    setView('search');
    setLineRoute(null);
    setBusLocations([]);
  };
  
  const getHeaderTitle = () => {
    switch(view) {
      case 'search': return 'BUSCAR LÍNEA';
      case 'details': return `LÍNEA ${lineRoute?.line || ''}`;
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
                    isApiChecking={apiStatus === 'checking'}
                    isApiError={apiStatus === 'error'}
                />
              )}
              {view === 'details' && lineRoute && (
                <RouteStopsList 
                  lineRoute={lineRoute}
                  isApiConnected={apiStatus === 'connected'}
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
              </div>
            )}
            <MapView 
              isLoaded={isGoogleMapsLoaded}
              userLocation={currentUserLocation}
              busLocations={busLocations}
              lineRoute={lineRoute}
              view={view}
            />
        </div>
      </div>
  );
}

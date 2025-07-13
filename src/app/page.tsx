
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
import { getBusLocation, BusLocation, checkApiConnection, findDirectBusRoutes, StmRouteOption } from '@/lib/stm-api';


const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";
const LIBRARIES: ("places" | "marker")[] = ['places', 'marker'];

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeOptions, setRouteOptions] = useState<StmRouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<StmRouteOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
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
      if (!selectedRoute || apiStatus !== 'connected') {
        setBusLocations([]);
        return;
      }
      
      try {
        const locations = await getBusLocation(selectedRoute.line.toString(), selectedRoute.destination);
        setBusLocations(locations);
      } catch (error) {
        console.error(`Error fetching locations for line ${selectedRoute.line}:`, error);
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
  }, []);

  const geocodeAddress = (address: string | google.maps.LatLngLiteral): Promise<google.maps.LatLngLiteral> => {
    return new Promise((resolve, reject) => {
        if (typeof address !== 'string') {
            resolve(address); // It's already a lat/lng literal
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address, region: 'UY' }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                resolve({ lat: location.lat(), lng: location.lng() });
            } else {
                reject(new Error(`Geocoding failed for ${address}: ${status}`));
            }
        });
    });
  };

  const handleSearch = async (origin: string, destination: string) => {
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
    setRouteOptions([]);
    setIsLoading(true);

    try {
        const [originCoords, destinationCoords] = await Promise.all([
            geocodeAddress(originParam),
            geocodeAddress(destination),
        ]);

        const stmRoutes = await findDirectBusRoutes(originCoords, destinationCoords);

        if (stmRoutes.length === 0) {
             toast({
                variant: "destructive",
                title: "No se encontraron rutas",
                description: "No se encontraron líneas de ómnibus directas para el origen y destino ingresados.",
             });
        } else {
            setRouteOptions(stmRoutes);
            setView('options');
            setMobileView('panel');
        }
    } catch (error) {
        console.error('Error during route search:', error);
        toast({
            variant: "destructive",
            title: "Error al buscar ruta",
            description: "No se pudo calcular la ruta. Verifica las direcciones e intenta de nuevo.",
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleSelectRoute = (route: StmRouteOption) => {
    setSelectedRoute(route);

    // Now, get directions for walking to the stop and for the bus route itself
    if (currentUserLocation && window.google) {
        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
            {
                origin: currentUserLocation,
                destination: {
                    lat: route.departureStop.location.coordinates[1],
                    lng: route.departureStop.location.coordinates[0],
                },
                travelMode: window.google.maps.TravelMode.WALKING,
            },
            (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                    setDirectionsResponse(result);
                    setView('details');
                    setMobileView('panel');
                } else {
                    console.error(`Error fetching walking directions: ${status}`);
                    // Fallback to showing details without walking path
                    setDirectionsResponse(null);
                    setView('details');
                    setMobileView('panel');
                }
            }
        );
    } else {
        // Can't get walking directions, just show details
        setDirectionsResponse(null);
        setView('details');
        setMobileView('panel');
    }
  };

  const handleBack = () => {
    if (mobileView === 'map') {
      setMobileView('panel');
      return;
    }
    if (view === 'details') {
      setView('options');
      setSelectedRoute(null);
      setDirectionsResponse(null);
      setBusLocations([]);
    } else if (view === 'options') {
      setView('search');
      setRouteOptions([]);
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
              {view === 'options' && (
                <RouteOptionsList 
                  routes={routeOptions} 
                  onSelectRoute={handleSelectRoute}
                  isApiConnected={apiStatus === 'connected'}
                />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel 
                  route={selectedRoute}
                  busLocations={busLocations}
                  isGoogleMapsLoaded={isGoogleMapsLoaded}
                  walkingDirections={directionsResponse}
                  userLocation={currentUserLocation}
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
              stmRoute={selectedRoute}
              walkingDirections={directionsResponse}
              userLocation={currentUserLocation}
              busLocations={busLocations}
              view={view}
            />
        </div>
      </div>
  );
}
    

    
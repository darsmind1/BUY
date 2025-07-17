
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
import { getBusLocation, BusLocation, checkApiConnection, getUpcomingBuses } from '@/lib/stm-api';


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
  const [isBusLoading, setIsBusLoading] = useState(false);
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
    let timeoutId: NodeJS.Timeout | null = null;
    let pollingInterval = 10000; // 10s inicial
    let lastLocations: BusLocation[] = [];
    let retryCount = 0;
    let isFetching = false;
    let pollingActive = false;

    const fetchBusLocations = async () => {
      if (!selectedRoute || apiStatus !== 'connected') {
        setBusLocations([]);
        setIsBusLoading(false);
        return;
      }
      if (isFetching) return;
      isFetching = true;
      setIsBusLoading(true);
      const firstTransitStep = selectedRoute.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
      if (!firstTransitStep) {
        setBusLocations([]);
        setIsBusLoading(false);
        isFetching = false;
        return;
      }
      const lineName = firstTransitStep.transit?.line.short_name;
      if (!lineName) {
         setBusLocations([]);
         setIsBusLoading(false);
         isFetching = false;
         return;
      }
      try {
        const locations = await getBusLocation(lineName, selectedLineDestination ?? undefined);
        setBusLocations(locations);
        setLastBusUpdate(new Date());
        setIsBusLoading(false);
        // Si la ubicación no cambió, aumenta el intervalo
        if (JSON.stringify(locations) === JSON.stringify(lastLocations)) {
          pollingInterval = Math.min(pollingInterval + 5000, 30000); // hasta 30s
        } else {
          pollingInterval = 10000; // vuelve a 10s si hay cambios
        }
        lastLocations = locations;
        retryCount = 0;
      } catch (error) {
        retryCount++;
        setIsBusLoading(false);
        if (retryCount <= 3) {
          pollingInterval = Math.min(2 ** retryCount * 1000, 30000); // backoff exponencial
        } else {
          setBusLocations([]);
        }
      } finally {
        isFetching = false;
        if (pollingActive) {
          timeoutId = setTimeout(fetchBusLocations, pollingInterval);
        }
      }
    };

    const startPolling = () => {
      if (!pollingActive) {
        pollingActive = true;
        fetchBusLocations();
      }
    };
    const stopPolling = () => {
      pollingActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
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
      setIsBusLoading(false);
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

  // Mostrar los dos buses más próximos a la parada de origen
  const [upcomingBusLocations, setUpcomingBusLocations] = useState<BusLocation[]>([]);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(17);

  // Polilínea especial para el tramo Buenos Aires - Ituzaingó
  const tramoEspecial = [
    [-34.90514509476023, -56.19996327179591],
    [-34.90408484172328, -56.20059090870147],
    [-34.904498386030006, -56.20159405486676],
    [-34.903680094215005, -56.201932013200526],
    [-34.904005652157586, -56.203074634243194],
    [-34.905624623823584, -56.20789188162772],
    [-34.90751191734933, -56.2134386898646],
    [-34.9095531370282, -56.21293443457813],
    [-34.91046815008008, -56.210928142243326],
    [-34.90814100554586, -56.20372372884025]
  ];

  // Función para calcular distancia entre dos puntos (Haversine)
  function haversineDistance([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371000; // metros
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function minDistanceToPolyline(point: google.maps.LatLngLiteral, polyline: [number, number][]): number {
    return Math.min(...polyline.map(polyPoint =>
      haversineDistance([point.lng, point.lat], polyPoint)
    ));
  }

  useEffect(() => {
    // Solo buscar los buses próximos si estamos en detalles y hay ruta seleccionada
    const fetchUpcomingBuses = async () => {
      if (view !== 'details' || !selectedRoute || apiStatus !== 'connected') {
        setUpcomingBusLocations([]);
        setMapCenter(null);
        return;
      }
      const firstTransitStep = selectedRoute.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT' && step.transit);
      if (!firstTransitStep) {
        setUpcomingBusLocations([]);
        setMapCenter(null);
        return;
      }
      const lineName = firstTransitStep.transit?.line.short_name;
      const departureStop = firstTransitStep.transit?.departure_stop;
      if (!lineName || !departureStop) {
        setUpcomingBusLocations([]);
        setMapCenter(null);
        return;
      }
      // Centrar el mapa en la parada de origen
      const stopLat = departureStop.location.lat();
      const stopLng = departureStop.location.lng();
      setMapCenter({ lat: stopLat, lng: stopLng });
      setMapZoom(17);
      try {
        // Buscar los próximos arribos (máximo 2)
        const upcoming = await getUpcomingBuses(departureStop.stop_id, [lineName], 2);
        const allBuses = await getBusLocation(lineName);
        console.log('Buses en tiempo real de la línea:', allBuses);
        // Si la parada de destino u origen es Buenos Aires - Ituzaingó, usa el tramo especial
        const isTramoEspecial = (departureStop && (
          departureStop.name?.toLowerCase().includes('buenos aires') ||
          departureStop.name?.toLowerCase().includes('ituzaingó')
        )) || (selectedRoute && selectedRoute.legs[0]?.end_address?.toLowerCase().includes('buenos aires'));

        if (isTramoEspecial) {
          // Sobrescribe el trayecto: fuerza los puntos A y B
          setMapCenter({ lat: -34.90514509476023, lng: -56.19996327179591 }); // Punto A
          setMapZoom(16);
          // Filtra buses en tiempo real sobre el tramo especial
          const busesOnTramo = allBuses.filter(bus => {
            const busLat = bus.location.coordinates[1];
            const busLng = bus.location.coordinates[0];
            const minDist = minDistanceToPolyline({ lat: busLat, lng: busLng }, tramoEspecial);
            return minDist < 200;
          });
          setUpcomingBusLocations(busesOnTramo);
          return; // No sigas con la lógica de Google Directions
        }
        // Si no es el tramo especial, procede con la lógica de Google Directions
        const polyline = selectedRoute?.overview_path || [];
        setDirectionsResponse(null); // Clear previous directions
        setSelectedRoute(null); // Clear previous route
        setMapCenter(null); // Clear previous center
        setMapZoom(17); // Reset zoom

        // Set the destination for the directions service
        let destinationParam: string | google.maps.LatLngLiteral = selectedRoute?.end_address || destination;
        if (destinationParam === 'Mi ubicación actual') {
          if (!currentUserLocation) {
            toast({
                variant: "destructive",
                title: "Error de ubicación",
                description: "No se pudo obtener tu ubicación. Por favor, habilita los permisos e intenta de nuevo.",
            });
            return;
          }
          destinationParam = currentUserLocation;
        }

        directionsService.route(
          {
            origin: originParam,
            destination: destinationParam,
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
      } catch {
        setUpcomingBusLocations([]);
      }
    };
    fetchUpcomingBuses();
  }, [view, selectedRoute, selectedLineDestination, apiStatus, lastBusUpdate, currentUserLocation]);

  // Solo pasar los buses próximos a los componentes de visualización
  const filteredBusLocations = React.useMemo(() => {
    return upcomingBusLocations;
  }, [upcomingBusLocations]);

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
                  busLocations={filteredBusLocations}
                  isGoogleMapsLoaded={isGoogleMapsLoaded}
                  directionsResponse={directionsResponse}
                  routeIndex={selectedRouteIndex}
                  userLocation={currentUserLocation}
                  lastBusUpdate={lastBusUpdate}
                  isBusLoading={isBusLoading}
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
              busLocations={filteredBusLocations}
              view={view}
              center={mapCenter}
              zoom={mapZoom}
              specialPolyline={view === 'details' && selectedRoute == null ? tramoEspecial : undefined}
            />
        </div>
      </div>
  );
}
    

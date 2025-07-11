
"use client";

import { useState, useEffect } from 'react';
import { Bus, ArrowLeft, Loader2 } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useJsApiLoader } from '@react-google-maps/api';
import { useToast } from '@/hooks/use-toast';


const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = ['places'];
const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<google.maps.DirectionsRoute | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const { toast } = useToast();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

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
        region: 'UY'
      },
      (result, status) => {
        setIsLoading(false);
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResponse(result);
          setView('options');
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

  const handleSelectRoute = (route: google.maps.DirectionsRoute, index: number) => {
    setSelectedRoute(route);
    setSelectedRouteIndex(index);
    setView('details');
  };

  const handleBack = () => {
    if (view === 'details') {
      setSelectedRoute(null);
      setView('options');
    } else if (view === 'options') {
      setDirectionsResponse(null);
      setView('search');
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

  return (
      <div className="flex h-dvh w-full bg-background text-foreground">
        <aside className="w-full md:w-[390px] md:border-r md:shadow-2xl flex flex-col h-full">
          <header className="p-4 flex items-center gap-4">
            {view !== 'search' ? (
                <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Volver">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : (
                <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                  <Bus className="h-5 w-5"/>
                </div>
            )}
            <h1 className="text-xl font-medium tracking-tight">{getHeaderTitle()}</h1>
          </header>
          <Separator />
          
          <main className="flex-1 overflow-y-auto p-4 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {view === 'search' && <RouteSearchForm onSearch={handleSearch} onLocationObtained={setCurrentUserLocation} isMapLoaded={isLoaded} />}
              {view === 'options' && directionsResponse && (
                <RouteOptionsList 
                  routes={directionsResponse.routes} 
                  onSelectRoute={handleSelectRoute} 
                />
              )}
              {view === 'details' && selectedRoute && (
                <RouteDetailsPanel 
                  route={selectedRoute}
                />
              )}
          </main>
        </aside>
        
        <div className="flex-1 hidden md:block">
            <MapView 
              isLoaded={isLoaded}
              directionsResponse={directionsResponse} 
              routeIndex={selectedRouteIndex}
              userLocation={currentUserLocation}
            />
        </div>
      </div>
  );
}

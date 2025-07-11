
"use client";

import { useState } from 'react';
import { Bus, ArrowLeft, Loader2 } from 'lucide-react';
import React from 'react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadScript } from '@react-google-maps/api';
import { useToast } from '@/hooks/use-toast';


const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = ['places'];
const googleMapsApiKey = "AIzaSyD1R-HlWiKZ55BMDdv1KP5anE5T5MX4YkU";

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<google.maps.DirectionsRoute & { routeIndex?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();


  const handleSearch = (origin: string, destination: string) => {
    if (!origin || !destination) return;

    setIsLoading(true);
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: origin,
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
    setSelectedRoute({...route, routeIndex: index});
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
    <LoadScript
      googleMapsApiKey={googleMapsApiKey}
      libraries={libraries}
    >
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
              {view === 'search' && <RouteSearchForm onSearch={handleSearch} />}
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
            directionsResponse={directionsResponse} 
            selectedRouteIndex={selectedRoute ? selectedRoute.routeIndex : 0}
          />
        </div>
      </div>
    </LoadScript>
  );
}

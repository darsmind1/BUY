"use client";

import { useState } from 'react';
import { Bus, ArrowLeft } from 'lucide-react';

import RouteSearchForm from '@/components/route-search-form';
import RouteOptionsList from '@/components/route-options-list';
import RouteDetailsPanel from '@/components/route-details-panel';
import MapView from '@/components/map-view';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// Mock data for routes
const mockRoutes = [
  {
    id: 1,
    name: "Ruta 1",
    duration: 25,
    buses: ["183"],
    steps: [
      { type: 'walk', instruction: 'Camina 300m a la parada Av. 8 de Octubre', duration: 4 },
      { type: 'bus', instruction: 'Toma el 183 hacia Pocitos', duration: 15, bus: '183' },
      { type: 'walk', instruction: 'Camina 400m a tu destino', duration: 6 },
    ],
    arrivals: ["En 2 min", "En 14 min"],
    busPositions: [{ id: 'bus-183-1', top: '25%', left: '20%' }],
  },
  {
    id: 2,
    name: "Ruta 2",
    duration: 35,
    buses: ["149", "17"],
    steps: [
      { type: 'walk', instruction: 'Camina 100m a la parada Av. Italia', duration: 2 },
      { type: 'bus', instruction: 'Toma el 149 hacia Ciudad Vieja', duration: 10, bus: '149' },
      { type: 'bus', instruction: 'Transbordo en Av. 18 de Julio al 17', duration: 15, bus: '17' },
      { type: 'walk', instruction: 'Camina 250m a tu destino', duration: 8 },
    ],
    arrivals: ["149: En 5 min", "17: En 8 min"],
    busPositions: [{ id: 'bus-149-1', top: '55%', left: '50%'}, {id: 'bus-17-1', top: '70%', left: '60%'}],
  },
  {
    id: 3,
    name: "Ruta 3",
    duration: 28,
    buses: ["CA1"],
    steps: [
      { type: 'walk', instruction: 'Camina 50m a la parada Plaza Independencia', duration: 1 },
      { type: 'bus', instruction: 'Toma el CA1 hacia Tres Cruces', duration: 20, bus: 'CA1' },
      { type: 'walk', instruction: 'Camina 350m a tu destino', duration: 7 },
    ],
    arrivals: ["En 1 min", "En 9 min"],
    busPositions: [{ id: 'bus-CA1-1', top: '40%', left: '80%' }],
  }
];

export default function Home() {
  const [view, setView] = useState<'search' | 'options' | 'details'>('search');
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  const handleSearch = (origin: string, destination: string) => {
    // Simulate API call
    console.log(`Searching from ${origin} to ${destination}`);
    setRoutes(mockRoutes);
    setView('options');
  };

  const handleSelectRoute = (route: any) => {
    setSelectedRoute(route);
    setView('details');
  };

  const handleBack = () => {
    if (view === 'details') {
      setSelectedRoute(null);
      setView('options');
    } else if (view === 'options') {
      setRoutes([]);
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
      <div className="flex-1 hidden md:block">
         <MapView route={selectedRoute} />
      </div>

      <aside className="w-full md:w-[390px] md:border-l md:shadow-2xl flex flex-col h-full">
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
        
        <main className="flex-1 overflow-y-auto p-4">
            {view === 'search' && <RouteSearchForm onSearch={handleSearch} />}
            {view === 'options' && <RouteOptionsList routes={routes} onSelectRoute={handleSelectRoute} />}
            {view === 'details' && selectedRoute && <RouteDetailsPanel route={selectedRoute} />}
        </main>
      </aside>
    </div>
  );
}
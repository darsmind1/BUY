
"use client";

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, LocateFixed, ArrowRight } from 'lucide-react';
import { Autocomplete } from '@react-google-maps/api';

interface RouteSearchFormProps {
  onSearch: (origin: string, destination: string) => void;
  isGoogleMapsLoaded: boolean;
  currentUserLocation: google.maps.LatLngLiteral | null;
}

const autocompleteOptions = {
    componentRestrictions: { country: "uy" },
    fields: ["formatted_address", "geometry", "name"],
    strictBounds: false,
};

export default function RouteSearchForm({ onSearch, isGoogleMapsLoaded, currentUserLocation }: RouteSearchFormProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const originRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const [originAutocomplete, setOriginAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [destinationAutocomplete, setDestinationAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (origin && destination) {
        onSearch(origin, destination);
    }
  };

  const handleUseCurrentLocation = () => {
    if (currentUserLocation) {
        setOrigin(`(${currentUserLocation.lat.toFixed(5)}, ${currentUserLocation.lng.toFixed(5)})`);
    }
  };
  
  const onOriginLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setOriginAutocomplete(autocomplete);
  };
  
  const onDestinationLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setDestinationAutocomplete(autocomplete);
  };
  
  const onOriginPlaceChanged = () => {
    if (originAutocomplete !== null) {
      const place = originAutocomplete.getPlace();
      setOrigin(place.formatted_address || '');
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  };

  const onDestinationPlaceChanged = () => {
    if (destinationAutocomplete !== null) {
      const place = destinationAutocomplete.getPlace();
      setDestination(place.formatted_address || '');
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  };

  if (!isGoogleMapsLoaded) {
    return <p>Cargando mapa...</p>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                        <Autocomplete
                          onLoad={onOriginLoad}
                          onPlaceChanged={onOriginPlaceChanged}
                          options={autocompleteOptions}
                        >
                            <Input 
                                ref={originRef}
                                value={origin}
                                onChange={(e) => setOrigin(e.target.value)}
                                className="border-0 bg-transparent shadow-none pl-2 focus-visible:ring-0 h-9"
                                placeholder="Punto de partida"
                                required
                            />
                        </Autocomplete>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleUseCurrentLocation}>
                        <LocateFixed className="h-5 w-5 text-muted-foreground" />
                    </Button>
                </div>
                 <div className="pl-5">
                   <div className="h-px bg-border ml-3" />
                 </div>
                <div className="flex items-center gap-3">
                     <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                     <div className="flex-1">
                        <Autocomplete
                          onLoad={onDestinationLoad}
                          onPlaceChanged={onDestinationPlaceChanged}
                          options={autocompleteOptions}
                        >
                            <Input 
                                ref={destinationRef}
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                className="border-0 bg-transparent shadow-none pl-2 focus-visible:ring-0 h-9"
                                placeholder="Destino"
                                required
                            />
                        </Autocomplete>
                     </div>
                </div>
            </CardContent>
        </Card>
        
        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12 text-base font-semibold">
          <Search className="mr-2 h-5 w-5" />
          Buscar Viaje
        </Button>
      </form>
    </div>
  );
}

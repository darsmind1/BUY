
"use client";

import { useState, type FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, MapPin, LocateFixed, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

interface RouteSearchFormProps {
  apiKey: string;
  onSearch: (origin: string, destination: string) => void;
  onLocationObtained: (location: google.maps.LatLngLiteral) => void;
  isApiChecking: boolean;
  isApiError: boolean;
}

const libraries: ("places")[] = ['places'];

const autocompleteOptions = {
    componentRestrictions: { country: "uy" },
    fields: ["formatted_address"],
};

export default function RouteSearchForm({ apiKey, onSearch, onLocationObtained, isApiChecking, isApiError }: RouteSearchFormProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const { toast } = useToast();

  const [originAutocomplete, setOriginAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [destinationAutocomplete, setDestinationAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

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
      console.error('Autocomplete is not loaded yet!');
    }
  };

  const onDestinationPlaceChanged = () => {
    if (destinationAutocomplete !== null) {
        const place = destinationAutocomplete.getPlace();
        setDestination(place.formatted_address || '');
    } else {
      console.error('Autocomplete is not loaded yet!');
    }
  };
  
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOrigin('Mi ubicación actual');
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          onLocationObtained(coords);
          toast({
            title: "Ubicación obtenida",
            description: "Se usará tu ubicación actual como punto de partida.",
          })
        },
        (error) => {
           toast({
            variant: "destructive",
            title: "Error de ubicación",
            description: "No se pudo obtener tu ubicación. Por favor, habilita los permisos.",
          })
        }
      );
    } else {
       toast({
        variant: "destructive",
        title: "Navegador no compatible",
        description: "Tu navegador no soporta la geolocalización.",
      })
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (destination) {
        onSearch(origin || "Mi ubicación actual", destination);
    }
  };
  
  if (!isLoaded) {
    return (
        <div className="flex flex-col items-center justify-center space-y-4 h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Cargando buscador...</p>
        </div>
    )
  }
  
  const isFormDisabled = isApiChecking || isApiError;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
      <fieldset disabled={isFormDisabled} className="space-y-6 group">
        <div className="space-y-2">
            <Label htmlFor="origin">Desde</Label>
            <div className="relative flex items-center">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Autocomplete
                    onLoad={onOriginLoad}
                    onPlaceChanged={onOriginPlaceChanged}
                    options={autocompleteOptions}
                >
                <Input 
                    id="origin" 
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="pl-9 pr-10"
                    placeholder="Mi ubicación actual"
                />
                </Autocomplete>
                <Button 
                    type="button" 
                    variant="ghost"
                    size="icon"
                    onClick={handleGetLocation} 
                    className="absolute right-1 h-8 w-8"
                    aria-label="Usar mi ubicación actual"
                >
                    <LocateFixed className="h-4 w-4" />
                </Button>
            </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="destination">Hasta</Label>
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Autocomplete
                    onLoad={onDestinationLoad}
                    onPlaceChanged={onDestinationPlaceChanged}
                    options={autocompleteOptions}
                >
                    <Input 
                        id="destination" 
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="pl-9"
                        placeholder="Escribe una dirección o lugar"
                        required
                    />
                </Autocomplete>
            </div>
        </div>
        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground group-disabled:bg-accent/50">
            {isApiChecking ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Conectando...</span>
                </>
            ) : isApiError ? (
                 <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    <span>Servicio no disponible</span>
                </>
            ) : (
                <>
                    <Search className="mr-2 h-4 w-4" />
                    <span>Buscar ruta</span>
                </>
            )}
        </Button>
      </fieldset>
    </form>
  );
}

    
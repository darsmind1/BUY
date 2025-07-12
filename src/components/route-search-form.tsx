
"use client";

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, MapPin, LocateFixed, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useJsApiLoader } from '@react-google-maps/api';

interface RouteSearchFormProps {
  apiKey: string;
  onSearch: (origin: string, destination: string) => void;
  onLocationObtained: (location: google.maps.LatLngLiteral) => void;
  isApiChecking: boolean;
  isApiError: boolean;
}

const libraries: ("places")[] = ['places'];

export default function RouteSearchForm({ apiKey, onSearch, onLocationObtained, isApiChecking, isApiError }: RouteSearchFormProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const { toast } = useToast();

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  useEffect(() => {
    if (isLoaded && originInputRef.current && !originAutocompleteRef.current) {
        originAutocompleteRef.current = new window.google.maps.places.Autocomplete(originInputRef.current, {
            componentRestrictions: { country: "uy" },
            fields: ["formatted_address"],
        });
        originAutocompleteRef.current.addListener('place_changed', () => {
            const place = originAutocompleteRef.current?.getPlace();
            if (place?.formatted_address) {
                setOrigin(place.formatted_address);
            }
        });
    }

    if (isLoaded && destinationInputRef.current && !destinationAutocompleteRef.current) {
        destinationAutocompleteRef.current = new window.google.maps.places.Autocomplete(destinationInputRef.current, {
            componentRestrictions: { country: "uy" },
            fields: ["formatted_address"],
        });
        destinationAutocompleteRef.current.addListener('place_changed', () => {
            const place = destinationAutocompleteRef.current?.getPlace();
            if (place?.formatted_address) {
                setDestination(place.formatted_address);
            }
        });
    }
  }, [isLoaded]);
  
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
                <Input 
                    ref={originInputRef}
                    id="origin" 
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="pl-9 pr-10"
                    placeholder="Mi ubicación actual"
                />
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
                <Input 
                    ref={destinationInputRef}
                    id="destination" 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="pl-9"
                    placeholder="Escribe una dirección o lugar"
                    required
                />
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

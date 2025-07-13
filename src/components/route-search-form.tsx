
"use client";

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, LocateFixed, Loader2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RouteSearchFormProps {
  isGoogleMapsLoaded: boolean;
  onSearch: (origin: string, destination: string) => void;
  onLocationObtained: (location: google.maps.LatLngLiteral) => void;
  isApiChecking: boolean;
  isApiError: boolean;
}

export default function RouteSearchForm({ isGoogleMapsLoaded, onSearch, onLocationObtained, isApiChecking, isApiError }: RouteSearchFormProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const { toast } = useToast();

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (isGoogleMapsLoaded && originInputRef.current && !originAutocompleteRef.current) {
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

    if (isGoogleMapsLoaded && destinationInputRef.current && !destinationAutocompleteRef.current) {
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
  }, [isGoogleMapsLoaded]);
  
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

  const handleSwapLocations = () => {
    const tempOrigin = origin;
    setOrigin(destination);
    setDestination(tempOrigin);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (destination) {
        onSearch(origin || "Mi ubicación actual", destination);
    }
  };
  
  if (!isGoogleMapsLoaded) {
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
      <fieldset disabled={isFormDisabled} className="space-y-4 group">
        <Card>
            <CardContent className="p-4 space-y-2 relative">
                <div className="flex items-center gap-4">
                     <div className="flex flex-col items-center h-full self-stretch">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground shrink-0"><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2"></circle></svg>
                        <div className="border-l-2 border-dashed border-border flex-grow my-2"></div>
                        <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="relative">
                            <Input 
                                ref={originInputRef}
                                id="origin" 
                                value={origin}
                                onChange={(e) => setOrigin(e.target.value)}
                                className="border-0 bg-transparent shadow-none pl-2 pr-10 focus-visible:ring-0"
                                placeholder="Mi ubicación actual"
                            />
                            <Button 
                                type="button" 
                                variant="ghost"
                                size="icon"
                                onClick={handleGetLocation} 
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                aria-label="Usar mi ubicación actual"
                            >
                                <LocateFixed className="h-4 w-4" />
                            </Button>
                        </div>
                        <hr className="border-border" />
                        <div className="relative">
                            <Input 
                                ref={destinationInputRef}
                                id="destination" 
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                className="border-0 bg-transparent shadow-none pl-2 focus-visible:ring-0"
                                placeholder="Escribe una dirección o lugar"
                                required
                            />
                        </div>
                    </div>
                </div>
                <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    className="absolute top-1/2 -translate-y-1/2 right-0 h-9 w-9 bg-background rounded-full border shadow-sm group-disabled:pointer-events-none"
                    onClick={handleSwapLocations}
                >
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                </Button>
            </CardContent>
        </Card>
        
        <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12 text-base font-semibold group-disabled:bg-accent/50">
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
                    <Search className="mr-2 h-5 w-5" />
                    <span>Buscar ruta</span>
                </>
            )}
        </Button>
      </fieldset>
    </form>
  );
}

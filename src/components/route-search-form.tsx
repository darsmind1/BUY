
"use client";

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, Loader2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const { toast } = useToast();

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      if (originInputRef.current && !originAutocompleteRef.current) {
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

      if (destinationInputRef.current && !destinationAutocompleteRef.current) {
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

      // Automatically get location on component mount
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationPermissionDenied(false);
            setOrigin('Mi ubicación actual');
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            onLocationObtained(coords);
            setIsGettingLocation(false);
          },
          (error) => {
            setIsGettingLocation(false);
            setOrigin(''); // Clear origin if location fails
            
            if(error.code === error.PERMISSION_DENIED) {
                 setLocationPermissionDenied(true);
            }
          }
        );
      } else {
        setIsGettingLocation(false);
        setLocationPermissionDenied(true);
      }
    }
  }, [isGoogleMapsLoaded, onLocationObtained, toast]);
  
  const handleSwapLocations = () => {
    if (origin === 'Mi ubicación actual' && !destination) return;
    if (!destination && !origin) return;

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
  const isOriginDisabled = isGettingLocation || (origin === 'Mi ubicación actual');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {locationPermissionDenied && (
         <Alert variant="warning" className="animate-in fade-in-0 slide-in-from-top-4 duration-500">
            <MapPin className="h-4 w-4" />
            <AlertDescription>
                Por favor, activa los permisos del Servicio de Localización (GPS) para recibir información precisa sobre tu viaje.
            </AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={isFormDisabled} className="space-y-4 group">
          <Card>
              <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                       <div className="flex flex-col items-center self-stretch justify-between">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground shrink-0 h-5 w-5"><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2"></circle></svg>
                          <div className="border-l-2 border-dashed border-border flex-grow my-2"></div>
                          <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                      <div className="flex-1 space-y-2 relative">
                          <div className="relative">
                              <Input 
                                  ref={originInputRef}
                                  id="origin" 
                                  value={origin}
                                  onChange={(e) => setOrigin(e.target.value)}
                                  className={cn(
                                      "border-0 bg-transparent shadow-none pl-2 pr-10 focus-visible:ring-0 h-9",
                                      isOriginDisabled && "bg-muted/50"
                                  )}
                                  placeholder="Obteniendo ubicación..."
                                  disabled={isOriginDisabled}
                              />
                               {isGettingLocation && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                          </div>
                          <div className="relative border-t border-border">
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="icon"
                                className="absolute top-0 right-1 -translate-y-1/2 h-7 w-7 bg-background rounded-full border shadow-sm group-disabled:pointer-events-none"
                                onClick={handleSwapLocations}
                                aria-label="Invertir origen y destino"
                            >
                                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                          <div className="relative">
                              <Input 
                                  ref={destinationInputRef}
                                  id="destination" 
                                  value={destination}
                                  onChange={(e) => setDestination(e.target.value)}
                                  className="border-0 bg-transparent shadow-none pl-2 focus-visible:ring-0 h-9"
                                  placeholder="Escribe una dirección o lugar"
                                  required
                              />
                          </div>
                      </div>
                  </div>
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
    </div>
  );
}


"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock, Wifi, Accessibility, Snowflake, Loader2 } from 'lucide-react';
import type { BusLocation, StmRouteOption } from '@/lib/stm-api';
import { GoogleMap, Marker, Polyline, DirectionsRenderer } from '@react-google-maps/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getFormattedAddress } from '@/lib/google-maps-api';
import { StopMarker } from '@/components/map-view';

interface RouteDetailsPanelProps {
  route: StmRouteOption;
  busLocations?: BusLocation[];
  isGoogleMapsLoaded: boolean;
  walkingDirections: google.maps.DirectionsResult | null;
  userLocation: google.maps.LatLngLiteral | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapStyle = [
    { elementType: "geometry", stylers: [{ color: "#F0F4F8" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#212F3D" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", stylers: [{ "visibility": "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e0e8f0" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e0e8f0" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dcec" }] },
];

const mapOptions: google.maps.MapOptions = {
    styles: mapStyle,
    disableDefaultUI: true,
    zoomControl: false,
    rotateControl: true,
    gestureHandling: 'auto',
};


const RouteDetailMap = ({ 
  isLoaded, 
  userLocation, 
  route,
  walkingDirections,
  busLocations 
} : {
  isLoaded: boolean;
  userLocation: google.maps.LatLngLiteral | null;
  route: StmRouteOption | null;
  walkingDirections: google.maps.DirectionsResult | null;
  busLocations: BusLocation[];
}) => {
  const [userMarkerIcon, setUserMarkerIcon] = useState<google.maps.Symbol | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const hasCenteredRef = useRef(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    hasCenteredRef.current = false;
  }, []);

  useEffect(() => {
    if (isLoaded && window.google) {
      setUserMarkerIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
      });
    }
  }, [isLoaded]);

  useEffect(() => {
      const map = mapRef.current;
      if (map && userLocation && !hasCenteredRef.current) {
          map.panTo(userLocation);
          map.setZoom(16.5);
          hasCenteredRef.current = true;
      }
  }, [userLocation, mapRef, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const busRoutePath = route?.shape.map(p => ({ lat: p[1], lng: p[0] }));
  const departureStopLocation = route?.departureStop.location.coordinates;
  const arrivalStopLocation = route?.arrivalStop.location.coordinates;

  return (
    <GoogleMap
      onLoad={onLoad}
      mapContainerStyle={mapContainerStyle}
      center={userLocation || { lat: -34.90, lng: -56.16 }}
      zoom={16.5}
      options={mapOptions}
    >
       {walkingDirections && (
          <DirectionsRenderer 
              directions={walkingDirections} 
              options={{
                  suppressMarkers: true,
                  polylineOptions: {
                      strokeColor: '#4A4A4A',
                      strokeOpacity: 0,
                      strokeWeight: 2,
                      zIndex: 2,
                      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 2, scale: 2, strokeColor: '#4A4A4A' }, offset: '0', repeat: '10px' }]
                  }
              }} 
          />
        )}
      
      {busRoutePath && (
        <Polyline
          path={busRoutePath}
          options={{ strokeColor: '#A40034', strokeOpacity: 0.7, strokeWeight: 5 }}
        />
      )}
      
      {userLocation && userMarkerIcon && <Marker position={userLocation} icon={userMarkerIcon} zIndex={101} />}

      {departureStopLocation && (
        <StopMarker position={{ lat: departureStopLocation[1], lng: departureStopLocation[0] }} />
      )}
      {arrivalStopLocation && (
        <StopMarker position={{ lat: arrivalStopLocation[1], lng: arrivalStopLocation[0] }} />
      )}

      {busLocations.map((bus) => (
        <Marker 
          key={`${bus.line}-${bus.id}-${bus.timestamp}`}
          position={{ lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] }}
          zIndex={100}
          icon={{
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="24">
                      <rect x="0" y="0" width="100%" height="100%" rx="8" ry="8" fill="#212F3D" stroke="#ffffff" stroke-width="2"/>
                      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff">${bus.line}</text>
                  </svg>
              `)}`,
              scaledSize: new window.google.maps.Size(40, 24),
              anchor: new window.google.maps.Point(20, 12),
          }}
        />
      ))}
    </GoogleMap>
  )
}

const StepIcon = ({ type }: { type: 'WALKING' | 'TRANSIT' }) => {
  if (type === 'WALKING') {
    return <Footprints className="h-5 w-5 text-primary" />;
  }
  return <Bus className="h-5 w-5 text-primary" />;
};


const AddressDisplay = ({ prefix, location, fallbackAddress }: { prefix: string; location: google.maps.LatLng | google.maps.LatLngLiteral | null; fallbackAddress: string }) => {
    const [address, setAddress] = useState<string | null>(null);

    useEffect(() => {
        const fetchAddress = async () => {
            if (location) {
                const lat = 'lat' in location ? location.lat() : location.lat;
                const lng = 'lng' in location ? location.lng() : location.lng;
                const formattedAddr = await getFormattedAddress(lat, lng);
                setAddress(formattedAddr);
            } else {
                setAddress(fallbackAddress.split(',')[0]);
            }
        };
        fetchAddress();
    }, [location, fallbackAddress]);
    
    if (address === null) {
        return (
             <p className="text-xs text-muted-foreground h-4 bg-muted/50 rounded animate-pulse w-3/4"></p>
        );
    }
    
    return (
        <p className="text-xs text-muted-foreground">
            {prefix}: <span className="font-semibold text-foreground">{address}</span>
        </p>
    )
}

const BusFeatures = ({ bus }: { bus: BusLocation }) => {
    const hasAccessibility = bus.access === "PLATAFORMA ELEVADORA";
    const hasAC = bus.thermalConfort === "Aire Acondicionado";

    if (!hasAccessibility && !hasAC) return null;

    return (
        <div className="flex items-center gap-4 pt-2">
            {hasAccessibility && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Accessibility className="h-4 w-4" />
                    <span>Accesible</span>
                </div>
            )}
            {hasAC && (
                 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Snowflake className="h-4 w-4" />
                    <span>Aire Acond.</span>
                </div>
            )}
        </div>
    )
}

export default function RouteDetailsPanel({ 
  route, 
  busLocations = [],
  isGoogleMapsLoaded,
  walkingDirections,
  userLocation,
}: RouteDetailsPanelProps) {

  const walkingLeg = walkingDirections?.routes[0]?.legs[0];
  const duration = walkingLeg?.duration?.value ? Math.round(walkingLeg.duration.value / 60) + route.duration : route.duration;
  
  const isBusLive = busLocations.length > 0;
  const liveBusData = isBusLive ? busLocations[0] : null; 
  
  if (!route) return null;

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
        <div className="md:hidden">
            {isBusLive && (
                <div className="flex items-center gap-2 p-4 pb-2 text-sm font-medium text-green-400">
                    <Wifi className="h-4 w-4" />
                    <span>Bus en el mapa</span>
                </div>
            )}
            <div className="relative h-[200px] bg-muted">
              <RouteDetailMap 
                isLoaded={isGoogleMapsLoaded}
                userLocation={userLocation}
                route={route}
                walkingDirections={walkingDirections}
                busLocations={busLocations}
              />
            </div>
        </div>

      <div className="p-4 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                 <Badge variant="outline" className="text-sm font-mono">{route.line}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm font-normal">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>~{duration} min</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
             <AddressDisplay prefix="Desde" location={userLocation} fallbackAddress={"Tu ubicación"} />
             <AddressDisplay prefix="Hasta" location={{ lat: route.arrivalStop.location.coordinates[1], lng: route.arrivalStop.location.coordinates[0] }} fallbackAddress={route.arrivalStop.name} />
            {liveBusData && <BusFeatures bus={liveBusData} />}
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground px-1">Indicaciones</h3>
          <div className="w-full space-y-1">
            {/* Walking Step */}
            {walkingLeg ? (
                <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="mt-0.5"><StepIcon type="WALKING" /></div>
                    <div className="flex-1 space-y-0.5">
                        <p className="font-medium text-xs leading-tight">Camina hasta la parada {route.departureStop.name} ({route.departureStop.busstopId})</p>
                        <p className="text-xs text-muted-foreground">{walkingLeg.duration?.text}</p>
                    </div>
                </div>
            ) : (
                 <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="mt-0.5"><StepIcon type="WALKING" /></div>
                    <div className="flex-1 space-y-0.5">
                        <p className="font-medium text-xs leading-tight">Dirígete a la parada {route.departureStop.name} ({route.departureStop.busstopId})</p>
                    </div>
                </div>
            )}
            
            {/* Transit Step */}
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className="mt-0.5"><StepIcon type="TRANSIT" /></div>
                <div className="flex-1 space-y-0.5">
                    <p className="font-medium text-xs leading-tight">Toma el bus línea <strong>{route.line}</strong> hacia <strong>{route.destination}</strong></p>
                    <p className="text-xs text-muted-foreground">Viaje de {route.stops} paradas (~{route.duration} min)</p>
                    <p className="text-xs text-muted-foreground pt-1">Baja en la parada {route.arrivalStop.name} ({route.arrivalStop.busstopId})</p>
                </div>
                <Badge variant="default" className="font-mono text-xs">{route.line}</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

    
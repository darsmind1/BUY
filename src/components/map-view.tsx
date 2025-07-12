
"use client";

import { GoogleMap, DirectionsRenderer, useJsApiLoader, AdvancedMarker, Pin } from '@react-google-maps/api';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { cn } from '@/lib/utils';

interface MapViewProps {
  apiKey: string;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  selectedRoute: google.maps.DirectionsRoute | null;
  busLocations: BusLocation[];
  containerClassName?: string;
}

const libraries: ("places" | "marker")[] = ['places', 'marker'];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -34.83,
  lng: -56.17
};

const montevideoBounds = {
  north: -34.5,
  south: -35.1,
  west: -56.8,
  east: -55.6,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapId: '6579f49a03449c66ec2a188b',
  gestureHandling: 'greedy',
  restriction: {
    latLngBounds: montevideoBounds,
    strictBounds: false,
  },
};

const PulsingUserMarker = () => {
    return (
        <div className="relative w-8 h-8">
            <style>
                {`
                @keyframes blink { 0%, 100% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1); opacity: 1; } }
                .pulsing-dot { position: absolute; top: 50%; left: 50%; width: 32px; height: 32px; transform: translate(-50%, -50%); border-radius: 50%; background-color: #4285F450; animation: blink 2s infinite ease-out; }
                .user-pin { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 50%; background-color: #4285F4; border: 2px solid #ffffff; }
                `}
            </style>
            <div className="pulsing-dot" />
            <div className="user-pin" />
        </div>
    )
}

export default function MapView({ apiKey, directionsResponse, routeIndex, userLocation, selectedRoute, busLocations, containerClassName }: MapViewProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const customPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [directionsRendererOptions, setDirectionsRendererOptions] = useState<google.maps.DirectionsRendererOptions | null>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
    setMapLoaded(false);
    customPolylinesRef.current.forEach(p => p.setMap(null));
    customPolylinesRef.current = [];
  }, []);
  
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !directionsResponse) {
        customPolylinesRef.current.forEach(p => p.setMap(null));
        customPolylinesRef.current = [];
        return;
    }
  
    customPolylinesRef.current.forEach(p => p.setMap(null));
    customPolylinesRef.current = [];
  
    const route = directionsResponse.routes[routeIndex];
    if (!route) return;
  
    const transitPolylineOptions = { strokeColor: '#A40034', strokeOpacity: 0.8, strokeWeight: 6, zIndex: 1 };
    const walkingPolylineOptions = { strokeColor: '#212F3D', strokeOpacity: 0, strokeWeight: 2, zIndex: 2, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 3, scale: 3 }, offset: '0', repeat: '15px' }] };
  
    route.legs[0].steps.forEach((step: google.maps.DirectionsStep) => {
      const polyline = new window.google.maps.Polyline(
        step.travel_mode === 'WALKING' ? walkingPolylineOptions : transitPolylineOptions
      );
      polyline.setPath(step.path);
      polyline.setMap(mapRef.current);
      customPolylinesRef.current.push(polyline);
    });
  
    setDirectionsRendererOptions({ suppressPolylines: true, suppressMarkers: true });
  }, [directionsResponse, routeIndex, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (selectedRoute) { 
        const bounds = new window.google.maps.LatLngBounds();
        directionsResponse?.routes[routeIndex].legs.forEach(leg => { leg.steps.forEach(step => step.path.forEach(point => bounds.extend(point))); });
        if(userLocation) bounds.extend(userLocation);
        map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else if (directionsResponse) {
        const bounds = new window.google.maps.LatLngBounds();
        directionsResponse.routes.forEach(route => { route.legs.forEach(leg => leg.steps.forEach(step => step.path.forEach(point => bounds.extend(point)))); });
        map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else if (userLocation) {
        map.panTo(userLocation);
        map.setZoom(15);
    } else {
        map.panTo(defaultCenter);
        map.setZoom(12);
    }
  }, [selectedRoute, directionsResponse, routeIndex, mapLoaded, userLocation]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const startLocation = directionsResponse?.routes[routeIndex]?.legs[0]?.start_location;
  const endLocation = directionsResponse?.routes[routeIndex]?.legs[0]?.end_location;

  return (
    <div className={cn("w-full h-full bg-gray-300 relative overflow-hidden", containerClassName)}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          options={mapOptions}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {directionsResponse && directionsRendererOptions && (
             <DirectionsRenderer directions={directionsResponse} routeIndex={routeIndex} options={directionsRendererOptions} />
          )}

          {userLocation && (
            <AdvancedMarker position={userLocation}>
                <PulsingUserMarker />
            </AdvancedMarker>
          )}
          
          {directionsResponse && (
            <>
              {startLocation && (
                <AdvancedMarker position={startLocation} title="Punto de partida">
                   <Pin background={'#10B981'} borderColor={'#059669'} glyphColor={'#ffffff'} />
                </AdvancedMarker>
              )}
              {endLocation && (
                 <AdvancedMarker position={endLocation} title="Punto de destino">
                    <Pin background={'#EF4444'} borderColor={'#DC2626'} glyphColor={'#ffffff'} />
                 </AdvancedMarker>
              )}
            </>
          )}

          {busLocations.map((bus) => (
             <AdvancedMarker 
                key={`${bus.line}-${bus.id}`}
                position={{ lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] }}
                zIndex={100}
             >
                <div className="bg-primary text-primary-foreground font-bold text-sm rounded-md px-2 py-1 shadow-lg border-2 border-background">
                  {bus.line}
                </div>
             </AdvancedMarker>
          ))}

        </GoogleMap>
    </div>
  );
}

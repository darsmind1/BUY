
"use client";

import { GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { cn } from '@/lib/utils';

interface MapViewProps {
  isLoaded: boolean;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  selectedRoute: google.maps.DirectionsRoute | null;
  busLocations: BusLocation[];
  containerClassName?: string;
}

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

export default function MapView({ isLoaded, directionsResponse, routeIndex, userLocation, selectedRoute, busLocations, containerClassName }: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const customPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [directionsRendererOptions, setDirectionsRendererOptions] = useState<google.maps.DirectionsRendererOptions | null>(null);
  const [userMarkerIcon, setUserMarkerIcon] = useState<google.maps.Symbol | null>(null);

  useEffect(() => {
    if (window.google) {
        setUserMarkerIcon({
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
        });
    }
  }, []);

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
    if (!isLoaded || !mapLoaded || !mapRef.current || !directionsResponse) {
        if (mapRef.current) {
            customPolylinesRef.current.forEach(p => p.setMap(null));
            customPolylinesRef.current = [];
        }
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
  
    setDirectionsRendererOptions({ suppressPolylines: true, suppressMarkers: false });
  }, [directionsResponse, routeIndex, mapLoaded, isLoaded]);

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
             <DirectionsRenderer 
                directions={directionsResponse} 
                routeIndex={routeIndex} 
                options={{
                    ...directionsRendererOptions,
                }} 
             />
          )}

          {userLocation && userMarkerIcon && (
            <Marker position={userLocation} icon={userMarkerIcon} />
          )}

          {busLocations.map((bus) => (
             <Marker 
                key={`${bus.line}-${bus.id}`}
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
    </div>
  );
}

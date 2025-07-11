
"use client";

import { GoogleMap, MarkerF, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface MapViewProps {
  apiKey: string;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
}

const libraries: ("places")[] = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -34.9011,
  lng: -56.1645
};

const montevideoBounds = {
  north: -34.75,
  south: -34.95,
  west: -56.3,
  east: -56.0,
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

const directionsRendererOptions = {
    suppressMarkers: true,
    polylineOptions: {
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 6,
    }
};

export default function MapView({ apiKey, directionsResponse, routeIndex, userLocation }: MapViewProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
  }, []);

  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
  }, []);
  
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Scenario 1: A route has been selected.
    if (directionsResponse && userLocation) {
        // Zoom in to user's location to start the trip.
        map.panTo(userLocation);
        map.setZoom(16);
        return; // Important to stop further execution
    }
    
    // Scenario 2: No route selected, but we have user location.
    if (userLocation) {
        // Center on user's location.
        map.panTo(userLocation);
        map.setZoom(15);
        return; // Important to stop further execution
    }

    // Fallback: No route, no user location, just show default Montevideo view.
    map.panTo(defaultCenter);
    map.setZoom(13);

  }, [directionsResponse, userLocation, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="w-full h-full bg-gray-300 relative overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={13}
          options={mapOptions}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {userLocation && (
             <MarkerF 
                position={userLocation}
                title="Tu ubicación"
                icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: '#4285F4',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                }}
             />
          )}

          {directionsResponse && (
            <DirectionsRenderer
                directions={directionsResponse}
                routeIndex={routeIndex}
                options={directionsRendererOptions}
            />
          )}
        </GoogleMap>
    </div>
  );
}

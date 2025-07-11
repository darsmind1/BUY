
"use client";

import { GoogleMap, MarkerF, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import React, { useEffect, useRef } from 'react';
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
  lat: -34.83,
  lng: -56.17
};

const montevideoBounds = {
  north: -34.7,
  south: -35.0,
  west: -56.5,
  east: -55.9,
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

    if (directionsResponse && userLocation) {
        map.panTo(userLocation);
        map.setZoom(16);
    } else if (userLocation) {
        map.panTo(userLocation);
        map.setZoom(15);
    } else {
        map.panTo(defaultCenter);
        map.setZoom(12);
    }
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
          zoom={12}
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


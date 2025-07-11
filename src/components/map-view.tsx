
"use client";

import { GoogleMap, DirectionsRenderer, MarkerF } from '@react-google-maps/api';
import React, { useState, useEffect, useRef } from 'react';

interface MapViewProps {
  directionsResponse: google.maps.DirectionsResult | null;
  selectedRouteIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
}

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

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapId: '6579f49a03449c66ec2a188b',
  gestureHandling: 'greedy',
  restriction: {
    latLngBounds: montevideoBounds,
    strictBounds: false,
  },
};

export default function MapView({ directionsResponse, selectedRouteIndex, userLocation }: MapViewProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(directionsResponse);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    setDirections(directionsResponse);
  }, [directionsResponse]);

  useEffect(() => {
    if (userLocation && mapRef.current) {
        mapRef.current.panTo(userLocation);
        mapRef.current.setZoom(15);
    }
  }, [userLocation]);


  return (
    <div className="w-full h-full bg-gray-300 relative overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={13}
          options={mapOptions}
          onLoad={(map) => { mapRef.current = map; }}
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
          {directions && (
             <DirectionsRenderer 
              directions={directions} 
              routeIndex={selectedRouteIndex}
              options={{
                polylineOptions: {
                  strokeColor: 'hsl(var(--accent))',
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                },
                suppressMarkers: true,
              }}
            />
          )}
        </GoogleMap>
    </div>
  );
}

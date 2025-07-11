
"use client";

import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import React, { useState, useEffect } from 'react';

interface MapViewProps {
  directionsResponse: google.maps.DirectionsResult | null;
  selectedRouteIndex: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const center = {
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

export default function MapView({ directionsResponse, selectedRouteIndex }: MapViewProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(directionsResponse);
  
  useEffect(() => {
    setDirections(directionsResponse);
  }, [directionsResponse]);

  return (
    <div className="w-full h-full bg-gray-300 relative overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
          options={mapOptions}
        >
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
                suppressMarkers: true, // We can add custom markers later
              }}
            />
          )}
        </GoogleMap>
    </div>
  );
}

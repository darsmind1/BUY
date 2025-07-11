
"use client";

import { GoogleMap, MarkerF, Polyline } from '@react-google-maps/api';
import React, { useEffect, useRef } from 'react';

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
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (userLocation && mapRef.current && !directionsResponse) {
        mapRef.current.panTo(userLocation);
        mapRef.current.setZoom(15);
    }
  }, [userLocation, directionsResponse]);
  
  useEffect(() => {
    if (directionsResponse && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        directionsResponse.routes[selectedRouteIndex].legs.forEach(leg => {
            leg.steps.forEach(step => {
                step.path.forEach(point => {
                    bounds.extend(point);
                });
            });
        });
        mapRef.current.fitBounds(bounds);
    }
  }, [directionsResponse, selectedRouteIndex]);

  const selectedRoute = directionsResponse?.routes[selectedRouteIndex];

  // Define styles inside the component to avoid issues on re-render
  const walkingPathOptions: google.maps.PolylineOptions = {
      strokeColor: 'hsl(var(--primary))',
      strokeOpacity: 0,
      strokeWeight: 2,
      icons: [{
          icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              scale: 3
          },
          offset: '0',
          repeat: '15px'
      }],
  };

  const transitPathOptions: google.maps.PolylineOptions = {
      strokeColor: '#4285F4',
      strokeOpacity: 0.9,
      strokeWeight: 5
  };

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

          {selectedRoute && selectedRoute.legs[0] && (
            <>
                {/* Custom Polylines */}
                {selectedRoute.legs[0].steps.map((step, index) => (
                    <Polyline
                        key={index}
                        path={step.path}
                        options={step.travel_mode === 'WALKING' ? walkingPathOptions : transitPathOptions}
                    />
                ))}

                {/* Start and End Markers */}
                <MarkerF position={selectedRoute.legs[0].start_location} title="Origen" />
                <MarkerF position={selectedRoute.legs[0].end_location} title="Destino" />
            </>
          )}

        </GoogleMap>
    </div>
  );
}

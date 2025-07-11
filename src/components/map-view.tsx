
"use client";

import { GoogleMap, MarkerF, Polyline } from '@react-google-maps/api';
import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface MapViewProps {
  isLoaded: boolean;
  directionsResponse: google.maps.DirectionsResult | null;
  selectedRouteIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  hasRouteBeenSelected: boolean;
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

export default function MapView({ isLoaded, directionsResponse, selectedRouteIndex, userLocation, hasRouteBeenSelected }: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
  }, [])

  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
  }, [])

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
  
    // 1. A route was just selected: Zoom in on user's location
    if (hasRouteBeenSelected && userLocation) {
      map.panTo(userLocation);
      map.setZoom(18);
      return; // Stop further processing
    }

    // 2. A route is active: Fit map to route bounds
    if (directionsResponse && directionsResponse.routes.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      directionsResponse.routes[selectedRouteIndex].legs.forEach(leg => {
        leg.steps.forEach(step => {
          step.path.forEach(point => {
            bounds.extend(point);
          });
        });
      });
      if (userLocation) {
        bounds.extend(new window.google.maps.LatLng(userLocation.lat, userLocation.lng));
      }
      map.fitBounds(bounds, 50);
    } 
    // 3. No route, but user location is present: Center on user
    else if (userLocation) {
      map.panTo(userLocation);
      map.setZoom(15);
    }
  
  }, [directionsResponse, selectedRouteIndex, userLocation, isLoaded, hasRouteBeenSelected]);


  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedRoute = directionsResponse?.routes[selectedRouteIndex];
  
  const transitPathOptions = {
      strokeColor: '#4285F4',
      strokeOpacity: 0.8,
      strokeWeight: 6
  };
  
  const walkingPathOptions = {
      strokeOpacity: 0,
      icons: [{
          icon: {
              path: 'M 0,-1 0,1',
              strokeColor: '#4285F4',
              strokeOpacity: 1,
              scale: 4,
          },
          offset: '0',
          repeat: '20px'
      }],
  };
  
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

          {selectedRoute && selectedRoute.legs[0] && (
            <>
                {selectedRoute.legs[0].steps.map((step, index) => {
                  return (
                    <Polyline
                        key={index}
                        path={step.path}
                        options={step.travel_mode === 'WALKING' ? walkingPathOptions : transitPathOptions}
                    />
                  )
                })}

                <MarkerF position={selectedRoute.legs[0].start_location} title="Origen" />
                <MarkerF position={selectedRoute.legs[0].end_location} title="Destino" />
            </>
          )}
        </GoogleMap>
    </div>
  );
}

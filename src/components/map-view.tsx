
"use client";

import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { cn } from '@/lib/utils';
import type { StmLineRoute } from '@/lib/types';

// Reusable StopMarker component
export const StopMarker = ({ position, name }: { position: google.maps.LatLngLiteral, name: string }) => (
  <Marker
    position={position}
    zIndex={99} // Below bus markers but above polylines
    title={name}
    icon={{
      path: google.maps.SymbolPath.CIRCLE,
      scale: 5,
      fillColor: "#A40034",
      fillOpacity: 0.8,
      strokeWeight: 2,
      strokeColor: "#ffffff",
    }}
  />
);

interface MapViewProps {
  isLoaded: boolean;
  userLocation: google.maps.LatLngLiteral | null;
  busLocations: BusLocation[];
  lineRoute: StmLineRoute | null;
  view: string;
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

const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#F0F4F8" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#212F3D" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#ffffff" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#c9c9c9" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#bdbdbd" }]
  },
  {
    "featureType": "poi",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#e0e8f0" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#e0e8f0" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#616161" }]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#c9dcec" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }]
  }
];

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  rotateControl: true,
  restriction: {
    latLngBounds: montevideoBounds,
    strictBounds: false,
  },
  styles: mapStyle,
  gestureHandling: 'auto',
};

export default function MapView({ isLoaded, userLocation, busLocations, lineRoute, view }: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userMarkerIcon, setUserMarkerIcon] = useState<google.maps.Symbol | null>(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (isLoaded && window.google) {
        setUserMarkerIcon({
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
        });
    }
  }, [isLoaded]);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
    setMapLoaded(true);
    hasCenteredRef.current = false;
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
    setMapLoaded(false);
  }, []);
  
  // Reset centering lock when route changes
  useEffect(() => {
    hasCenteredRef.current = false;
  }, [lineRoute]);
  

  // Effect to set the map bounds or center based on the current view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || hasCenteredRef.current) return;
    
    if (lineRoute && lineRoute.route.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        lineRoute.route.forEach(point => bounds.extend({ lat: point.lat, lng: point.lng }));
        
        if (userLocation) {
            bounds.extend(userLocation);
        }
        
        map.fitBounds(bounds, 50); // 50px padding
        hasCenteredRef.current = true;
    } else if (userLocation) {
        // For initial load without a route, center on user
        map.panTo(userLocation);
        map.setZoom(15);
        hasCenteredRef.current = true;
    } else {
        // Fallback
        map.panTo(defaultCenter);
        map.setZoom(12);
        hasCenteredRef.current = true;
    }
    
  }, [view, lineRoute, mapLoaded, userLocation]);

  const linePath = lineRoute?.route.map(p => ({ lat: p.lat, lng: p.lng })) || [];

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full bg-gray-300 relative overflow-hidden")}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          options={mapOptions}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {userLocation && userMarkerIcon && (
            <Marker position={userLocation} icon={userMarkerIcon} zIndex={101} />
          )}

          {lineRoute && (
            <>
              <Polyline 
                path={linePath}
                options={{ strokeColor: '#A40034', strokeOpacity: 0.7, strokeWeight: 5, zIndex: 1 }}
              />
              {lineRoute.route.map(stop => (
                <StopMarker key={stop.stopId} position={{ lat: stop.lat, lng: stop.lng }} name={stop.name} />
              ))}
            </>
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

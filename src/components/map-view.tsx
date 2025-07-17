
"use client";

import { GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { cn } from '@/lib/utils';

// Reusable StopMarker component
export const StopMarker = ({ position }: { position: google.maps.LatLngLiteral }) => (
  <Marker
    position={position}
    zIndex={99} // Below bus markers but above polylines
    icon={{
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#A40034",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#ffffff",
    }}
  />
);

interface MapViewProps {
  isLoaded: boolean;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  selectedRoute: google.maps.DirectionsRoute | null;
  busLocations: BusLocation[];
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
    "transit.line",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }]
  },
  {
    "transit.station",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }]
  },
  {
    "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#c9dcec" }]
  },
  {
    "water",
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

export default function MapView({ isLoaded, directionsResponse, routeIndex, userLocation, selectedRoute, busLocations, view }: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const customPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [directionsRendererOptions, setDirectionsRendererOptions] = useState<google.maps.DirectionsRendererOptions | null>(null);
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
    hasCenteredRef.current = false; // Reset on new map load
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
    const walkingPolylineOptions = { strokeColor: '#4A4A4A', strokeOpacity: 0, strokeWeight: 2, zIndex: 2, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 3, scale: 3, strokeColor: '#4A4A4A' }, offset: '0', repeat: '15px' }] };
  
    route.legs[0].steps.forEach((step: google.maps.DirectionsStep) => {
      const polyline = new window.google.maps.Polyline(
        step.travel_mode === 'WALKING' ? walkingPolylineOptions : transitPolylineOptions
      );
      polyline.setPath(step.path);
      polyline.setMap(mapRef.current);
      customPolylinesRef.current.push(polyline);
    });
  
    setDirectionsRendererOptions({ suppressPolylines: true, suppressMarkers: true });
  }, [directionsResponse, routeIndex, mapLoaded, isLoaded]);

  // Effect to set the map bounds or center based on the current view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || hasCenteredRef.current) return;
    
    // For full map view, fit to route bounds. This runs only once.
    if (directionsResponse) {
        const bounds = new window.google.maps.LatLngBounds();
        const routeToBound = selectedRoute || directionsResponse.routes[routeIndex];
        routeToBound.legs.forEach(leg => leg.steps.forEach(step => step.path.forEach(point => bounds.extend(point))));

        if (userLocation) {
            bounds.extend(userLocation);
        }
        map.fitBounds(bounds, 50); // 50px padding
        hasCenteredRef.current = true;
    } else {
        // For initial load without a route, center on user or default
        map.panTo(userLocation || defaultCenter);
        map.setZoom(12);
        hasCenteredRef.current = true;
    }
    
  }, [selectedRoute, directionsResponse, routeIndex, mapLoaded, userLocation]);

  const firstTransitStep = selectedRoute?.legs[0]?.steps.find(step => step.travel_mode === 'TRANSIT');
  const departureStopLocation = firstTransitStep?.transit?.departure_stop.location;

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
            <Marker position={userLocation} icon={userMarkerIcon} zIndex={101} />
          )}

          {departureStopLocation && (
            <StopMarker position={{ lat: departureStopLocation.lat(), lng: departureStopLocation.lng() }} />
          )}

          {busLocations.map((bus) => (
             <Marker 
                key={bus.id}
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

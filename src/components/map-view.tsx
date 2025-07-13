
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
  view: 'search' | 'options' | 'details';
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
        "featureType": "all",
        "elementType": "labels.text.fill",
        "stylers": [
            { "saturation": 36 },
            { "color": "#333333" },
            { "lightness": 40 }
        ]
    },
    {
        "featureType": "all",
        "elementType": "labels.text.stroke",
        "stylers": [
            { "visibility": "on" },
            { "color": "#ffffff" },
            { "lightness": 16 }
        ]
    },
    {
        "featureType": "all",
        "elementType": "labels.icon",
        "stylers": [
            { "visibility": "off" }
        ]
    },
    {
        "featureType": "administrative",
        "elementType": "geometry.fill",
        "stylers": [
            { "color": "#fefefe" },
            { "lightness": 20 }
        ]
    },
    {
        "featureType": "administrative",
        "elementType": "geometry.stroke",
        "stylers": [
            { "color": "#fefefe" },
            { "lightness": 17 },
            { "weight": 1.2 }
        ]
    },
    {
        "featureType": "landscape",
        "elementType": "geometry",
        "stylers": [
            { "color": "#f5f5f5" },
            { "lightness": 20 }
        ]
    },
    {
        "featureType": "poi",
        "elementType": "geometry",
        "stylers": [
            { "color": "#f5f5f5" },
            { "lightness": 21 }
        ]
    },
    {
        "featureType": "poi.park",
        "elementType": "geometry",
        "stylers": [
            { "color": "#dedede" },
            { "lightness": 21 }
        ]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.fill",
        "stylers": [
            { "color": "#ffffff" },
            { "lightness": 17 }
        ]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.stroke",
        "stylers": [
            { "color": "#ffffff" },
            { "lightness": 29 },
            { "weight": 0.2 }
        ]
    },
    {
        "featureType": "road.arterial",
        "elementType": "geometry",
        "stylers": [
            { "color": "#ffffff" },
            { "lightness": 18 }
        ]
    },
    {
        "featureType": "road.local",
        "elementType": "geometry",
        "stylers": [
            { "color": "#ffffff" },
            { "lightness": 16 }
        ]
    },
    {
        "featureType": "transit",
        "elementType": "geometry",
        "stylers": [
            { "color": "#f2f2f2" },
            { "lightness": 19 }
        ]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [
            { "color": "#e9e9e9" },
            { "lightness": 17 }
        ]
    }
];

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  restriction: {
    latLngBounds: montevideoBounds,
    strictBounds: false,
  },
  styles: mapStyle
};

const mapOptionsWithZoomControl: google.maps.MapOptions = {
    ...mapOptions,
    zoomControl: true,
    gestureHandling: 'auto',
};

const mapOptionsForDetailsPanel: google.maps.MapOptions = {
    ...mapOptions,
    gestureHandling: 'greedy',
    zoomControl: false,
};


export default function MapView({ isLoaded, directionsResponse, routeIndex, userLocation, selectedRoute, busLocations, view }: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const customPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [directionsRendererOptions, setDirectionsRendererOptions] = useState<google.maps.DirectionsRendererOptions | null>(null);
  const [userMarkerIcon, setUserMarkerIcon] = useState<google.maps.Symbol | null>(null);
  const initialCenterSetRef = useRef(false);

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
    if (!map || !mapLoaded) return;
    
    // For the small map in the details panel, center on the user's location with a fixed zoom.
    if (view === 'details' && userLocation && !initialCenterSetRef.current) {
        map.panTo(userLocation);
        map.setZoom(16.5);
        initialCenterSetRef.current = true; // Mark as set to prevent re-centering on every location update
    } 
    // For other views (full-screen map, options list), fit the entire route.
    else if (view !== 'details' && directionsResponse) {
        const bounds = new window.google.maps.LatLngBounds();
        const routeToBound = selectedRoute || directionsResponse.routes[routeIndex];
        routeToBound.legs.forEach(leg => leg.steps.forEach(step => step.path.forEach(point => bounds.extend(point))));

        if (userLocation) {
            bounds.extend(userLocation);
        }
        map.fitBounds(bounds, 50); // 50px padding
    } else if (view !== 'details') {
        map.panTo(userLocation || defaultCenter);
        map.setZoom(12);
    }
    
  }, [view, selectedRoute, directionsResponse, routeIndex, mapLoaded, userLocation]);

  // Effect to reset the initial centering flag when we leave the details view
  useEffect(() => {
    if (view !== 'details') {
        initialCenterSetRef.current = false;
    }
  }, [view]);


  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const getCurrentMapOptions = () => {
      // The small map in the details panel needs 'greedy' gesture handling to be interactive.
      if (view === 'details') {
          return mapOptionsForDetailsPanel;
      }
      // The full-screen map uses 'auto' and has zoom controls.
      return mapOptionsWithZoomControl;
  }

  return (
    <div className={cn("w-full h-full bg-gray-300 relative overflow-hidden")}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          options={getCurrentMapOptions()}
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
                key={`${bus.line}-${bus.location.coordinates[1]}-${bus.location.coordinates[0]}`}
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

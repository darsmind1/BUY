"use client";

import { GoogleMap, Marker, Polyline, DirectionsRenderer, InfoWindow } from '@react-google-maps/api';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { BusLocation, StmBusStop, StmInfo, StmLineRoute } from '@/lib/stm-api';
import { cn } from '@/lib/utils';


interface MapViewProps {
  isLoaded: boolean;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  busLocations: BusLocation[];
  selectedRoute: google.maps.DirectionsRoute | null;
  lineRoutes: Record<string, StmLineRoute | null>;
  view: 'search' | 'options' | 'details';
  allStops: StmBusStop[];
  stmInfo: StmInfo[];
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -34.88,
  lng: -56.18
};

const montevideoBounds = {
  north: -34.7,
  south: -35.0,
  west: -56.4,
  east: -56.0,
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
    "stylers": [{ "visibility": "off" }]
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
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#e0e8f0" }]
  },
  {
    "featureType": "road",
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
    "featureType": "road.local",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "transit",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#c9dcec" }]
  }
];


const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  rotateControl: true,
  restriction: {
    latLngBounds: montevideoBounds,
    strictBounds: false,
  },
  styles: mapStyle,
  gestureHandling: 'auto',
};

const directionsRendererOptions = (isSelected: boolean): google.maps.DirectionsRendererOptions => ({
  suppressMarkers: true,
  polylineOptions: {
    strokeColor: isSelected ? '#A40034' : '#888888',
    strokeOpacity: isSelected ? 0.8 : 0.5,
    strokeWeight: 6,
    zIndex: isSelected ? 10 : 1,
  }
});

const stmRoutePolylineOptions = {
    strokeColor: '#212F3D',
    strokeOpacity: 0.6,
    strokeWeight: 4,
    zIndex: 20
};


export default function MapView({ 
    isLoaded,
    directionsResponse, 
    routeIndex,
    userLocation, 
    busLocations, 
    selectedRoute,
    lineRoutes,
    view,
    allStops,
    stmInfo
}: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [userMarkerIcon, setUserMarkerIcon] = useState<google.maps.Symbol | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && window.google) {
        setUserMarkerIcon({
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
        });
    }
  }, [isLoaded]);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
  }, []);
  
  useEffect(() => {
    if (mapRef.current && directionsResponse) {
        const bounds = new window.google.maps.LatLngBounds();
        directionsResponse.routes.forEach(route => {
            if (route.bounds) {
                bounds.union(route.bounds);
            } else if (route.legs) {
                route.legs.forEach(leg => {
                    leg.steps.forEach(step => {
                        if (step.path) {
                            step.path.forEach(pathPoint => {
                                bounds.extend(pathPoint);
                            });
                        }
                    });
                });
            }
        });

        if (userLocation) {
            bounds.extend(new window.google.maps.LatLng(userLocation.lat, userLocation.lng));
        }
        
        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, 100);
        }

    } else if (mapRef.current && userLocation) {
        mapRef.current.panTo(userLocation);
        if(mapRef.current.getZoom()! < 15) {
            mapRef.current.setZoom(15);
        }
    }
  }, [directionsResponse, userLocation, selectedRoute]);

  const handleMarkerClick = (markerId: string) => {
    setActiveMarker(markerId);
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine which stops to show
  const transitStops = selectedRoute?.legs[0].steps
    .filter(step => step.travel_mode === 'TRANSIT' && step.transit)
    .flatMap(step => [step.transit!.departure_stop.location, step.transit!.arrival_stop.location]);

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
          {directionsResponse && directionsResponse.routes.length > 0 && (
             <DirectionsRenderer 
                directions={directionsResponse}
                routeIndex={routeIndex}
                options={directionsRendererOptions(true)}
             />
          )}

          {view === 'details' && Object.values(lineRoutes).map((route, index) => {
              if (route && route.route) {
                  const path = route.route.map(p => ({ lat: p.lat, lng: p.lng }));
                  return <Polyline key={index} path={path} options={stmRoutePolylineOptions} />;
              }
              return null;
          })}

          {userLocation && userMarkerIcon && (
            <Marker position={userLocation} icon={userMarkerIcon} zIndex={101} />
          )}

          {busLocations.map((bus) => (
             <Marker 
                key={`${bus.line}-${bus.id}`}
                position={{ lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] }}
                zIndex={100}
                icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="24" viewBox="0 0 40 24">
                            <rect x="0" y="0" width="100%" height="100%" rx="8" ry="8" fill="#212F3D" stroke="#ffffff" stroke-width="2"/>
                            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#ffffff">${bus.line}</text>
                        </svg>
                    `)}`,
                    scaledSize: new window.google.maps.Size(40, 24),
                    anchor: new window.google.maps.Point(20, 12),
                }}
             />
          ))}

          {view === 'details' && transitStops && transitStops.map((location, index) => {
              if (location) {
                  const latLng = location instanceof google.maps.LatLng ? location : new google.maps.LatLng(location);
                  return <Marker
                      key={`stop-${index}`}
                      position={latLng}
                      zIndex={50}
                      icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 5,
                          fillColor: '#A40034',
                          fillOpacity: 0.8,
                          strokeColor: '#ffffff',
                          strokeWeight: 1,
                      }}
                  />
              }
              return null;
          })}
        </GoogleMap>
    </div>
  );
}


"use client";

import { GoogleMap, MarkerF, DirectionsRenderer, useJsApiLoader, OverlayViewF } from '@react-google-maps/api';
import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import { cn } from '@/lib/utils';

interface MapViewProps {
  apiKey: string;
  directionsResponse: google.maps.DirectionsResult | null;
  routeIndex: number;
  userLocation: google.maps.LatLngLiteral | null;
  selectedRoute: google.maps.DirectionsRoute | null;
  busLocations: BusLocation[];
  containerClassName?: string;
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
  north: -34.5,
  south: -35.1,
  west: -56.8,
  east: -55.6,
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
    preserveViewport: true, 
    polylineOptions: {
        strokeColor: '#A40034', // Accent color
        strokeOpacity: 0.8,
        strokeWeight: 6,
    }
};

const busIconSvg = (line: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="42" height="28" viewBox="0 0 42 28" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="0.5" y="0.5" width="41" height="27" rx="6" fill="#212F3D" stroke="#F0F4F8" stroke-width="1"/>
<path d="M5 22C5 20.8954 5.89543 20 7 20H10C11.1046 20 12 20.8954 12 22V28H5V22Z" fill="#F0F4F8"/>
<path d="M30 22C30 20.8954 30.8954 20 32 20H35C36.1046 20 37 20.8954 37 22V28H30V22Z" fill="#F0F4F8"/>
<foreignObject x="0" y="4" width="42" height="20" style="font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; color: #F0F4F8; text-align: center; line-height: 20px;">
  ${line}
</foreignObject>
</svg>
`)}`;

const getPixelPositionOffset = (width: number, height: number) => ({
    x: -(width / 2),
    y: -(height / 2),
});

const PulsingUserMarker = () => (
    <div className="relative w-8 h-8">
        <style>
            {`
            @keyframes blink {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.2;
                }
            }
            `}
        </style>
        <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4285F4] border-2 border-white shadow-lg"
            style={{ width: '16px', height: '16px', animation: 'blink 1.5s infinite ease-in-out' }}
        />
    </div>
)


export default function MapView({ apiKey, directionsResponse, routeIndex, userLocation, selectedRoute, busLocations, containerClassName }: MapViewProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = null;
    setMapLoaded(false);
  }, []);
  
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (selectedRoute && userLocation) {
        // When in details view, focus on the user's location
        map.panTo(userLocation);
        map.setZoom(16.75);
    } else if (directionsResponse) {
        // For options view, fit the bounds of the route
        const bounds = new window.google.maps.LatLngBounds();
        directionsResponse.routes[routeIndex].legs.forEach(leg => {
            leg.steps.forEach(step => {
                step.path.forEach(point => bounds.extend(point));
            });
        });
        map.fitBounds(bounds);
    }
    else if (userLocation) {
        // For initial search view with location, focus on user
        map.panTo(userLocation);
        map.setZoom(15);
    } else {
        // Default view
        map.panTo(defaultCenter);
        map.setZoom(12);
    }
  }, [selectedRoute, directionsResponse, routeIndex, mapLoaded]); // Removed userLocation from deps

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const startLocation = directionsResponse?.routes[routeIndex]?.legs[0]?.start_location;
  const endLocation = directionsResponse?.routes[routeIndex]?.legs[0]?.end_location;

  return (
    <div className={cn("w-full h-full bg-gray-300 relative overflow-hidden", containerClassName)}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          options={mapOptions}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {userLocation && (
             <OverlayViewF
                position={userLocation}
                mapPaneName={OverlayViewF.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={getPixelPositionOffset}
            >
                <PulsingUserMarker />
            </OverlayViewF>
          )}

          {directionsResponse && (
            <>
              <DirectionsRenderer
                  directions={directionsResponse}
                  routeIndex={routeIndex}
                  options={directionsRendererOptions}
              />
              {startLocation && (
                <MarkerF
                  position={startLocation}
                  title="Punto de partida"
                  icon={{
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                    fillColor: '#10B981', // green-500
                    fillOpacity: 1,
                    strokeWeight: 0,
                    rotation: 0,
                    scale: 1.5,
                    anchor: new google.maps.Point(12, 24),
                  }}
                />
              )}
              {endLocation && (
                 <MarkerF
                  position={endLocation}
                  title="Punto de destino"
                  icon={{
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                    fillColor: '#EF4444', // red-500
                    fillOpacity: 1,
                    strokeWeight: 0,
                    rotation: 0,
                    scale: 1.5,
                    anchor: new google.maps.Point(12, 24),
                  }}
                />
              )}
            </>
          )}

          {busLocations.map((bus, index) => (
             <MarkerF 
                key={`${bus.line}-${index}`}
                position={{ lat: bus.location.coordinates[1], lng: bus.location.coordinates[0] }}
                title={`Línea ${bus.line}`}
                icon={{
                    url: busIconSvg(bus.line),
                    scaledSize: new window.google.maps.Size(42, 28),
                    anchor: new window.google.maps.Point(21, 14),
                }}
                zIndex={100}
             />
          ))}

        </GoogleMap>
    </div>
  );
}

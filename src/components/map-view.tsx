
"use client";

import { GoogleMap, MarkerF } from '@react-google-maps/api';
import React from 'react';

interface MapViewProps {
  route: any | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const center = {
  lat: -34.9011,
  lng: -56.1645
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapId: '6579f49a03449c66'
};

export default function MapView({ route }: MapViewProps) {
  const busPositions = route ? route.busPositions : [];

  // Define icons inside the component to ensure `google` object is available.
  const busIcon = React.useMemo(() => ({
    path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11C5.84 5 5.28 5.42 5.08 6.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
    fillColor: 'hsl(var(--primary-foreground))',
    fillOpacity: 1,
    strokeWeight: 0,
    rotation: 0,
    scale: 1.1,
    anchor: typeof window !== 'undefined' && window.google ? new google.maps.Point(12, 12) : undefined,
  }), []);

  const busIconBackground = React.useMemo(() => ({
    path: typeof window !== 'undefined' && window.google ? google.maps.SymbolPath.CIRCLE : undefined,
    fillColor: 'hsl(var(--primary))',
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: 'hsl(var(--primary-foreground))',
    scale: 12,
    anchor: typeof window !== 'undefined' && window.google ? new google.maps.Point(0, 0) : undefined
  }), []);


  return (
    <div className="w-full h-full bg-gray-300 relative overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
          options={mapOptions}
        >
          {busPositions.map((bus: any) => (
            <React.Fragment key={bus.id}>
               <MarkerF position={bus.position} icon={busIconBackground} zIndex={1} />
               <MarkerF position={bus.position} icon={busIcon} zIndex={2} />
            </React.Fragment>
          ))}
        </GoogleMap>
    </div>
  );
}

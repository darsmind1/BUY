
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock, Wifi, Accessibility, Snowflake, Dot, Loader2 } from 'lucide-react';
import type { BusLocation } from '@/lib/stm-api';
import type { StmInfo } from '@/lib/types';
import { getFormattedAddress } from '@/lib/google-maps-api';

// Reusing style from main map view for consistency
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

const mapContainerStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '0.5rem',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  gestureHandling: 'auto',
  styles: mapStyle,
};

const StopMarker = ({ position }: { position: google.maps.LatLngLiteral }) => (
  <Marker
    position={position}
    icon={{
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#A40034",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#ffffff",
    }}
  />
);

interface RouteDetailsPanelProps {
  route: google.maps.DirectionsRoute;
  busLocations?: BusLocation[];
  isGoogleMapsLoaded: boolean;
  userLocation: google.maps.LatLngLiteral | null;
  stmInfo: StmInfo[];
}

const StepIcon = ({ type }: { type: 'WALKING' | 'TRANSIT' }) => {
  if (type === 'WALKING') {
    return <Footprints className="h-5 w-5 text-primary" />;
  }
  return <Bus className="h-5 w-5 text-primary" />;
};

const getTotalDuration = (legs: google.maps.DirectionsLeg[]) => {
  let totalSeconds = 0;
  legs.forEach(leg => {
    if (leg.duration) {
      totalSeconds += leg.duration.value;
    }
  });
  return Math.round(totalSeconds / 60);
}

const AddressDisplay = ({ prefix, location, fallbackAddress }: { prefix: string; location: google.maps.LatLng | null; fallbackAddress: string }) => {
    const [address, setAddress] = useState<string | null>(null);
    useEffect(() => {
        const fetchAddress = async () => {
            if (location) {
                const formattedAddr = await getFormattedAddress(location.lat(), location.lng());
                setAddress(formattedAddr);
            } else if (fallbackAddress === 'Mi ubicación actual') {
                 setAddress('Tu ubicación actual');
            } else {
                const parts = fallbackAddress.split(',');
                setAddress(parts[0]);
            }
        };
        fetchAddress();
    }, [location, fallbackAddress]);
    
    if (address === null) {
        return (
             <p className="text-xs text-muted-foreground h-4 bg-muted/50 rounded animate-pulse w-3/4"></p>
        );
    }
    
    return (
        <p className="text-xs text-muted-foreground">
            {prefix}: <span className="font-semibold text-foreground">{address}</span>
        </p>
    )
}

const BusFeatures = ({ stmInfo, busLocations }: { stmInfo: StmInfo[], busLocations: BusLocation[] }) => {
    if (stmInfo.length === 0) return null;
    
    const firstBusLineStmInfo = stmInfo.find(s => s.line);
    if (!firstBusLineStmInfo) return null;

    const relevantBus = busLocations.find(b => b.line === firstBusLineStmInfo.line);
    if (!relevantBus) return null;
    
    const hasAccessibility = relevantBus.access === "PLATAFORMA ELEVADORA";
    const hasAC = relevantBus.thermalConfort === "Aire Acondicionado";

    if (!hasAccessibility && !hasAC) return null;

    return (
        <div className="flex items-center gap-4 pt-2">
            {hasAccessibility && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Accessibility className="h-4 w-4" />
                    <span>Accesible</span>
                </div>
            )}
            {hasAC && (
                 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Snowflake className="h-4 w-4" />
                    <span>Aire Acond.</span>
                </div>
            )}
        </div>
    )
}

const getUniqueBusLines = (steps: google.maps.DirectionsStep[]) => {
    const busLines = new Set<string>();
    steps.forEach(step => {
        if (step.travel_mode === 'TRANSIT' && step.transit?.line.short_name) {
            busLines.add(step.transit.line.short_name);
        }
    });
    return Array.from(busLines);
}

const transitPolylineOptions = { strokeColor: '#A40034', strokeOpacity: 0.8, strokeWeight: 6, zIndex: 3 };
const walkingPolylineOptions = { strokeColor: '#4A4A4A', strokeOpacity: 0, strokeWeight: 2, zIndex: 4, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 3, scale: 3, strokeColor: '#4A4A4A' }, offset: '0', repeat: '15px' }] };


export default function RouteDetailsPanel({ 
  route, 
  busLocations = [],
  isGoogleMapsLoaded,
  userLocation,
  stmInfo,
}: RouteDetailsPanelProps) {
  const leg = route.legs[0];
  const busLines = getUniqueBusLines(leg.steps);
  const duration = getTotalDuration(route.legs);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (mapRef.current && userLocation) {
        mapRef.current.panTo(userLocation);
        mapRef.current.setZoom(16);
    } else if (mapRef.current && leg.start_location) {
        mapRef.current.panTo(leg.start_location);
        mapRef.current.setZoom(16);
    }
  }, [userLocation, leg.start_location]);

  if (!leg) return null;

  const transitStops = leg.steps
    .filter(step => step.travel_mode === 'TRANSIT' && step.transit)
    .map(step => step.transit!.departure_stop.location);

  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-right-4 duration-500 -m-4 md:m-0">
      <div className="p-4 space-y-3">
        <Card>
            {isGoogleMapsLoaded ? (
                 <CardContent className="p-2">
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={userLocation || { lat: leg.start_location.lat(), lng: leg.start_location.lng() }}
                        zoom={16}
                        options={mapOptions}
                        onLoad={map => mapRef.current = map}
                    >
                       {leg.steps.map((step, index) => (
                          <Polyline 
                            key={index} 
                            path={step.path} 
                            options={step.travel_mode === 'WALKING' ? walkingPolylineOptions : transitPolylineOptions}
                          />
                        ))}
                        
                        {transitStops?.map((stop, index) => (
                           stop && <StopMarker key={index} position={{ lat: stop.lat(), lng: stop.lng() }} />
                        ))}

                        {userLocation && (
                           <Marker position={userLocation} zIndex={101} icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 6,
                                fillColor: "#4285F4",
                                fillOpacity: 1,
                                strokeWeight: 2,
                                strokeColor: "#ffffff",
                            }}/>
                        )}
                    </GoogleMap>
                 </CardContent>
            ) : (
                <div className="h-[180px] flex items-center justify-center bg-muted rounded-t-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}
          <CardHeader className="pt-4 pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2 flex-wrap">
                  {busLines.map((bus, index) => (
                    <React.Fragment key={bus}>
                      <Badge variant="outline" className="text-sm font-mono">{bus}</Badge>
                      {index < busLines.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                    </React.Fragment>
                  ))}
                  {busLines.length === 0 && leg.steps.some(s => s.travel_mode === 'WALKING') && (
                    <Badge variant="outline" className="text-sm">A pie</Badge>
                  )}
              </div>
              <div className="flex items-center gap-3 text-sm font-normal">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{duration} min</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
             <AddressDisplay prefix="Desde" location={leg.start_location} fallbackAddress={leg.start_address} />
             <AddressDisplay prefix="Hasta" location={leg.end_location} fallbackAddress={leg.end_address} />
            <BusFeatures stmInfo={stmInfo} busLocations={busLocations} />
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground px-1">Indicaciones</h3>
          <Accordion type="multiple" className="w-full space-y-1" defaultValue={['item-0']}>
            {leg.steps.map((step, index) => {
              const hasDetailedWalkingSteps = step.travel_mode === 'WALKING' && step.steps && step.steps.length > 1;
              const isTransit = step.travel_mode === 'TRANSIT' && step.transit;

              const transitStepInfo = isTransit ? stmInfo.find(info => 
                  info.line === step.transit?.line.short_name &&
                  info.departureStopLocation?.lat.toFixed(4) === step.transit?.departure_stop.location?.lat().toFixed(4)
              ) : null;
              
              if (hasDetailedWalkingSteps) {
                return (
                  <AccordionItem value={`item-${index}`} key={index} className="border-none">
                     <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                       <div className="pt-1">
                          <StepIcon type={step.travel_mode} />
                       </div>
                       <AccordionTrigger className="flex-1 text-left p-0 hover:no-underline">
                          <div className="flex-1 space-y-0.5">
                            <p className="font-medium text-xs leading-tight" dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
                            <p className="text-xs text-muted-foreground">{step.duration?.text}</p>
                          </div>
                       </AccordionTrigger>
                     </div>
                    <AccordionContent className="py-2 pl-10 pr-4 border-l ml-4">
                        <div className="space-y-2 text-xs text-muted-foreground">
                          {step.steps!.map((subStep, subIndex) => (
                             <p key={subIndex} className="flex gap-2"><Dot className="shrink-0 mt-0.5" /> <span dangerouslySetInnerHTML={{ __html: subStep.instructions || '' }} /></p>
                          ))}
                        </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              }

              return (
                <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="pt-1">
                        <StepIcon type={step.travel_mode} />
                    </div>
                    <div className="flex-1 space-y-0.5">
                        <p className="font-medium text-xs leading-tight" dangerouslySetInnerHTML={{ __html: step.instructions || '' }} />
                        <p className="text-xs text-muted-foreground">{step.duration?.text} {isTransit && `(${step.transit.num_stops} paradas)`}</p>
                        {isTransit && transitStepInfo?.arrival && (
                           <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium pt-1">
                              <Wifi className="h-3.5 w-3.5" />
                              <span>Llega en {Math.round(transitStepInfo.arrival.eta / 60)} min</span>
                           </div>
                        )}
                        {isTransit && !transitStepInfo?.arrival && step.transit?.departure_time?.text && (
                           <div className="flex items-center gap-1.5 text-muted-foreground text-xs pt-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Salida programada: {step.transit.departure_time.text}</span>
                           </div>
                        )}
                    </div>
                    {isTransit && (
                      <Badge variant="default" className="font-mono text-xs">{step.transit.line.short_name || step.transit.line.name}</Badge>
                    )}
                </div>
              )
            })}
          </Accordion>
        </div>
      </div>
    </div>
  );
}



export interface BusLocation {
    timestamp: string;
    line: string;
    id: string;
    direction: number;
    access: string;
    lastStopId: number;
    nextStopId: number;
    nextStopDistance: number;
    nextStopArrival: number;
    location: {
      type: "Point",
      coordinates: [number, number]
    },
    angle: number;
    lastUpdate: string;
    routeId: string;
    tripId: string;
    thermalConfort: string;
    destination: string | null;
    lineVariantId: number;
}

export interface StmBusStop {
    busstopId: number;
    name: string;
    location: {
      type: "Point";
      coordinates: [number, number];
    };
}

export interface ArrivalInfo {
  eta: number; // in seconds
  timestamp: string; // ISO 8601 format
}

// Info needed for STM API calls extracted from a Google Maps route step
export interface StmInfo {
    stepIndex: number;
    line: string | null;
    lineDestination: string | null;
    departureStopLocation: google.maps.LatLngLiteral | null;
    arrival: ArrivalInfo | null;
}

export interface StmLineRouteStop {
    type: number;
    stopId: number;
    name: string;
    lat: number;
    lng: number;
    isWaypoint: boolean;
}
export interface StmLineRoute {
    line: string;
    description: string;
    route: StmLineRouteStop[];
}

export interface UpcomingBus {
    busstopId: number;
    line: string;
    destination: string;
    arrival: {
        minutes: number;
        lastUpdate: string;
        busId: string;
    };
    lineVariantId: number;
}

export interface Place {
  address: string;
  location: google.maps.LatLngLiteral | null;
}

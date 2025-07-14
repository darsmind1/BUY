
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
    lineVariantId: number; // This is often the key
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
  eta: number; // in minutes
  timestamp: string;
}

export interface StmInfo {
  stopId: number | null;
  line: string;
  lineVariantId: number | null;
  lineDestination: string | null;
  departureStopLocation: google.maps.LatLngLiteral | null;
  arrival: ArrivalInfo | null;
}

export interface StmLineRoute {
    line: string;
    description: string;
    route: {
        type: number;
        stopId: number;
        name: string;
        lat: number;
        lng: number;
    }[];
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

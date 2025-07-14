
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
  eta: number; // calculated ETA in minutes from /upcomingbuses
  timestamp: string; // Not available from upcomingbuses, might need to remove or adapt
}

export interface StmInfo {
  stopId: number | null;
  line: string;
  lineDestination: string | null;
  departureStopLocation: google.maps.LatLngLiteral | null;
  arrival: ArrivalInfo | null;
}

export interface BusArrivalsState {
  [routeIndex: number]: ArrivalInfo | null;
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
}

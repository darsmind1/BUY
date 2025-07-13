
import type { BusArrival } from './stm-api';

export interface RouteOption {
  id: string;
  summary: string;
  duration: number; // in seconds
  walkingDuration: number; // in seconds
  gmapsRoute: google.maps.DirectionsResult;
  routeIndex: number;
  transitDetails: {
    line: {
      name: string;
      vehicle: string;
    };
    departureStop: {
      name: string;
      location: google.maps.LatLngLiteral;
      stopId: number | null;
    };
    arrivalStop: {
      name: string;
      location: google.maps.LatLngLiteral;
    };
    headsign: string;
    numStops: number;
  };
  walkingSteps: google.maps.DirectionsStep[];
}

export interface BusArrivalInfo {
  arrival: BusArrival | null;
  isLoading: boolean;
}

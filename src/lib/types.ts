
import type { BusLocation as StmBusLocation } from './stm-api';

export interface RouteOption {
  id: string;
  gmapsRoute: google.maps.DirectionsResult;
  routeIndex: number;
}

export type BusLocation = StmBusLocation;

export interface ArrivalInfo {
  eta: number; // calculated ETA in seconds
  timestamp: string;
}

export interface StmInfo {
  stopId: number | null;
  line: string | undefined;
  lineDestination: string | null;
  departureStopLocation: google.maps.LatLngLiteral | null;
}

export interface BusArrivalsState {
  [routeIndex: number]: ArrivalInfo | null;
}


export interface RouteOption {
  id: string;
  summary: string;
  duration: number; // in seconds
  walkingDuration: number; // in seconds
  gmapsRoute: google.maps.DirectionsRoute;
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

    
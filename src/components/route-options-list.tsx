"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bus, Clock, ArrowRight, Footprints, ChevronsRight } from 'lucide-react';

interface RouteOptionsListProps {
  routes: google.maps.DirectionsRoute[];
  onSelectRoute: (route: google.maps.DirectionsRoute, index: number) => void;
}

const getBusLines = (steps: google.maps.DirectionsStep[]) => {
  const busLines = new Set<string>();
  steps.forEach(step => {
    if (step.travel_mode === 'TRANSIT' && step.transit) {
      busLines.add(step.transit.line.short_name || step.transit.line.name);
    }
  });
  return Array.from(busLines);
}

const getTotalDuration = (legs: google.maps.DirectionsLeg[]) => {
  let totalSeconds = 0;
  legs.forEach(leg => {
    if (leg.duration) {
      totalSeconds += leg.duration.value;
    }
  });
  return Math.round(totalSeconds / 60);
}


export default function RouteOptionsList({ routes, onSelectRoute }: RouteOptionsListProps) {
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {routes.map((route, index) => {
        const busLines = getBusLines(route.legs[0].steps);
        const duration = getTotalDuration(route.legs);

        return (
          <Card 
            key={index}
            className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300"
            onClick={() => onSelectRoute(route, index)}
            style={{ animationDelay: `${index * 100}ms`}}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {busLines.map((line, lineIndex) => (
                      <React.Fragment key={line}>
                        <Badge variant="secondary" className="font-mono">{line}</Badge>
                        {lineIndex < busLines.length - 1 && <ChevronsRight className="h-4 w-4 text-muted-foreground" />}
                      </React.Fragment>
                    ))}
                    {busLines.length === 0 && (
                      <div className="flex items-center gap-2">
                        <Footprints className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Solo a pie</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{duration} min</span>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}

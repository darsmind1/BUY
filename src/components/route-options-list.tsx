
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, Footprints, Wifi, Info, Loader2 } from 'lucide-react';
import type { RouteOption, BusArrivalInfo } from '@/lib/types';

interface RouteOptionsListProps {
  routes: RouteOption[];
  onSelectRoute: (route: RouteOption) => void;
  arrivals: Record<string, BusArrivalInfo>;
}

const ArrivalInfoLegend = ({ hasRealTime }: { hasRealTime: boolean }) => {
  return (
      <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-dashed text-xs text-muted-foreground space-y-2">
         <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4" />
              <span>Leyenda de Arribos</span>
         </div>
         {hasRealTime && (
            <div className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-green-400 animate-pulse-green" />
                <span>En tiempo real (bus con GPS activo)</span>
            </div>
         )}
         <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Horario programado (bus sin GPS)</span>
         </div>
      </div>
    
  )
}

const RouteOptionItem = ({ 
  route, 
  index, 
  onSelectRoute,
  arrivalData,
}: { 
  route: RouteOption, 
  index: number, 
  onSelectRoute: (route: RouteOption) => void,
  arrivalData?: BusArrivalInfo,
}) => {
  
  const getArrivalText = () => {
    if (!arrivalData) return null;
    const { arrival, isLoading } = arrivalData;

    if (isLoading) return "Buscando arribo...";
    if (!arrival) return "Horario no disponible";
    
    if (arrival.eta === -1) {
       return "Horario programado";
    }

    const arrivalMinutes = Math.round(arrival.eta / 60);

    if (arrivalMinutes < 1) {
      return `Llegando`;
    }
    return `Llega en ${arrivalMinutes} min`;
  };

  const isRealTime = arrivalData?.arrival?.eta !== undefined && arrivalData.arrival.eta > -1;
  const arrivalText = getArrivalText();
  const walkingDuration = Math.round(route.walkingDuration / 60);
  const totalDuration = Math.round(route.duration / 60);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300 animate-in fade-in-0"
      onClick={() => onSelectRoute(route)}
      style={{ animationDelay: `${index * 100}ms`}}
    >
      <CardContent className="p-4 flex items-center">
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between">
             <div className="flex flex-col gap-1.5">
                <Badge variant="secondary" className="font-mono text-lg">{route.transitDetails.line.name}</Badge>
                <span className="text-sm text-muted-foreground">hacia {route.transitDetails.headsign}</span>
             </div>
             <div className="text-right">
                <p className="font-bold text-lg">~{totalDuration} min</p>
                <p className="text-xs text-muted-foreground">Total</p>
             </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3 mt-1">
              {arrivalData?.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Buscando arribo...</span>
                  </div>
              ) : arrivalText ? (
                 isRealTime ? (
                   <div className="flex items-center gap-2 font-medium text-green-400">
                      <Wifi className="h-4 w-4 animate-pulse-green" />
                      <span>{arrivalText}</span>
                   </div>
                 ) : (
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{arrivalText}</span>
                   </div>
                 )
               ) : null
            }
            <div className="flex items-center gap-2">
              <Footprints className="h-4 w-4" />
              <span>{walkingDuration > 0 ? `${walkingDuration} min a pie` : 'Menos de 1 min a pie'}</span>
            </div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground ml-4" />
      </CardContent>
    </Card>
  )
}

export default function RouteOptionsList({ routes, onSelectRoute, arrivals }: RouteOptionsListProps) {
  const hasApiData = Object.keys(arrivals).length > 0;
  const hasAnyRealTime = Object.values(arrivals).some(a => a.arrival?.eta !== -1);
  
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {hasApiData && (
        <ArrivalInfoLegend hasRealTime={hasAnyRealTime} />
      )}
      {routes.map((route, index) => (
        <RouteOptionItem 
            key={route.id}
            route={route} 
            index={index} 
            onSelectRoute={onSelectRoute}
            arrivalData={arrivals[route.id]}
        />
      ))}
    </div>
  );
}

    
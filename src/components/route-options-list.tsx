"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bus, Clock, ArrowRight } from 'lucide-react';

interface RouteOptionsListProps {
  routes: any[];
  onSelectRoute: (route: any) => void;
}

export default function RouteOptionsList({ routes, onSelectRoute }: RouteOptionsListProps) {
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {routes.map((route, index) => (
        <Card 
          key={route.id}
          className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-300"
          onClick={() => onSelectRoute(route)}
          style={{ animationDelay: `${index * 100}ms`}}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  {route.buses.map((bus: string) => (
                    <Badge key={bus} variant="secondary" className="font-mono">{bus}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{route.duration} min</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

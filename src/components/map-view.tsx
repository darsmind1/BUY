"use client";

import Image from 'next/image';
import { Bus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapViewProps {
  route: any | null;
}

export default function MapView({ route }: MapViewProps) {
  const busPositions = route ? route.busPositions : [
    { id: 'bus-1', top: '25%', left: '20%', animation: 'animate-move-bus-1' },
    { id: 'bus-2', top: '55%', left: '50%', animation: 'animate-move-bus-2' },
    { id: 'bus-3', top: '40%', left: '80%', animation: 'animate-move-bus-3' },
  ];

  return (
    <div className="w-full h-full bg-gray-300 relative overflow-hidden">
      <Image
        src="https://placehold.co/1200x1800.png"
        alt="Map of Montevideo"
        layout="fill"
        objectFit="cover"
        className="opacity-70"
        data-ai-hint="map montevideo satellite"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
      
      {busPositions.map((bus: any, index: number) => (
        <div
          key={bus.id}
          className={cn(
            "absolute transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500",
            route ? 'opacity-100' : 'opacity-50'
          )}
          style={{ top: bus.top, left: bus.left, animation: route ? `moveBus${route.id} ${20 + index*5}s linear infinite alternate` : bus.animation }}
        >
          <div className="p-1.5 bg-primary rounded-full shadow-lg ring-2 ring-white/50">
            <Bus className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

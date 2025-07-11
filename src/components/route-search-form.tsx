"use client";

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, MapPin } from 'lucide-react';

interface RouteSearchFormProps {
  onSearch: (origin: string, destination: string) => void;
}

export default function RouteSearchForm({ onSearch }: RouteSearchFormProps) {
  const [origin, setOrigin] = useState('Mi ubicación actual');
  const [destination, setDestination] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (destination) {
      onSearch(origin, destination);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <Label htmlFor="origin">Desde</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            id="origin" 
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="pl-9"
            placeholder="Punto de partida"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="destination">Hasta</Label>
         <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            id="destination" 
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="pl-9"
            placeholder="Escribe una dirección o lugar"
            required
          />
        </div>
      </div>
      <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        <Search className="mr-2 h-4 w-4" />
        Buscar ruta
      </Button>
    </form>
  );
}

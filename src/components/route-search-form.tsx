
"use client";

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Loader2, AlertTriangle, Bus } from 'lucide-react';

interface RouteSearchFormProps {
  onSearch: (line: string) => void;
  isApiChecking: boolean;
  isApiError: boolean;
}

export default function RouteSearchForm({ onSearch, isApiChecking, isApiError }: RouteSearchFormProps) {
  const [line, setLine] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (line) {
        onSearch(line.toUpperCase());
    }
  };
  
  const isFormDisabled = isApiChecking || isApiError;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={isFormDisabled} className="space-y-4 group">
          <Card>
              <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                      <Bus className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                          <Input 
                              id="line" 
                              value={line}
                              onChange={(e) => setLine(e.target.value)}
                              className="border-0 bg-transparent shadow-none pl-2 focus-visible:ring-0 h-9"
                              placeholder="Ej: CE1, 185, 522..."
                              required
                          />
                      </div>
                  </div>
              </CardContent>
          </Card>
          
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12 text-base font-semibold group-disabled:bg-accent/50">
              {isApiChecking ? (
                  <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Conectando...</span>
                  </>
              ) : isApiError ? (
                   <>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      <span>Servicio no disponible</span>
                  </>
              ) : (
                  <>
                      <Search className="mr-2 h-5 w-5" />
                      <span>Buscar Recorrido</span>
                  </>
              )}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}

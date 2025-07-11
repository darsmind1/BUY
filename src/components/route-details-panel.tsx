"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Footprints, Bus, Clock } from 'lucide-react';

interface RouteDetailsPanelProps {
  route: any;
}

const StepIcon = ({ type }: { type: 'walk' | 'bus' }) => {
  if (type === 'walk') {
    return <Footprints className="h-5 w-5 text-primary" />;
  }
  return <Bus className="h-5 w-5 text-primary" />;
};

export default function RouteDetailsPanel({ route }: RouteDetailsPanelProps) {
  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-3">
                {route.buses.map((bus: string) => (
                  <Badge key={bus} variant="outline" className="text-base font-mono">{bus}</Badge>
                ))}
            </div>
            <div className="flex items-center gap-2 text-base font-normal">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{route.duration} min</span>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground px-1">Indicaciones</h3>
        <div className="space-y-1">
          {route.steps.map((step: any, index: number) => (
            <div key={index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50">
                <div className="mt-1">
                    <StepIcon type={step.type} />
                </div>
                <div className="flex-1 space-y-1">
                    <p className="font-medium leading-tight">{step.instruction}</p>
                    <p className="text-sm text-muted-foreground">{step.duration} min</p>
                </div>
                {step.bus && <Badge variant="default" className="font-mono">{step.bus}</Badge>}
            </div>
          ))}
        </div>
      </div>
      
      <Accordion type="single" collapsible defaultValue='item-1'>
        <AccordionItem value="item-1">
          <AccordionTrigger className="px-1 text-sm font-semibold text-muted-foreground">Próximos arribos</AccordionTrigger>
          <AccordionContent>
            <Card className="bg-transparent shadow-none">
              <CardContent className="p-4 space-y-2">
                {route.arrivals.map((arrival: string, index: number) => (
                  <p key={index} className="text-sm">{arrival}</p>
                ))}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";

type DetailsTabsProps = {
  specs: string[];
  howItWorks: string;
  reviews: ReactNode;
};

export function DetailsTabs({ specs, howItWorks, reviews }: DetailsTabsProps) {
  return (
    <Tabs defaultValue="details" className="gap-6">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="details">Детали</TabsTrigger>
        <TabsTrigger value="process">Процесс</TabsTrigger>
        <TabsTrigger value="reviews">Отзывы</TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <ul className="grid gap-3 sm:grid-cols-2">
          {specs.map((spec) => (
            <li key={spec} className="flex gap-2 text-sm leading-6 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-rose-500" />
              <span>{spec}</span>
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="process">
        <Card className="bg-muted/30">
          <CardContent>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{howItWorks}</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reviews">{reviews}</TabsContent>
    </Tabs>
  );
}

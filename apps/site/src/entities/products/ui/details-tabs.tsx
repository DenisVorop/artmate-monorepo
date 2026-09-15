"use client";

import { useState, type ReactNode } from "react";

import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";
import type { ProductCharacteristic } from "../model";

type DetailsTabsProps = {
  characteristics: ProductCharacteristic[];
  usageInstructions?: string;
  reviews: ReactNode;
};

export function DetailsTabs({ characteristics, usageInstructions, reviews }: DetailsTabsProps) {
  const [activeTab, setActiveTab] = useState("details");
  const hasDetails = characteristics.length > 0;
  const hasInstructions = Boolean(usageInstructions?.trim());
  const availableTabs = [
    ...(hasDetails ? ["details"] : []),
    ...(hasInstructions ? ["process"] : []),
    "reviews",
  ];
  const value = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];

  return (
    <Tabs value={value} onValueChange={setActiveTab} className="gap-6">
      <TabsList className="w-full flex-wrap gap-1 group-data-horizontal/tabs:h-auto sm:w-fit">
        {hasDetails && (
          <TabsTrigger className="h-9" value="details">
            Характеристики
          </TabsTrigger>
        )}
        {hasInstructions && (
          <TabsTrigger className="h-9" value="process">
            Как пользоваться
          </TabsTrigger>
        )}
        <TabsTrigger className="h-9" value="reviews">
          Отзывы
        </TabsTrigger>
      </TabsList>

      {hasDetails && (
        <TabsContent value="details">
          <dl className="divide-y divide-border text-sm leading-6">
            {characteristics.map((item) => (
              <div key={item.name} className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-6">
                <dt className="min-w-0 wrap-anywhere text-muted-foreground">{item.name}</dt>
                <dd className="min-w-0 wrap-anywhere whitespace-pre-line">{item.value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>
      )}

      {hasInstructions && (
        <TabsContent value="process">
          <Card className="bg-muted/30">
            <CardContent>
              <p className="max-w-3xl text-sm leading-7 wrap-anywhere whitespace-pre-line text-muted-foreground">
                {usageInstructions}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="reviews">{reviews}</TabsContent>
    </Tabs>
  );
}

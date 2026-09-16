"use client";

import { useState, type ReactNode } from "react";

import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";

type DetailsTabsProps = {
  usageInstructions?: string;
  reviews: ReactNode;
};

export function DetailsTabs({ usageInstructions, reviews }: DetailsTabsProps) {
  const [activeTab, setActiveTab] = useState("process");
  const hasInstructions = Boolean(usageInstructions?.trim());
  const availableTabs = [...(hasInstructions ? ["process"] : []), "reviews"];
  const value = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];

  return (
    <Tabs value={value} onValueChange={setActiveTab} className="gap-6">
      <TabsList className="w-full flex-wrap gap-1 group-data-horizontal/tabs:h-auto sm:w-fit">
        {hasInstructions && (
          <TabsTrigger className="h-9" value="process">
            Как пользоваться
          </TabsTrigger>
        )}
        <TabsTrigger className="h-9" value="reviews">
          Отзывы
        </TabsTrigger>
      </TabsList>

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

"use client";

import { useState, type ReactNode } from "react";

import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";

type DetailsTabsProps = {
  usageInstructions?: string;
  reviews: ReactNode;
  navigation?: ReactNode;
  onTabChange?: (_tab: "process" | "reviews") => void;
};

export function DetailsTabs({
  usageInstructions,
  reviews,
  navigation,
  onTabChange,
}: DetailsTabsProps) {
  const [activeTab, setActiveTab] = useState("process");
  const hasInstructions = Boolean(usageInstructions?.trim());
  const availableTabs = [...(hasInstructions ? ["process"] : []), "reviews"];
  const value = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];

  return (
    <Tabs
      value={value}
      onValueChange={(nextTab) => {
        if ((nextTab !== "process" && nextTab !== "reviews") || nextTab === value) return;
        onTabChange?.(nextTab);
        setActiveTab(nextTab);
      }}
      className="gap-6"
    >
      <div className="flex flex-wrap items-center gap-1">
        <TabsList className="flex-wrap gap-1 group-data-horizontal/tabs:h-auto">
          {hasInstructions && (
            <TabsTrigger className="h-9" value="process">
              Как пользоваться
            </TabsTrigger>
          )}
          <TabsTrigger className="h-9" value="reviews">
            Отзывы
          </TabsTrigger>
        </TabsList>
        {navigation}
      </div>

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

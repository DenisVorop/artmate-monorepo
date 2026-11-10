"use client";

import { useAnalytics } from "../lib/analytics";
import { Palette } from "lucide-react";
import { Button, Card, CardDescription, CardTitle } from "@/shared/ui";
import { useCatalog } from "../lib/catalog-provider";

export function EmptyState() {
  const analytics = useAnalytics();
  const { clearAll } = useCatalog();

  return (
    <Card className="mx-auto max-w-md items-center gap-5 px-6 py-10 text-center sm:px-10">
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Palette className="size-5" />
      </div>

      <div className="space-y-2">
        <CardTitle>Товары не&nbsp;найдены</CardTitle>
        <CardDescription className="mx-auto max-w-xs">
          Попробуйте изменить фильтры или&nbsp;поисковый запрос.
        </CardDescription>
      </div>

      <Button
        type="button"
        onClick={() => {
          analytics.filtersReset();
          clearAll();
        }}
      >
        Очистить поиск и фильтры
      </Button>
    </Card>
  );
}

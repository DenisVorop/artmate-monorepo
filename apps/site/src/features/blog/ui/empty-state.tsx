import { SearchX } from "lucide-react";

import { Button, Card, CardContent, CardDescription, CardTitle } from "@/shared";

type EmptyStateProps = {
  onReset(): void;
};

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-10 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </span>
        <CardTitle className="text-xl">Ничего не&nbsp;найдено</CardTitle>
        <CardDescription className="mt-2 max-w-md">
          Попробуйте изменить категорию или&nbsp;поисковый запрос.
        </CardDescription>
        <Button type="button" variant="outline" className="mt-5" onClick={onReset}>
          Сбросить фильтры
        </Button>
      </CardContent>
    </Card>
  );
}

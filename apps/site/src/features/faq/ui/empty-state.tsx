import { SearchX } from "lucide-react";

import { Button, Card, CardContent, CardDescription, CardTitle } from "@/shared/ui";

type EmptyStateProps = {
  query: string;
  onReset: () => void;
};

export function EmptyState({ query, onReset }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-10 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </span>
        <CardTitle className="text-xl">Ничего не&nbsp;найдено</CardTitle>
        <CardDescription className="mt-2 max-w-md">
          По&nbsp;запросу «{query}» нет совпадений. Попробуйте изменить формулировку
          или&nbsp;посмотреть все разделы.
        </CardDescription>
        <Button type="button" variant="outline" className="mt-5" onClick={onReset}>
          Показать все вопросы
        </Button>
      </CardContent>
    </Card>
  );
}

import { AlertCircle, LoaderCircle } from "lucide-react";

import { Card, CardContent } from "./card";

type DataStateProps = {
  readonly status: "error" | "loading";
};

export function DataState({ status }: DataStateProps) {
  const isLoading = status === "loading";

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <Card className="w-full max-w-md">
        <CardContent className="flex items-start gap-3">
          {isLoading ? (
            <LoaderCircle
              className="mt-0.5 animate-spin text-violet-600"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="mt-0.5 text-destructive"
              aria-hidden="true"
            />
          )}
          <div>
            <h1 className="font-heading font-bold">
              {isLoading ? "Загружаем кабинет" : "Не удалось загрузить кабинет"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Получаем актуальные данные сотрудничества."
                : "Обновите страницу или попробуйте немного позже."}
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

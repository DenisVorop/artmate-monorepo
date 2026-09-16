import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { Card, CardContent } from "./card";

type DataStateProps = {
  readonly children?: ReactNode;
  readonly compact?: boolean;
  readonly description?: string;
  readonly status: "error" | "loading";
  readonly title?: string;
};

export function DataState({
  children,
  compact = false,
  description,
  status,
  title,
}: DataStateProps) {
  const isLoading = status === "loading";
  const content = (
    <Card className={compact ? "w-full" : "w-full max-w-md"}>
      <CardContent className="flex items-start gap-3">
        {isLoading ? (
          <LoaderCircle
            className="mt-0.5 animate-spin text-violet-600"
            aria-hidden="true"
          />
        ) : (
          <AlertCircle className="mt-0.5 text-destructive" aria-hidden="true" />
        )}
        <div>
          {compact ? (
            <p className="font-heading font-bold">
              {title ??
                (isLoading
                  ? "Загружаем кабинет"
                  : "Не удалось загрузить кабинет")}
            </p>
          ) : (
            <h1 className="font-heading font-bold">
              {title ??
                (isLoading
                  ? "Загружаем кабинет"
                  : "Не удалось загрузить кабинет")}
            </h1>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {description ??
              (isLoading
                ? "Получаем актуальные данные сотрудничества."
                : "Обновите страницу или попробуйте немного позже.")}
          </p>
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </CardContent>
    </Card>
  );

  return compact ? (
    <div role={isLoading ? "status" : "alert"}>{content}</div>
  ) : (
    <main className="grid min-h-screen place-items-center p-5">{content}</main>
  );
}

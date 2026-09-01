"use client";

import { useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import {
  getPartnerApplicationStatusLabel,
  usePartnerApplications,
  type PartnerApplicationStatus,
} from "@/entities/partner-applications";
import { partnerApplicationStatuses } from "@/shared/actions/partner-applications";
import { cn } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  NativeSelectOption,
} from "@/shared/ui";

import {
  usePartnerApplicationsState,
  type PartnerApplicationStatusFilter,
} from "../lib";
import { ApplicationsList } from "./applications-list";

export function PartnerApplicationsManagement() {
  const {
    clampPage,
    goToNextPage,
    goToPreviousPage,
    page: requestedPage,
    params,
    setStatus,
    status,
  } = usePartnerApplicationsState();
  const { applications, isError, isFetching, isPending, page, refetch } =
    usePartnerApplications(params);
  const totalPages = page?.totalPages;

  useEffect(() => {
    if (isError || isFetching || totalPages === undefined) {
      return;
    }

    clampPage(totalPages);
  }, [clampPage, isError, isFetching, totalPages]);

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить партнёрские заявки</CardTitle>
          <CardDescription>
            Проверьте соединение с API и повторите попытку.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void refetch()} variant="outline">
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isPending || !page) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загружаем партнёрские заявки</CardTitle>
          <CardDescription>
            Получаем контакты, площадки и источники обращений.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Подождите немного
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleFrom =
    page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const visibleTo = Math.min(page.page * page.pageSize, page.total);

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Inbox className="size-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">
                  {formatApplicationsCount(page.total)}
                </p>
                {isFetching ? (
                  <Badge variant="secondary">
                    <LoaderCircle
                      className="animate-spin motion-reduce:animate-none"
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    Обновляем
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {page.total > 0
                  ? "Показаны " + visibleFrom + "–" + visibleTo
                  : "Новых обращений пока нет"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label
              className="text-sm font-medium text-muted-foreground"
              htmlFor="partner-application-status-filter"
            >
              Статус
            </label>
            <NativeSelect
              className="min-w-44 flex-1 sm:flex-none"
              disabled={isFetching}
              id="partner-application-status-filter"
              onChange={(event) =>
                setStatus(event.target.value as PartnerApplicationStatusFilter)
              }
              value={status}
            >
              <NativeSelectOption value="ALL">Все заявки</NativeSelectOption>
              {partnerApplicationStatuses.map((statusOption) => (
                <NativeSelectOption key={statusOption} value={statusOption}>
                  {getPartnerApplicationStatusLabel(
                    statusOption as PartnerApplicationStatus,
                  )}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <div
        className={cn(
          "transition-opacity",
          isFetching && "pointer-events-none opacity-60",
        )}
      >
        <ApplicationsList applications={applications} />
      </div>

      {page.totalPages > 1 ? (
        <nav
          aria-label="Пагинация партнёрских заявок"
          className="flex items-center justify-between gap-3"
        >
          <Button
            disabled={requestedPage <= 1 || isFetching}
            onClick={goToPreviousPage}
            variant="outline"
          >
            <ChevronLeft data-icon="inline-start" aria-hidden="true" />
            Назад
          </Button>
          <p className="text-sm text-muted-foreground">
            Страница{" "}
            <span className="font-medium text-foreground">{requestedPage}</span>{" "}
            из {page.totalPages}
          </p>
          <Button
            disabled={requestedPage >= page.totalPages || isFetching}
            onClick={goToNextPage}
            variant="outline"
          >
            Далее
            <ChevronRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function formatApplicationsCount(total: number) {
  const mod10 = total % 10;
  const mod100 = total % 100;
  const label =
    mod10 === 1 && mod100 !== 11
      ? "заявка"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "заявки"
        : "заявок";

  return total.toLocaleString("ru-RU") + " " + label;
}

"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, SearchCheck } from "lucide-react";

import {
  formatWorkshopModerationDate,
  getWorkshopModerationStatusLabel,
  getWorkshopUserInitials,
  useWorkshopModerationQueue,
  WorkshopModerationStatusBadge,
  type WorkshopModerationQueueItem,
  type WorkshopModerationStatus,
} from "@/entities/workshop-moderation";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import {
  useWorkshopModerationQueueState,
  workshopModerationStatusFilters,
} from "../lib";
import { ProtectedAsset } from "./protected-asset";

export function WorkshopModerationQueue() {
  const { setStatus, status } = useWorkshopModerationQueueState();
  const { isError, isFetching, isPending, items, refetch } =
    useWorkshopModerationQueue(status);

  return (
    <div className="grid gap-4">
      <Card size="sm">
        <CardContent>
          <div
            aria-label="Фильтр по статусу модерации"
            className="flex gap-2 overflow-x-auto pb-1"
            role="group"
          >
            {workshopModerationStatusFilters.map((statusOption) => (
              <Button
                aria-pressed={statusOption === status}
                className="min-h-11"
                disabled={isFetching && statusOption === status}
                key={statusOption}
                onClick={() => setStatus(statusOption)}
                type="button"
                variant={statusOption === status ? "default" : "outline"}
              >
                {getWorkshopModerationStatusLabel(statusOption)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <QueueError onRetry={() => void refetch()} />
      ) : isPending ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <QueueEmpty status={status} />
      ) : (
        <div
          aria-busy={isFetching}
          className={cn(
            "grid gap-3 transition-opacity md:grid-cols-2 2xl:grid-cols-3",
            isFetching && "opacity-60",
          )}
        >
          {items.map((item) => (
            <QueueItemCard item={item} key={item.revisionId} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueItemCard({
  item,
}: {
  readonly item: WorkshopModerationQueueItem;
}) {
  return (
    <Card className="min-h-72">
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="size-11" size="lg">
            {item.author.image ? (
              <AvatarImage alt="" src={item.author.image} />
            ) : null}
            <AvatarFallback>
              {getWorkshopUserInitials(item.author.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate" role="heading" aria-level={2}>
              {item.author.name}
            </CardTitle>
            <CardDescription className="truncate">
              @{item.workshopHandle}
            </CardDescription>
          </div>
          <WorkshopModerationStatusBadge status={item.status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ProtectedAsset
          alt={`Фото работы «${item.coloring.title}» пользователя ${item.author.name}`}
          compact
          label="Фото работы"
          revisionId={item.revisionId}
          variant="thumb"
        />
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Коллекция</dt>
            <dd className="font-medium">{item.collection.title}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Раскраска</dt>
            <dd>
              № {item.coloring.number} · {item.coloring.title}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Отправлена</dt>
            <dd>{formatWorkshopModerationDate(item.submittedAt)}</dd>
          </div>
        </dl>

        {item.suspectedOfficialCopy ? (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Возможно, загружена официальная версия
          </div>
        ) : null}

        <Button asChild className="mt-auto min-h-11 w-full">
          <Link
            aria-label={`Проверить работу «${item.coloring.title}» пользователя ${item.author.name}`}
            href={routes.workshopModerationRevision(item.revisionId)}
          >
            <SearchCheck data-icon="inline-start" aria-hidden="true" />
            Проверить
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QueueSkeleton() {
  return (
    <div
      aria-label="Загрузка очереди модерации"
      className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
      role="status"
    >
      {[0, 1, 2].map((item) => (
        <Card className="min-h-72 animate-pulse" key={item}>
          <CardContent className="grid gap-4 pt-2">
            <div className="h-11 rounded-lg bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="mt-auto h-11 rounded-lg bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function QueueError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <Card className="min-h-72 justify-center">
      <CardHeader>
        <CardTitle>Не удалось загрузить очередь модерации</CardTitle>
        <CardDescription>
          Проверьте соединение с API и повторите попытку.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="min-h-11" onClick={onRetry} variant="outline">
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          Повторить
        </Button>
      </CardContent>
    </Card>
  );
}

function QueueEmpty({ status }: { readonly status: WorkshopModerationStatus }) {
  return (
    <Card className="min-h-72 justify-center text-center">
      <CardHeader>
        <CardTitle>Работ нет</CardTitle>
        <CardDescription>
          В категории «{getWorkshopModerationStatusLabel(status)}» очередь
          пуста.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

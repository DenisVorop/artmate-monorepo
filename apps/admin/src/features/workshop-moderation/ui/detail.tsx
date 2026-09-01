"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  Megaphone,
  RefreshCw,
  UserRound,
} from "lucide-react";

import {
  formatWorkshopModerationDate,
  useWorkshopModerationDetail,
  WorkshopModerationHistory,
  WorkshopModerationStatusBadge,
  type WorkshopModerationDetail as WorkshopModerationDetailModel,
} from "@/entities/workshop-moderation";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import { ApproveDialog } from "./approve-dialog";
import { ProtectedAsset } from "./protected-asset";
import { HideRevisionDialog, RequestChangesDialog } from "./reason-dialog";

export function WorkshopModerationDetail({
  revisionId,
}: {
  readonly revisionId: string;
}) {
  const { detail, isError, isPending, refetch } =
    useWorkshopModerationDetail(revisionId);

  if (isError) {
    return (
      <Card className="min-h-72 justify-center">
        <CardHeader>
          <CardTitle>Не удалось загрузить работу</CardTitle>
          <CardDescription>
            Данные ревизии не изменяются, повторите защищенный запрос.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="min-h-11"
            onClick={() => void refetch()}
            variant="outline"
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isPending || !detail) {
    return <DetailSkeleton />;
  }

  return (
    <div className="grid gap-4">
      {detail.suspectedOfficialCopy ? <SuspectedCopyWarning /> : null}
      <Summary detail={detail} />
      <Comparison detail={detail} />
      <AuthorDescription detail={detail} />
      <Materials detail={detail} />
      <SymbolMappings detail={detail} />
      <OfficialPalette detail={detail} />
      <WorkshopModerationHistory history={detail.decisionHistory} />
      <DecisionActions detail={detail} />
    </div>
  );
}

function Summary({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  const usersHref = `${routes.users}?userId=${encodeURIComponent(detail.author.id)}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <WorkshopModerationStatusBadge status={detail.status} />
          <Badge variant="outline">Ревизия {detail.revisionId}</Badge>
        </div>
        <CardTitle className="mt-2" role="heading" aria-level={2}>
          № {detail.coloring.number} · {detail.coloring.title}
        </CardTitle>
        <CardDescription>{detail.collection.title}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryValue
          label="Автор"
          value={`${detail.author.name} · @${detail.workshopHandle}`}
        />
        <SummaryValue
          label="Отправлена"
          value={formatWorkshopModerationDate(detail.submittedAt)}
        />
        <SummaryValue
          label="Создана"
          value={formatWorkshopModerationDate(detail.createdAt)}
        />
        <div className="flex flex-col items-start gap-2">
          <span className="text-xs text-muted-foreground">
            Связанные страницы
          </span>
          <Button asChild className="min-h-11" variant="outline">
            <Link href={usersHref}>
              <UserRound data-icon="inline-start" aria-hidden="true" />
              Пользователь
            </Link>
          </Button>
          <Button asChild className="min-h-11" variant="outline">
            <Link
              href={routes.digitalVersionColoring(
                detail.collection.id,
                detail.coloring.id,
              )}
            >
              <ExternalLink data-icon="inline-start" aria-hidden="true" />
              Цифровая раскраска
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Comparison({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Сравнение изображений
        </CardTitle>
        <CardDescription>
          Фото автора и официальная цветная версия показаны в одинаковом
          масштабе для визуальной проверки.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <ProtectedAsset
          alt={`Фото работы «${detail.coloring.title}» пользователя ${detail.author.name}`}
          label="Фото автора"
          revisionId={detail.revisionId}
          variant="web"
        />
        <ProtectedAsset
          alt={`Официальная цветная версия «${detail.coloring.title}»`}
          label="Официальная цветная версия Artmate"
          revisionId={detail.revisionId}
          variant="official"
        />
      </CardContent>
    </Card>
  );
}

function AuthorDescription({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Подпись автора
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {detail.caption || "Подпись не указана"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center gap-2"
            role="heading"
            aria-level={2}
          >
            <Megaphone className="size-4" aria-hidden="true" />
            Рекламное согласие
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={detail.advertisingConsent ? "default" : "outline"}>
            {detail.advertisingConsent ? "Получено" : "Не получено"}
          </Badge>
          <p className="mt-3 text-sm text-muted-foreground">
            Этот признак показан отдельно и не влияет на решение о качестве
            работы.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Materials({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Материалы, указанные автором
        </CardTitle>
        <CardDescription>
          Снимок данных на момент отправки этой ревизии.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {detail.materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">Материалы не указаны.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тип</TableHead>
                <TableHead>Бренд</TableHead>
                <TableHead>Линейка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.materials.map((material) => (
                <TableRow key={material.position}>
                  <TableCell className="font-medium">
                    {material.type === "ARTMATE_168"
                      ? "Artmate 168"
                      : "Другой набор"}
                  </TableCell>
                  <TableCell>{material.brand}</TableCell>
                  <TableCell>{material.line}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SymbolMappings({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Соответствие символов и маркеров
        </CardTitle>
        <CardDescription>
          Значения автора сопоставлены с официальными значениями Artmate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {detail.symbolMappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Соответствия не указаны.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Символ</TableHead>
                <TableHead>Указано автором</TableHead>
                <TableHead>Официальное значение</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.symbolMappings.map((mapping, index) => (
                <TableRow key={`${mapping.symbol}-${index}`}>
                  <TableCell className="font-mono text-base font-semibold">
                    {mapping.symbol}
                  </TableCell>
                  <TableCell>{mapping.markerNumber}</TableCell>
                  <TableCell>
                    {mapping.officialColor ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          aria-label={`Цвет ${mapping.officialColor.hex}`}
                          className="size-5 rounded-full border"
                          role="img"
                          style={{
                            backgroundColor: mapping.officialColor.hex,
                          }}
                        />
                        <span>
                          {mapping.officialColor.markerNumber} · №
                          {mapping.officialColor.colorNumber} ·{" "}
                          {mapping.officialColor.pantone}
                        </span>
                        <Badge variant="secondary">Artmate</Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Нет официального соответствия
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OfficialPalette({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Официальная палитра Artmate
        </CardTitle>
        <CardDescription>
          Эталон цифровой раскраски, отдельно от данных автора.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {detail.officialComparison.palette.colors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Официальная палитра не указана.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {detail.officialComparison.palette.colors.map((color) => (
              <div
                className="flex items-center gap-3 rounded-lg border p-3"
                key={color.symbolPosition}
              >
                <span
                  aria-label={`Цвет ${color.hex}`}
                  className="size-8 shrink-0 rounded-full border"
                  role="img"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {color.symbol} · {color.markerNumber}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    №{color.colorNumber} · {color.pantone} · {color.hex}
                  </p>
                </div>
                <Badge className="ml-auto" variant="secondary">
                  Artmate
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DecisionActions({
  detail,
}: {
  readonly detail: WorkshopModerationDetailModel;
}) {
  if (detail.status !== "PENDING" && detail.status !== "APPROVED") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Решение модератора
        </CardTitle>
        <CardDescription>
          Идентификаторы и текущий статус недоступны для ручного редактирования.
          Допустимый переход определяет backend.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {detail.status === "PENDING" ? (
          <>
            <ApproveDialog revisionId={detail.revisionId} />
            <RequestChangesDialog revisionId={detail.revisionId} />
          </>
        ) : (
          <HideRevisionDialog revisionId={detail.revisionId} />
        )}
      </CardContent>
    </Card>
  );
}

function SuspectedCopyWarning() {
  return (
    <div
      className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
      role="alert"
    >
      <AlertTriangle
        className="mt-0.5 size-5 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div>
        <p className="font-medium text-destructive">
          Подозрение на копию официальной версии
        </p>
        <p className="mt-1 text-muted-foreground">
          Сравните фото автора с эталоном перед принятием решения.
        </p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-label="Загрузка работы" className="grid gap-4" role="status">
      <Card className="min-h-48 animate-pulse">
        <CardContent className="grid gap-4 pt-2">
          <div className="h-6 w-1/3 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </CardContent>
      </Card>
      <Card className="min-h-[28rem] animate-pulse">
        <CardContent className="grid gap-4 pt-2 md:grid-cols-2">
          <div className="aspect-square rounded-xl bg-muted" />
          <div className="aspect-square rounded-xl bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}

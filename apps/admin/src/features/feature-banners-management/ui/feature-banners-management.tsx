"use client";

import { Archive, Megaphone, Plus, Power, PowerOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";

import {
  featureBannerAudiences,
  featureBannerTones,
  getFeatureBannerAudienceLabel,
  getFeatureBannerStatusLabel,
  getFeatureBannerToneLabel,
  type FeatureBanner,
  useFeatureBanners,
} from "@/entities/feature-banners";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/shared/ui";

import {
  defaultFeatureBannerFormValues,
  featureBannerFormSchema,
  toCreateFeatureBannerInput,
  type FeatureBannerFormValues,
} from "../lib";
import {
  useArchiveFeatureBanner,
  useCreateFeatureBanner,
  useUpdateFeatureBanner,
} from "../model";

const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export function FeatureBannersManagement() {
  const { banners, isError, isPending } = useFeatureBanners();

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить баннеры</CardTitle>
          <CardDescription>Перезагрузите страницу и повторите действие.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка баннеров</CardTitle>
          <CardDescription>Получаем настройки сервисных уведомлений.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
      <CreateBannerCard />
      <BannersTable banners={banners} />
    </div>
  );
}

function CreateBannerCard() {
  const { handleSubmit, register, reset } = useForm<FeatureBannerFormValues>({
    defaultValues: defaultFeatureBannerFormValues,
    resolver: zodResolver(featureBannerFormSchema),
  });
  const createBanner = useCreateFeatureBanner();
  const submitForm = handleSubmit(async (values) => {
    await createBanner.mutate(toCreateFeatureBannerInput(values));
    reset(defaultFeatureBannerFormValues);
  });

  return (
    <Card className="xl:sticky xl:top-8 xl:self-start">
      <CardHeader>
        <CardTitle>Новый баннер</CardTitle>
        <CardDescription>Создайте флаг, который сайт покажет над хедером.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitForm}>
          <LabeledField label="Slug">
            <Input placeholder="telegram-link" {...register("slug")} />
          </LabeledField>
          <LabeledField label="Заголовок">
            <Input placeholder="Подключите Telegram" {...register("title")} />
          </LabeledField>
          <LabeledField label="Описание">
            <Textarea
              placeholder="Будем присылать обновления по заказам в удобный чат."
              rows={4}
              {...register("description")}
            />
          </LabeledField>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Кнопка">
              <Input placeholder="Подключить" {...register("ctaLabel")} />
            </LabeledField>
            <LabeledField label="Ссылка">
              <Input placeholder="/account" {...register("ctaHref")} />
            </LabeledField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField label="Аудитория">
              <select className={fieldClassName} {...register("audience")}>
                {featureBannerAudiences.map((audience) => (
                  <option key={audience} value={audience}>
                    {getFeatureBannerAudienceLabel(audience)}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Тон">
              <select className={fieldClassName} {...register("tone")}>
                {featureBannerTones.map((tone) => (
                  <option key={tone} value={tone}>
                    {getFeatureBannerToneLabel(tone)}
                  </option>
                ))}
              </select>
            </LabeledField>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <LabeledField label="Порядок">
              <Input type="number" min={0} {...register("sortOrder")} />
            </LabeledField>
            <label className="grid content-end gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Старт</span>
              <span className="flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm">
                <input type="checkbox" {...register("enabled")} />
                Включить
              </span>
            </label>
          </div>
          <Button type="submit" disabled={createBanner.isPending}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BannersTable({ banners }: { readonly banners: readonly FeatureBanner[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Сервисные баннеры</CardTitle>
        <CardDescription>Флаги, которые сайт получает из API.</CardDescription>
        <CardAction>
          <Badge variant="secondary">
            <Megaphone data-icon="inline-start" aria-hidden="true" />
            {banners.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {banners.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Баннер</TableHead>
                <TableHead>Аудитория</TableHead>
                <TableHead>Тон</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner) => (
                <BannerTableRow banner={banner} key={banner.id} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Баннеры пока не созданы
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BannerTableRow({ banner }: { readonly banner: FeatureBanner }) {
  const isArchived = Boolean(banner.archivedAt);
  const updateBanner = useUpdateFeatureBanner();
  const archiveBanner = useArchiveFeatureBanner();
  const nextEnabled = !banner.enabled;

  return (
    <TableRow>
      <TableCell className="min-w-80 whitespace-normal">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{banner.title}</span>
            <Badge variant="outline">{banner.slug}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">{banner.description}</span>
          {banner.ctaHref && banner.ctaLabel ? (
            <span className="text-xs text-muted-foreground">
              {banner.ctaLabel}: {banner.ctaHref}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>{getFeatureBannerAudienceLabel(banner.audience)}</TableCell>
      <TableCell>{getFeatureBannerToneLabel(banner.tone)}</TableCell>
      <TableCell>
        <Badge variant={isArchived ? "outline" : banner.enabled ? "default" : "secondary"}>
          {getFeatureBannerStatusLabel(banner)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={isArchived || updateBanner.isPending}
            onClick={() =>
              updateBanner.mutate({
                bannerId: banner.id,
                input: { enabled: nextEnabled },
              })
            }
          >
            {nextEnabled ? (
              <Power data-icon="inline-start" aria-hidden="true" />
            ) : (
              <PowerOff data-icon="inline-start" aria-hidden="true" />
            )}
            {nextEnabled ? "Включить" : "Выключить"}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="destructive"
            disabled={isArchived || archiveBanner.isPending}
            onClick={() => archiveBanner.mutate(banner.id)}
          >
            <Archive data-icon="inline-start" aria-hidden="true" />
            Архив
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function LabeledField({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

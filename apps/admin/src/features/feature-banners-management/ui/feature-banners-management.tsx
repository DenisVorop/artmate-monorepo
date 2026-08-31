"use client";

import { Archive, Megaphone, Plus, Power, PowerOff, Users } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  featureBannerAudiences,
  featureBannerTones,
  getFeatureBannerAudienceLabel,
  getFeatureBannerStatusLabel,
  getFeatureBannerToneLabel,
  type FeatureBanner,
  type FeatureBannerAudience,
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
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  featureBannerAudiencesFormSchema,
  featureBannerFormSchema,
  getNextFeatureBannerAudiences,
  toCreateFeatureBannerInput,
  type FeatureBannerAudiencesFormValues,
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
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FeatureBannerFormValues>({
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
        <CardDescription>Создайте флаг с условиями показа на сайте.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitForm}>
          <LabeledField error={errors.slug?.message} label="Slug">
            <Input placeholder="telegram-link" {...register("slug")} />
          </LabeledField>
          <LabeledField error={errors.title?.message} label="Заголовок">
            <Input placeholder="Подключите Telegram" {...register("title")} />
          </LabeledField>
          <LabeledField error={errors.description?.message} label="Описание">
            <Textarea
              placeholder="Будем присылать обновления по заказам в удобный чат."
              rows={4}
              {...register("description")}
            />
          </LabeledField>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField error={errors.ctaLabel?.message} label="Кнопка">
              <Input placeholder="Подключить" {...register("ctaLabel")} />
            </LabeledField>
            <LabeledField error={errors.ctaHref?.message} label="Ссылка">
              <Input placeholder="/account" {...register("ctaHref")} />
            </LabeledField>
          </div>
          <Controller
            control={control}
            name="audiences"
            render={({ field, fieldState }) => (
              <AudienceCheckboxGroup
                audiences={field.value}
                error={fieldState.error?.message}
                onChange={field.onChange}
              />
            )}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledField error={errors.tone?.message} label="Тон">
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
            <LabeledField error={errors.sortOrder?.message} label="Порядок">
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
      <TableCell className="min-w-64 whitespace-normal">
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
      <TableCell className="min-w-48 whitespace-normal">
        <div className="flex flex-wrap gap-1">
          {banner.audiences.map((audience) => (
            <Badge key={audience} variant="secondary">
              {getFeatureBannerAudienceLabel(audience)}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>{getFeatureBannerToneLabel(banner.tone)}</TableCell>
      <TableCell>
        <Badge variant={isArchived ? "outline" : banner.enabled ? "default" : "secondary"}>
          {getFeatureBannerStatusLabel(banner)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <EditBannerAudiencesDialog banner={banner} />
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

function EditBannerAudiencesDialog({
  banner,
}: {
  readonly banner: FeatureBanner;
}) {
  const [open, setOpen] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
  } = useForm<FeatureBannerAudiencesFormValues>({
    defaultValues: { audiences: banner.audiences },
    resolver: zodResolver(featureBannerAudiencesFormSchema),
  });
  const updateBanner = useUpdateFeatureBanner({
    onSuccess: () => setOpen(false),
  });
  const isArchived = Boolean(banner.archivedAt);
  const submitForm = handleSubmit((values) =>
    updateBanner.mutate({
      bannerId: banner.id,
      input: { audiences: values.audiences },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          reset({ audiences: banner.audiences });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          aria-label={`Изменить аудитории баннера ${banner.title}`}
          disabled={isArchived}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Users aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Аудитории баннера</DialogTitle>
          <DialogDescription>
            {banner.title}. Достаточно совпадения с одной аудиторией.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submitForm}>
          <Controller
            control={control}
            name="audiences"
            render={({ field, fieldState }) => (
              <AudienceCheckboxGroup
                audiences={field.value}
                error={fieldState.error?.message}
                onChange={field.onChange}
                showDescription={false}
              />
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button
                disabled={updateBanner.isPending}
                type="button"
                variant="outline"
              >
                Отмена
              </Button>
            </DialogClose>
            <Button disabled={updateBanner.isPending} type="submit">
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AudienceCheckboxGroup({
  audiences,
  error,
  onChange,
  showDescription = true,
}: {
  readonly audiences: readonly FeatureBannerAudience[];
  readonly error?: string;
  readonly onChange: (audiences: FeatureBannerAudience[]) => void;
  readonly showDescription?: boolean;
}) {
  const idPrefix = useId();

  return (
    <fieldset className="grid min-w-0 gap-2 rounded-lg border border-input p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">Аудитории</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {featureBannerAudiences.map((audience) => {
          const id = `${idPrefix}-${audience}`;

          return (
            <label
              className="flex min-w-0 items-start gap-2 text-sm"
              htmlFor={id}
              key={audience}
            >
              <Checkbox
                aria-invalid={Boolean(error)}
                checked={audiences.includes(audience)}
                id={id}
                onCheckedChange={(checked) =>
                  onChange(
                    getNextFeatureBannerAudiences(
                      audiences,
                      audience,
                      checked === true,
                    ),
                  )
                }
              />
              <span className="min-w-0 leading-4">
                {getFeatureBannerAudienceLabel(audience)}
              </span>
            </label>
          );
        })}
      </div>
      {showDescription ? (
        <p className="text-xs text-muted-foreground">
          Достаточно совпадения с одной аудиторией.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}

function LabeledField({
  children,
  error,
  label,
}: {
  readonly children: ReactNode;
  readonly error?: string;
  readonly label: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

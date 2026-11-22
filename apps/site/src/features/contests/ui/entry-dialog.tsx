"use client";

import Image from "next/image";
import { Link } from "@/shared/ui/link";
import { routes } from "@/shared/constants";
import { EntryConsents } from "./entry-consents";
import { usePrepareEntryConsent } from "../model/use-prepare-entry-consent";
import { ImagePlus, X } from "lucide-react";
import type { RefObject } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useIsMobile } from "@/shared/lib/device";
import {
  Button,
  CtaGradientButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerFooter,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";

import {
  emptyContestConsent,
  createContestEntrySchema,
  contestPhotoSchema,
  type ContestEntryValues,
} from "../lib/entry-form";
import { useProductsData } from "@/entities/products";
import { usePhotoUrl } from "../lib/use-photo-url";

type Props = {
  returnFocusRef: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange(_open: boolean): void;
  contestTitle: string;
  slug: string;
  initialValues?: Partial<ContestEntryValues>;
  existingPhoto?: string;
  hasExistingPhoto?: boolean;
  isPending?: boolean;
  onSubmit(_values: ContestEntryValues): Promise<unknown>;
};

export function EntryDialog({
  open,
  onOpenChange,
  contestTitle,
  slug,
  initialValues,
  onSubmit,
  returnFocusRef,
  existingPhoto,
  hasExistingPhoto = false,
  isPending = false,
}: Props) {
  const mobile = useIsMobile();
  const form = useForm<ContestEntryValues>({
    resolver: zodResolver(createContestEntrySchema(hasExistingPhoto)),
    defaultValues: {
      ...emptyContestConsent,
      albumId: "",
      number: "",
      caption: "",
      ...initialValues,
    },
  });
  function restoreFocus(event: Event) {
    event.preventDefault();
    returnFocusRef.current?.focus({ preventScroll: true });
  }
  const content = (
    <EntryForm
      form={form}
      onSubmit={onSubmit}
      existingPhoto={existingPhoto}
      isPending={isPending}
      slug={slug}
      open={open}
    />
  );

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} handleOnly>
        <DrawerContent
          onCloseAutoFocus={restoreFocus}
          data-contest-entry="drawer"
          className="gap-0 border-rose-100 bg-white"
        >
          <DrawerHeader className="relative shrink-0 gap-2 border-b border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 px-5 py-5 pr-16 text-left">
            <DrawerTitle className="font-heading text-xl font-bold">Работа на конкурс</DrawerTitle>
            <DrawerDescription className="text-stone-600">{contestTitle}</DrawerDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 size-11"
              aria-label="Закрыть"
              onClick={() => onOpenChange(false)}
            >
              <X aria-hidden />
            </Button>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={restoreFocus}
        data-contest-entry="dialog"
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden border-rose-100 p-0 sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0 gap-2 border-b border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 p-6 pr-16 sm:px-8">
          <DialogTitle className="font-heading text-2xl font-bold">Работа на конкурс</DialogTitle>
          <DialogDescription className="text-base text-stone-600">{contestTitle}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  form,
  onSubmit,
  existingPhoto,
  isPending,
  slug,
  open,
}: {
  form: UseFormReturn<ContestEntryValues>;
  onSubmit(_values: ContestEntryValues): Promise<unknown>;
  existingPhoto?: string;
  isPending: boolean;
  slug: string;
  open: boolean;
}) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = form;
  const { data: catalog, isPending: isCatalogPending, isError: isCatalogError } = useProductsData();
  const albums = catalog?.products.filter((product) => product.categorySlug !== "markery") ?? [];
  const photo = useWatch({ control, name: "photo" });
  const consentOfferId = useWatch({ control, name: "consentOfferId" });
  const consent = usePrepareEntryConsent(slug);
  const rulesDocument = consent.offer?.documents.find(
    (document) => document.id === "contest-rules",
  );
  const localPhotoUrl = usePhotoUrl(
    contestPhotoSchema.safeParse(photo).success ? photo : undefined,
  );
  const photoUrl = localPhotoUrl ?? existingPhoto;

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        form.clearErrors("root");
        try {
          await onSubmit(values);
        } catch (error) {
          form.setError("root", {
            message:
              error instanceof Error
                ? error.message
                : "Не удалось отправить работу. Попробуйте ещё раз",
          });
        }
      })}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <DrawerBody className="space-y-6 px-5 py-5 sm:p-8">
        <fieldset
          disabled={isPending}
          className="grid items-start gap-6 md:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]"
        >
          <div className="min-w-0 space-y-3">
            <Label htmlFor="contest-photo">Фотография работы</Label>
            <Controller
              name="photo"
              control={control}
              render={({ field: { onChange, ref, onBlur } }) => {
                function selectPhoto(file?: File) {
                  if (!file || isPending) return;
                  onChange(file);
                  void trigger("photo");
                }
                return (
                  <div
                    className="relative overflow-hidden rounded-2xl border-2 border-dashed border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 transition-colors focus-within:border-rose-400 focus-within:ring-4 focus-within:ring-rose-100 hover:border-rose-400"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      selectPhoto(event.dataTransfer.files[0]);
                    }}
                  >
                    {photoUrl ? (
                      <>
                        <div className="relative h-64 bg-white/60">
                          <Image
                            src={photoUrl}
                            alt="Ваша работа"
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                        <p className="px-4 py-3 text-center text-sm font-semibold text-rose-700">
                          Заменить фотографию
                        </p>
                      </>
                    ) : (
                      <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-5 py-8 text-center">
                        <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm shadow-rose-200/50">
                          <ImagePlus className="size-7" aria-hidden />
                        </span>
                        <div className="space-y-2">
                          <p className="text-base font-bold text-rose-700">Выберите фотографию</p>
                          <p className="text-sm text-stone-600">или перетащите её сюда</p>
                        </div>
                      </div>
                    )}
                    <Input
                      id="contest-photo"
                      ref={ref}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onBlur={onBlur}
                      onChange={(event) => selectPhoto(event.target.files?.[0])}
                      aria-label={photoUrl ? "Заменить фотографию" : "Выберите фотографию"}
                      aria-invalid={Boolean(errors.photo)}
                      aria-describedby={`contest-photo-help${errors.photo ? " contest-photo-error" : ""}`}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </div>
                );
              }}
            />
            <p id="contest-photo-help" className="text-xs leading-5 text-stone-500">
              JPEG, PNG или WebP, до 10 МБ.
            </p>
            {errors.photo?.message && (
              <p id="contest-photo-error" role="alert" className="text-sm text-red-700">
                {errors.photo.message}
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="contest-album">Альбом</Label>
              <Controller
                name="albumId"
                control={control}
                render={({ field }) => (
                  <Select
                    disabled={isCatalogPending || isCatalogError || !albums.length}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      setValue("number", "");
                    }}
                  >
                    <SelectTrigger
                      id="contest-album"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={Boolean(errors.albumId)}
                      aria-describedby={errors.albumId ? "contest-album-error" : undefined}
                      className="min-h-12 w-full"
                    >
                      <SelectValue
                        placeholder={isCatalogPending ? "Загружаем альбомы…" : "Выберите альбом"}
                      />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                      {albums.map((album) => (
                        <SelectItem key={album.id} value={album.id}>
                          {album.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {isCatalogError && (
                <p role="alert" className="text-sm text-red-700">
                  Не удалось загрузить альбомы. Закройте форму и обновите страницу.
                </p>
              )}
              {!isCatalogPending && !isCatalogError && !albums.length && (
                <p className="text-sm text-stone-500">Альбомов пока нет в каталоге.</p>
              )}
              {errors.albumId?.message && (
                <p id="contest-album-error" role="alert" className="text-sm text-red-700">
                  {errors.albumId.message}
                </p>
              )}
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="contest-number">
                Номер картинки <span className="font-normal text-stone-500">· необязательно</span>
              </Label>
              <Input
                id="contest-number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Например, 12"
                className="min-h-12"
                aria-invalid={Boolean(errors.number)}
                aria-describedby={errors.number ? "contest-number-error" : undefined}
                {...register("number")}
              />
              {errors.number?.message && (
                <p id="contest-number-error" role="alert" className="text-sm text-red-700">
                  {errors.number.message}
                </p>
              )}
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="contest-caption">
                Подпись <span className="font-normal text-stone-500">· необязательно</span>
              </Label>
              <Textarea
                id="contest-caption"
                rows={3}
                maxLength={500}
                aria-invalid={Boolean(errors.caption)}
                aria-describedby={errors.caption ? "contest-caption-error" : undefined}
                {...register("caption")}
              />
              {errors.caption?.message && (
                <p id="contest-caption-error" role="alert" className="text-sm text-red-700">
                  {errors.caption.message}
                </p>
              )}
            </div>
          </div>
        </fieldset>
        <EntryConsents form={form} open={open} pending={isPending} consent={consent} />
        <div>
          {errors.root?.message && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {errors.root.message}
            </p>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter className="border-rose-100 px-5 sm:px-8">
        {consent.offer && rulesDocument && (
          <p className="text-sm leading-5 text-stone-600">
            Нажимая «Отправить работу», вы принимаете{" "}
            <Link
              href={routes.legal.contestRulesRevision(rulesDocument.version)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              правила
            </Link>{" "}
            и{" "}
            <Link
              href={routes.legal.contestConditions(slug, consent.offer.conditions.id)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              условия конкурса
            </Link>
            .
          </p>
        )}
        <CtaGradientButton
          type="submit"
          size="lg"
          className="min-h-12 w-full"
          disabled={
            isPending ||
            isCatalogPending ||
            isCatalogError ||
            !albums.length ||
            !consentOfferId ||
            !rulesDocument
          }
        >
          {isPending ? "Отправляем…" : "Отправить работу"}
        </CtaGradientButton>
      </DrawerFooter>
    </form>
  );
}

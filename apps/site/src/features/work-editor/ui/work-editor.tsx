"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ChevronLeft, ChevronRight, RotateCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, type FieldErrors, useForm, useWatch } from "react-hook-form";

import {
  type WorkshopMarkerColor,
  useMarkerColors,
  useWorkshopColoringData,
  useWorkshopTools,
} from "@/entities/workshop";
import type { WorkshopSubmissionIntent } from "@/shared/actions/workshops";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Textarea,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import {
  acceptedWorkshopPhotoTypes,
  getEditorDefaultValues,
  toCreateRevisionInput,
  workEditorFormSchema,
  type WorkEditorFormValues,
} from "../lib";
import { useCreateWorkshopRevision, useSaveWorkshopTool } from "../model";
import { editorSteps, EditorStepper } from "./stepper";
import { PhotoPreview } from "./photo-preview";

export function WorkEditor({ slug, number }: { slug: string; number: number }) {
  const router = useRouter();
  const query = useWorkshopColoringData(slug, number);

  if (query.isPending) {
    return (
      <DataState title="Открываем редактор" description="Загружаем картину и черновик работы." />
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <DataState
          variant="error"
          title="Не удалось открыть редактор"
          description="Проверьте соединение и попробуйте ещё раз."
        />
        <div className="flex justify-center">
          <Button type="button" className="min-h-11" onClick={() => void query.refetch()}>
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  if (query.data.work?.currentRevision?.status === "PENDING") {
    return (
      <div className="space-y-4">
        <DataState
          title="Работа уже на проверке"
          description="Дождитесь решения модератора. После него можно будет исправить или заменить фотографию."
        />
        <div className="flex justify-center">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={routes.workshopCollection(slug)}>Вернуться к тематике</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <EditorForm
      key={query.data.work?.currentRevision?.id ?? query.data.coloring.id}
      slug={slug}
      number={number}
      data={query.data}
      onSuccess={() => router.push(routes.workshopCollection(slug))}
    />
  );
}

function EditorForm({
  slug,
  number,
  data,
  onSuccess,
}: {
  slug: string;
  number: number;
  data: NonNullable<ReturnType<typeof useWorkshopColoringData>["data"]>;
  onSuccess: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [submissionIntent, setSubmissionIntent] = useState<WorkshopSubmissionIntent>("DRAFT");
  const [objectUrl, setObjectUrl] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const defaultValues = getEditorDefaultValues(data);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<WorkEditorFormValues>({
    resolver: zodResolver(workEditorFormSchema),
    defaultValues,
  });
  const values = useWatch({ control });
  const selectedPhoto = useWatch({ control, name: "photo" });
  const toolType = useWatch({ control, name: "toolType" });
  const crop = useWatch({ control, name: "crop" });
  const toolsQuery = useWorkshopTools();
  const markerColorsQuery = useMarkerColors(toolType === "ARTMATE_168");
  const officialMarkerOptions =
    markerColorsQuery.colors.length > 0
      ? markerColorsQuery.colors
      : (toolsQuery.tools.find((tool) => tool.type === "ARTMATE_168")?.officialPalette ?? []);
  const canAdjustCrop = Boolean(selectedPhoto);
  const createRevision = useCreateWorkshopRevision(slug, number, {
    onSuccess: () => {
      reset(defaultValues);
      onSuccess();
    },
  });
  const saveTool = useSaveWorkshopTool();
  const isSaving = createRevision.isPending || saveTool.isPending || toolsQuery.isPending;

  useEffect(() => {
    if (!selectedPhoto) {
      setObjectUrl(undefined);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedPhoto);
    setObjectUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedPhoto]);

  function selectTool(type: "ARTMATE_168" | "CUSTOM") {
    setValue("toolType", type, { shouldDirty: true, shouldValidate: true });

    if (type === "ARTMATE_168") {
      setValue("brand", "Artmate", { shouldDirty: true, shouldValidate: true });
      setValue("line", "168", { shouldDirty: true, shouldValidate: true });
      setValue(
        "mappings",
        data.coloring.officialRevision.palette.colors.map((color) => ({
          symbol: color.symbol,
          markerNumber: color.markerNumber,
        })),
        { shouldDirty: true, shouldValidate: true },
      );
    } else {
      setValue("brand", "", { shouldDirty: true, shouldValidate: true });
      setValue("line", "", { shouldDirty: true, shouldValidate: true });
      setValue(
        "mappings",
        data.coloring.officialRevision.palette.colors.map((color) => ({
          symbol: color.symbol,
          markerNumber: "",
        })),
        { shouldDirty: true },
      );
    }
  }

  async function onSubmit(formValues: WorkEditorFormValues) {
    setServerError(undefined);

    if (!formValues.photo && !data.work?.currentRevision) {
      setError("photo", { message: "Добавьте фотографию готовой работы" });
      setCurrentStep(0);
      return;
    }

    try {
      const savedTool = toolsQuery.tools.find(
        (tool) =>
          tool.type === formValues.toolType &&
          tool.brand === formValues.brand &&
          tool.line === formValues.line,
      );
      const officialColors =
        officialMarkerOptions.length > 0
          ? officialMarkerOptions
          : (savedTool?.officialPalette ?? []);

      if (formValues.toolType === "ARTMATE_168") {
        const invalidMappingIndex = formValues.mappings.findIndex(
          (mapping) =>
            mapping.markerNumber.trim().length > 0 &&
            !officialColors.some((color) => color.markerNumber === mapping.markerNumber.trim()),
        );

        if (invalidMappingIndex >= 0) {
          setError(`mappings.${invalidMappingIndex}.markerNumber`, {
            message: "Выберите номер из официального каталога Artmate",
          });
          setCurrentStep(3);
          return;
        }
      }

      const tool =
        savedTool ??
        (await saveTool.mutate({
          type: formValues.toolType,
          brand: formValues.brand,
          line: formValues.line,
        }));

      await createRevision.mutate(
        toCreateRevisionInput(formValues, submissionIntent, tool.id, officialColors),
      );
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Не удалось сохранить работу");
    }
  }

  function onInvalid(formErrors: FieldErrors<WorkEditorFormValues>) {
    if (formErrors.photo) {
      setCurrentStep(0);
    } else if (formErrors.crop) {
      setCurrentStep(1);
    } else if (formErrors.toolType || formErrors.brand || formErrors.line) {
      setCurrentStep(2);
    } else if (formErrors.mappings) {
      setCurrentStep(3);
    } else if (formErrors.caption) {
      setCurrentStep(4);
    } else if (formErrors.advertisingConsent) {
      setCurrentStep(5);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-bold tracking-wide text-rose-500 uppercase">
          {data.collection.title} · Картина {data.coloring.number}
        </p>
        <PageTitle>{data.work ? "Обновить работу" : "Добавить работу"}</PageTitle>
        <p className="max-w-3xl text-stone-600">
          Загрузите фото уже раскрашенной физической картины. Это не редактор рисования: здесь можно
          только подготовить фотографию и описать использованные материалы.
        </p>
        {data.work?.publishedRevision ? (
          <Badge className="h-auto max-w-full justify-start bg-emerald-100 py-1 text-left leading-snug whitespace-normal text-emerald-800">
            Опубликованная версия останется видимой, пока новая проходит проверку
          </Badge>
        ) : null}
      </header>

      <EditorStepper currentStep={currentStep} onStepChange={setCurrentStep} />

      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit, onInvalid)(event);
        }}
      >
        <Card className="overflow-visible">
          <CardContent className="p-4 sm:p-6">
            {currentStep === 0 ? (
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)] lg:items-start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="work-photo">Фото готовой раскраски</Label>
                    <Controller
                      name="photo"
                      control={control}
                      render={({ field: { onChange, ref } }) => (
                        <Input
                          ref={ref}
                          id="work-photo"
                          type="file"
                          accept={acceptedWorkshopPhotoTypes.join(",")}
                          className="min-h-11 file:mr-3 file:font-bold"
                          aria-invalid={Boolean(errors.photo)}
                          onChange={(event) => onChange(event.target.files?.[0])}
                        />
                      )}
                    />
                    <p className="text-sm text-stone-500">JPEG, PNG или WebP, не более 10 МиБ.</p>
                    {errors.photo?.message ? (
                      <p className="text-sm text-destructive">{errors.photo.message}</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-950">
                    <Camera className="mb-2 size-5 text-rose-500" aria-hidden="true" />
                    Снимайте при ровном освещении, держите камеру параллельно листу и оставьте
                    небольшой запас по краям для кадрирования.
                  </div>
                </div>
                <PhotoPreview
                  objectUrl={objectUrl}
                  revisionId={data.work?.currentRevision?.id}
                  alt={`Предпросмотр работы ${data.coloring.number}`}
                />
              </section>
            ) : null}

            {currentStep === 1 ? (
              <section className="grid gap-6 lg:grid-cols-[minmax(18rem,28rem)_minmax(0,1fr)] lg:items-start">
                <PhotoPreview
                  objectUrl={objectUrl}
                  revisionId={data.work?.currentRevision?.id}
                  alt={`Кадрирование работы ${data.coloring.number}`}
                  crop={objectUrl ? crop : undefined}
                />
                <div className="space-y-6">
                  {!canAdjustCrop ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      {data.work?.currentRevision
                        ? "Без нового фото сервер сохранит прежний кадр без изменений. Чтобы изменить кадрирование, вернитесь на шаг «Фото» и выберите замену."
                        : "Сначала выберите фотографию на шаге «Фото», затем настройте кадрирование."}
                    </p>
                  ) : null}
                  <CropSlider
                    label="Масштаб"
                    value={crop.zoom}
                    min={1}
                    max={3}
                    step={0.05}
                    disabled={!canAdjustCrop}
                    onChange={(value) => setValue("crop.zoom", value, { shouldDirty: true })}
                  />
                  <CropSlider
                    label="По горизонтали"
                    value={crop.x}
                    min={-1}
                    max={1}
                    step={0.01}
                    disabled={!canAdjustCrop}
                    onChange={(value) => setValue("crop.x", value, { shouldDirty: true })}
                  />
                  <CropSlider
                    label="По вертикали"
                    value={crop.y}
                    min={-1}
                    max={1}
                    step={0.01}
                    disabled={!canAdjustCrop}
                    onChange={(value) => setValue("crop.y", value, { shouldDirty: true })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={!canAdjustCrop}
                    onClick={() =>
                      setValue(
                        "crop.rotation",
                        ((crop.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                        {
                          shouldDirty: true,
                        },
                      )
                    }
                  >
                    <RotateCw data-icon="inline-start" />
                    Повернуть на 90°
                  </Button>
                  <p className="text-sm text-stone-500">
                    Кадр сохраняется в нормализованном виде. Финальную обработку выполняет сервер.
                  </p>
                </div>
              </section>
            ) : null}

            {currentStep === 2 ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold">Материалы</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Выберите Artmate 168 или сохраните свою комбинацию бренда и линейки.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ToolChoice
                    active={toolType === "ARTMATE_168"}
                    title="Artmate 168"
                    description="Официальный каталог маркеров и точная палитра картины"
                    onClick={() => selectTool("ARTMATE_168")}
                  />
                  <ToolChoice
                    active={toolType === "CUSTOM"}
                    title="Другие материалы"
                    description="Ваш бренд и линейка; данные будут показаны как авторские"
                    onClick={() => selectTool("CUSTOM")}
                  />
                </div>

                {toolsQuery.tools.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="saved-tool">Сохранённые материалы</Label>
                    <Select
                      onValueChange={(id) => {
                        const tool = toolsQuery.tools.find((item) => item.id === id);
                        if (!tool) return;
                        selectTool(tool.type);
                        setValue("brand", tool.brand, { shouldDirty: true });
                        setValue("line", tool.line, { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger id="saved-tool" size="lg" className="w-full sm:max-w-md">
                        <SelectValue placeholder="Выбрать сохранённый набор" />
                      </SelectTrigger>
                      <SelectContent>
                        {toolsQuery.tools.map((tool) => (
                          <SelectItem key={tool.id} value={tool.id}>
                            {tool.brand} · {tool.line}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="material-brand">Бренд</Label>
                    <Input
                      id="material-brand"
                      className="min-h-11"
                      readOnly={toolType === "ARTMATE_168"}
                      aria-invalid={Boolean(errors.brand)}
                      {...register("brand")}
                    />
                    {errors.brand?.message ? (
                      <p className="text-sm text-destructive">{errors.brand.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="material-line">Линейка</Label>
                    <Input
                      id="material-line"
                      className="min-h-11"
                      readOnly={toolType === "ARTMATE_168"}
                      aria-invalid={Boolean(errors.line)}
                      {...register("line")}
                    />
                    {errors.line?.message ? (
                      <p className="text-sm text-destructive">{errors.line.message}</p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {currentStep === 3 ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Соответствие символов</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Можно заполнить только известные номера. Одинаковый номер допустим для
                    нескольких символов; ведущие нули и буквенные суффиксы сохраняются.
                  </p>
                </div>
                {toolType === "ARTMATE_168" ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <p className="font-bold text-rose-950">Палитра Artmate для этой картины</p>
                    <p className="mt-1 text-sm text-rose-900">
                      {markerColorsQuery.isPending
                        ? "Загружаем официальный каталог маркеров…"
                        : markerColorsQuery.isError
                          ? "Каталог временно недоступен; точные номера картины уже подставлены."
                          : `Загружено ${markerColorsQuery.colors.length} цветов официального каталога.`}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-700">
                    Номера ниже указаны вами и будут показаны как авторские, не как официальная
                    палитра.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.coloring.officialRevision.palette.colors.map((color, index) => (
                    <div key={color.symbol} className="rounded-xl border p-3">
                      <div className="mb-3 flex items-center gap-3">
                        <span
                          className="size-9 rounded-full border border-black/10"
                          style={{ backgroundColor: color.hex }}
                          aria-label={`Цвет ${color.hex}`}
                        />
                        <div>
                          <p className="font-bold">Символ {color.symbol}</p>
                          <p className="text-xs text-stone-500">
                            {color.hex}
                            {color.pantone ? ` · Pantone ${color.pantone}` : ""}
                          </p>
                        </div>
                      </div>
                      <input type="hidden" {...register(`mappings.${index}.symbol`)} />
                      <Label htmlFor={`mapping-${color.symbol}`}>
                        {toolType === "ARTMATE_168" ? "Номер маркера Artmate" : "Номер автора"}
                      </Label>
                      {toolType === "ARTMATE_168" ? (
                        <Controller
                          name={`mappings.${index}.markerNumber`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value || "__none__"}
                              onValueChange={(value) =>
                                field.onChange(value === "__none__" ? "" : value)
                              }
                              disabled={officialMarkerOptions.length === 0}
                            >
                              <SelectTrigger
                                id={`mapping-${color.symbol}`}
                                size="lg"
                                className="mt-2 w-full font-mono"
                                aria-invalid={Boolean(errors.mappings?.[index]?.markerNumber)}
                              >
                                <SelectValue placeholder="Выберите номер" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Не указывать</SelectItem>
                                {officialMarkerOptions.map((marker) => (
                                  <SelectItem key={marker.id} value={marker.markerNumber}>
                                    {marker.markerNumber} · Pantone {marker.pantone}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      ) : (
                        <Input
                          id={`mapping-${color.symbol}`}
                          className="mt-2 min-h-11 font-mono"
                          placeholder="Например, 023 или 27A"
                          aria-invalid={Boolean(errors.mappings?.[index]?.markerNumber)}
                          {...register(`mappings.${index}.markerNumber`)}
                        />
                      )}
                      {toolType === "ARTMATE_168" ? (
                        <p className="mt-2 text-xs text-stone-500">
                          {getOfficialMarkerLabel(
                            officialMarkerOptions,
                            values.mappings?.[index]?.markerNumber,
                          )}
                        </p>
                      ) : null}
                      {errors.mappings?.[index]?.markerNumber?.message ? (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.mappings[index]?.markerNumber?.message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {currentStep === 4 ? (
              <section className="mx-auto max-w-2xl space-y-3">
                <h2 className="text-xl font-bold">Подпись к работе</h2>
                <Label htmlFor="work-caption">Необязательно</Label>
                <Textarea
                  id="work-caption"
                  rows={7}
                  maxLength={500}
                  placeholder="Расскажите о процессе, бумаге или любимых сочетаниях…"
                  aria-invalid={Boolean(errors.caption)}
                  {...register("caption")}
                />
                <p className="text-sm text-stone-500">До 500 символов.</p>
                {errors.caption?.message ? (
                  <p className="text-sm text-destructive">{errors.caption.message}</p>
                ) : null}
              </section>
            ) : null}

            {currentStep === 5 ? (
              <section className="mx-auto max-w-3xl space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Как сохранить работу?</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Публикация всегда проходит модерацию. Рекламное согласие не влияет на
                    публикацию.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SubmissionChoice
                    active={submissionIntent === "DRAFT"}
                    title="Оставить только себе"
                    description="Сохранить DRAFT без отправки на модерацию"
                    onClick={() => setSubmissionIntent("DRAFT")}
                  />
                  <SubmissionChoice
                    active={submissionIntent === "SUBMIT"}
                    title="Опубликовать после модерации"
                    description="Отправить новую ревизию на проверку"
                    onClick={() => setSubmissionIntent("SUBMIT")}
                  />
                </div>
                <label className="flex min-h-11 items-start gap-3 rounded-xl border p-4 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 accent-rose-500"
                    {...register("advertisingConsent")}
                  />
                  <span>
                    Разрешаю Artmate отдельно использовать фото в рекламных материалах. Это
                    необязательное согласие и не является условием публикации.
                  </span>
                </label>
              </section>
            ) : null}

            {currentStep === 6 ? (
              <section className="grid gap-6 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-start">
                <PhotoPreview
                  objectUrl={objectUrl}
                  revisionId={data.work?.currentRevision?.id}
                  alt={`Предпросмотр работы ${data.coloring.number}`}
                  crop={objectUrl ? crop : undefined}
                />
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Проверьте данные</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      {submissionIntent === "DRAFT"
                        ? "Работа останется приватным черновиком."
                        : "Новая ревизия будет отправлена на модерацию."}
                    </p>
                  </div>
                  <dl className="grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-stone-500">Материалы</dt>
                      <dd className="font-bold">
                        {values.brand} · {values.line}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-stone-500">Заполнено соответствий</dt>
                      <dd className="font-bold">
                        {values.mappings?.filter((item) => item.markerNumber?.trim()).length ?? 0}{" "}
                        из {data.coloring.officialRevision.palette.colors.length}
                      </dd>
                    </div>
                  </dl>
                  {values.caption ? (
                    <p className="rounded-xl border p-4">{values.caption}</p>
                  ) : null}
                  {serverError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {serverError}. Все введённые данные сохранены в форме.
                    </p>
                  ) : null}
                  <Button type="submit" size="lg" className="min-h-11 w-full" disabled={isSaving}>
                    <ShieldCheck data-icon="inline-start" />
                    {submissionIntent === "DRAFT"
                      ? "Оставить только себе"
                      : "Опубликовать после модерации"}
                  </Button>
                </div>
              </section>
            ) : null}
          </CardContent>

          <div className="flex items-center justify-between gap-3 border-t bg-stone-50 px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={currentStep === 0 || isSaving}
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            >
              <ChevronLeft data-icon="inline-start" />
              Назад
            </Button>
            <span className="text-sm text-stone-500">
              {currentStep + 1} / {editorSteps.length}
            </span>
            <Button
              type="button"
              className="min-h-11"
              disabled={currentStep === editorSteps.length - 1 || isSaving}
              onClick={() => setCurrentStep((step) => Math.min(editorSteps.length - 1, step + 1))}
            >
              Далее
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

function CropSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (_value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-3">
        <Label>{label}</Label>
        <output className="font-mono text-sm">{value.toFixed(2)}</output>
      </div>
      <Slider
        disabled={disabled}
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        className="min-h-11"
        thumbClassName="size-5 after:-inset-3"
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
      />
    </div>
  );
}

function ToolChoice({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-24 rounded-2xl border p-4 text-left focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:outline-none ${active ? "border-rose-500 bg-rose-50" : "border-stone-200 bg-white"}`}
    >
      <span className="block font-heading text-lg font-bold">{title}</span>
      <span className="mt-1 block text-sm text-stone-600">{description}</span>
    </button>
  );
}

function SubmissionChoice(props: Parameters<typeof ToolChoice>[0]) {
  return <ToolChoice {...props} />;
}

function getOfficialMarkerLabel(
  colors: Array<Pick<WorkshopMarkerColor, "markerNumber" | "pantone">>,
  markerNumber?: string,
) {
  const color = colors.find((item) => item.markerNumber === markerNumber);

  if (!color) {
    return markerNumber ? "Номер из палитры картины" : "Номер не указан";
  }

  return `Каталог Artmate: ${color.markerNumber} · Pantone ${color.pantone}`;
}

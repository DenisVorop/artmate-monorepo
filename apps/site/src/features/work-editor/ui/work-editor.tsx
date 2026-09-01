"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form";

import {
  type WorkshopMarkerColor,
  useMarkerColors,
  useWorkshopColoringData,
  useWorkshopTools,
} from "@/entities/workshop";
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
  canAppendWorkshopMaterial,
  changeMaterialTypeAssignments,
  getEditorDefaultValues,
  removeMaterialAssignments,
  selectMappingMaterial,
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
      <DataState title="Открываем редактор" description="Загружаем картину и данные работы." />
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
  const [objectUrl, setObjectUrl] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const defaultValues = getEditorDefaultValues(data);
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<WorkEditorFormValues>({
    resolver: zodResolver(workEditorFormSchema),
    defaultValues,
  });
  const {
    append: appendMaterial,
    fields: materialFields,
    remove: removeMaterial,
  } = useFieldArray({ control, name: "materials" });
  const values = useWatch({ control });
  const selectedPhoto = useWatch({ control, name: "photo" });
  const materials = useWatch({ control, name: "materials" });
  const crop = useWatch({ control, name: "crop" });
  const toolsQuery = useWorkshopTools();
  const markerColorsQuery = useMarkerColors(
    materials.some((material) => material.type === "ARTMATE_168"),
  );
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
  const needsNewPhoto =
    !data.work?.currentRevision || data.work.currentRevision.status === "HIDDEN";

  useEffect(() => {
    if (!selectedPhoto) {
      setObjectUrl(undefined);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedPhoto);
    setObjectUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedPhoto]);

  function addSavedMaterial(toolId: string) {
    const tool = toolsQuery.tools.find((item) => item.id === toolId);
    const currentMaterials = getValues("materials");

    if (
      !tool ||
      !canAppendWorkshopMaterial(currentMaterials.length) ||
      hasMaterial(currentMaterials, tool)
    ) {
      return;
    }

    appendMaterial({ type: tool.type, brand: tool.brand, line: tool.line });
  }

  function addCustomMaterial() {
    if (!canAppendWorkshopMaterial(materialFields.length)) {
      return;
    }

    appendMaterial({ type: "CUSTOM", brand: "", line: "" });
  }

  function changeMaterialType(index: number, type: "ARTMATE_168" | "CUSTOM") {
    const currentMaterial = getValues(`materials.${index}`);

    if (!currentMaterial || currentMaterial.type === type) {
      return;
    }

    setValue(`materials.${index}.type`, type, { shouldDirty: true, shouldValidate: true });
    setValue(`materials.${index}.brand`, type === "ARTMATE_168" ? "Artmate" : "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`materials.${index}.line`, type === "ARTMATE_168" ? "168" : "", {
      shouldDirty: true,
      shouldValidate: true,
    });

    setValue(
      "mappings",
      changeMaterialTypeAssignments(
        getValues("mappings"),
        index,
        currentMaterial.type,
        type,
        data.coloring.officialRevision.palette.colors,
      ),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function deleteMaterial(index: number) {
    setValue("mappings", removeMaterialAssignments(getValues("mappings"), index), {
      shouldDirty: true,
      shouldValidate: true,
    });
    removeMaterial(index);
  }

  function changeMappingMaterial(mappingIndex: number, materialIndex: number | null) {
    const material = materialIndex === null ? undefined : getValues(`materials.${materialIndex}`);
    const color = data.coloring.officialRevision.palette.colors[mappingIndex];
    const mapping = getValues(`mappings.${mappingIndex}`);

    setValue(
      `mappings.${mappingIndex}`,
      selectMappingMaterial(mapping, materialIndex, material?.type, color?.markerNumber),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function onSubmit(formValues: WorkEditorFormValues) {
    setServerError(undefined);

    if (!formValues.photo && needsNewPhoto) {
      setError("photo", { message: "Добавьте фотографию готовой работы" });
      setCurrentStep(0);
      return;
    }

    try {
      const officialColors = officialMarkerOptions;
      const invalidMappingIndex = formValues.mappings.findIndex((mapping) => {
        const material =
          mapping.materialIndex === null ? undefined : formValues.materials[mapping.materialIndex];

        return (
          material?.type === "ARTMATE_168" &&
          mapping.markerNumber.trim().length > 0 &&
          !officialColors.some((color) => color.markerNumber === mapping.markerNumber.trim())
        );
      });

      if (invalidMappingIndex >= 0) {
        setError(`mappings.${invalidMappingIndex}.markerNumber`, {
          message: "Выберите номер из официального каталога Artmate",
        });
        setCurrentStep(3);
        return;
      }

      const resolvedTools = [];

      for (const material of formValues.materials) {
        const savedTool = toolsQuery.tools.find(
          (tool) =>
            tool.type === material.type &&
            tool.brand === material.brand &&
            tool.line === material.line,
        );

        resolvedTools.push(
          savedTool ??
            (await saveTool.mutate({
              type: material.type,
              brand: material.brand,
              line: material.line,
            })),
        );
      }

      await createRevision.mutate(toCreateRevisionInput(formValues, resolvedTools, officialColors));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Не удалось сохранить работу");
    }
  }

  function onInvalid(formErrors: FieldErrors<WorkEditorFormValues>) {
    if (formErrors.photo) {
      setCurrentStep(0);
    } else if (formErrors.crop) {
      setCurrentStep(1);
    } else if (formErrors.materials) {
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
                  revisionId={
                    data.work?.currentRevision?.status === "HIDDEN"
                      ? undefined
                      : data.work?.currentRevision?.id
                  }
                  alt={`Предпросмотр работы ${data.coloring.number}`}
                />
              </section>
            ) : null}

            {currentStep === 1 ? (
              <section className="grid gap-6 lg:grid-cols-[minmax(18rem,28rem)_minmax(0,1fr)] lg:items-start">
                <PhotoPreview
                  objectUrl={objectUrl}
                  revisionId={
                    data.work?.currentRevision?.status === "HIDDEN"
                      ? undefined
                      : data.work?.currentRevision?.id
                  }
                  alt={`Кадрирование работы ${data.coloring.number}`}
                  crop={objectUrl ? crop : undefined}
                />
                <div className="space-y-6">
                  {!canAdjustCrop ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      {data.work?.currentRevision?.status === "HIDDEN"
                        ? "Эта версия скрыта модератором. Вернитесь на шаг «Фото» и загрузите новую фотографию."
                        : data.work?.currentRevision
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
                    Добавьте все наборы, которые использовали. На следующем шаге материал выбирается
                    отдельно для каждого цвета.
                  </p>
                </div>

                {toolsQuery.tools.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="saved-tool">Добавить из сохранённых</Label>
                    <Select
                      disabled={!canAppendWorkshopMaterial(materialFields.length)}
                      onValueChange={addSavedMaterial}
                    >
                      <SelectTrigger id="saved-tool" size="lg" className="w-full sm:max-w-md">
                        <SelectValue placeholder="Выберите бренд и линейку" />
                      </SelectTrigger>
                      <SelectContent>
                        {toolsQuery.tools.map((tool) => (
                          <SelectItem
                            key={tool.id}
                            value={tool.id}
                            disabled={
                              !canAppendWorkshopMaterial(materialFields.length) ||
                              hasMaterial(materials, tool)
                            }
                          >
                            {tool.brand} · {tool.line}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {materialFields.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-sm leading-6 text-stone-600">
                    Материалы пока не добавлены. Выберите сохранённый набор или добавьте новый — ни
                    один бренд не назначается всем цветам автоматически.
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  {materialFields.map((field, index) => {
                    const material = materials[index];
                    const materialErrors = errors.materials?.[index];

                    return (
                      <div key={field.id} className="space-y-4 rounded-2xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-heading text-lg font-bold">Материал {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-lg"
                            aria-label={`Удалить материал ${index + 1}`}
                            onClick={() => deleteMaterial(index)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <ToolChoice
                            active={material?.type === "ARTMATE_168"}
                            title="Artmate 168"
                            description="Официальный каталог"
                            onClick={() => changeMaterialType(index, "ARTMATE_168")}
                          />
                          <ToolChoice
                            active={material?.type === "CUSTOM"}
                            title="Другой набор"
                            description="Свой бренд и линейка"
                            onClick={() => changeMaterialType(index, "CUSTOM")}
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`material-${index}-brand`}>Бренд</Label>
                            <Input
                              id={`material-${index}-brand`}
                              className="min-h-11"
                              readOnly={material?.type === "ARTMATE_168"}
                              aria-invalid={Boolean(materialErrors?.brand)}
                              {...register(`materials.${index}.brand`)}
                            />
                            {materialErrors?.brand?.message ? (
                              <p className="text-sm text-destructive">
                                {materialErrors.brand.message}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`material-${index}-line`}>Линейка</Label>
                            <Input
                              id={`material-${index}-line`}
                              className="min-h-11"
                              readOnly={material?.type === "ARTMATE_168"}
                              aria-invalid={Boolean(materialErrors?.line)}
                              {...register(`materials.${index}.line`)}
                            />
                            {materialErrors?.line?.message ? (
                              <p className="text-sm text-destructive">
                                {materialErrors.line.message}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!canAppendWorkshopMaterial(materialFields.length)}
                  onClick={addCustomMaterial}
                >
                  <Plus data-icon="inline-start" />
                  Добавить материал
                </Button>
                {typeof errors.materials?.message === "string" ? (
                  <p className="text-sm text-destructive">{errors.materials.message}</p>
                ) : null}
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
                {materials.some((material) => material.type === "ARTMATE_168") ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <p className="font-bold text-rose-950">Каталог Artmate для выбранных цветов</p>
                    <p className="mt-1 text-sm text-rose-900">
                      {markerColorsQuery.isPending
                        ? "Загружаем официальный каталог маркеров…"
                        : markerColorsQuery.isError
                          ? "Каталог временно недоступен; номера картины уже подставлены."
                          : `Загружено ${markerColorsQuery.colors.length} цветов официального каталога.`}
                    </p>
                  </div>
                ) : null}
                {materials.length === 0 ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    Сначала добавьте хотя бы один материал на предыдущем шаге.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.coloring.officialRevision.palette.colors.map((color, index) => {
                    const mapping = values.mappings?.[index];
                    const selectedMaterial =
                      mapping?.materialIndex === null || mapping?.materialIndex === undefined
                        ? undefined
                        : materials[mapping.materialIndex];

                    return (
                      <div key={color.symbol} className="space-y-3 rounded-xl border p-3">
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
                        <div className="space-y-2">
                          <Label htmlFor={`mapping-${color.symbol}-material`}>Материал цвета</Label>
                          <Controller
                            name={`mappings.${index}.materialIndex`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value === null ? "__none__" : String(field.value)}
                                disabled={materials.length === 0}
                                onValueChange={(value) =>
                                  changeMappingMaterial(
                                    index,
                                    value === "__none__" ? null : Number(value),
                                  )
                                }
                              >
                                <SelectTrigger
                                  id={`mapping-${color.symbol}-material`}
                                  size="lg"
                                  className="w-full"
                                  aria-invalid={Boolean(errors.mappings?.[index]?.materialIndex)}
                                >
                                  <SelectValue placeholder="Выберите материал" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Материал не выбран</SelectItem>
                                  {materials.map((material, materialIndex) => (
                                    <SelectItem
                                      key={`${material.type}-${material.brand}-${material.line}-${materialIndex}`}
                                      value={String(materialIndex)}
                                    >
                                      {material.brand || "Без бренда"} ·{" "}
                                      {material.line || "Без линейки"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <Label htmlFor={`mapping-${color.symbol}`}>
                          {selectedMaterial?.type === "ARTMATE_168"
                            ? "Номер маркера Artmate"
                            : "Номер маркера"}
                        </Label>
                        {selectedMaterial?.type === "ARTMATE_168" ? (
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
                            placeholder={
                              selectedMaterial
                                ? "Например, 023 или 27A"
                                : "Сначала выберите материал"
                            }
                            disabled={!selectedMaterial}
                            aria-invalid={Boolean(errors.mappings?.[index]?.markerNumber)}
                            {...register(`mappings.${index}.markerNumber`)}
                          />
                        )}
                        {selectedMaterial?.type === "ARTMATE_168" ? (
                          <p className="mt-2 text-xs text-stone-500">
                            {getOfficialMarkerLabel(
                              officialMarkerOptions,
                              values.mappings?.[index]?.markerNumber,
                            )}
                          </p>
                        ) : null}
                        {errors.mappings?.[index]?.materialIndex?.message ? (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.mappings[index]?.materialIndex?.message}
                          </p>
                        ) : null}
                        {errors.mappings?.[index]?.markerNumber?.message ? (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.mappings[index]?.markerNumber?.message}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
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
                  <h2 className="text-xl font-bold">Отправка на модерацию</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Все фотографии проверяет модератор. После одобрения вы сможете опубликовать
                    работу в открытой мастерской.
                  </p>
                </div>
                <label className="flex min-h-11 items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 accent-rose-500"
                    {...register("advertisingConsent")}
                  />
                  <span>
                    Хочу, чтобы моя работа вдохновляла других. Разрешаю Artmate использовать это
                    фото на сайте, в социальных сетях, рекламе и материалах бренда.
                  </span>
                </label>
              </section>
            ) : null}

            {currentStep === 6 ? (
              <section className="grid gap-6 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-start">
                <PhotoPreview
                  objectUrl={objectUrl}
                  revisionId={
                    data.work?.currentRevision?.status === "HIDDEN"
                      ? undefined
                      : data.work?.currentRevision?.id
                  }
                  alt={`Предпросмотр работы ${data.coloring.number}`}
                  crop={objectUrl ? crop : undefined}
                />
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Проверьте данные</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      Новая ревизия будет отправлена на модерацию.
                    </p>
                  </div>
                  <dl className="grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-stone-500">Материалы</dt>
                      <dd className="space-y-1 font-bold">
                        {values.materials?.map((material, index) => (
                          <span key={`${material?.type}-${index}`} className="block">
                            {material?.brand} · {material?.line}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-stone-500">Материал назначен</dt>
                      <dd className="font-bold">
                        {values.mappings?.filter((item) => item.materialIndex !== null).length ?? 0}{" "}
                        из {data.coloring.officialRevision.palette.colors.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-stone-500">Номер указан</dt>
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
                    Отправить на модерацию
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

function hasMaterial(
  materials: Array<{ type: string; brand: string; line: string }>,
  candidate: { type: string; brand: string; line: string },
) {
  return materials.some(
    (material) =>
      material.type === candidate.type &&
      material.brand.trim().toLocaleLowerCase("ru-RU") ===
        candidate.brand.trim().toLocaleLowerCase("ru-RU") &&
      material.line.trim().toLocaleLowerCase("ru-RU") ===
        candidate.line.trim().toLocaleLowerCase("ru-RU"),
  );
}

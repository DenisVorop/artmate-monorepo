"use client";

import { useAnalytics } from "../lib/analytics";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form";

import { getCommunityCollectionTitle } from "@/entities/community-work";
import {
  type WorkshopMarkerColor,
  useMarkerColors,
  useWorkshopColoringData,
  useWorkshopTools,
} from "@/entities/workshop";
import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  DataState,
  Input,
  Label,
  PageHero,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";

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
  const analytics = useAnalytics();
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
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              analytics.retried();
              void query.refetch();
            }}
          >
            Повторить
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
  const analytics = useAnalytics();
  const [currentStep, setCurrentStep] = useState(0);
  const isReviewStep = currentStep === editorSteps.length - 1;
  const [isMaterialsEditorOpen, setIsMaterialsEditorOpen] = useState(
    Boolean(
      data.work?.currentRevision?.materials.length ||
      data.work?.currentRevision?.symbolMappings.length,
    ),
  );
  const [isMappingEditorOpen, setIsMappingEditorOpen] = useState(
    Boolean(data.work?.currentRevision?.symbolMappings.length),
  );
  const [objectUrl, setObjectUrl] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const defaultValues = getEditorDefaultValues(data);
  const {
    control,
    formState: { errors, isSubmitting },
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
  const toolsQuery = useWorkshopTools();
  const markerColorsQuery = useMarkerColors(
    materials.some((material) => material.type === "ARTMATE_168"),
  );
  const officialMarkerOptions =
    markerColorsQuery.colors.length > 0
      ? markerColorsQuery.colors
      : (toolsQuery.tools.find((tool) => tool.type === "ARTMATE_168")?.officialPalette ?? []);
  const createRevision = useCreateWorkshopRevision(slug, number, {
    onSuccess: () => {
      reset(defaultValues);
      onSuccess();
    },
  });
  const saveTool = useSaveWorkshopTool();
  const isSaving =
    isSubmitting || createRevision.isPending || saveTool.isPending || toolsQuery.isPending;
  const needsNewPhoto =
    !data.work?.currentRevision || data.work.currentRevision.status === "HIDDEN";
  const previewRevisionId = needsNewPhoto ? undefined : data.work?.currentRevision?.id;
  const hasPhoto = Boolean(selectedPhoto || previewRevisionId);
  const photoAlt = `Фото работы «${data.coloring.title}»`;
  const isPublished = Boolean(data.work?.isPublicationEnabled && data.work.publishedAt);
  const caption = values.caption?.trim();
  const markerCount =
    values.mappings?.filter((mapping) => mapping.markerNumber?.trim()).length ?? 0;

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

    analytics.savedMaterialAdded();
    appendMaterial({ type: tool.type, brand: tool.brand, line: tool.line });
  }

  function addCustomMaterial() {
    if (!canAppendWorkshopMaterial(materialFields.length)) {
      return;
    }

    analytics.customMaterialAdded();
    appendMaterial({ type: "CUSTOM", brand: "", line: "" });
  }

  function changeMaterialType(index: number, type: "ARTMATE_168" | "CUSTOM") {
    const currentMaterial = getValues(`materials.${index}`);

    if (!currentMaterial || currentMaterial.type === type) {
      return;
    }

    analytics.materialTypeChanged();
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
    analytics.materialRemoved();
  }

  function changeMappingMaterial(mappingIndex: number, materialIndex: number | null) {
    const material = materialIndex === null ? undefined : getValues(`materials.${materialIndex}`);
    const color = data.coloring.officialRevision.palette.colors[mappingIndex];
    const mapping = getValues(`mappings.${mappingIndex}`);
    if (materialIndex === null) analytics.mappingCleared();
    else analytics.mappingAssigned();

    setValue(
      `mappings.${mappingIndex}`,
      selectMappingMaterial(mapping, materialIndex, material?.type, color?.markerNumber),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function onSubmit(formValues: WorkEditorFormValues) {
    analytics.saveRequested();
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
        setIsMaterialsEditorOpen(true);
        setIsMappingEditorOpen(true);
        setCurrentStep(1);
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
    } catch {
      setServerError("Не удалось отправить. Попробуйте снова.");
    }
  }

  function onInvalid(formErrors: FieldErrors<WorkEditorFormValues>) {
    analytics.validationFailed();
    if (formErrors.materials || formErrors.mappings) {
      setIsMaterialsEditorOpen(true);
    }

    if (formErrors.mappings) {
      setIsMappingEditorOpen(true);
    }

    if (formErrors.photo) {
      setCurrentStep(0);
    } else if (formErrors.materials || formErrors.mappings || formErrors.caption) {
      setCurrentStep(1);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHero
        title={data.work ? "Обновить работу" : "Добавить работу"}
        breadcrumbs={[
          { label: "Моя мастерская", href: routes.workshop },
          {
            label: getCommunityCollectionTitle(data.collection.title),
            href: routes.workshopCollection(slug),
          },
          { label: `Картина № ${data.coloring.number}` },
        ]}
        description={
          <div className="space-y-2">
            <p className="font-semibold text-stone-800">{data.coloring.title}</p>
            {isPublished ? (
              <p>Опубликованная версия останется видна, пока мы проверяем изменения.</p>
            ) : data.work?.currentRevision?.status === "PENDING" ? (
              <p>Работа на проверке. Если внесёте изменения, мы проверим новую версию.</p>
            ) : null}
          </div>
        }
      />

      <form
        className="-mx-4 md:mx-0"
        onSubmit={(event) => {
          if (!isReviewStep || isSaving) {
            event.preventDefault();
            return;
          }

          void handleSubmit(onSubmit, onInvalid)(event);
        }}
      >
        <Card className="gap-0 rounded-none border-y py-0 ring-0 md:rounded-2xl md:border-y-0 md:ring-1">
          <EditorStepper
            currentStep={currentStep}
            onStepChange={(step) => {
              if (step === currentStep) return;
              analytics.stepSelected();
              setCurrentStep(step);
            }}
          />
          <CardContent className="p-4 sm:p-8">
            {currentStep === 0 ? (
              <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-start md:gap-10">
                <div className="min-w-0 space-y-4">
                  <h2 className="font-heading text-lg font-bold sm:text-xl">
                    Фото готовой раскраски
                  </h2>
                  <Controller
                    name="photo"
                    control={control}
                    render={({ field: { onChange, onBlur, ref } }) => (
                      <div className="relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-center transition-colors focus-within:border-rose-400 focus-within:ring-3 focus-within:ring-rose-200 hover:border-rose-400">
                        <Camera className="size-5 text-rose-700" aria-hidden="true" />
                        <Label htmlFor="work-photo" className="text-sm font-bold">
                          {hasPhoto ? "Заменить фото" : "Выбрать фото"}
                        </Label>
                        {selectedPhoto ? (
                          <p
                            className="w-full truncate text-sm text-stone-600"
                            title={selectedPhoto.name}
                          >
                            {selectedPhoto.name}
                          </p>
                        ) : null}
                        <Input
                          ref={ref}
                          id="work-photo"
                          type="file"
                          accept={acceptedWorkshopPhotoTypes.join(",")}
                          className="absolute inset-0 size-full cursor-pointer opacity-0"
                          aria-invalid={Boolean(errors.photo)}
                          aria-describedby={
                            errors.photo ? "work-photo-help work-photo-error" : "work-photo-help"
                          }
                          onBlur={onBlur}
                          onChange={(event) => {
                            const photo = event.target.files?.[0];
                            if (!photo) return;
                            analytics.photoSelected();
                            onChange(photo);
                          }}
                        />
                      </div>
                    )}
                  />
                  <p id="work-photo-help" className="text-sm text-stone-600">
                    JPEG, PNG или WebP, до 10 МБ. Снимайте при ровном освещении.
                  </p>
                  {errors.photo?.message ? (
                    <p id="work-photo-error" role="alert" className="text-sm text-destructive">
                      {errors.photo.message}
                    </p>
                  ) : null}
                </div>
                <PhotoPreview
                  objectUrl={objectUrl}
                  revisionId={previewRevisionId}
                  alt={photoAlt}
                  example={data.coloring.officialImage}
                />
              </section>
            ) : null}

            {currentStep === 1 ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-heading text-lg font-bold sm:text-xl">
                    <Label htmlFor="work-caption" className="inline font-bold text-inherit">
                      Подпись к работе
                    </Label>
                  </h2>
                  <p id="work-caption-help" className="text-sm text-stone-600">
                    Необязательно, до 500 символов
                  </p>
                </div>
                <Textarea
                  id="work-caption"
                  rows={4}
                  maxLength={500}
                  aria-invalid={Boolean(errors.caption)}
                  aria-describedby={
                    errors.caption ? "work-caption-help work-caption-error" : "work-caption-help"
                  }
                  {...register("caption")}
                />
                {errors.caption?.message ? (
                  <p id="work-caption-error" role="alert" className="text-sm text-destructive">
                    {errors.caption.message}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  aria-expanded={isMaterialsEditorOpen}
                  aria-controls="workshop-materials"
                  onClick={() => {
                    if (isMaterialsEditorOpen) analytics.materialsClosed();
                    else analytics.materialsOpened();
                    setIsMaterialsEditorOpen(!isMaterialsEditorOpen);
                  }}
                >
                  {isMaterialsEditorOpen ? "Скрыть материалы" : "Добавить материалы"}
                </Button>
              </section>
            ) : null}

            {currentStep === 1 && isMaterialsEditorOpen ? (
              <section id="workshop-materials" className="mt-6 space-y-5 border-t pt-6">
                <h2 className="font-heading text-lg font-bold sm:text-xl">Материалы</h2>

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

                {materialFields.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {materialFields.map((field, index) => {
                      const material = materials[index];
                      const materialErrors = errors.materials?.[index];

                      return (
                        <div key={field.id} className="min-w-0 space-y-4 rounded-xl border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">Материал № {index + 1}</p>
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
                              onClick={() => changeMaterialType(index, "ARTMATE_168")}
                            />
                            <ToolChoice
                              active={material?.type === "CUSTOM"}
                              title="Другой набор"
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
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
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
                  {materials.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      aria-expanded={isMappingEditorOpen}
                      aria-controls="workshop-symbol-mappings"
                      onClick={() => {
                        if (isMappingEditorOpen) analytics.mappingClosed();
                        else analytics.mappingOpened();
                        setIsMappingEditorOpen(!isMappingEditorOpen);
                      }}
                    >
                      {isMappingEditorOpen ? "Скрыть номера маркеров" : "Указать номера маркеров"}
                    </Button>
                  ) : null}
                </div>
                {typeof errors.materials?.message === "string" ? (
                  <p className="text-sm text-destructive">{errors.materials.message}</p>
                ) : null}
              </section>
            ) : null}

            {currentStep === 1 &&
            isMaterialsEditorOpen &&
            isMappingEditorOpen &&
            materials.length > 0 ? (
              <section id="workshop-symbol-mappings" className="mt-6 space-y-5 border-t pt-6">
                <div>
                  <h2 className="font-heading text-lg font-bold sm:text-xl">Номера маркеров</h2>
                  <p className="mt-1 text-sm text-stone-600">Укажите номера, которые знаете.</p>
                </div>
                {materials.some((material) => material.type === "ARTMATE_168") &&
                (markerColorsQuery.isPending || markerColorsQuery.isError) ? (
                  <p role="status" className="text-sm text-stone-600">
                    {markerColorsQuery.isPending
                      ? "Загружаем каталог маркеров Artmate…"
                      : "Каталог маркеров Artmate временно недоступен."}
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
                                onValueChange={(value) => {
                                  if (value === "__none__") analytics.markerCleared();
                                  else analytics.markerSelected();
                                  field.onChange(value === "__none__" ? "" : value);
                                }}
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

            {isReviewStep ? (
              <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-start md:gap-10">
                <div className="min-w-0 space-y-4">
                  <h2 className="font-heading text-lg font-bold sm:text-xl">Проверьте работу</h2>
                  {caption || values.materials?.length || markerCount ? (
                    <dl className="space-y-4 text-sm wrap-break-word">
                      {caption ? (
                        <div>
                          <dt className="font-semibold">Подпись</dt>
                          <dd className="mt-1 whitespace-pre-wrap text-stone-700">{caption}</dd>
                        </div>
                      ) : null}
                      {values.materials?.length ? (
                        <div>
                          <dt className="font-semibold">Материалы</dt>
                          <dd className="mt-1 text-stone-700">
                            <ul>
                              {values.materials.map((material, index) => (
                                <li key={materialFields[index]?.id ?? index}>
                                  {material?.brand} · {material?.line}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      {markerCount > 0 ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="font-semibold">Номера маркеров</dt>
                          <dd className="text-stone-700">
                            {markerCount} из {data.coloring.officialRevision.palette.colors.length}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-sm text-stone-600">Подпись и материалы не добавлены.</p>
                  )}
                </div>
                <PhotoPreview objectUrl={objectUrl} revisionId={previewRevisionId} alt={photoAlt} />
              </section>
            ) : null}
          </CardContent>

          <CardFooter className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-none bg-stone-50 px-4 sm:px-8 sm:py-5 md:rounded-b-2xl">
            {isReviewStep ? (
              <div className="col-span-2 space-y-2">
                {serverError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {serverError}
                  </p>
                ) : null}
                <p
                  id="work-submission-consent"
                  className="max-w-[68ch] text-xs leading-4 text-stone-700 sm:text-sm sm:leading-5"
                >
                  Отправляя фото, вы разрешаете Artmate опубликовать его в галерее и мастерской
                  после одобрения и использовать на сайте, в соцсетях, рекламе и материалах бренда.
                </p>
              </div>
            ) : null}
            {currentStep > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 px-3"
                disabled={isSaving}
                onClick={() => {
                  analytics.stepPrevious();
                  setCurrentStep((step) => Math.max(0, step - 1));
                }}
              >
                <ChevronLeft data-icon="inline-start" />
                Назад
              </Button>
            ) : null}
            {isReviewStep ? (
              <Button
                type="submit"
                size="lg"
                className="col-start-2 min-h-11 w-full justify-self-end px-4 sm:w-auto"
                aria-describedby="work-submission-consent"
                aria-label="Отправить на модерацию"
                disabled={isSaving}
              >
                <span className="sm:hidden">Отправить</span>
                <span className="hidden sm:inline">Отправить на модерацию</span>
              </Button>
            ) : (
              <Button
                type="button"
                className="col-start-2 min-h-11 justify-self-end px-4"
                disabled={isSaving}
                onClick={() => {
                  analytics.stepNext();
                  setCurrentStep((step) => Math.min(editorSteps.length - 1, step + 1));
                }}
              >
                Далее
                <ChevronRight data-icon="inline-end" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

function ToolChoice({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={active}
      onClick={onClick}
      className="min-h-11 aria-pressed:border-rose-300 aria-pressed:bg-rose-50 aria-pressed:text-rose-900"
    >
      {title}
    </Button>
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

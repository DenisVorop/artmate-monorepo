"use client";

import { useColoringVariants } from "@/entities/coloring-variants";
import { useColoring } from "@/entities/colorings";
import { useColoringCollections } from "@/entities/coloring-collections";
import { useMaterialSets } from "@/entities/material-sets";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { SavedImages } from "./saved-images";
import { UploadForm } from "./upload-form";

export function ColoringVariantsManagement({
  coloringId,
}: {
  readonly coloringId: string;
}) {
  const { variants, isError, isPending } = useColoringVariants(coloringId);
  const {
    coloring,
    isError: isColoringError,
    isPending: isColoringPending,
  } = useColoring({ coloringId });
  const {
    collections,
    isError: isCollectionsError,
    isPending: isCollectionsPending,
  } = useColoringCollections();
  const {
    materialSets,
    isError: isSetsError,
    isPending: isSetsPending,
  } = useMaterialSets();
  const unavailable =
    isError || isColoringError || isCollectionsError || isSetsError;
  const loading =
    isPending || isColoringPending || isCollectionsPending || isSetsPending;
  const archived =
    coloring?.status === "archived" ||
    collections.some(
      (item) =>
        item.id === coloring?.collectionId && item.status === "archived",
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Оригинал и адаптации для наборов</CardTitle>
        <CardDescription>
          Оригинал и наборы для нового просмотрщика. Основной каталог пока
          использует прежние изображения.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8">
        {unavailable ? (
          <p role="alert" className="text-sm">
            Не удалось загрузить изображения или наборы. Обновите страницу.
          </p>
        ) : loading ? (
          <p role="status" className="text-sm">
            Загружаем изображения и наборы…
          </p>
        ) : !variants || !coloring ? (
          <p role="alert" className="text-sm">
            Раскраска недоступна. Обновите страницу.
          </p>
        ) : (
          <>
            {archived ? (
              <p className="text-sm text-muted-foreground">
                Раскраска или альбом в архиве. Загрузка недоступна.
              </p>
            ) : (
              <UploadForm
                key={variants.token}
                state={variants}
                materialSets={materialSets}
              />
            )}
            <SavedImages state={variants} disabled={archived} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

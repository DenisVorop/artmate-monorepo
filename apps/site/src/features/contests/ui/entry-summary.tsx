"use client";
import Image from "next/image";
import type { ContestEntry } from "@/entities/contest";
import { Button, Card, CardContent } from "@/shared/ui";
import { entryStatusLabels } from "../lib/entry-status";
export function EntrySummary({
  entry,
  photoUrl,
  isPhotoError,
  onRetryPhoto,
  onEdit,
}: {
  entry: ContestEntry;
  photoUrl?: string;
  isPhotoError: boolean;
  onRetryPhoto(): void;
  onEdit(_trigger: HTMLElement): void;
}) {
  return (
    <Card className="max-w-3xl gap-0 overflow-hidden py-0 sm:grid sm:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="relative flex min-h-60 items-center justify-center bg-stone-200/40">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt="Ваша конкурсная фотография"
            fill
            unoptimized
            className="object-contain"
          />
        ) : isPhotoError ? (
          <Button variant="outline" onClick={onRetryPhoto}>
            Загрузить фото ещё раз
          </Button>
        ) : (
          <p role="status" className="text-sm text-stone-500">
            Загружаем фотографию…
          </p>
        )}
      </div>
      <CardContent className="space-y-4 p-6">
        <p role="status" className="text-sm font-semibold text-stone-700">
          {entryStatusLabels[entry.status]}
        </p>
        <h2 className="font-heading text-xl font-bold">Ваша заявка</h2>
        <p className="text-base text-stone-600">
          {entry.albumTitle}
          {entry.number ? ` · № ${entry.number}` : ""}
        </p>
        {entry.caption && (
          <p className="text-base leading-7 whitespace-pre-wrap">{entry.caption}</p>
        )}
        {entry.reason && (
          <p className="rounded-xl bg-orange-50 p-4 text-sm leading-6 text-stone-800">
            {entry.reason}
          </p>
        )}
        {entry.canEdit && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={(event) => onEdit(event.currentTarget)}
          >
            Изменить заявку
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

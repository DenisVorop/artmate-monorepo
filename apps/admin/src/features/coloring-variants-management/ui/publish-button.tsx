"use client";

import type { ColoringVariants } from "@/entities/coloring-variants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@/shared/ui";

import { usePublicationState } from "../lib/publication-state";
import { ProtectedImage } from "./protected-image";

export function PublishButton({
  state,
  target,
  title,
  imageUrl,
  outlineUrl,
  disabled,
}: {
  readonly state: ColoringVariants;
  readonly target: string;
  readonly title: string;
  readonly imageUrl: string;
  readonly outlineUrl: string;
  readonly disabled: boolean;
}) {
  const {
    open,
    changeOpen,
    publish,
    error,
    needsReload,
    isPending,
    blockReason,
  } = usePublicationState(state, target, disabled);
  return (
    <div className="grid justify-items-start gap-2">
      <AlertDialog open={open} onOpenChange={changeOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" disabled={disabled || Boolean(blockReason)}>
            Опубликовать
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target === "original"
                ? "Опубликовать оригинал?"
                : `Опубликовать адаптацию «${title}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вариант появится в новом просмотрщике, когда альбом будет
              опубликован.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProtectedImage url={outlineUrl} label="Контуры" />
            <ProtectedImage
              url={imageUrl}
              label={target === "original" ? "Оригинал" : title}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
            {needsReload ? (
              <Button type="button" onClick={() => window.location.reload()}>
                Обновить страницу
              </Button>
            ) : (
              <AlertDialogAction
                disabled={isPending || disabled || Boolean(blockReason)}
                onClick={(event) => {
                  event.preventDefault();
                  void publish();
                }}
              >
                {isPending ? "Публикуем…" : "Опубликовать"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {blockReason && (
        <p className="text-sm text-muted-foreground">{blockReason}</p>
      )}
    </div>
  );
}

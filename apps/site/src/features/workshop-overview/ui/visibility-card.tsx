"use client";

import { useState } from "react";
import { ExternalLink, Globe2, Lock } from "lucide-react";

import type { OwnerWorkshop } from "@/entities/workshop";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { useUpdateWorkshopVisibility } from "../model";

export function WorkshopVisibilityCard({ workshop }: { workshop: OwnerWorkshop }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string>();
  const isPublic = workshop.isPublic;
  const updateVisibility = useUpdateWorkshopVisibility({
    onSuccess: () => setIsConfirmOpen(false),
  });

  async function toggleVisibility() {
    setError(undefined);

    try {
      await updateVisibility.mutate({ isPublic: !isPublic });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "Не удалось изменить видимость",
      );
    }
  }

  return (
    <Card className="border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              {isPublic ? <Globe2 className="text-rose-500" /> : <Lock className="text-rose-500" />}
              Видимость мастерской
            </CardTitle>
            <p className="text-sm text-stone-600">
              {isPublic
                ? "Мастерская открыта. В ней видны только опубликованные работы."
                : "Мастерская закрыта и доступна только вам."}
            </p>
          </div>
          <Badge className={isPublic ? "bg-emerald-100 text-emerald-800" : undefined}>
            {isPublic ? "Открыта" : "Закрыта"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {isPublic && workshop.handle ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={routes.publicWorkshop(workshop.handle)}>
              <ExternalLink data-icon="inline-start" />
              Публичная ссылка
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant={isPublic ? "outline" : "default"}
          className="min-h-11"
          onClick={() => setIsConfirmOpen(true)}
        >
          {isPublic ? "Закрыть мастерскую" : "Открыть мастерскую"}
        </Button>
      </CardContent>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isPublic ? "Закрыть мастерскую?" : "Открыть мастерскую?"}</DialogTitle>
            <DialogDescription>
              {isPublic
                ? "Публичная страница станет недоступна. Ваши работы и черновики сохранятся."
                : "Появится публичная страница. На ней будут видны только отдельно опубликованные работы."}
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11">
                Отмена
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="min-h-11"
              disabled={updateVisibility.isPending}
              onClick={() => void toggleVisibility()}
            >
              {isPublic ? "Закрыть" : "Открыть"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

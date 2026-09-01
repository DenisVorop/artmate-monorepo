"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui";

import { useApproveWorkshopRevision } from "../model";

export function ApproveDialog({ revisionId }: { readonly revisionId: string }) {
  const [open, setOpen] = useState(false);
  const { errorMessage, isPending, mutate, reset } = useApproveWorkshopRevision(
    { onSuccess: () => setOpen(false) },
  );

  function changeOpen(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (nextOpen) reset();
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="min-h-11" type="button">
          <CircleCheck data-icon="inline-start" aria-hidden="true" />
          Одобрить
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Одобрить работу?</DialogTitle>
          <DialogDescription>
            Ревизия станет доступна как одобренная. Финальный переход статуса
            проверит backend.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button className="min-h-11" disabled={isPending} variant="outline">
              Отмена
            </Button>
          </DialogClose>
          <Button
            className="min-h-11"
            disabled={isPending}
            onClick={() => mutate(revisionId)}
            type="button"
          >
            {isPending ? "Одобряем..." : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

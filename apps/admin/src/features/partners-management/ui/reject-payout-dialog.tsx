"use client";

import { CircleX } from "lucide-react";

import type { AffiliatePayout } from "@/entities/affiliate-partners";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Textarea,
} from "@/shared/ui";

import {
  useRejectPayoutForm,
} from "../lib";

export function RejectPayoutDialog({
  payout,
  userId,
}: {
  readonly payout: AffiliatePayout;
  readonly userId: string;
}) {
  const { changeOpen, form, isPending, open, submit, submitError } =
    useRejectPayoutForm(payout, userId);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <CircleX aria-hidden="true" /> Отклонить
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-0 max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Отклонить заявку</DialogTitle>
          <DialogDescription className="break-words">
            Резерв будет освобождён. Причина останется в истории заявки.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-2">
            <label className="font-medium" htmlFor={`reject-${payout.id}`}>
              Причина отказа
            </label>
            <Textarea
              id={`reject-${payout.id}`}
              disabled={isPending}
              maxLength={1000}
              rows={4}
              {...form.register("reason")}
            />
            {form.formState.errors.reason?.message ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.reason.message}
              </p>
            ) : null}
          </div>
          {submitError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => changeOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Сохраняем..." : "Отклонить заявку"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

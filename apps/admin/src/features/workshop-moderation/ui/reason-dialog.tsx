"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";

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
  Textarea,
} from "@/shared/ui";

import {
  getWorkshopModerationReasonInput,
  workshopModerationReasonFormSchema,
  workshopModerationReasonMaxLength,
  type WorkshopModerationReasonFormValues,
} from "../lib";
import { useHideWorkshopRevision, useRequestWorkshopChanges } from "../model";

type Decision = "REQUEST_CHANGES" | "HIDE";

type ReasonDialogViewProps = {
  readonly decision: Decision;
  readonly errorMessage?: string;
  readonly isPending: boolean;
  readonly onSubmit: (
    values: WorkshopModerationReasonFormValues,
    onSuccess: () => void,
  ) => void;
  readonly resetMutation: () => void;
};

export function RequestChangesDialog({
  revisionId,
}: {
  readonly revisionId: string;
}) {
  const mutation = useRequestWorkshopChanges();

  return (
    <ReasonDialogView
      decision="REQUEST_CHANGES"
      errorMessage={mutation.errorMessage}
      isPending={mutation.isPending}
      onSubmit={(values, onSuccess) =>
        mutation.mutate(
          {
            input: getWorkshopModerationReasonInput("REQUEST_CHANGES", values),
            revisionId,
          },
          { onSuccess },
        )
      }
      resetMutation={mutation.reset}
    />
  );
}

export function HideRevisionDialog({
  revisionId,
}: {
  readonly revisionId: string;
}) {
  const mutation = useHideWorkshopRevision();

  return (
    <ReasonDialogView
      decision="HIDE"
      errorMessage={mutation.errorMessage}
      isPending={mutation.isPending}
      onSubmit={(values, onSuccess) =>
        mutation.mutate(
          {
            input: getWorkshopModerationReasonInput("HIDE", values),
            revisionId,
          },
          { onSuccess },
        )
      }
      resetMutation={mutation.reset}
    />
  );
}

function ReasonDialogView({
  decision,
  errorMessage,
  isPending,
  onSubmit,
  resetMutation,
}: ReasonDialogViewProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<WorkshopModerationReasonFormValues>({
    defaultValues: { reason: "" },
    resolver: zodResolver(workshopModerationReasonFormSchema),
  });
  const errorId = `workshop-moderation-${decision.toLowerCase()}-reason-error`;
  const serverErrorId = `workshop-moderation-${decision.toLowerCase()}-server-error`;
  const formId = `workshop-moderation-${decision.toLowerCase()}-form`;
  const isHide = decision === "HIDE";

  function changeOpen(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (nextOpen) {
        resetMutation();
      } else {
        form.reset({ reason: "" });
      }
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="min-h-11"
          type="button"
          variant={isHide ? "destructive" : "outline"}
        >
          {isHide ? "Скрыть работу" : "Запросить изменения"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isHide ? "Скрыть опубликованную работу?" : "Запросить изменения?"}
          </DialogTitle>
          <DialogDescription>
            Причина сохранится в истории модерации и должна точно объяснять
            решение.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <ShieldAlert
            className="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p>
            {isHide
              ? "Работа перестанет быть публичной после подтверждения перехода backend."
              : "Автору потребуется подготовить новую ревизию с учетом причины."}
          </p>
        </div>

        <form
          aria-describedby={errorMessage ? serverErrorId : undefined}
          className="grid gap-2"
          id={formId}
          onSubmit={form.handleSubmit((values) =>
            onSubmit(values, () => {
              form.reset({ reason: "" });
              setOpen(false);
            }),
          )}
        >
          <label className="grid gap-1.5" htmlFor={`${formId}-reason`}>
            <span className="text-sm font-medium">Причина</span>
            <Textarea
              aria-describedby={
                form.formState.errors.reason ? errorId : undefined
              }
              aria-invalid={Boolean(form.formState.errors.reason)}
              autoFocus
              disabled={isPending}
              id={`${formId}-reason`}
              maxLength={workshopModerationReasonMaxLength}
              rows={5}
              {...form.register("reason")}
            />
          </label>
          {form.formState.errors.reason ? (
            <p className="text-xs text-destructive" id={errorId}>
              {form.formState.errors.reason.message}
            </p>
          ) : null}
          {errorMessage ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              id={serverErrorId}
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button className="min-h-11" disabled={isPending} variant="outline">
              Отмена
            </Button>
          </DialogClose>
          <Button
            className="min-h-11"
            disabled={isPending}
            form={formId}
            type="submit"
            variant={isHide ? "destructive" : "default"}
          >
            {isPending
              ? "Сохраняем..."
              : isHide
                ? "Подтвердить скрытие"
                : "Отправить автору"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

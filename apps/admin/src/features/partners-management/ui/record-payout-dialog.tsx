"use client";

import { CircleCheck } from "lucide-react";
import { useId } from "react";

import { formatKopecks, type AffiliatePayout } from "@/entities/affiliate-partners";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@/shared/ui";

import {
  useRecordPayoutForm,
} from "../lib";

export function RecordPayoutDialog({
  payout,
  userId,
}: {
  readonly payout: AffiliatePayout;
  readonly userId: string;
}) {
  const formId = useId();
  const {
    changeOpen,
    form,
    isPending,
    maxPaidAt,
    minPaidAt,
    open,
    submit,
    submitError,
  } = useRecordPayoutForm(payout, userId);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CircleCheck aria-hidden="true" /> Учесть выплату
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Учесть ручную выплату</DialogTitle>
          <DialogDescription className="break-words">
            Сохранение не переводит деньги и не обращается в банк. Зафиксируйте
            уже выполненную выплату на {formatKopecks(payout.amountKopecks)}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <fieldset className="space-y-4" disabled={isPending}>
            <div className="grid gap-2">
              <label className="font-medium" htmlFor={`${formId}-paid-at`}>
                Дата и время выплаты
              </label>
              <Input
                id={`${formId}-paid-at`}
                type="datetime-local"
                step="0.001"
                max={maxPaidAt}
                min={minPaidAt}
                {...form.register("paidAt")}
              />
              <FieldError message={form.formState.errors.paidAt?.message} />
            </div>
            <div className="grid gap-2">
              <label className="font-medium" htmlFor={`${formId}-reference`}>
                Номер операции
              </label>
              <Input
                id={`${formId}-reference`}
                autoComplete="off"
                maxLength={160}
                {...form.register("reference")}
              />
              <FieldError message={form.formState.errors.reference?.message} />
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm leading-6">
              <Checkbox
                aria-label="Подтвердить выполненную выплату"
                checked={form.watch("confirmed")}
                onCheckedChange={(checked) =>
                  form.setValue("confirmed", checked === true, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <span>Подтверждаю, что деньги уже переведены партнёру</span>
            </label>
            <FieldError message={form.formState.errors.confirmed?.message} />
          </fieldset>
          {submitError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => changeOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохраняем..." : "Учесть выплату"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { readonly message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

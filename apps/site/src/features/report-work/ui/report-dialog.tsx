"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flag } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { reportWorkFormSchema, type ReportWorkFormValues } from "../lib/report-form";
import { useReportWork } from "../model/use-report-work";

export function ReportWorkDialog({
  publicId,
  revisionId,
}: {
  publicId: string;
  revisionId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  const { user, isPending: isSessionPending } = useSession();
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<ReportWorkFormValues>({
    resolver: zodResolver(reportWorkFormSchema),
    defaultValues: { reason: "INAPPROPRIATE", details: "" },
  });
  const report = useReportWork({
    onSuccess: () => {
      reset();
      setIsSent(true);
    },
  });

  async function onSubmit(values: ReportWorkFormValues) {
    setError(undefined);

    try {
      await report.mutate({
        publicId,
        input: {
          revisionId,
          reason: values.reason,
          details: values.details.trim() || undefined,
        },
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "Не удалось отправить жалобу",
      );
    }
  }

  if (!isSessionPending && !user) {
    return (
      <Button asChild variant="ghost" className="min-h-11">
        <Link href={`${routes.auth}?next=${encodeURIComponent(routes.publicWork(publicId))}`}>
          <Flag data-icon="inline-start" />
          Войти, чтобы пожаловаться
        </Link>
      </Button>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setIsSent(false);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-11" disabled={isSessionPending}>
          <Flag data-icon="inline-start" />
          Пожаловаться
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сообщить о работе</DialogTitle>
          <DialogDescription>
            Жалоба будет передана модераторам. Автор не увидит ваши данные.
          </DialogDescription>
        </DialogHeader>
        {isSent ? (
          <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900">
            Спасибо, жалоба отправлена.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void handleSubmit(onSubmit)(event);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="report-reason">Причина</Label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="report-reason" size="lg" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COPYRIGHT">Нарушение авторских прав</SelectItem>
                      <SelectItem value="OFFICIAL_COPY">Копия официальной версии</SelectItem>
                      <SelectItem value="INAPPROPRIATE">Неприемлемый контент</SelectItem>
                      <SelectItem value="SPAM">Спам</SelectItem>
                      <SelectItem value="PERSONAL_DATA">Персональные данные</SelectItem>
                      <SelectItem value="OTHER">Другая причина</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-detail">Комментарий, необязательно</Label>
              <Textarea
                id="report-detail"
                rows={4}
                maxLength={500}
                aria-invalid={Boolean(errors.details)}
                {...register("details")}
              />
              {errors.details?.message ? (
                <p className="text-sm text-destructive">{errors.details.message}</p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={report.isPending}>
                Отправить жалобу
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

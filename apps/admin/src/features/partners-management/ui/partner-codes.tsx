"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Controller } from "react-hook-form";

import {
  useAffiliatePartnerCodes,
  type AffiliateCode,
} from "@/entities/affiliate-partners";
import { Badge, Button, Checkbox, Input, Textarea } from "@/shared/ui";

import {
  useAffiliateCodeFormState,
  useCodeListState,
  type CopyStatus,
} from "../lib";

export function PartnerCodes({ userId }: { readonly userId: string }) {
  const {
    copyCode,
    getCopyStatus,
    goToNextPage,
    goToPreviousPage,
    page,
    pageSize,
  } = useCodeListState();
  const codesQuery = useAffiliatePartnerCodes(userId, { page, pageSize });
  const totalPages = Math.max(
    1,
    Math.ceil((codesQuery.data?.total ?? 0) / pageSize),
  );

  return (
    <section className="min-w-0 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Коды партнёра</h2>
        {codesQuery.isFetching && !codesQuery.isPending ? (
          <Badge variant="secondary">
            <LoaderCircle className="animate-spin motion-reduce:animate-none" />
            Обновляем
          </Badge>
        ) : null}
      </div>

      {codesQuery.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Загружаем коды…</p>
      ) : codesQuery.isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="alert">
          <p className="text-sm text-destructive">Не удалось загрузить коды.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void codesQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Повторить
          </Button>
        </div>
      ) : codesQuery.data?.items.length ? (
        <div className="mt-3 grid min-w-0 gap-3">
          {codesQuery.data.items.map((code) => (
            <AffiliateCodeForm
              code={code}
              key={`${code.id}-${code.updatedAt}`}
              onCopy={() => void copyCode(code)}
              copyStatus={getCopyStatus(code.id)}
              userId={userId}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Кодов пока нет.</p>
      )}

      {codesQuery.data && totalPages > 1 ? (
        <nav
          aria-label="Пагинация кодов партнёра"
          className="mt-3 flex items-center justify-between gap-2"
        >
          <Button
            disabled={page <= 1 || codesQuery.isFetching}
            onClick={goToPreviousPage}
            size="sm"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
            Назад
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} из {totalPages}
          </span>
          <Button
            disabled={page >= totalPages || codesQuery.isFetching}
            onClick={goToNextPage}
            size="sm"
            variant="outline"
          >
            Далее
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

function AffiliateCodeForm({
  code,
  copyStatus,
  onCopy,
  userId,
}: {
  readonly code: AffiliateCode;
  readonly copyStatus: CopyStatus | null;
  readonly onCopy: () => void;
  readonly userId: string;
}) {
  const { buyerPreview, error, form, isPending, submit } =
    useAffiliateCodeFormState({ code, userId });

  return (
    <form className="min-w-0 rounded-lg border p-3" onSubmit={submit}>
      <fieldset className="min-w-0 space-y-3" disabled={isPending}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-all font-mono font-semibold">{code.code}</p>
            <p className="text-xs text-muted-foreground">
              Создан {new Date(code.createdAt).toLocaleDateString("ru-RU")}
            </p>
          </div>
          <Button
            aria-label={`Скопировать код ${code.code}`}
            onClick={onCopy}
            size="sm"
            type="button"
            variant="outline"
          >
            {copyStatus === "success" ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copyStatus === "success" ? "Скопировано" : "Скопировать код"}
          </Button>
        </div>
        <p
          aria-live="polite"
          className={
            copyStatus === "error"
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {copyStatus === "success"
            ? "Код скопирован."
            : copyStatus === "error"
              ? "Не удалось скопировать. Выделите код и скопируйте вручную."
              : ""}
        </p>

        <label className="grid min-w-0 gap-1.5 text-sm font-medium">
          Комментарий
          <Textarea
            className="min-h-20 min-w-0 whitespace-pre-wrap break-words"
            placeholder="Необязательно"
            {...form.register("comment")}
          />
          {form.formState.errors.comment?.message ? (
            <span className="text-xs text-destructive">
              {form.formState.errors.comment.message}
            </span>
          ) : null}
        </label>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Доля партнёра, %
            <Input
              aria-invalid={Boolean(form.formState.errors.partnerPercent)}
              inputMode="numeric"
              max={15}
              min={0}
              step={1}
              type="number"
              {...form.register("partnerPercent", { valueAsNumber: true })}
            />
            {form.formState.errors.partnerPercent?.message ? (
              <span className="text-xs text-destructive">
                {form.formState.errors.partnerPercent.message}
              </span>
            ) : null}
          </label>
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Доля покупателя</span>
            <strong className="mt-1 block text-lg">{buyerPreview}</strong>
          </div>
        </div>

        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={field.value}
                name={field.name}
                onBlur={field.onBlur}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                ref={field.ref}
              />
              Промокод активен
            </label>
          )}
        />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button disabled={isPending} size="sm" type="submit">
            {isPending ? "Сохраняем…" : "Сохранить код"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

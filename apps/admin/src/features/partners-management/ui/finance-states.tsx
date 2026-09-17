import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/shared/ui";

export function FinancePagination({
  currentPage,
  label,
  onPageChange,
  totalPages,
}: {
  readonly currentPage: number;
  readonly label: string;
  readonly onPageChange: (page: number) => void;
  readonly totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-2 pt-1"
    >
      <Button
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        size="sm"
        variant="outline"
      >
        <ChevronLeft aria-hidden="true" /> Назад
      </Button>
      <span className="text-xs text-muted-foreground">
        {currentPage} из {totalPages}
      </span>
      <Button
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        size="sm"
        variant="outline"
      >
        Далее <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

export function FinanceLoading({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
      <LoaderCircle
        className="size-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function FinanceError({
  label,
  onRetry,
}: {
  readonly label: string;
  readonly onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 p-3"
      role="alert"
    >
      <p className="text-sm text-destructive">{label}</p>
      <Button onClick={onRetry} size="sm" variant="outline">
        <RefreshCw aria-hidden="true" />
        Повторить
      </Button>
    </div>
  );
}

export function FinanceEmpty({ label }: { readonly label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      {label}
    </p>
  );
}

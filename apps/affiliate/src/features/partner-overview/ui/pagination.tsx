import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui";

type PaginationProps = {
  readonly isFetching: boolean;
  readonly label: string;
  readonly onPageChange: (page: number) => void;
  readonly page: number;
  readonly totalPages: number;
};

export function Pagination({
  isFetching,
  label,
  onPageChange,
  page,
  totalPages,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="mt-5 flex items-center justify-between gap-3"
      aria-label={label}
    >
      <Button
        disabled={page <= 1 || isFetching}
        onClick={() => onPageChange(page - 1)}
        type="button"
        variant="outline"
      >
        <ChevronLeft aria-hidden="true" />
        Назад
      </Button>
      <span className="text-sm font-bold text-muted-foreground">
        {page} из {totalPages}
      </span>
      <Button
        disabled={page >= totalPages || isFetching}
        onClick={() => onPageChange(page + 1)}
        type="button"
        variant="outline"
      >
        Дальше
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

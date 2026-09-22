"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { OrderCard, useOrdersData } from "@/entities/orders";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

export function AccountOrders({ preview = false }: { preview?: boolean }) {
  const { user } = useSession();
  if (!user) return null;
  return <Orders key={`${user.id}:${preview}`} userId={user.id} preview={preview} />;
}

function Orders({ userId, preview }: { userId: string; preview: boolean }) {
  const [page, setPage] = useState(0);
  const pageSize = preview ? 3 : 10;
  const { data, isPending, isError } = useOrdersData({
    userId,
    limit: preview ? 3 : pageSize + 1,
    offset: page * pageSize,
  });
  const hasNextPage = !isError && data.length > pageSize;
  return (
    <section className="min-w-0 space-y-5" aria-labelledby={preview ? "recent-orders" : undefined}>
      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle id="recent-orders">Последние заказы</SectionTitle>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={routes.accountOrders}>
              Все заказы
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
      <div aria-live="polite" aria-busy={isPending}>
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : isError ? (
          <DataState
            variant="error"
            className="max-w-none"
            title="Не удалось загрузить заказы"
            description="Попробуйте обновить страницу немного позже."
          />
        ) : data.length ? (
          <div className="space-y-4">
            {data.slice(0, pageSize).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <DataState
            className="max-w-none"
            title={page ? "На этой странице заказов нет" : "Заказов пока нет"}
            description={
              page
                ? "Вернитесь на предыдущую страницу."
                : "Здесь появятся ваши покупки и информация о доставке."
            }
          />
        )}
      </div>
      {!preview && (page > 0 || hasNextPage) && (
        <nav
          aria-label="Страницы заказов"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            className="min-h-11"
            disabled={page === 0 || isPending}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-4" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">Страница {page + 1}</span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!hasNextPage || isPending || isError}
            onClick={() => setPage((value) => value + 1)}
          >
            Далее
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      )}
    </section>
  );
}

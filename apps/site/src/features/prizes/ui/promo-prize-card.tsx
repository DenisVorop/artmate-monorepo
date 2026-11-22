import { Check, Copy } from "lucide-react";
import { routes } from "@/shared/constants";
import { Badge, Button, Card } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/lib/utils";
import type { PromoPrize } from "../lib/types";
import { useCopyPrizePromocode } from "../lib/use-copy-prize-promocode";
import { PrizeContestLink } from "./contest-link";

const money = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;
const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
const statuses = {
  available: "Ваш приз",
  upcoming: "Скоро",
  reserved: "В заказе",
  used: "Использован",
  expired: "Срок истёк",
  disabled: "Недоступен",
};
export function PromoPrizeCard({ prize, className }: { prize: PromoPrize; className?: string }) {
  const { copy, state } = useCopyPrizePromocode(prize.code);
  const discount =
    prize.discountPercent !== null
      ? `${prize.discountPercent.toLocaleString("ru-RU")}%`
      : money(prize.amount!);
  return (
    <Card
      className={cn(
        "grid gap-0 overflow-hidden rounded-2xl py-0 sm:grid-cols-[7rem_minmax(0,1fr)] lg:grid-cols-[9rem_minmax(0,1fr)_20rem]",
        className,
      )}
    >
      <div className="flex items-center justify-center border-b border-orange-100/70 bg-orange-50/70 px-5 py-5 sm:row-span-2 sm:border-r sm:border-b-0 lg:row-span-1">
        <span
          className={cn(
            "font-heading font-bold tracking-tight text-rose-700",
            prize.discountPercent !== null
              ? "text-4xl sm:text-3xl lg:text-4xl"
              : "text-3xl sm:text-2xl lg:text-3xl",
          )}
        >
          −{discount}
        </span>
      </div>
      <div className="min-w-0 space-y-1 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-bold sm:text-xl">Скидка на следующий заказ</h2>
          {prize.status !== "available" && (
            <Badge variant="secondary">{statuses[prize.status]}</Badge>
          )}
        </div>
        <PrizeContestLink slug={prize.contestSlug} title={prize.contestTitle} />
        <div className="space-y-1 text-sm text-stone-500">
          {prize.minSubtotal > 0 && <p>Сумма товаров от {money(prize.minSubtotal)}</p>}
          {prize.maxDiscount !== null && <p>Скидка не больше {money(prize.maxDiscount)}</p>}
          {prize.startsAt && prize.status === "upcoming" && <p>С {date(prize.startsAt)} МСК</p>}
          {prize.endsAt && <p>До {date(prize.endsAt)} МСК</p>}
          <p className="text-xs">Одно использование</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-3 border-t border-dashed px-5 py-5 sm:col-start-2 sm:px-6 sm:pt-4 lg:col-start-auto lg:border-t-0 lg:border-l lg:py-5">
        <code className="block text-center text-sm font-semibold break-all select-all">
          {prize.code}
        </code>
        {(prize.status === "available" || prize.status === "upcoming") && (
          <Button
            variant="outline"
            className="min-h-11 w-full gap-2"
            onClick={() => void copy()}
            disabled={state === "copying"}
          >
            {state === "copied" ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {state === "copied"
              ? "Скопировано"
              : state === "copying"
                ? "Копируем…"
                : "Скопировать промокод"}
          </Button>
        )}
        {prize.orderId && (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={routes.accountOrders}>Посмотреть заказ</Link>
          </Button>
        )}
        {state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Не удалось скопировать. Выделите код вручную.
          </p>
        )}
      </div>
    </Card>
  );
}

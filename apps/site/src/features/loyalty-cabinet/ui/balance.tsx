import { Sparkles } from "lucide-react";

import {
  formatLoyaltyMoney,
  formatLoyaltyPoints,
  type LoyaltyDashboard,
  type LoyaltyOverview,
} from "@/entities/loyalty";
import { Badge, Card, CardContent } from "@/shared/ui";

export function Balance({
  member,
  tier,
}: {
  member: NonNullable<LoyaltyOverview["member"]>;
  tier?: LoyaltyDashboard["tier"];
}) {
  const ready = member.status === "active" && member.historyState === "ready";
  return (
    <Card className="overflow-hidden border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <CardContent className="grid gap-7 p-6 sm:p-8 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-600">Ваш баланс</p>
          <p className="font-display text-5xl font-bold tracking-tight text-stone-900 sm:text-6xl">
            {formatLoyaltyPoints(member.wallet.balancePoints)}
          </p>
          <p className="text-sm text-stone-600">5 б = 1 ₽ · Баллы бессрочные</p>
          {ready ? (
            <p className="text-sm font-medium">
              Доступно для покупок: {formatLoyaltyPoints(member.wallet.availablePoints)}
            </p>
          ) : (
            <p className="text-sm leading-6 text-stone-600">Списание баллов пока недоступно.</p>
          )}
          {member.wallet.reservedPoints > 0 && (
            <p className="text-sm text-stone-600">
              В резерве для заказов: {formatLoyaltyPoints(member.wallet.reservedPoints)}
            </p>
          )}
        </div>
        {tier && ready && (
          <div className="space-y-3 rounded-2xl bg-white/80 p-5">
            <Badge variant="secondary">
              <Sparkles className="size-3.5" />
              Ваш уровень
            </Badge>
            <p className="text-3xl font-bold text-rose-600">{tier.ratePercent}% бонусами</p>
            <p className="text-sm leading-6 text-stone-600">
              Возвращаем баллами за завершённые покупки.
            </p>
            <p className="text-sm text-stone-600">
              Сумма покупок для уровня: {formatLoyaltyMoney(tier.spendKopecks)}
            </p>
            {tier.nextThresholdKopecks !== null && tier.nextRatePercent !== null ? (
              <p className="text-sm font-medium">
                Следующий уровень — {tier.nextRatePercent}% бонусами при сумме покупок{" "}
                {formatLoyaltyMoney(tier.nextThresholdKopecks)}.
              </p>
            ) : (
              <p className="text-sm font-medium">У вас максимальный процент бонусов.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

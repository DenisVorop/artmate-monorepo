"use client";

import { useAnalytics } from "../lib/analytics";
import { ArrowUpRight, Sparkles } from "lucide-react";
import {
  formatLoyaltyMoney,
  LoyaltyPoints,
  useLoyaltyData,
  useLoyaltyDashboard,
} from "@/entities/loyalty";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Card, CardContent, DataState, Progress } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

export function AccountClubPreview() {
  const { user } = useSession();
  if (!user) return null;
  return <MemberPreview key={user.id} userId={user.id} />;
}

function MemberPreview({ userId }: { userId: string }) {
  const analytics = useAnalytics();
  const overview = useLoyaltyData(userId, true);
  const member = overview.data?.member;
  const ready = !overview.isError && member?.status === "active" && member.historyState === "ready";
  const dashboard = useLoyaltyDashboard(userId, ready);
  const tier = dashboard.data?.tier;

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="account-club">
      <SectionTitle id="account-club">Клуб Artmate</SectionTitle>
      {overview.isPending ? (
        <Skeleton
          className="aspect-[1.7] w-full max-w-md rounded-3xl"
          aria-label="Загружаем клуб"
        />
      ) : overview.isError ? (
        <DataState
          variant="error"
          title="Клуб временно недоступен"
          description="Остальные разделы кабинета доступны. Попробуйте обновить страницу позже."
        />
      ) : (
        <div className="max-w-md space-y-4">
          <Link
            href={routes.loyalty}
            onClick={analytics.clubOpened}
            aria-label={overview.data?.enrolled ? "Мой клуб" : "Познакомиться с клубом"}
            className="group block rounded-3xl focus-visible:ring-3 focus-visible:ring-rose-400 focus-visible:ring-offset-4"
          >
            <Card className="relative isolate aspect-[1.7] min-h-56 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-100 via-orange-50 to-violet-100 py-0 text-stone-900 shadow-md ring-1 ring-rose-200/70 transition-shadow group-hover:shadow-lg">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full border-[40px] border-white/35"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -bottom-32 size-96 rounded-full border-[40px] border-rose-200/30"
              />
              <CardContent className="relative flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-heading text-xl font-bold tracking-tight">Artmate</p>
                  {ready && tier ? (
                    <div className="rounded-full border border-white/80 bg-white/60 px-3 py-2 text-sm font-semibold">
                      {tier.ratePercent}% бонусами
                    </div>
                  ) : (
                    <Sparkles className="size-6 text-rose-600" aria-hidden="true" />
                  )}
                </div>
                {!overview.data?.enrolled ? (
                  <div className="max-w-80 space-y-2">
                    <p className="text-2xl leading-tight font-semibold">Больше поводов творить</p>
                    <p className="text-sm leading-relaxed text-stone-600">
                      Копите баллы за покупки и достижения. Тратьте на новые раскраски.
                    </p>
                  </div>
                ) : !ready ? (
                  <p className="max-w-80 text-sm leading-relaxed text-stone-700" role="status">
                    {member?.status === "blocked"
                      ? "Участие в клубе приостановлено."
                      : member?.historyState === "pending"
                        ? "Собираем вашу историю для расчёта баллов клуба."
                        : "Не удалось загрузить историю клуба. Подробности доступны в разделе клуба."}
                  </p>
                ) : (
                  <div>
                    <p className="mb-2 text-sm text-stone-600">Доступно баллов</p>
                    <p className="text-4xl font-semibold tracking-tight break-words tabular-nums">
                      <LoyaltyPoints
                        points={member.wallet.availablePoints}
                        iconClassName="size-8"
                      />
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-white/70 pt-4 text-sm font-semibold">
                  <span>{overview.data?.enrolled ? "Мой клуб" : "Познакомиться с клубом"}</span>
                  <ArrowUpRight className="size-5 shrink-0" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </Link>
          {ready &&
            (dashboard.isError ? (
              <p className="text-sm text-stone-600">Уровень клуба временно недоступен.</p>
            ) : dashboard.isPending ? (
              <Skeleton className="h-10" aria-label="Загружаем уровень клуба" />
            ) : tier ? (
              <div className="space-y-2 px-1">
                {tier.nextThresholdKopecks !== null ? (
                  <>
                    <p className="text-sm text-stone-600">
                      Ещё{" "}
                      {formatLoyaltyMoney(
                        Math.max(0, tier.nextThresholdKopecks - tier.spendKopecks),
                      )}{" "}
                      покупок до {tier.nextRatePercent}% бонусами
                    </p>
                    <Progress
                      value={Math.min(100, (tier.spendKopecks / tier.nextThresholdKopecks) * 100)}
                      aria-label="Прогресс до следующего уровня клуба"
                      className="h-1.5 bg-rose-100 [&_[data-slot=progress-indicator]]:bg-rose-500"
                    />
                  </>
                ) : (
                  <p className="text-sm text-stone-600">Ваш максимальный уровень клуба</p>
                )}
              </div>
            ) : null)}
        </div>
      )}
    </section>
  );
}

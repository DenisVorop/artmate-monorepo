"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Palette } from "lucide-react";

import { loyaltyQuery, useLoyaltyDashboard, useLoyaltyData } from "@/entities/loyalty";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { Achievements } from "./achievements";
import { Balance } from "./balance";
import { Enrollment } from "./enrollment";
import { Operations } from "./operations";

export function LoyaltyCabinet() {
  const { user, isPending } = useSession();
  if (isPending)
    return (
      <div className="container py-10">
        <DataState title="Загружаем клуб" description="Проверяем ваш аккаунт." />
      </div>
    );
  if (!user)
    return (
      <section className="container space-y-5 py-10">
        <DataState
          title="Войдите в аккаунт"
          description="Баланс и достижения доступны участникам клуба после входа."
        />
        <div className="flex justify-center">
          <Button asChild className="min-h-11">
            <Link href={`${routes.auth}?next=${encodeURIComponent(routes.loyalty)}`}>Войти</Link>
          </Button>
        </div>
      </section>
    );
  return <MemberCabinet key={user.id} userId={user.id} />;
}

function MemberCabinet({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const overview = useLoyaltyData(userId, true);
  const member = overview.data?.member;
  const ready = !overview.isError && member?.status === "active" && member.historyState === "ready";
  const dashboard = useLoyaltyDashboard(userId, ready);
  const previousHistoryState = useRef(member?.historyState);
  const previousWalletRevision = useRef(member?.wallet.revision);

  useEffect(() => {
    if (
      ready &&
      (previousHistoryState.current === "pending" ||
        previousWalletRevision.current !== member?.wallet.revision)
    ) {
      void queryClient.invalidateQueries({ queryKey: loyaltyQuery.dashboard(userId).queryKey });
      void queryClient.invalidateQueries({
        queryKey: [...loyaltyQuery.userKey(userId), "operations"],
      });
    }
    previousHistoryState.current = member?.historyState;
    previousWalletRevision.current = member?.wallet.revision;
  }, [member?.historyState, member?.wallet.revision, queryClient, ready, userId]);

  useEffect(
    () => () => {
      void queryClient.cancelQueries({ queryKey: loyaltyQuery.userKey(userId) });
    },
    [queryClient, userId],
  );

  return (
    <section className="container space-y-8 py-8 md:space-y-10 md:py-12">
      <div className="space-y-5">
        <Button asChild variant="ghost" className="-ml-3 min-h-11">
          <Link href={routes.account}>
            <ArrowLeft className="size-4" />В аккаунт
          </Link>
        </Button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">
              Творчество с наградой
            </p>
            <PageTitle>Клуб Artmate</PageTitle>
            <p className="max-w-xl text-muted-foreground">
              Ваши баллы, достижения и новые поводы творить.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={routes.workshop}>
              <Palette className="size-4" />В мастерскую
            </Link>
          </Button>
        </div>
      </div>
      {overview.isPending ? (
        <DataState title="Загружаем клуб" description="Собираем данные вашего кабинета." />
      ) : overview.isError || !overview.data ? (
        <DataState
          variant="error"
          title="Клуб временно недоступен"
          description="Не удалось загрузить ваши данные. Попробуйте открыть страницу немного позже."
        />
      ) : !overview.data.enrolled ? (
        <Enrollment userId={userId} termsVersion={overview.data.termsVersion} />
      ) : member ? (
        <>
          <Balance member={member} tier={dashboard.data?.tier} />
          {member.status === "blocked" ? (
            <DataState
              title="Участие в клубе приостановлено"
              description="Ваши баллы сохранены. Если нужна помощь, свяжитесь с поддержкой Artmate."
              className="max-w-none"
            />
          ) : member.historyState === "failed" ? (
            <DataState
              variant="error"
              title="История пока недоступна"
              description="Не удалось завершить сбор истории. Ваши баллы сохранены. Попробуйте заглянуть позже или обратитесь в поддержку Artmate."
              className="max-w-none"
            />
          ) : member.historyState === "pending" ? (
            <div role="status" aria-live="polite">
              <DataState
                title="Собираем вашу историю"
                description="Учитываем ваши покупки и творчество. Баланс выше уже отражает начисленные баллы. Когда история будет готова, они станут доступны для покупок. Страница обновится автоматически."
                className="max-w-none"
              />
            </div>
          ) : (
            <>
              {dashboard.isPending ? (
                <DataState
                  title="Загружаем достижения"
                  description="Скоро здесь появится ваш прогресс."
                  className="max-w-none"
                />
              ) : dashboard.isError || !dashboard.data ? (
                <DataState
                  variant="error"
                  title="Не удалось загрузить уровень и достижения"
                  description="Баланс сохранён. Попробуйте открыть клуб позже."
                  className="max-w-none"
                />
              ) : (
                <Achievements items={dashboard.data.achievements} />
              )}
              <Operations userId={userId} />
            </>
          )}
        </>
      ) : (
        <DataState
          variant="error"
          title="Не удалось загрузить участие в клубе"
          description="Попробуйте открыть клуб позже."
        />
      )}
    </section>
  );
}

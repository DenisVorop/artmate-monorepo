"use client";

import { useAnalytics } from "../lib/analytics";
import { Settings2 } from "lucide-react";
import { getSessionUserDisplayName, useSession, useTelegramLinkStatus } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";
import { WelcomePromoCard } from "./welcome-promo-card";

export function Account() {
  const analytics = useAnalytics();
  const { user } = useSession();
  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="space-y-3">
        <p className="text-sm font-medium text-rose-600">Ваше пространство для творчества</p>
        <PageTitle className="break-words">
          {user ? getSessionUserDisplayName(user) : "Личный кабинет"}
        </PageTitle>
        <p className="text-muted-foreground">
          Творите, собирайте достижения и находите новое вдохновение.
        </p>
      </div>
      <Button asChild variant="outline" className="min-h-11 shrink-0 self-start sm:self-auto">
        <Link href={routes.accountSettings} onClick={analytics.settingsOpened}>
          <Settings2 className="size-4" />
          Настройки
        </Link>
      </Button>
    </header>
  );
}

export function AccountWelcomePromo() {
  const { user } = useSession();
  const telegram = useTelegramLinkStatus({ enabled: Boolean(user) });
  if (!user) return null;
  return (
    <WelcomePromoCard
      key={user.id}
      userId={user.id}
      isTelegramLinked={Boolean(telegram.data?.linked && telegram.data.account)}
    />
  );
}

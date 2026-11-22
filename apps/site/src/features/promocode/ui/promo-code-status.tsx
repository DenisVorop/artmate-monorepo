"use client";
import { LogIn } from "lucide-react";
import { Button } from "@/shared/ui";
import { usePromocode } from "../lib/promo-code-provider";
import { useAnalytics } from "../lib/analytics";

export function PromoCodeStatus({ id, onLogin }: { id?: string; onLogin: () => void }) {
  const promo = usePromocode(),
    analytics = useAnalytics();
  return (
    <div id={id} aria-live="polite" className="space-y-2 text-xs leading-5">
      {(promo.isHydrating || (promo.isPending && !promo.isPaused)) && (
        <p className="text-stone-500">Проверяем промокод…</p>
      )}
      {promo.isPaused && (
        <p role="status" className="text-stone-500">
          Нет сети. Подключитесь к интернету и примените промокод ещё раз.
        </p>
      )}
      {promo.isError && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive">
            {promo.error?.message && /[а-яё]/iu.test(promo.error.message)
              ? promo.error.message
              : "Не удалось проверить промокод. Попробуйте ещё раз."}
          </p>
          {promo.isGuest && promo.onLoginRequested && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                analytics.loginRequested();
                onLogin();
              }}
            >
              <LogIn aria-hidden="true" className="size-4" />
              Войти и применить
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

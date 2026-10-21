"use client";

import { useId } from "react";
import { Bell } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, DataState, Label } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";
import { useSettingsState } from "../lib/use-settings-state";

export function EmailSubscriptionSettings() {
  const switchId = useId();
  const {
    email,
    isSignedIn,
    isSessionPending,
    subscription,
    isPending,
    feedback,
    subscribe,
    revoke,
  } = useSettingsState();
  const isLoading = isSessionPending || (isSignedIn && Boolean(email) && subscription.isPending);
  const showPreference =
    isLoading ||
    (isSignedIn && Boolean(email) && !subscription.isError && Boolean(subscription.data));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5 text-rose-500" aria-hidden="true" />
          Настройки уведомлений
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showPreference ? (
          <div className="flex items-start justify-between gap-6" aria-busy={isLoading}>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={switchId} className="text-base leading-6 font-medium">
                Скидки и акции
              </Label>
              <p id={`${switchId}-description`} className="text-sm leading-6 text-muted-foreground">
                Экономьте на акциях и распродажах.
              </p>
            </div>
            {isLoading ? (
              <Skeleton
                className="mt-1 h-[18.4px] w-8 shrink-0 rounded-full"
                role="status"
                aria-label="Загружаем настройки уведомлений"
              />
            ) : (
              <Switch
                id={switchId}
                aria-describedby={`${switchId}-description`}
                checked={subscription.data!.subscribed}
                disabled={isPending || subscription.isFetching}
                onCheckedChange={(checked) => void (checked ? subscribe() : revoke())}
                className="mt-1 after:-inset-y-3.5 data-checked:bg-rose-500"
              />
            )}
          </div>
        ) : !isSignedIn || !email ? (
          <DataState
            title="Войдите в аккаунт"
            description="Подписка доступна для подтверждённой почты."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-destructive" role="alert">
              Не удалось загрузить подписку.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void subscription.retry()}
            >
              Повторить
            </Button>
          </div>
        )}
        {feedback?.error && (
          <p className="text-sm text-destructive" role="alert">
            {feedback.error}
          </p>
        )}
        {feedback?.success && (
          <p className="text-sm text-emerald-700" role="status">
            {feedback.success}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

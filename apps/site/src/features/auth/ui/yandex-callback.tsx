"use client";
import type { YandexCallbackInputDTO } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";
import { useYandexCallback } from "../lib/use-yandex-callback";
import { AuthPageShell } from "./auth-page-shell";

export function YandexCallback({ input }: { input: YandexCallbackInputDTO }) {
  const state = useYandexCallback(input);
  return (
    <main>
      <AuthPageShell className="max-w-md">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Вход через Яндекс</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p role="status" className="text-sm leading-6 text-stone-600">
              {state === "pending"
                ? "Проверяем данные аккаунта."
                : state === "ready"
                  ? "Вернитесь в окно Artmate, чтобы продолжить."
                  : "Не удалось войти. Попробуйте ещё раз."}
            </p>
            {state !== "pending" && (
              <Button
                variant="outline"
                className="min-h-11 text-stone-500 hover:text-stone-700"
                onClick={() =>
                  window.location.replace(
                    state === "ready" ? `${routes.auth}?resume=1` : routes.auth,
                  )
                }
              >
                {state === "ready" ? "Продолжить вход" : "Вернуться ко входу"}
              </Button>
            )}
          </CardContent>
        </Card>
      </AuthPageShell>
    </main>
  );
}

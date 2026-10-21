"use client";

import { useMemo } from "react";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { withAuth } from "../lib/auth-provider";
import type { AuthRouteEntry } from "../lib/auth-flow-state";
import { useRouteAuth } from "../lib/use-route-auth";
import { AuthPageShell } from "./auth-page-shell";
import { CurrentFlowView } from "./current-flow-view";

export type AuthRouteProps = {
  entry?: "login" | "activation" | "recovery" | "resume";
  token?: string;
  next?: string;
};

function BaseAuthRoute({ entry = "login", token, next }: AuthRouteProps) {
  const request = useMemo<AuthRouteEntry | undefined>(() => {
    if (entry === "activation") return token ? { type: "activation", token } : { type: "resume" };
    if (entry === "recovery" || entry === "resume") return { type: entry };
    return undefined;
  }, [entry, token]);
  const { failure, isPending, retry, coordinator, snapshot, initialStep } = useRouteAuth({
    entry: request,
    next,
  });
  return (
    <main>
      <AuthPageShell>
        {failure ? (
          <div className="w-full space-y-4 text-center">
            <h1 className="font-comfortaa text-xl font-bold">Не удалось войти</h1>
            <p className="text-sm leading-6 text-stone-500">
              {entry === "activation" && failure.code === "flow_expired"
                ? "Ссылка не действует. Запросите новую."
                : "Попробуйте ещё раз или вернитесь на сайт."}
            </p>
            <Button onClick={retry} disabled={isPending} className="min-h-11 w-full">
              {entry === "activation" ? "Войти" : "Повторить"}
            </Button>
            {entry === "activation" && (
              <Button
                asChild
                variant="outline"
                className="min-h-11 w-full text-stone-500 hover:text-stone-700"
              >
                <a href={routes.authRecovery}>Восстановить доступ</a>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              className="min-h-11 w-full text-stone-500 hover:text-stone-700"
            >
              <a href={routes.home}>На главную</a>
            </Button>
          </div>
        ) : (
          <CurrentFlowView
            coordinator={coordinator}
            snapshot={snapshot}
            initialStep={entry === "activation" ? "activation-loading" : initialStep}
            dismissible={false}
          />
        )}
      </AuthPageShell>
    </main>
  );
}

export const AuthRoute = withAuth(BaseAuthRoute, (props) => ({
  source:
    props.entry === "activation"
      ? "auth_order_activation"
      : props.entry === "recovery"
        ? "auth_recovery"
        : "auth_page",
}));

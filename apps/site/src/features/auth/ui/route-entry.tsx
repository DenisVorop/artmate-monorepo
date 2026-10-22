"use client";

import { useMemo } from "react";
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
  const { coordinator, snapshot, initialStep } = useRouteAuth({
    entry: request,
    next,
  });
  return (
    <main>
      <AuthPageShell>
        <CurrentFlowView
          coordinator={coordinator}
          snapshot={snapshot}
          initialStep={entry === "activation" ? "activation-loading" : initialStep}
          dismissible={false}
        />
      </AuthPageShell>
    </main>
  );
}

export const AuthRoute = withAuth(BaseAuthRoute, (props) => ({
  presentation: "inline",
  source:
    props.entry === "activation"
      ? "auth_order_activation"
      : props.entry === "recovery"
        ? "auth_recovery"
        : "auth_page",
}));

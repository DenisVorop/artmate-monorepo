"use client";

import { useEffect, useState } from "react";

import type { AuthFlowCoordinator } from "../lib/auth-flow-coordinator";
import type { AuthFlowSnapshot } from "../lib/auth-flow-state";
import type { AuthFlowViewProps } from "../lib/flow-view.types";
import { AuthFlowView } from "./flow/flow-view";

export function CurrentFlowView({
  snapshot,
  coordinator,
  dismissible,
  initialStep = "login",
}: {
  snapshot: AuthFlowSnapshot;
  coordinator: AuthFlowCoordinator;
  dismissible: boolean;
  initialStep?: "login" | "recovery" | "activation-loading" | "completion";
}) {
  const shared = {
    onCancel: dismissible ? () => void coordinator.cancel() : undefined,
    isPending: snapshot.pending || snapshot.step === "closed" || snapshot.step === "loading",
    error: snapshot.error ?? undefined,
  };
  const flow = snapshot.flow;

  const step =
    snapshot.step === "closed" || snapshot.step === "loading" ? initialStep : snapshot.step;
  switch (step) {
    case "activation-loading":
      return <AuthFlowView {...shared} step="activation-loading" />;
    case "login":
      return (
        <AuthFlowView
          {...shared}
          step="login"
          initialEmail={snapshot.email}
          emailCodeConfirmed={snapshot.emailConfirmation === "confirmed"}
          onLogin={(values) => void coordinator.login(values)}
          onSignup={() => void coordinator.showEmail()}
          onRecovery={() => void coordinator.showRecovery()}
          onYandex={() => void coordinator.startYandex()}
        />
      );
    case "provider":
      return (
        <AuthFlowView {...shared} step="provider" onLogin={() => void coordinator.showLogin()} />
      );
    case "email":
      return (
        <AuthFlowView
          {...shared}
          step="email"
          initialEmail={snapshot.email}
          confirmExistingEmail={snapshot.emailConfirmation === "required"}
          onEmail={(values) => void coordinator.requestCode(values)}
          onLogin={() => void coordinator.showLogin()}
          onYandex={() => void coordinator.startYandex()}
        />
      );
    case "code":
      if (flow?.status !== "PENDING" || flow.nextStep !== "code") break;
      return (
        <CodeCountdownView
          {...shared}
          step="code"
          email={flow.emailMasked}
          resendAvailableAt={flow.resendAvailableAt}
          onCode={(values) => void coordinator.confirmCode(values)}
          onBack={() =>
            void (snapshot.emailConfirmation === "required"
              ? coordinator.showLogin()
              : coordinator.showEmail())
          }
          backLabel={
            snapshot.emailConfirmation === "required" ? "Ко входу" : undefined
          }
          onResend={() => void coordinator.resendCode()}
        />
      );
    case "registration":
      if (flow?.status !== "PENDING" || flow.nextStep !== "registration") break;
      return (
        <AuthFlowView
          {...shared}
          step="registration"
          initialProfile={{ name: flow.name ?? "", phone: flow.phone ?? "" }}
          missingFields={flow.missingFields}
          onRegistration={(values) => void coordinator.saveRegistration(values)}
        />
      );
    case "activation":
      return (
        <AuthFlowView
          {...shared}
          step="activation"
          onActivation={(values) => void coordinator.saveActivation(values)}
        />
      );
    case "profile":
      if (flow?.status !== "PENDING" || flow.nextStep !== "profile") break;
      return (
        <AuthFlowView
          {...shared}
          step="profile"
          initialProfile={{ name: flow.name ?? "", phone: flow.phone ?? "" }}
          missingFields={flow.missingFields}
          onProfile={(values) => void coordinator.saveProfile(values)}
        />
      );
    case "consents":
      if (flow?.status !== "PENDING" || flow.nextStep !== "consents") break;
      return (
        <AuthFlowView
          {...shared}
          step="consents"
          documents={flow}
          onConsents={(values) => void coordinator.submitConsents(values)}
        />
      );
    case "recovery":
      return snapshot.recoverySent ? (
        <AuthFlowView
          {...shared}
          step="recovery-sent"
          onLogin={() => void coordinator.showLogin()}
        />
      ) : (
        <AuthFlowView
          {...shared}
          step="recovery"
          initialEmail={snapshot.email}
          onRecovery={(values) => void coordinator.requestRecovery(values)}
          onLogin={() => void coordinator.showLogin()}
        />
      );
    case "success":
      return <AuthFlowView {...shared} step="success" />;
  }

  return (
    <AuthFlowView
      {...shared}
      step="completion"
      onRetry={snapshot.canRetry ? () => void coordinator.retry() : undefined}
    />
  );
}

function CodeCountdownView({
  resendAvailableAt,
  ...props
}: Omit<Extract<AuthFlowViewProps, { step: "code" }>, "resendSeconds"> & {
  resendAvailableAt: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const resendSeconds = Math.max(0, Math.ceil((Date.parse(resendAvailableAt) - now) / 1_000));
  return <AuthFlowView {...props} resendSeconds={resendSeconds} />;
}

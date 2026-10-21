"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useStartYandexFlow,
  useReadYandexFlow,
  useExchangeOrderActivation,
  useStartAuthFlow,
  useCancelAuthFlow,
  useStartPasswordFlow,
  useRequestRegistrationCode,
  useConfirmRegistrationCode,
  useResendRegistrationCode,
  useSaveRegistrationDraft,
  useSaveActivationPassword,
  useSaveProfileDraft,
  useCompleteAuthFlow,
  useResumeAuthFlow,
  useRequestAccountRecovery,
} from "../../model";
import { AuthHost } from "../../ui/auth-host";
import { AuthFlowCoordinator } from "../auth-flow-coordinator";
import { createSignupAttempt, useAnalytics } from "../analytics";
import { YandexPopup } from "../yandex-popup";
import { publishAuthSession } from "../publish-auth-session";
import { AuthContext } from "./auth.context";

/** Mounted only by withAuth; nested scopes share this single cookie coordinator. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const popup = useRef<ReturnType<typeof YandexPopup.open> | null>(null);
  const { mutateAsync: startYandex } = useStartYandexFlow();
  const { mutateAsync: readYandex } = useReadYandexFlow();
  const { mutateAsync: exchangeActivation } = useExchangeOrderActivation();
  useEffect(() => () => popup.current?.cancel(), []);
  const returnFocus = useRef<HTMLElement | null>(null);
  const { mutateAsync: start } = useStartAuthFlow();
  const { mutateAsync: cancel } = useCancelAuthFlow();
  const { mutateAsync: login } = useStartPasswordFlow();
  const { mutateAsync: requestCode } = useRequestRegistrationCode();
  const { mutateAsync: confirmCode } = useConfirmRegistrationCode();
  const { mutateAsync: resend } = useResendRegistrationCode();
  const { mutateAsync: saveRegistration } = useSaveRegistrationDraft();
  const { mutateAsync: saveActivation } = useSaveActivationPassword();
  const { mutateAsync: saveProfile } = useSaveProfileDraft();
  const { mutateAsync: complete } = useCompleteAuthFlow();
  const { mutateAsync: resume } = useResumeAuthFlow();
  const { mutateAsync: recovery } = useRequestAccountRecovery();
  const [coordinator] = useState(
    () =>
      new AuthFlowCoordinator({
        start: async () => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          return _required(await start());
        },
        exchangeActivation: async (input) => _required(await exchangeActivation(input)),
        yandex: () => {
          const handle = YandexPopup.open({
            start: async () => _required(await startYandex()),
            read: async (attemptId) => _required(await readYandex(attemptId)),
          });
          popup.current = handle;
          return handle.result.finally(() => {
            if (popup.current === handle) popup.current = null;
          });
        },
        cancelProvider: () => popup.current?.cancel(),
        registrationCompleted: () => analytics.signupCompleted(createSignupAttempt()),
        login: async (input) => _required(await login(input)),
        requestCode: async (input) => _required(await requestCode(input)),
        confirmCode: async (input) => _required(await confirmCode(input)),
        resend: async () => _required(await resend()),
        saveRegistration: async (input) => _required(await saveRegistration(input)),
        saveActivation: async (input) => _required(await saveActivation(input)),
        saveProfile: async (input) => _required(await saveProfile(input)),
        complete: async (input) => _required(await complete(input)),
        resume: async () => _required(await resume()),
        cancel: () => cancel(),
        recovery: (input) => recovery(input),
        publishSession: (user) => publishAuthSession(queryClient, user),
      }),
  );
  return (
    <AuthContext.Provider value={coordinator}>
      {children}
      <AuthHost coordinator={coordinator} returnFocus={returnFocus} />
    </AuthContext.Provider>
  );
}

function _required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Auth response is unavailable");
  return value;
}

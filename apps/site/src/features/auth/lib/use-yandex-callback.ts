"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type {
  YandexCallbackInputDTO,
  YandexResultDTO,
} from "@/shared/actions/auth";
import { useFinishYandexFlow } from "../model/use-finish-yandex-flow";

/** The server result stays authoritative even when COOP severs window.opener. */
export function useYandexCallback(input: YandexCallbackInputDTO) {
  const router = useRouter();
  const [initialInput] = useState(() => input);
  const [isCleaning, startCleaning] = useTransition();
  const [isPrepared, setIsPrepared] = useState(false);
  const { mutateAsync } = useFinishYandexFlow();
  const exchange = useRef(mutateAsync);
  exchange.current = mutateAsync;
  const started = useRef<Promise<YandexResultDTO | undefined> | null>(null);
  const delivered = useRef(false);
  const [state, setState] = useState<"pending" | "ready" | "error">("pending");
  const { state: providerState, code, error } = initialInput;
  useLayoutEffect(() => {
    const path = window.location.pathname;
    window.history.replaceState(null, "", path);
    // Wait for Next's clean route tree before an automatic server action can
    // attach router headers, including when the provider response is delayed.
    startCleaning(() => router.replace(path, { scroll: false }));
    setIsPrepared(true);
  }, [router, startCleaning]);
  useEffect(() => {
    if (!isPrepared || isCleaning) return;
    let mounted = true;
    // Capture provider input in this request before Next's cookie-driven RSC
    // refresh. The action itself must already run against the clean route URL.
    window.history.replaceState(null, "", window.location.pathname);
    started.current ??= exchange.current({ state: providerState, code, error });
    void started.current
      .then((result) => {
        if (!mounted || delivered.current) return;
        delivered.current = true;
        window.history.replaceState(null, "", window.location.pathname);
        if (!result || result.status === "WAITING") {
          setState("error");
          return;
        }
        const message = { type: "artmate:oauth", attemptId: result.attemptId };
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("artmate:oauth");
          channel.postMessage(message);
          channel.close();
        }
        if (window.opener && !window.opener.closed)
          window.opener.postMessage(message, window.location.origin);
        setState(result.status === "PENDING" ? "ready" : "error");
        window.close();
      })
      .catch(() => {
        if (!mounted || delivered.current) return;
        delivered.current = true;
        window.history.replaceState(null, "", window.location.pathname);
        setState("error");
      });
    return () => {
      mounted = false;
    };
  }, [providerState, code, error, isPrepared, isCleaning]);
  return state;
}

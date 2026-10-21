"use client";

import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import { routes } from "@/shared/constants";

import type { AuthFailure, AuthRouteEntry } from "./auth-flow-state";
import { AuthContext } from "./auth-provider/auth.context";
import { useAuthRequest } from "./auth-provider/use-auth-request";
import { getSafeAuthRedirectPath } from "./redirect";

/** Route ownership uses the same cancellation and captured callback contract as useAuth. */
export function useRouteAuth({ entry, next }: { entry?: AuthRouteEntry; next?: string }) {
  const router = useRouter();
  // Cookie responses may rerender the route without its cleaned query. Keep only
  // this mounted entry in memory; a document reload instead resumes its capability.
  const [initialEntry] = useState(() => entry);
  const coordinator = useContext(AuthContext)!;
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [isPrepared, setIsPrepared] = useState(false);
  const [isCleaning, startCleaning] = useTransition();
  const { onAuth, isPending } = useAuthRequest(
    {
      onSuccess: () => {
        _cleanToken();
        router.replace(getSafeAuthRedirectPath(next));
        router.refresh();
      },
      onError: (error) => setFailure(error),
    },
    initialEntry,
  );
  const snapshot = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const trigger = useRef(onAuth);
  trigger.current = onAuth;

  useLayoutEffect(() => {
    if (initialEntry?.type === "activation") {
      const cleanUrl = _cleanToken();
      // Automatic actions must wait for Next's clean history tree as well as
      // the visible URL; a delayed exchange cannot retain the original link.
      startCleaning(() => router.replace(cleanUrl, { scroll: false }));
    }
    setIsPrepared(true);
  }, [initialEntry?.type, router, startCleaning]);

  useEffect(() => {
    if (!isPrepared || isCleaning) return;
    // A deferred mount is cancelled by StrictMode's discarded first effect.
    const timer = window.setTimeout(() => {
      // Clean before the first action: Next uses the current URL when a cookie
      // response refreshes RSC. Cleaning after that response can be overwritten.
      if (initialEntry?.type === "activation") _cleanToken();
      void trigger.current();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialEntry?.type, isPrepared, isCleaning]);

  useEffect(() => {
    if (initialEntry?.type === "activation" && snapshot.flow?.status === "PENDING") {
      _cleanToken();
    }
  }, [initialEntry?.type, snapshot.flow]);

  return {
    coordinator,
    snapshot,
    initialStep:
      initialEntry?.type === "recovery"
        ? ("recovery" as const)
        : initialEntry?.type === "activation"
          ? ("activation-loading" as const)
          : initialEntry?.type === "resume"
            ? ("completion" as const)
            : ("login" as const),
    isPending: isPending || isCleaning || !isPrepared,
    failure,
    retry: () => {
      setFailure(null);
      // A cancelled/terminal activation cannot reopen its consumed link.
      if (initialEntry?.type === "activation") window.location.replace(routes.auth);
      else void onAuth();
    },
  };
}

function _cleanToken() {
  const url = new URL(window.location.href);
  const hasToken = url.searchParams.has("token");
  url.searchParams.delete("token");
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  if (hasToken) window.history.replaceState(null, "", cleanUrl);
  return cleanUrl;
}

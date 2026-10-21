"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { routes } from "@/shared/constants";
import { useUnsubscribe } from "../model/use-unsubscribe";

export function useUnsubscribeState(initialToken?: string) {
  const router = useRouter();
  // Freeze the capability for this mounted document; URL cleanup can refresh RSC props.
  const capability = useRef(
    initialToken && /^[A-Za-z0-9_-]{43}$/.test(initialToken) ? initialToken : undefined,
  );
  const [status, setStatus] = useState<"ready" | "invalid" | "unsubscribed">(
    capability.current ? "ready" : "invalid",
  );
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const submitting = useRef(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const { unsubscribe, isPending } = useUnsubscribe();

  useLayoutEffect(() => {
    window.history.replaceState(null, "", routes.unsubscribe);
    // Also replace Next's rendered search/tree; changing the address alone keeps
    // the original capability in the browser's persistent history state.
    router.replace(routes.unsubscribe, { scroll: false });
  }, [router]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (status !== "ready") titleRef.current?.focus();
  }, [status]);

  const confirm = async () => {
    const token = capability.current;
    if (!token || submitting.current || status !== "ready") return;
    submitting.current = true;
    setError(undefined);
    try {
      const result = await unsubscribe({ token });
      if (!mounted.current) return;
      capability.current = undefined;
      setStatus(result);
    } catch {
      if (mounted.current) setError("Не удалось отписаться. Попробуйте ещё раз.");
    } finally {
      submitting.current = false;
    }
  };
  return { status, error, isPending, confirm, titleRef };
}

"use client";

import { useAuth } from "@/features/auth";

export function useCartAuth() {
  const { onAuth } = useAuth();
  const onLoginRequested = async () => {
    const outcome = await onAuth();
    return outcome.status === "success" ? outcome.user.id : undefined;
  };
  return { onLoginRequested };
}

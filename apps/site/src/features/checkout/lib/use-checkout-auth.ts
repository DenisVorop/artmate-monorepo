"use client";

import { useAuth } from "@/features/auth";

export function useCheckoutAuth() {
  const { onAuth, isPending } = useAuth();
  const onLoginRequested = async () => {
    const outcome = await onAuth();
    return outcome.status === "success" ? outcome.user.id : undefined;
  };
  return { onLoginRequested, isPending };
}

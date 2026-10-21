"use client";

import { useEffect, useRef, useState } from "react";
import { useEmailSubscriptionData } from "@/entities/email-subscription";
import { useSession } from "@/entities/session";
import { useGrantSubscription } from "../model/use-grant-subscription";
import { useRevokeSubscription } from "../model/use-revoke-subscription";

export function useSettingsState() {
  const { user, isPending: isSessionPending } = useSession();
  const ownerId = user?.id ?? "";
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const mounted = useRef(true);
  const busy = useRef(false);
  const [feedback, setFeedback] = useState<{
    ownerId: string;
    error?: string;
    success?: string;
    subscribed?: boolean;
  }>();
  const subscription = useEmailSubscriptionData(ownerId, Boolean(user?.email));
  const grantMutation = useGrantSubscription();
  const revokeMutation = useRevokeSubscription();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function subscribe() {
    if (busy.current || !ownerId) return;
    busy.current = true;
    setFeedback({ ownerId });
    try {
      const current = subscription.data;
      if (!current?.grantRevisionId) {
        throw new Error("Advertising consent revision is unavailable");
      }
      const state = await grantMutation.grant({
        ownerId,
        revisionId: current.grantRevisionId,
        expectedVersion: current.version,
        expectedStateRevision: current.stateRevision,
      });
      if (mounted.current && currentOwner.current === ownerId && state.subscribed) {
        setFeedback({
          ownerId,
          success: "Подписка включена.",
          subscribed: true,
        });
      }
    } catch {
      if (mounted.current && currentOwner.current === ownerId)
        setFeedback({
          ownerId,
          error: "Не удалось включить подписку. Обновите страницу и попробуйте ещё раз.",
        });
    } finally {
      busy.current = false;
    }
  }
  async function revoke() {
    if (busy.current || !ownerId) return;
    busy.current = true;
    setFeedback({ ownerId });
    try {
      const state = await revokeMutation.revoke(ownerId);
      if (mounted.current && currentOwner.current === ownerId && !state.subscribed) {
        setFeedback({
          ownerId,
          success: "Вы отписались от рекламных писем.",
          subscribed: false,
        });
      }
    } catch {
      if (mounted.current && currentOwner.current === ownerId)
        setFeedback({
          ownerId,
          error: "Не удалось отписаться. Попробуйте ещё раз.",
        });
    } finally {
      busy.current = false;
    }
  }
  return {
    email: user?.email,
    isSignedIn: Boolean(user),
    isSessionPending,
    subscription,
    isPending: grantMutation.isPending || revokeMutation.isPending,
    feedback:
      feedback?.ownerId === ownerId &&
      (!feedback.success || feedback.subscribed === subscription.data?.subscribed)
        ? feedback
        : undefined,
    subscribe,
    revoke,
  };
}

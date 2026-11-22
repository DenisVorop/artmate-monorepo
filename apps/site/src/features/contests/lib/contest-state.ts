"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/entities/session";
import { useAuth } from "@/features/auth";
import { useQueryState } from "@/shared/lib/query-state-manager";

import type { ContestStage, ContestWork } from "./types";

export function useContestListState() {
  const [filter, setFilter] = useState<ContestStage | "all">("all");
  return { filter, setFilter };
}

export function useContestDetailsState(canParticipate: boolean) {
  const [params, { add, remove }] = useQueryState();
  const { user, isPending: isSessionPending } = useSession();
  const { onAuth, isPending: isAuthPending } = useAuth({
    onError: () => remove("participate"),
  });
  const authTrigger = useRef(onAuth);
  authTrigger.current = onAuth;
  const entryTriggerRef = useRef<HTMLElement | null>(null);
  const workTriggerRef = useRef<HTMLElement | null>(null);
  const entryRequested = canParticipate && params.participate === "1";
  const entryOpen = entryRequested && !isSessionPending && Boolean(user);
  const [selectedWork, setSelectedWork] = useState<ContestWork>();
  const [tab, setTab] = useState("works");

  useEffect(() => {
    if (!entryRequested || isSessionPending || user) return;
    const timer = window.setTimeout(() => void authTrigger.current(), 0);
    return () => window.clearTimeout(timer);
  }, [entryRequested, isSessionPending, user]);

  function setEntryOpen(open: boolean) {
    if (open && canParticipate) add("participate", "1");
    else remove("participate");
  }

  function openEntry(trigger: HTMLElement) {
    entryTriggerRef.current = trigger;
    setEntryOpen(true);
  }

  function openWork(work: ContestWork, trigger: HTMLElement) {
    workTriggerRef.current = trigger;
    setSelectedWork(work);
  }

  function entrySubmitted() {
    setEntryOpen(false);
    setTab("mine");
  }

  return {
    entryTriggerRef,
    workTriggerRef,
    openEntry,
    openWork,
    entryOpen,
    isEntryAccessPending: isSessionPending || isAuthPending,
    setEntryOpen,
    selectedWork,
    setSelectedWork,
    tab,
    setTab,
    userId: user?.id,
    entrySubmitted,
  };
}

"use client";
import { useRef, useState } from "react";
import type { ManualContestDrawInput } from "@/entities/contest-draw";
export function useResultsState() {
  const [confirmation, setConfirmation] =
    useState<ManualContestDrawInput | null>(null);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  return { confirmation, setConfirmation, publishButtonRef };
}

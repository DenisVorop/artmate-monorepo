"use client";
import { useState } from "react";

export function useCopyPrizePromocode(code: string) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  async function copy() {
    setState("copying");
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("error");
    }
  }
  return { copy, state };
}

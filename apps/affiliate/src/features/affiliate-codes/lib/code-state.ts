"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AffiliateCode } from "@/entities/affiliate-code";

import { useUpdateAffiliateCode } from "../model/use-update-affiliate-code";
import { getAffiliateCodeErrorMessage } from "./error-message";

export function useAffiliateCodeCard(code: AffiliateCode) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isPending, mutate } = useUpdateAffiliateCode();

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearCopyTimer;
  }, [clearCopyTimer]);

  const copyCode = async () => {
    setError(undefined);
    clearCopyTimer();

    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
      setError("Не удалось скопировать код. Выделите его вручную.");
    }
  };

  const toggleActive = async () => {
    setError(undefined);

    try {
      const result = await mutate({
        codeId: code.id,
        input: { isActive: !code.isActive },
      });
      if (!result.ok) {
        setError(getAffiliateCodeErrorMessage(result.error.status));
      }
    } catch {
      setError(getAffiliateCodeErrorMessage(503));
    }
  };

  const startEditing = () => {
    setError(undefined);
    setIsEditing(true);
  };

  const stopEditing = () => setIsEditing(false);

  return {
    copied,
    copyCode,
    error,
    isEditing,
    isPending,
    startEditing,
    stopEditing,
    toggleActive,
  };
}

"use client";

import { useCallback, useRef, useState } from "react";
import type { CommunityWorkSummary } from "@/entities/community-work";

export function useImagePreview() {
  const [selectedWork, setSelectedWork] = useState<CommunityWorkSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openImage = useCallback((work: CommunityWorkSummary, button: HTMLButtonElement) => {
    triggerRef.current = button;
    setSelectedWork(work);
    setIsOpen(true);
  }, []);
  return {
    selectedWork,
    isOpen,
    triggerRef,
    openImage,
    onOpenChange: setIsOpen,
  };
}

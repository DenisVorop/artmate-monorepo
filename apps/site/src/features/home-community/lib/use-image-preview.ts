"use client";

import { useRef, useState } from "react";
import type { CommunityWorkSummary } from "@/entities/community-work";

export function useImagePreview() {
  const [selectedWork, setSelectedWork] = useState<CommunityWorkSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return {
    selectedWork,
    isOpen,
    triggerRef,
    openImage(work: CommunityWorkSummary, button: HTMLButtonElement) {
      triggerRef.current = button;
      setSelectedWork(work);
      setIsOpen(true);
    },
    onOpenChange: setIsOpen,
  };
}

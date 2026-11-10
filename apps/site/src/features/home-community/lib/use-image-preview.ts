"use client";

import { useRef, useState } from "react";
import type { CommunityWorkSummary } from "@/entities/community-work";

import { useAnalytics } from "./analytics";

export function useImagePreview() {
  const analytics = useAnalytics();
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
    analytics.photoOpened(work.publicId);
      setIsOpen(true);
    },
    onOpenChange(open: boolean) {
      if (!open && isOpen && selectedWork) analytics.photoClosed(selectedWork.publicId);
      setIsOpen(open);
    },
  };
}

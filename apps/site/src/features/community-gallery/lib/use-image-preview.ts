"use client";

import { useCallback, useRef, useState } from "react";
import type { GalleryWork } from "@/entities/community-work";

import { useAnalytics } from "./analytics";

export function useImagePreview() {
  const analytics = useAnalytics();
  const [selectedWork, setSelectedWork] = useState<GalleryWork | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openImage = useCallback(
    (work: GalleryWork, button: HTMLButtonElement) => {
      triggerRef.current = button;
      setSelectedWork(work);
      analytics.photoOpened(work.publicId);
      setIsOpen(true);
    },
    [analytics],
  );
  return {
    selectedWork,
    isOpen,
    triggerRef,
    openImage,
    onOpenChange(open: boolean) {
      if (!open && isOpen && selectedWork) analytics.photoClosed(selectedWork.publicId);
      setIsOpen(open);
    },
  };
}

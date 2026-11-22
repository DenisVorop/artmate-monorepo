"use client";

import { useEffect, useRef, useState } from "react";

export function useCheckoutSubmitVisibility() {
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [isSubmitVisible, setIsSubmitVisible] = useState(true);

  useEffect(() => {
    const button = submitButtonRef.current;
    if (!button || typeof IntersectionObserver !== "function") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsSubmitVisible(entry.isIntersecting && entry.intersectionRatio >= 1);
      },
      { threshold: 1 },
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  return { submitButtonRef, isSubmitVisible };
}

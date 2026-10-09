"use client";

import { useRef, useState } from "react";

import type { ColoringVariants } from "@/entities/coloring-variants";

import { usePublishColoringVariant } from "../model/use-publish-coloring-variant";
import {
  getPublicationBlockReason,
  getPublicationError,
  publicationNeedsReload,
} from "./publication-values";

export function usePublicationState(
  state: ColoringVariants,
  target: string,
  disabled: boolean,
) {
  const { mutate, isPending } = usePublishColoringVariant(
    state.coloringId,
    target,
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const submitting = useRef(false);
  const blockReason = getPublicationBlockReason(state, target);

  const changeOpen = (value: boolean) => {
    if (submitting.current) return;
    setOpen(value);
    if (value && !needsReload) setError(null);
  };

  const publish = async () => {
    if (submitting.current || !open || disabled || blockReason || needsReload)
      return;
    submitting.current = true;
    setError(null);
    try {
      const result = await mutate({ expectedToken: state.token });
      if (result.ok) setOpen(false);
      else {
        setError(getPublicationError(result.code, result.status));
        setNeedsReload(publicationNeedsReload(result.code, result.status));
      }
    } catch {
      setError(getPublicationError());
      setNeedsReload(true);
    } finally {
      submitting.current = false;
    }
  };
  return {
    open,
    changeOpen,
    publish,
    error,
    needsReload,
    isPending,
    blockReason,
  };
}

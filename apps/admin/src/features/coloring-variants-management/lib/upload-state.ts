"use client";

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { ColoringVariants } from "@/entities/coloring-variants";
import { useMaterialSet } from "@/entities/material-sets";

import { useUploadColoringVariant } from "../model/use-upload-coloring-variant";
import { getTargetStatus } from "./publication-values";
import {
  buildUploadFormData,
  createUploadDefaults,
  createUploadSchema,
  getUploadError,
  type UploadFormValues,
} from "./form-values";

export function useUploadState(state: ColoringVariants) {
  const form = useForm<UploadFormValues>({
    defaultValues: createUploadDefaults(state),
    resolver: zodResolver(createUploadSchema(state)),
  });
  const target = useWatch({ control: form.control, name: "target" });
  const rows = useWatch({ control: form.control, name: "palette" });
  const {
    materialSet,
    isPending: isSetPending,
    isError: isSetError,
  } = useMaterialSet(target === "original" ? "" : target);
  const { mutate, isPending } = useUploadColoringVariant(state.coloringId);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [replacement, setReplacement] = useState<UploadFormValues | null>(null);
  const submitting = useRef(false);

  const selectTarget = (value: string) => {
    if (submitting.current) return;
    form.reset(createUploadDefaults(state, value));
    setError(null);
  };

  const save = async (values: UploadFormValues) => {
    if (
      submitting.current ||
      needsReload ||
      values.target !== form.getValues("target")
    )
      return;
    if (getTargetStatus(state, values.target) === "archived") {
      setError(getUploadError("VARIANT_ARCHIVED"));
      return;
    }
    if (
      values.target !== "original" &&
      (!materialSet ||
        materialSet.id !== values.target ||
        materialSet.isArchived)
    )
      return;
    if (
      values.target !== "original" &&
      values.palette.some(
        (row) =>
          row.enabled &&
          !materialSet?.colors.some(
            (color) => color.id === row.materialColorId,
          ),
      )
    ) {
      setError(getUploadError("MATERIAL_COLOR_INVALID"));
      return;
    }
    submitting.current = true;
    setError(null);
    try {
      const result = await mutate(buildUploadFormData(values));
      if (!result.ok) {
        setError(getUploadError(result.code, result.status));
        if (
          result.code === "STALE_UPLOAD" ||
          (result.status === 409 && !result.code) ||
          !result.status ||
          result.status >= 500
        )
          setNeedsReload(true);
      }
    } catch {
      setError(getUploadError());
      setNeedsReload(true);
    } finally {
      submitting.current = false;
    }
  };
  const submit = async (values: UploadFormValues) => {
    if (
      submitting.current ||
      needsReload ||
      values.target !== form.getValues("target")
    )
      return;
    if (getTargetStatus(state, values.target) === "published") {
      setReplacement(values);
      return;
    }
    await save(values);
  };
  const confirmReplacement = async () => {
    if (!replacement || submitting.current) return;
    const values = replacement;
    setReplacement(null);
    await save(values);
  };
  return {
    form,
    target,
    rows,
    materialSet,
    isSetPending,
    isSetError,
    isPending,
    error,
    needsReload,
    replacement,
    confirmReplacement,
    cancelReplacement: () => setReplacement(null),
    selectTarget,
    submit,
  };
}

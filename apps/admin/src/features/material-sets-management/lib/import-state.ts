"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  MaterialSetImportInputDTO,
  MaterialSetImportPreviewDTO,
} from "@/shared/actions/material-sets";

import { useImportMaterialSet } from "../model/use-import-material-set";
import { usePreviewMaterialSet } from "../model/use-preview-material-set";
import {
  buildImportInput,
  defaultValues,
  getImportError,
  importSchema,
  maxSourceBytes,
  type ImportFormValues,
} from "./form-values";

type CheckedPreview = {
  input: MaterialSetImportInputDTO;
  revision: number;
  result: MaterialSetImportPreviewDTO;
};

export function useImportState() {
  const form = useForm<ImportFormValues>({
    defaultValues,
    resolver: zodResolver(importSchema),
  });
  const { watch, getValues, setValue, setError, clearErrors, reset } = form;
  const [preview, setPreview] = useState<CheckedPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileReadId = useRef(0);
  const revision = useRef(0);
  const busy = useRef(false);
  const { mutate: previewImport, isPending: isPreviewPending } =
    usePreviewMaterialSet();
  const { mutate: importSet, isPending: isImportPending } =
    useImportMaterialSet();

  useEffect(() => {
    const subscription = watch(() => {
      revision.current += 1;
      setPreview(null);
      setMessage(null);
      setSuccess(null);
    });
    return () => {
      subscription.unsubscribe();
      fileReadId.current += 1;
    };
  }, [watch]);

  async function readFile(file?: File) {
    const readId = ++fileReadId.current;
    setPreview(null);
    setValue("source", "", { shouldDirty: true });
    clearErrors("source");
    if (!file) {
      setIsReadingFile(false);
      return;
    }
    if (file.size > maxSourceBytes) {
      setIsReadingFile(false);
      setError("source", { message: "Файл должен быть не больше 50 КБ" });
      return;
    }
    setIsReadingFile(true);
    try {
      const source = await file.text();
      if (readId !== fileReadId.current) return;
      setValue("source", source, { shouldDirty: true, shouldValidate: true });
    } catch {
      if (readId === fileReadId.current)
        setError("source", {
          message: "Не удалось прочитать файл. Выберите его снова.",
        });
    } finally {
      if (readId === fileReadId.current) setIsReadingFile(false);
    }
  }

  async function check(values: ImportFormValues) {
    if (busy.current || isReadingFile) return;
    const input = buildImportInput(values);
    if (JSON.stringify(input) !== JSON.stringify(buildImportInput(getValues())))
      return;
    busy.current = true;
    const checkedRevision = revision.current;
    setPreview(null);
    setMessage(null);
    setSuccess(null);
    try {
      const response = await previewImport(input);
      if (checkedRevision !== revision.current) return;
      if (!response.ok) {
        setMessage(getImportError(response.status));
        return;
      }
      setPreview({ input, revision: checkedRevision, result: response.data });
    } catch {
      if (checkedRevision === revision.current) setMessage(getImportError());
    } finally {
      busy.current = false;
    }
  }

  async function create() {
    if (busy.current || isReadingFile || !preview?.result.canImport) return;
    if (
      preview.revision !== revision.current ||
      JSON.stringify(preview.input) !==
        JSON.stringify(buildImportInput(getValues()))
    ) {
      setPreview(null);
      return;
    }
    busy.current = true;
    setMessage(null);
    try {
      const response = await importSet({
        ...preview.input,
        confirmationHash: preview.result.confirmationHash,
      });
      setPreview(null);
      if (!response.ok) {
        setMessage(getImportError(response.status));
        return;
      }
      reset(defaultValues);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(
        `Набор «${response.data.title}» добавлен. Цветов: ${response.data.colorCount}.`,
      );
    } catch {
      setPreview(null);
      setMessage(getImportError());
    } finally {
      busy.current = false;
    }
  }

  return {
    form,
    preview: preview?.result ?? null,
    message,
    success,
    fileInputRef,
    isReadingFile,
    isPreviewPending,
    isImportPending,
    readFile,
    check,
    create,
  };
}

"use client";

import { useState } from "react";

import type { AffiliateCode } from "@/entities/affiliate-partners";

export type CopyStatus = "success" | "error";

const pageSize = 20;

export function useCodeListState() {
  const [page, setPage] = useState(1);
  const [copyResult, setCopyResult] = useState<{
    codeId: string;
    status: CopyStatus;
  } | null>(null);

  const copyCode = async (code: AffiliateCode) => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopyResult({ codeId: code.id, status: "success" });
    } catch {
      setCopyResult({ codeId: code.id, status: "error" });
    }
  };

  return {
    copyCode,
    getCopyStatus: (codeId: string) =>
      copyResult?.codeId === codeId ? copyResult.status : null,
    goToNextPage: () => setPage((value) => value + 1),
    goToPreviousPage: () => setPage((value) => value - 1),
    page,
    pageSize,
  };
}

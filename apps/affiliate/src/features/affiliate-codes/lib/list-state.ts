"use client";

import { useState } from "react";

import { useAffiliateCodesData } from "@/entities/affiliate-code";

const pageSize = 20;

export function useAffiliateCodeList() {
  const [page, setPage] = useState(1);
  const query = useAffiliateCodesData(page, pageSize);
  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return {
    ...query,
    firstPage: () => setPage(1),
    nextPage: () => setPage((value) => value + 1),
    page,
    previousPage: () => setPage((value) => value - 1),
    totalPages,
  };
}

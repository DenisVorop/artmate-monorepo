"use client";

import { useCallback, useState } from "react";

import type {
  PartnerApplicationsListParams,
  PartnerApplicationStatus,
} from "@/entities/partner-applications";

import { clampPartnerApplicationsPage } from "./pagination";

export type PartnerApplicationStatusFilter = "ALL" | PartnerApplicationStatus;

const pageSize = 20;

export function usePartnerApplicationsState() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PartnerApplicationStatusFilter>("ALL");
  const params: PartnerApplicationsListParams = {
    page,
    pageSize,
    ...(status === "ALL" ? {} : { status }),
  };

  const changeStatus = (nextStatus: PartnerApplicationStatusFilter) => {
    setStatus(nextStatus);
    setPage(1);
  };
  const clampPage = useCallback((totalPages: number) => {
    setPage((currentPage) =>
      clampPartnerApplicationsPage(currentPage, totalPages),
    );
  }, []);

  return {
    clampPage,
    goToNextPage: () => setPage((currentPage) => currentPage + 1),
    goToPreviousPage: () =>
      setPage((currentPage) => Math.max(1, currentPage - 1)),
    page,
    params,
    setStatus: changeStatus,
    status,
  };
}

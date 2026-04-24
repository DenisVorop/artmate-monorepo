"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { emptyFaqSectionsData } from "@/entities/faq/model";

import { faqQuery } from "./query";

function useFaqSectionsQuery() {
  return useQuery(faqQuery.getSections());
}

export function useFaqSections() {
  const { data } = useFaqSectionsQuery();
  const faqData = data?.data ?? emptyFaqSectionsData;

  const sections = useMemo(() => faqData.items, [faqData]);

  return {
    sections,
    isError: data?.isError === true,
    isEmpty: data?.isEmpty === true,
  };
}

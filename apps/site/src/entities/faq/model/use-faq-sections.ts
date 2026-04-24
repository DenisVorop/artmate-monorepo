"use client";

import { useQuery } from "@tanstack/react-query";

import { faqQuery } from "./query";

export function useFaqSections() {
  const { data, isError } = useQuery(faqQuery.getSections());

  return { data, isError };
}

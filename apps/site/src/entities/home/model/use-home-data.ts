"use client";

import { useQuery } from "@tanstack/react-query";

import { emptyHomeData } from "@/entities/home/model";

import { homeQuery } from "./query";

export function useHomeData() {
  const { data } = useQuery(homeQuery.getData());

  return {
    homeData: data?.data ?? emptyHomeData,
    isError: data?.isError === true,
    isEmpty: data?.isEmpty === true,
  };
}

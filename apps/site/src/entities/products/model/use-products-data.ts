"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { emptyProductsData } from "@/entities/products/model";

import { productsQuery } from "./query";

export function useProductsData() {
  const { data } = useQuery(productsQuery.getData());
  const productsData = data?.data ?? emptyProductsData;

  const categories = useMemo(() => productsData.categories, [productsData]);
  const products = useMemo(() => productsData.products, [productsData]);

  return {
    categories,
    products,
    productSpecs: productsData.productSpecs,
    productHowItWorks: productsData.productHowItWorks,
    productHighlights: productsData.productHighlights,
    isError: data?.isError === true,
    isEmpty: data?.isEmpty === true,
  };
}

"use client";

import type { ComponentType } from "react";
import { CatalogProvider } from "./catalog-provider";

type WithCatalogProps = {
  initialCategoryId?: string;
};

export function withCatalog(Component: ComponentType) {
  function CatalogWithProvider({ initialCategoryId }: WithCatalogProps) {
    return (
      <CatalogProvider initialCategoryId={initialCategoryId}>
        <Component />
      </CatalogProvider>
    );
  }

  return CatalogWithProvider;
}

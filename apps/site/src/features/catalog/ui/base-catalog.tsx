"use client";

import { withCatalog } from "../lib/catalog-provider";
import { Filters } from "./filters";
import { List } from "./list";

function BaseCatalogContent() {
  return (
    <>
      <Filters />
      <List />
    </>
  );
}

export const BaseCatalog = withCatalog(BaseCatalogContent);

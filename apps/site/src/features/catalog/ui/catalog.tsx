"use client";

import { withCatalog } from "../lib/catalog-provider";
import { Filters } from "./filters";
import { List } from "./list";

function BaseCatalog() {
  return (
    <>
      <Filters />
      <List />
    </>
  );
}

export const Catalog = withCatalog(BaseCatalog);

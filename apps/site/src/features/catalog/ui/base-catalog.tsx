"use client";

import { withCatalog } from "../lib/catalog-provider";
import { Filters } from "./filters";
import { List } from "./list";
import { Toolbar } from "./toolbar";

function BaseCatalogContent() {
  return (
    <section
      className="container grid items-start gap-5 py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:py-8"
      aria-label="Каталог товаров"
    >
      <Filters />
      <div className="min-w-0">
        <Toolbar />
        <List />
      </div>
    </section>
  );
}
export const BaseCatalog = withCatalog(BaseCatalogContent);

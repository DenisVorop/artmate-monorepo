import {
  catalogLandingsQuery,
  type CatalogLandingPageResult,
  type CatalogLandingLinksResult,
} from "@/entities/catalog-landings";
import {
  getCatalogLandingPage,
  getCatalogLandingLinks,
} from "@/shared/actions/catalog-landings";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  landing?: CatalogLandingPageResult;
  catalogLandings?: CatalogLandingLinksResult;
};

export class CatalogLandingDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as CatalogLandingDataBuilder<
      TData & Record<K, V>,
      TFields
    >;
  }

  withLanding(slug: string) {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("landing", async function () {
      return setApiResultQueryData(
        catalogLandingsQuery.getDetail(slug).queryKey,
        await getCatalogLandingPage(slug),
      );
    });
  }

  withCatalogLandings() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("catalogLandings", async function () {
      return setApiResultQueryData(
        catalogLandingsQuery.getLinks().queryKey,
        await getCatalogLandingLinks(),
      );
    });
  }
}

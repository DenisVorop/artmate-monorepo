import {
  coloringCollectionsQuery,
  type ColoringCollection,
  type ColoringCollections,
} from "@/entities/coloring-collection";
import {
  getPublicColoringCollection,
  getPublicColoringCollections,
} from "@/shared/actions/coloring-collections";
import { ApiResult } from "@/shared/lib/api-result";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  collections?: ColoringCollections;
  collection?: ColoringCollection | null;
};

export class ColoringCollectionsDataBuilder<
  TData = object,
  TFields extends Fields = Fields,
> extends BaseDataBuilder<TData, TFields> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as ColoringCollectionsDataBuilder<
      TData & Record<K, V>,
      TFields
    >;
  }

  withCollections() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("collections", async function () {
      return (
        setApiResultQueryData(
          coloringCollectionsQuery.getList().queryKey,
          await getPublicColoringCollections(),
        ) ?? []
      );
    });
  }

  withCollection(slug: string) {
    const queryClient = this.queryClient;

    return this.add("collection", async function () {
      const result = ApiResult.fromDTO(await getPublicColoringCollection(slug));

      if (result.isError) {
        if (result.error?.status === 404) {
          return null;
        }

        throw result.error ?? new Error("Unknown coloring collections API error");
      }

      const collection = result.data;

      if (!collection) {
        throw new Error("Coloring collections API returned no data");
      }

      queryClient.setQueryData(coloringCollectionsQuery.getDetail(slug).queryKey, collection);

      return collection;
    });
  }
}

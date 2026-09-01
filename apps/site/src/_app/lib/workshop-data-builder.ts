import {
  workshopQuery,
  type OwnerWorkshop,
  type OwnerWorkshopCollection,
  type OwnerWorkshopColoring,
  type WorkshopMarkerColor,
  type WorkshopTool,
} from "@/entities/workshop";
import { coloringCollectionsQuery, type ColoringCollections } from "@/entities/coloring-collection";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  workshop?: OwnerWorkshop | null;
  collection?: OwnerWorkshopCollection | null;
  coloring?: OwnerWorkshopColoring | null;
  tools?: WorkshopTool[];
  markerColors?: WorkshopMarkerColor[];
  availableCollections?: ColoringCollections;
};

export class WorkshopDataBuilder<
  TData = object,
  TFields extends Fields = Fields,
> extends BaseDataBuilder<TData, TFields> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as WorkshopDataBuilder<TData & Record<K, V>, TFields>;
  }

  withWorkshop() {
    const queryClient = this.queryClient;

    return this.add("workshop", () =>
      fetchOrNull(() => queryClient.fetchQuery(workshopQuery.owner())),
    );
  }

  withCollection(slug: string) {
    const queryClient = this.queryClient;

    return this.add("collection", () =>
      fetchOrNull(() => queryClient.fetchQuery(workshopQuery.collection(slug))),
    );
  }

  withColoring(slug: string, number: number) {
    const queryClient = this.queryClient;

    return this.add("coloring", () =>
      fetchOrNull(() => queryClient.fetchQuery(workshopQuery.coloring(slug, number))),
    );
  }

  withTools() {
    const queryClient = this.queryClient;

    return this.add("tools", () => queryClient.fetchQuery(workshopQuery.tools()));
  }

  withMarkerColors() {
    const queryClient = this.queryClient;

    return this.add("markerColors", () => queryClient.fetchQuery(workshopQuery.markerColors()));
  }

  withAvailableCollections() {
    const queryClient = this.queryClient;

    return this.add("availableCollections", () =>
      queryClient.fetchQuery(coloringCollectionsQuery.getList()),
    );
  }
}

async function fetchOrNull<T>(request: () => Promise<T>) {
  try {
    return await request();
  } catch (error) {
    if (isStatusError(error, 404)) {
      return null;
    }

    throw error;
  }
}

function isStatusError(error: unknown, status: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === status
  );
}

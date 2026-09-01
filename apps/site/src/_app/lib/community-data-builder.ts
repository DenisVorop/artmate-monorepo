import {
  communityWorkQuery,
  type CommunityWorkSummary,
  type PublicCommunityWork,
  type PublicWorkshop,
} from "@/entities/community-work";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  workshop?: PublicWorkshop | null;
  work?: PublicCommunityWork | null;
  relatedWorks?: CommunityWorkSummary[];
};

export class CommunityDataBuilder<
  TData = object,
  TFields extends Fields = Fields,
> extends BaseDataBuilder<TData, TFields> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as CommunityDataBuilder<TData & Record<K, V>, TFields>;
  }

  withWorkshop(handle: string) {
    const queryClient = this.queryClient;

    return this.add("workshop", () =>
      fetchOrNull(() => queryClient.fetchQuery(communityWorkQuery.workshop(handle))),
    );
  }

  withWork(publicId: string) {
    const queryClient = this.queryClient;

    return this.add("work", () =>
      fetchOrNull(() => queryClient.fetchQuery(communityWorkQuery.work(publicId))),
    );
  }

  withRelatedWorks(slug: string, number: number) {
    const queryClient = this.queryClient;
    const query = communityWorkQuery.forColoring(slug, number);

    return this.add("relatedWorks", async () => {
      try {
        return await queryClient.fetchQuery(query);
      } catch {
        // Community content enriches the official coloring page and must never
        // make the canonical coloring unavailable when the club API is down.
        queryClient.setQueryData(query.queryKey, []);
        return [];
      }
    });
  }
}

async function fetchOrNull<T>(request: () => Promise<T>) {
  try {
    return await request();
  } catch (error) {
    if (isStatusError(error, 404) || isStatusError(error, 403)) {
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

import type { SessionResult } from "@/entities/session";
import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  session?: SessionResult;
};

export class LayoutDataBuilder<
  TData = object,
  TFields extends Fields = Fields,
> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as LayoutDataBuilder<TData & Record<K, V>, TFields>;
  }

  withSession() {
    return this.add("session", async function () {
      const result = ApiResult.fromDTO(await getAuthSession());

      if (result.isError) {
        return undefined;
      }

      return result.data ?? null;
    });
  }
}

import { contestsQuery, type Contest } from "@/entities/contest";
import { getContest, getContests } from "@/shared/actions/contests";
import type { TaskFn } from "../types/data-builder";
import { BaseDataBuilder } from "./base-data-builder";
type Fields = { contest?: Contest | null; contests?: Contest[] | null };
export class ContestsDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as ContestsDataBuilder<TData & Record<K, V>, TFields>;
  }
  withContests() {
    const set = this.setApiResultQueryData.bind(this);
    return this.add("contests", async () =>
      set(contestsQuery.list().queryKey, await getContests()),
    );
  }
  withContest(slug: string) {
    const set = this.setApiResultQueryData.bind(this);
    return this.add("contest", async () =>
      set(contestsQuery.detail(slug).queryKey, await getContest(slug)),
    );
  }
}

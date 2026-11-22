import { prizesQuery } from "@/entities/prize";
import { getMyPrize, getMyPrizes } from "@/shared/actions/prizes";
import { BaseDataBuilder } from "./base-data-builder";
export class PrizesDataBuilder extends BaseDataBuilder<
  Record<string, unknown>,
  { prizes: unknown; prize: unknown }
> {
  withList(owner: string) {
    return this.add("prizes", async () =>
      this.setApiResultQueryData(prizesQuery.list(owner).queryKey, await getMyPrizes()),
    );
  }
  withPrize(owner: string, id: string) {
    return this.add("prize", async () =>
      this.setApiResultQueryData(prizesQuery.detail(owner, id).queryKey, await getMyPrize(id)),
    );
  }
}

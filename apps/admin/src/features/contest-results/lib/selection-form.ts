import { z } from "zod";
import type {
  ContestDrawData,
  ManualContestDrawInput,
} from "@/entities/contest-draw";
export const selectionFormSchema = z.object({
  entryIds: z.array(z.string()).max(100),
});
export type SelectionFormValues = z.infer<typeof selectionFormSchema>;
export function rankedSelectionGroups(
  prizes: ContestDrawData["contest"]["prizes"],
  eligibleCount: number,
) {
  let offset = 0;
  return prizes.flatMap((prize) => {
    const count = Math.min(prize.winnersCount ?? 1, eligibleCount - offset);
    if (count <= 0) return [];
    const slots = Array.from({ length: count }, (_, index) => offset + index);
    offset += count;
    return [{ ...prize, slots }];
  });
}

export function toSelectionInput(
  values: SelectionFormValues,
  data: ContestDrawData,
): ManualContestDrawInput {
  if (!data.rosterToken) throw new Error("Обновите список участников");
  const count = Math.min(data.contest.winnersCount, data.candidates.length);
  if (
    values.entryIds.length !== count ||
    new Set(values.entryIds).size !== count ||
    values.entryIds.some(
      (id) => !data.candidates.some((candidate) => candidate.entryId === id),
    )
  )
    throw new Error(`Выберите ${count} победителей`);
  return { rosterToken: data.rosterToken, entryIds: values.entryIds };
}

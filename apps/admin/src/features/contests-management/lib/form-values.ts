import { z } from "zod";
import {
  contestAppearances,
  type ContestAppearance,
} from "@repo/ui/contest-design";
import type { Contest, ContestInput } from "@/entities/contest";

export function toMoscowInput(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
    : "";
}
export function fromMoscowInput(value: string) {
  return new Date(`${value}:00+03:00`).toISOString();
}
const date = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
      toMoscowInput(`${value}:00+03:00`) === value,
    "Укажите дату и время",
  );
const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Заполните поле")
    .max(max, `Не больше ${max} символов`);
export const contestFormSchema = z
  .object({
    title: required(160),
    slug: required(120).regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Латинские буквы, цифры и дефис между словами",
    ),
    description: required(600),
    task: required(4000),
    rules: required(30030).refine((value) => {
      const items = value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return items.length <= 30 && items.every((item) => item.length <= 1000);
    }, "Не больше 30 пунктов, каждый до 1000 символов"),
    appearance: z.custom<ContestAppearance>(
      (value) =>
        typeof value === "string" && Object.hasOwn(contestAppearances, value),
      "Выберите оформление",
    ),
    prizePromoCodeId: z.string().nullable(),
    hasAlbumPrize: z.boolean(),
    prizeAlbumQuantity: z.coerce
      .number()
      .int()
      .min(1, "Минимум один альбом")
      .max(20, "Не больше 20 альбомов"),
    prizeAlbumIds: z.array(z.string()),
    prize: required(200),
    prizeDetail: required(1000),
    winnersCount: z.coerce
      .number()
      .int("Укажите целое число")
      .min(1, "Минимум один победитель")
      .max(100, "Не больше 100 победителей"),
    selectionMode: z.enum(["AUTOMATIC", "MANUAL"]),
    manualCriteria: z.string().trim().max(4000),
    manualTieBreak: z.string().trim().max(1000),
    manualEvaluator: z.string().trim().max(300),
    opensAt: date,
    closesAt: date,
    drawAt: date,
    published: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.published && !values.hasAlbumPrize && !values.prizePromoCodeId)
      ctx.addIssue({
        code: "custom",
        path: ["prize"],
        message: "Настройте выдачу альбомов или промокода",
      });
    if (values.published && values.selectionMode === "MANUAL")
      for (const name of [
        "manualCriteria",
        "manualTieBreak",
        "manualEvaluator",
      ] as const) {
        if (!values[name])
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: "Заполните поле для публикации условий",
          });
      }
    if (
      values.hasAlbumPrize &&
      values.prizeAlbumIds.length < values.prizeAlbumQuantity
    )
      ctx.addIssue({
        code: "custom",
        path: ["prizeAlbumIds"],
        message: "Добавьте достаточно альбомов для выбора",
      });
    if (values.opensAt >= values.closesAt)
      ctx.addIssue({
        code: "custom",
        path: ["closesAt"],
        message: "Окончание приёма должно быть позже начала",
      });
    if (values.closesAt >= values.drawAt)
      ctx.addIssue({
        code: "custom",
        path: ["drawAt"],
        message: "Выбор победителей должен быть после окончания приёма",
      });
  });
export type ContestFormValues = z.infer<typeof contestFormSchema>;
export const defaultContestValues: ContestFormValues = {
  title: "",
  slug: "",
  description: "",
  task: "",
  rules: "",
  appearance: "none",
  prizePromoCodeId: null,
  hasAlbumPrize: true,
  prizeAlbumQuantity: 1,
  prizeAlbumIds: [],
  prize: "",
  prizeDetail: "",
  winnersCount: 1,
  selectionMode: "AUTOMATIC",
  manualCriteria: "",
  manualTieBreak: "",
  manualEvaluator: "",
  opensAt: "",
  closesAt: "",
  drawAt: "",
  published: false,
};
export function toContestForm(contest: Contest): ContestFormValues {
  return {
    ...contest,
    manualCriteria: contest.manualCriteria,
    manualTieBreak: contest.manualTieBreak,
    manualEvaluator: contest.manualEvaluator,
    prizePromoCodeId: contest.prizePromoCodeId ?? null,
    hasAlbumPrize: contest.prizeAlbumQuantity !== null,
    prizeAlbumQuantity: contest.prizeAlbumQuantity ?? 1,
    rules: contest.rules.join("\n"),
    opensAt: toMoscowInput(contest.opensAt),
    closesAt: toMoscowInput(contest.closesAt),
    drawAt: toMoscowInput(contest.drawAt),
  };
}
export function toContestInput(
  values: ContestFormValues,
  contest?: Contest,
): ContestInput {
  const preserveDates =
    Boolean(contest?.publishedAt) ||
    Boolean(contest?.entriesCount) ||
    contest?.stage === "completed";
  const { hasAlbumPrize, ...input } = values;
  return {
    ...input,
    prizeAlbumQuantity: hasAlbumPrize ? input.prizeAlbumQuantity : null,
    prizeAlbumIds: hasAlbumPrize ? input.prizeAlbumIds : [],
    rules: values.rules
      .split("\n")
      .map((rule) => rule.trim())
      .filter(Boolean),
    opensAt: preserveDates ? contest!.opensAt : fromMoscowInput(values.opensAt),
    closesAt: preserveDates
      ? contest!.closesAt
      : fromMoscowInput(values.closesAt),
    drawAt: preserveDates ? contest!.drawAt : fromMoscowInput(values.drawAt),
  };
}
export const stageLabels = {
  draft: "Черновик",
  upcoming: "Скоро",
  open: "Приём работ",
  review: "Приём завершён",
  completed: "Итоги",
} as const;
export function formatContestTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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
export const prizePlaceSchema = z.object({
  prize: z.string().trim().max(200),
  prizeDetail: z.string().trim().max(1000),
  hasMarkerPrize: z.boolean(),
  prizeMarkerQuantity: z.coerce.number(),
  prizeMarkerIds: z.array(z.string()),
  hasAlbumPrize: z.boolean(),
  prizeAlbumQuantity: z.coerce.number(),
  prizeAlbumIds: z.array(z.string()),
  prizePromoCodeId: z.string().nullable(),
});
export function defaultPrizePlace(quantity = 1) {
  return {
    prize: `${quantity} ${quantity === 1 ? "альбом" : quantity < 5 ? "альбома" : "альбомов"} на выбор`,
    prizeDetail: "",
    hasMarkerPrize: false,
    prizeMarkerQuantity: 1,
    prizeMarkerIds: [] as string[],
    hasAlbumPrize: true,
    prizeAlbumQuantity: quantity,
    prizeAlbumIds: [] as string[],
    prizePromoCodeId: null as string | null,
  };
}
export function productPrizeTitle(value: {
  hasAlbumPrize: boolean;
  prizeAlbumQuantity: number;
  hasMarkerPrize: boolean;
  prizeMarkerQuantity: number;
}) {
  const parts: string[] = [];
  if (value.hasAlbumPrize) {
    const q = value.prizeAlbumQuantity;
    parts.push(`${q} ${q === 1 ? "альбом" : q < 5 ? "альбома" : "альбомов"}`);
  }
  if (value.hasMarkerPrize) {
    const q = value.prizeMarkerQuantity;
    parts.push(
      `${q} ${q === 1 ? "набор" : q < 5 ? "набора" : "наборов"} маркеров`,
    );
  }
  return parts.length ? `${parts.join(" и ")} на выбор` : "";
}
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
    hasMarkerPrize: z.boolean(),
    prizeMarkerQuantity: z.coerce.number(),
    prizeMarkerIds: z.array(z.string()),
    hasAlbumPrize: z.boolean(),
    prizeAlbumQuantity: z.coerce.number(),
    prizeAlbumIds: z.array(z.string()),
    prizeMode: z.enum(["EQUAL", "PLACES"]),
    prizePlaces: z.array(prizePlaceSchema).max(100),
    hasParticipationPrize: z.boolean(),
    participationPromoCodeId: z.string().nullable(),
    prize: z.string().trim().max(200),
    prizeDetail: z.string().trim().max(1000),
    winnersCount: z.coerce.number(),
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
    if (values.prizeMode === "EQUAL") {
      if (
        !Number.isInteger(values.winnersCount) ||
        values.winnersCount < 1 ||
        values.winnersCount > 100
      )
        ctx.addIssue({
          code: "custom",
          path: ["winnersCount"],
          message: "Укажите от 1 до 100 победителей",
        });
      if (
        values.hasAlbumPrize &&
        (!Number.isInteger(values.prizeAlbumQuantity) ||
          values.prizeAlbumQuantity < 1 ||
          values.prizeAlbumQuantity > 20)
      )
        ctx.addIssue({
          code: "custom",
          path: ["prizeAlbumQuantity"],
          message: "Укажите от 1 до 20 альбомов",
        });
      for (const name of ["prize", "prizeDetail"] as const)
        if (!values[name])
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: "Заполните поле",
          });
    } else {
      if (!values.prizePlaces.length)
        ctx.addIssue({
          code: "custom",
          path: ["prizePlaces"],
          message: "Добавьте призовое место",
        });
      values.prizePlaces.forEach((place, index) => {
        if (!place.prize)
          ctx.addIssue({
            code: "custom",
            path: ["prizePlaces", index, "prize"],
            message: "Укажите приз",
          });
        if (
          place.hasAlbumPrize &&
          (!Number.isInteger(place.prizeAlbumQuantity) ||
            place.prizeAlbumQuantity < 1 ||
            place.prizeAlbumQuantity > 20)
        )
          ctx.addIssue({
            code: "custom",
            path: ["prizePlaces", index, "prizeAlbumQuantity"],
            message: "Укажите от 1 до 20 альбомов",
          });
        if (
          !place.hasAlbumPrize &&
          !place.hasMarkerPrize &&
          !place.prizePromoCodeId
        )
          ctx.addIssue({
            code: "custom",
            path: ["prizePlaces", index, "prize"],
            message: "Выберите товары или промокод",
          });
        if (
          place.hasAlbumPrize &&
          new Set(place.prizeAlbumIds).size < place.prizeAlbumQuantity
        )
          ctx.addIssue({
            code: "custom",
            path: ["prizePlaces", index, "prizeAlbumIds"],
            message: "Добавьте достаточно разных альбомов для выбора",
          });
      });
    }
    const markerPrizes =
      values.prizeMode === "PLACES"
        ? values.prizePlaces.map((place, index) => ({
            value: place,
            path: ["prizePlaces", index] as (string | number)[],
          }))
        : [{ value: values, path: [] as (string | number)[] }];
    for (const { value, path } of markerPrizes) {
      if (!value.hasMarkerPrize) continue;
      if (
        !Number.isInteger(value.prizeMarkerQuantity) ||
        value.prizeMarkerQuantity < 1 ||
        value.prizeMarkerQuantity > 20
      )
        ctx.addIssue({
          code: "custom",
          path: [...path, "prizeMarkerQuantity"],
          message: "Укажите от 1 до 20 наборов",
        });
      if (new Set(value.prizeMarkerIds).size < value.prizeMarkerQuantity)
        ctx.addIssue({
          code: "custom",
          path: [...path, "prizeMarkerIds"],
          message: "Добавьте достаточно разных наборов для выбора",
        });
      if (
        value.hasAlbumPrize &&
        value.prizeMarkerIds.some((id) => value.prizeAlbumIds.includes(id))
      )
        ctx.addIssue({
          code: "custom",
          path: [...path, "prizeMarkerIds"],
          message: "Альбомы и маркеры должны быть разными товарами",
        });
    }
    if (values.hasParticipationPrize && !values.participationPromoCodeId)
      ctx.addIssue({
        code: "custom",
        path: ["participationPromoCodeId"],
        message: "Выберите промокод за участие",
      });
    if (
      values.prizeMode === "EQUAL" &&
      values.published &&
      !values.hasAlbumPrize &&
      !values.hasMarkerPrize &&
      !values.prizePromoCodeId
    )
      ctx.addIssue({
        code: "custom",
        path: ["prize"],
        message: "Выберите товары или промокод",
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
      values.prizeMode === "EQUAL" &&
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
  prizeMode: "EQUAL",
  prizePlaces: [
    defaultPrizePlace(3),
    defaultPrizePlace(2),
    defaultPrizePlace(1),
  ],
  hasParticipationPrize: false,
  participationPromoCodeId: null,
  title: "",
  slug: "",
  description: "",
  task: "",
  rules: "",
  appearance: "none",
  prizePromoCodeId: null,
  hasMarkerPrize: false,
  prizeMarkerQuantity: 1,
  prizeMarkerIds: [],
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
function prizeForm(prize: {
  prize: string;
  prizeDetail: string;
  prizeAlbumQuantity: number | null;
  prizeAlbumIds: string[];
  prizeMarkerQuantity: number | null;
  prizeMarkerIds: string[];
  prizePromoCodeId: string | null;
}) {
  return {
    ...defaultPrizePlace(),
    ...prize,
    hasAlbumPrize: prize.prizeAlbumQuantity !== null,
    prizeAlbumQuantity: prize.prizeAlbumQuantity ?? 1,
    hasMarkerPrize: prize.prizeMarkerQuantity !== null,
    prizeMarkerQuantity: prize.prizeMarkerQuantity ?? 1,
  };
}
export function toContestForm(contest: Contest): ContestFormValues {
  return {
    ...defaultContestValues,
    ...contest,
    ...prizeForm(contest),
    prizePlaces:
      contest.prizeMode === "PLACES"
        ? contest.prizePlaces.map(prizeForm)
        : defaultContestValues.prizePlaces,
    hasParticipationPrize: Boolean(contest.participationPromoCodeId),
    rules: contest.rules.join("\n"),
    opensAt: toMoscowInput(contest.opensAt),
    closesAt: toMoscowInput(contest.closesAt),
    drawAt: toMoscowInput(contest.drawAt),
  };
}
function prizeInput(values: ContestFormValues["prizePlaces"][number]) {
  return {
    prize: values.prize,
    prizeDetail: values.prizeDetail,
    prizeAlbumQuantity: values.hasAlbumPrize ? values.prizeAlbumQuantity : null,
    prizeAlbumIds: values.hasAlbumPrize ? values.prizeAlbumIds : [],
    prizeMarkerQuantity: values.hasMarkerPrize
      ? values.prizeMarkerQuantity
      : null,
    prizeMarkerIds: values.hasMarkerPrize ? values.prizeMarkerIds : [],
    prizePromoCodeId: values.prizePromoCodeId,
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
  return {
    prizeMode: values.prizeMode,
    prizePlaces:
      values.prizeMode === "PLACES" ? values.prizePlaces.map(prizeInput) : [],
    prizeMarkerQuantity:
      values.prizeMode === "EQUAL" && values.hasMarkerPrize
        ? values.prizeMarkerQuantity
        : null,
    prizeMarkerIds:
      values.prizeMode === "EQUAL" && values.hasMarkerPrize
        ? values.prizeMarkerIds
        : [],
    participationPromoCodeId: values.hasParticipationPrize
      ? values.participationPromoCodeId
      : null,
    title: values.title,
    slug: values.slug,
    description: values.description,
    task: values.task,
    appearance: values.appearance,
    prize:
      values.prizeMode === "PLACES"
        ? values.prizePlaces[0]!.prize
        : values.prize,
    prizeDetail:
      values.prizeMode === "PLACES" ? "Призы по местам" : values.prizeDetail,
    prizePromoCodeId:
      values.prizeMode === "EQUAL" ? values.prizePromoCodeId : null,
    prizeAlbumQuantity:
      values.prizeMode === "EQUAL" && values.hasAlbumPrize
        ? values.prizeAlbumQuantity
        : null,
    prizeAlbumIds:
      values.prizeMode === "EQUAL" && values.hasAlbumPrize
        ? values.prizeAlbumIds
        : [],
    winnersCount:
      values.prizeMode === "PLACES"
        ? values.prizePlaces.length
        : values.winnersCount,
    selectionMode: values.selectionMode,
    manualCriteria: values.manualCriteria,
    manualTieBreak: values.manualTieBreak,
    manualEvaluator: values.manualEvaluator,
    published: values.published,
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

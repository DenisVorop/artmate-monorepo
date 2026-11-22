export const contestAppearances = [
  "none",
  "new-year",
  "valentines",
  "womens-day",
  "easter",
  "knowledge-day",
  "halloween",
  "mothers-day",
  "artmate-birthday",
  "spring",
  "summer",
  "autumn",
  "winter",
] as const;
export type ContestAppearance = (typeof contestAppearances)[number];
export type ContestStage =
  | "draft"
  | "upcoming"
  | "open"
  | "review"
  | "completed";

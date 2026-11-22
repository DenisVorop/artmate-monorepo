export const contestAppearances = {
  none: {
    label: "Без оформления",
    card: "bg-linear-to-br from-rose-50 via-white to-orange-50 ring-orange-200/70",
    date: "bg-orange-100/60",
    number: "text-rose-700",
  },
  "new-year": {
    label: "Новый год",
    card: "bg-linear-to-br from-sky-50 via-white to-slate-50 ring-sky-200/80",
    date: "bg-sky-100/60",
    number: "text-sky-900",
  },
  valentines: {
    label: "14 февраля",
    card: "bg-linear-to-br from-rose-50 via-white to-pink-50 ring-rose-200/70",
    date: "bg-rose-100/60",
    number: "text-rose-800",
  },
  "womens-day": {
    label: "8 Марта",
    card: "bg-linear-to-br from-yellow-50 via-white to-emerald-50 ring-yellow-200/70",
    date: "bg-yellow-100/60",
    number: "text-emerald-800",
  },
  easter: {
    label: "Пасха",
    card: "bg-linear-to-br from-violet-50 via-white to-amber-50 ring-violet-200/70",
    date: "bg-violet-100/50",
    number: "text-violet-800",
  },
  "knowledge-day": {
    label: "День знаний",
    card: "bg-linear-to-br from-orange-50 via-white to-rose-50 ring-orange-200/70",
    date: "bg-orange-100/60",
    number: "text-red-900",
  },
  halloween: {
    label: "Хэллоуин",
    card: "bg-linear-to-br from-orange-50 via-white to-violet-50 ring-orange-200/80",
    date: "bg-orange-100/70",
    number: "text-violet-900",
  },
  "mothers-day": {
    label: "День матери",
    card: "bg-linear-to-br from-pink-50 via-white to-orange-50 ring-pink-200/70",
    date: "bg-pink-100/50",
    number: "text-rose-800",
  },
  "artmate-birthday": {
    label: "День рождения Artmate",
    card: "bg-linear-to-br from-rose-50 via-white to-orange-50 ring-rose-200/70",
    date: "bg-rose-100/60",
    number: "text-rose-700",
  },
  spring: {
    label: "Весна",
    card: "bg-linear-to-br from-lime-50 via-white to-rose-50 ring-lime-200/70",
    date: "bg-lime-100/50",
    number: "text-emerald-800",
  },
  summer: {
    label: "Лето",
    card: "bg-linear-to-br from-amber-50 via-white to-sky-50 ring-amber-200/70",
    date: "bg-amber-100/60",
    number: "text-sky-800",
  },
  autumn: {
    label: "Осень",
    card: "bg-linear-to-br from-amber-50 via-white to-orange-50 ring-amber-200/80",
    date: "bg-amber-100/60",
    number: "text-orange-800",
  },
  winter: {
    label: "Зима",
    card: "bg-linear-to-br from-sky-50 via-white to-slate-50 ring-sky-200/80",
    date: "bg-sky-100/60",
    number: "text-sky-900",
  },
} as const;

export type ContestAppearance = keyof typeof contestAppearances;

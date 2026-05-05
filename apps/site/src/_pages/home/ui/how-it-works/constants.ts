import { BookOpen, Brush, Smile, type LucideIcon } from "lucide-react";
import { routes } from "@/shared/constants";

export type StepTone = "rose" | "amber" | "violet";
export type StepIcon = "book-open" | "brush" | "smile";

export type HowItWorksStep = {
  num: string;
  icon: StepIcon;
  title: string;
  desc: string;
  chips: string[];
  tone: StepTone;
  href: string;
  cta: string;
};

export const stepIcons = {
  "book-open": BookOpen,
  brush: Brush,
  smile: Smile,
} satisfies Record<StepIcon, LucideIcon>;

export const howItWorksSteps = [
  {
    num: "01",
    icon: "book-open",
    title: "Выберите раскраску",
    desc: "Выберите тематику под\u00a0настроение — от\u00a0уютных сюжетов до\u00a0детализированных пейзажей.",
    chips: ["25 иллюстраций", "Формат A4", "Металлическая пружина"],
    tone: "rose",
    href: routes.catalog,
    cta: "В\u00a0каталог",
  },
  {
    num: "02",
    icon: "brush",
    title: "Раскрашивайте по\u00a0номерам",
    desc: "Каждая зона уже продумана — просто подбирайте оттенки и\u00a0заполняйте рисунок шаг за\u00a0шагом.",
    chips: ["Плотная бумага 190 г/м²", "Подходит для\u00a0маркеров", "Чёткие контуры"],
    tone: "amber",
    href: routes.catalog,
    cta: "Смотреть",
  },
  {
    num: "03",
    icon: "smile",
    title: "Наслаждайтесь процессом",
    desc: "Расслабьтесь, отвлекитесь от\u00a0суеты и\u00a0создайте работу, которая будет радовать вас каждый день.",
    chips: ["Антистресс", "Творческий отдых", "Уникальный результат"],
    tone: "violet",
    href: routes.catalog,
    cta: "В\u00a0каталог",
  },
] satisfies HowItWorksStep[];

type StepTones = {
  accent: string;
  badge: string;
  icon: string;
  num: string;
};

export const stepTones = {
  rose: {
    accent: "from-rose-400 to-pink-500",
    badge: "bg-rose-100 text-rose-600",
    icon: "bg-rose-500 text-white",
    num: "text-rose-100",
  },
  amber: {
    accent: "from-amber-400 to-orange-400",
    badge: "bg-amber-100 text-amber-700 ",
    icon: "bg-amber-500 text-white",
    num: "text-amber-100",
  },
  violet: {
    accent: "from-violet-400 to-purple-500",
    badge: "bg-violet-100 text-violet-700",
    icon: "bg-violet-500 text-white",
    num: "text-violet-100",
  },
} satisfies Record<StepTone, StepTones>;

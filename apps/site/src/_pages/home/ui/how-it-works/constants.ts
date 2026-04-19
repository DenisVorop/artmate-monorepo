import { routes } from "@/shared";
import { BookOpen, Brush, Smile, type LucideIcon } from "lucide-react";

export type StepTone = "rose" | "amber" | "violet";

export type HowItWorksStep = {
  num: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  chips: string[];
  tone: StepTone;
  href: string;
  cta: string;
};

export const steps = [
  {
    num: "01",
    icon: BookOpen,
    title: "Выберите раскраску",
    desc: "Выберите тематику под настроение — от уютных сюжетов до детализированных пейзажей.",
    chips: ["25 иллюстраций", "Формат A4", "Металлическая пружина"],
    tone: "rose",
    href: routes.catalog,
    cta: "В каталог",
  },
  {
    num: "02",
    icon: Brush,
    title: "Раскрашивайте по номерам",
    desc: "Каждая зона уже продумана — просто подбирайте оттенки и заполняйте рисунок шаг за шагом.",
    chips: ["Плотная бумага 190 г/м²", "Подходит для маркеров", "Чёткие контуры"],
    tone: "amber",
    href: routes.catalog,
    cta: "Смотреть",
  },
  {
    num: "03",
    icon: Smile,
    title: "Наслаждайтесь процессом",
    desc: "Расслабьтесь, отвлекитесь от суеты и создайте работу, которая будет радовать вас каждый день.",
    chips: ["Антистресс", "Творческий отдых", "Уникальный результат"],
    tone: "violet",
    href: routes.gallery,
    cta: "Галерея",
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

import { BookOpen, Brush, Smile, type LucideIcon } from "lucide-react";

export type StepTone = "rose" | "amber" | "violet";
export type StepIcon = "book-open" | "brush" | "smile";

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

export const stepIcons = {
  "book-open": BookOpen,
  brush: Brush,
  smile: Smile,
} satisfies Record<StepIcon, LucideIcon>;

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

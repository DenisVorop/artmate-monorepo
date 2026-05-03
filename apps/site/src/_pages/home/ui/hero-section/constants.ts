import FlowersCover from "./assets/flowers-cover.png";

export type HeroMetrics = {
  ratingLabel: string;
  paintedCountLabel: string;
  progressValue: number;
};

export const heroMetrics = {
  ratingLabel: "4.95 из 5",
  paintedCountLabel: "33 000+ человек",
  progressValue: 80,
} satisfies HeroMetrics;

export const heroImages = {
  workspace: {
    src: FlowersCover,
    alt: "Рабочее место художника",
  },
  hands: {
    src: FlowersCover,
    alt: "Акварельная живопись",
  },
  mandala: {
    src: FlowersCover,
    alt: "Мандала",
  },
} as const;

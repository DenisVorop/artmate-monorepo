import FoodCover from "./assets/food.webp";
import LandscapesCover from "./assets/landscapes-2.webp";
import FantasyCover from "./assets/fantasy.webp";

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
  middle: {
    src: FantasyCover,
    alt: "Обложка тематики 'Фэнтези'",
  },
  right: {
    src: FoodCover,
    alt: "Обложка тематики 'Еда'",
  },
  left: {
    src: LandscapesCover,
    alt: "Обложка тематики 'Пейзажи-2'",
  },
} as const;

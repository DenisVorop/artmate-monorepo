import type { HomeData } from "@/shared/actions/home";

export type {
  HomeData,
  HomeHeroMetrics,
  HomeHowItWorksStep,
  HomeStepIcon,
  HomeStepTone,
} from "@/shared/actions/home";

export const emptyHomeData: HomeData = {
  heroMetrics: {
    ratingLabel: "",
    paintedCountLabel: "",
    progressValue: 0,
  },
  advantages: [],
  howItWorksSteps: [],
};

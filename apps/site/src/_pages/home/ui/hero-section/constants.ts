import FlowersCover from "./assets/flowers-cover.png";

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

export const reviewAvatars = [heroImages.hands, heroImages.workspace, heroImages.mandala] as const;

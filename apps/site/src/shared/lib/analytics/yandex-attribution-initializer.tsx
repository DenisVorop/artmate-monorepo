"use client";

import { useEffect } from "react";

import { captureYandexAttribution } from "./yandex-attribution";

type YandexAttributionInitializerProps = {
  counterId: number;
};

export function YandexAttributionInitializer({ counterId }: YandexAttributionInitializerProps) {
  useEffect(() => {
    captureYandexAttribution(counterId);
  }, [counterId]);

  return null;
}

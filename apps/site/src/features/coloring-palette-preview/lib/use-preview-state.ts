"use client";

import { useState } from "react";

import { isPaletteChoice, type PaletteChoice } from "./sample";

export function usePreviewState() {
  const [palette, setPalette] = useState<PaletteChoice>("artmate");
  const [isComparing, setIsComparing] = useState(false);
  const [outlineSplit, setOutlineSplit] = useState(50);
  const [paletteSplit, setPaletteSplit] = useState(50);

  function selectPalette(value: string) {
    if (!isPaletteChoice(value)) return;
    setPalette(value);
  }

  function toggleComparison() {
    setIsComparing((current) => !current);
  }

  return {
    palette,
    selectPalette,
    isComparing,
    split: isComparing ? paletteSplit : outlineSplit,
    setSplit: isComparing ? setPaletteSplit : setOutlineSplit,
    toggleComparison,
  };
}

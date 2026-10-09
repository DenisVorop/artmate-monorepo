"use client";

import { useState } from "react";

import type { Coloring } from "@/entities/coloring-variants";

export function usePaletteState(coloring: Coloring) {
  const [paletteId, setPaletteId] = useState(coloring.defaultPaletteId);
  const [isComparing, setIsComparing] = useState(false);
  const [outlineSplit, setOutlineSplit] = useState(50);
  const [originalSplit, setOriginalSplit] = useState(50);
  const palettes = [coloring.original, ...coloring.variants];
  const palette = palettes.find(({ id }) => id === paletteId) ?? coloring.original;

  return {
    palettes,
    palette,
    selectPalette: (id: string) => {
      if (palettes.some((item) => item.id === id)) setPaletteId(id);
    },
    isComparing,
    toggleComparison: () => setIsComparing((value) => !value),
    split: isComparing ? originalSplit : outlineSplit,
    setSplit: isComparing ? setOriginalSplit : setOutlineSplit,
  };
}

export const coloringPaletteSymbols = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
] as const;

export const coloringPaletteMaxColors = coloringPaletteSymbols.length;
export const coloringPaletteSymbolPattern = /^(?:[1-9]|[A-J])$/;
export const coloringPaletteDescription =
  "JSON array of 1–19 unique marker color IDs in symbol order (1–9, A–J)";

export function getColoringPaletteSymbol(symbolPosition: number) {
  const symbol = coloringPaletteSymbols[symbolPosition - 1];

  if (!symbol) {
    throw new RangeError(
      `Unsupported palette symbol position: ${symbolPosition}`,
    );
  }

  return symbol;
}

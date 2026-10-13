// UI fixture, not an approved marker assignment. See README.md in this slice.
export const sampleColors = [
  { symbol: "1", original: "#302122", artmate: "#302122", marker: "611" },
  { symbol: "2", original: "#365046", artmate: "#365046", marker: "343" },
  { symbol: "3", original: "#556C4E", artmate: "#536444", marker: "634" },
  { symbol: "4", original: "#249637", artmate: "#249637", marker: "747" },
  { symbol: "5", original: "#B7D4E7", artmate: "#B7D4E7", marker: "537" },
  { symbol: "6", original: "#6BBFE4", artmate: "#81C8F9", marker: "298" },
  { symbol: "7", original: "#34758F", artmate: "#48A1E0", marker: "220" },
  { symbol: "8", original: "#F6F4F0", artmate: "#F6F4F0", marker: "600" },
  { symbol: "9", original: "#CFA07E", artmate: "#FFCC8B", marker: "654" },
  { symbol: "A", original: "#FFB96E", artmate: "#FFB96E", marker: "202" },
  { symbol: "B", original: "#FF8502", artmate: "#FF8402", marker: "604" },
  { symbol: "C", original: "#AC7724", artmate: "#AC7724", marker: "775" },
  { symbol: "D", original: "#B84736", artmate: "#B84736", marker: "354" },
  { symbol: "E", original: "#C90004", artmate: "#C90004", marker: "605" },
  { symbol: "F", original: "#8A2B21", artmate: "#8A2B21", marker: "759" },
  { symbol: "G", original: "#FFD805", artmate: "#FFB542", marker: "122" },
] as const;

export const sampleImages = {
  original: "/previews/coloring-palette/original.webp",
  artmate: "/previews/coloring-palette/artmate-demo.webp",
  outline: "/previews/coloring-palette/outline.webp",
};

export type PreviewPalette = {
  label: string;
  title: string;
  image: string;
  outline: string;
  totalColors?: number;
  colors: { symbol: string; original: string; hex: string; marker?: string }[];
};

// Adding a palette here connects its image pair, swatches and selector option together.
export const previewPalettes = {
  original: {
    label: "Оригинал",
    title: "Палитра оригинала",
    image: sampleImages.original,
    outline: sampleImages.outline,
    colors: sampleColors.map((color) => ({
      symbol: color.symbol,
      original: color.original,
      hex: color.original,
    })),
  },
  artmate: {
    label: "Artmate · 168 цветов",
    title: "Палитра Artmate",
    image: sampleImages.artmate,
    outline: sampleImages.outline,
    totalColors: 168,
    colors: sampleColors.map((color) => ({
      symbol: color.symbol,
      original: color.original,
      hex: color.artmate,
      marker: color.marker,
    })),
  },
} satisfies Record<string, PreviewPalette>;

export type PaletteChoice = keyof typeof previewPalettes;

export function isPaletteChoice(value: string): value is PaletteChoice {
  return Object.prototype.hasOwnProperty.call(previewPalettes, value);
}

export type OriginalPaletteColorDTO = { symbolPosition: number; hex: string };
export type ColoringVariantStatusDTO = "draft" | "published" | "archived";
export type VariantPaletteColorDTO = OriginalPaletteColorDTO & {
  materialColorId: string;
  code: string;
};

export type ColoringVariantsDTO = {
  coloringId: string;
  token: string;
  width: number | null;
  height: number | null;
  outlineUrl: string | null;
  original: null | {
    status: ColoringVariantStatusDTO;
    updatedAt: string;
    palette: OriginalPaletteColorDTO[];
    imageUrl: string;
    cardUrl: string;
  };
  variants: Array<{
    status: ColoringVariantStatusDTO;
    materialSetId: string;
    title: string;
    updatedAt: string;
    palette: VariantPaletteColorDTO[];
    imageUrl: string;
    cardUrl: string;
  }>;
};

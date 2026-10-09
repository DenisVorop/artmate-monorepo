export type MaterialKind = "MARKER" | "PENCIL" | "PAINT" | "OTHER";

export type MaterialSetSummaryDTO = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  line: string | null;
  kind: MaterialKind;
  colorCount: number;
  isArchived: boolean;
};

export type MaterialSetImportInputDTO = {
  title: string;
  slug: string;
  brand: string;
  line?: string;
  kind: MaterialKind;
  source: string;
};

export type MaterialSetDetailDTO = MaterialSetSummaryDTO & {
  colors: Array<{
    id: string;
    code: string;
    hex: string;
    name: string | null;
    pantone: string | null;
    position: number;
  }>;
};

export type MaterialSetImportPreviewDTO = {
  canImport: boolean;
  confirmationHash: string;
  colors: Array<{
    code: string;
    hex: string;
    name: string | null;
    pantone: string | null;
    position: number;
  }>;
  issues: Array<{
    row: number | null;
    field: string;
    message: string;
    severity: "error" | "warning";
  }>;
};

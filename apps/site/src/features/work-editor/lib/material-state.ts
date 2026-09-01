import type { WorkshopToolType } from "@/shared/actions/workshops";

import type { WorkEditorFormValues } from "./editor-form";

type EditorMapping = WorkEditorFormValues["mappings"][number];
type PaletteColor = { symbol: string; markerNumber: string };

export const maxWorkshopMaterials = 19;

export function canAppendWorkshopMaterial(materialCount: number) {
  return materialCount < maxWorkshopMaterials;
}

export function changeMaterialTypeAssignments(
  mappings: EditorMapping[],
  materialIndex: number,
  previousType: WorkshopToolType,
  nextType: WorkshopToolType,
  palette: PaletteColor[],
): EditorMapping[] {
  if (previousType === nextType) {
    return mappings;
  }

  return mappings.map((mapping) => {
    if (mapping.materialIndex !== materialIndex) {
      return mapping;
    }

    return {
      ...mapping,
      markerNumber:
        nextType === "ARTMATE_168"
          ? (palette.find((color) => color.symbol === mapping.symbol)?.markerNumber ?? "")
          : "",
    };
  });
}

export function removeMaterialAssignments(
  mappings: EditorMapping[],
  materialIndex: number,
): EditorMapping[] {
  return mappings.map((mapping) => {
    if (mapping.materialIndex === materialIndex) {
      return { ...mapping, materialIndex: null, markerNumber: "" };
    }

    if (mapping.materialIndex !== null && mapping.materialIndex > materialIndex) {
      return { ...mapping, materialIndex: mapping.materialIndex - 1 };
    }

    return mapping;
  });
}

export function selectMappingMaterial(
  mapping: EditorMapping,
  materialIndex: number | null,
  materialType: WorkshopToolType | undefined,
  officialMarkerNumber: string | undefined,
): EditorMapping {
  return {
    ...mapping,
    materialIndex,
    markerNumber:
      materialIndex !== null && materialType === "ARTMATE_168" ? (officialMarkerNumber ?? "") : "",
  };
}

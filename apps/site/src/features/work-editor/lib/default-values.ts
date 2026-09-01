import type { OwnerWorkshopColoring } from "@/entities/workshop";

import type { WorkEditorFormValues } from "./editor-form";

export function getEditorDefaultValues(data: OwnerWorkshopColoring): WorkEditorFormValues {
  const revision = data.work?.currentRevision;
  const materials =
    revision?.materials.map(({ type, brand, line }) => ({ type, brand, line })) ?? [];

  return {
    crop: revision?.crop ?? { rotation: 0, zoom: 1, x: 0, y: 0 },
    materials,
    mappings: data.coloring.officialRevision.palette.colors.map((color) => {
      const existingMapping = revision?.symbolMappings.find(
        (mapping) => mapping.symbol === color.symbol,
      );

      return {
        symbol: color.symbol,
        materialIndex: existingMapping ? existingMapping.materialPosition - 1 : null,
        markerNumber: existingMapping?.markerNumber ?? "",
      };
    }),
    caption: revision?.caption ?? "",
    advertisingConsent: false,
  };
}

import type { OwnerWorkshopColoring } from "@/entities/workshop";

import type { WorkEditorFormValues } from "./editor-form";

export function getEditorDefaultValues(data: OwnerWorkshopColoring): WorkEditorFormValues {
  const revision = data.work?.currentRevision;
  const material = revision?.materials[0];
  const isArtmate = !material || material.type === "ARTMATE_168";

  return {
    crop: revision?.crop ?? { rotation: 0, zoom: 1, x: 0, y: 0 },
    toolType: material?.type ?? "ARTMATE_168",
    brand: material?.brand ?? "Artmate",
    line: material?.line ?? "168",
    mappings: data.coloring.officialRevision.palette.colors.map((color) => ({
      symbol: color.symbol,
      markerNumber:
        revision?.symbolMappings.find((mapping) => mapping.symbol === color.symbol)?.markerNumber ??
        (isArtmate ? color.markerNumber : ""),
    })),
    caption: revision?.caption ?? "",
    advertisingConsent: revision?.advertisingConsent ?? false,
  };
}

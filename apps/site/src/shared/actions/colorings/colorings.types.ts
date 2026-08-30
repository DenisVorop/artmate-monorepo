import type { z } from "zod";

import type { publicColoringSchema, publicColoringsManifestSchema } from "./colorings.schemas";

export type PublicColoring = z.infer<typeof publicColoringSchema>;
export type PublicColoringManifest = z.infer<typeof publicColoringsManifestSchema>;
export type PublicColoringManifestItem = PublicColoringManifest[number];

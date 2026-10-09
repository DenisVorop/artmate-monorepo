import type { z } from "zod";

import type { publicColoringVariantsSchema } from "./coloring-variants.schemas";

export type PublicColoringVariants = z.infer<typeof publicColoringVariantsSchema>;

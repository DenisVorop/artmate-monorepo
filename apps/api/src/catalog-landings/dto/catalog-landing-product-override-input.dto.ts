import { IsIn, IsInt, IsString, MaxLength, Min } from "class-validator";

import {
  catalogLandingProductOverrideModes,
  type CatalogLandingProductOverrideMode,
} from "../catalog-landings.types";

export class CatalogLandingProductOverrideInputDTO {
  @IsString()
  @MaxLength(32)
  productId!: string;

  @IsIn(catalogLandingProductOverrideModes)
  mode!: CatalogLandingProductOverrideMode;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

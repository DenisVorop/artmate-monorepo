import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, Min, ValidateNested } from "class-validator";

import { ProductDTO } from "../../products/dto";
import {
  catalogLandingProductOverrideModes,
  type CatalogLandingProductOverrideMode,
} from "../catalog-landings.types";

export class CatalogLandingProductOverrideDTO {
  @IsString()
  productId!: string;

  @IsIn(catalogLandingProductOverrideModes)
  mode!: CatalogLandingProductOverrideMode;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ValidateNested()
  @Type(() => ProductDTO)
  product!: ProductDTO;
}
